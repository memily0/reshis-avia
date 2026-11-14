import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Cookie, FastAPI, HTTPException, Request, Response, status
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from backend.app.auth import (
    SESSION_COOKIE,
    SESSION_LIFETIME,
    authenticate_user,
    cookie_is_secure,
    create_session,
    create_user,
    delete_session,
    get_user_by_session,
    initialize_database,
)
from backend.app.forecast import (
    FORECASTS,
    ROUTES,
    ForecastNotFoundError,
    RouteNotFoundError,
    calculate_forecast,
    list_dates,
    list_routes,
)
from backend.app.schemas import (
    DatesResponse,
    ForecastRequest,
    ForecastResponse,
    HealthResponse,
    LoginRequest,
    RegisterRequest,
    RoutesResponse,
    UserResponse,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    initialize_database()
    yield


app = FastAPI(
    title="Решись Авиа API",
    description="API для оценки спроса и продаж авиабилетов",
    version="0.1.0",
    lifespan=lifespan,
)

FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, error: RequestValidationError):
    if request.url.path in {"/api/auth/register", "/api/auth/login"}:
        # Ошибки Pydantic содержат исходный input, в том числе пароль.
        return JSONResponse(
            status_code=422,
            content={"detail": "Проверьте email и пароль."},
            headers={"Cache-Control": "no-store"},
        )
    return await request_validation_exception_handler(request, error)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "same-origin")
    response.headers.setdefault(
        "Permissions-Policy",
        "camera=(), microphone=(), geolocation=()",
    )
    if cookie_is_secure():
        response.headers.setdefault(
            "Strict-Transport-Security",
            "max-age=31536000; includeSubDomains",
        )
    return response


def validate_auth_origin(request: Request) -> None:
    origin = request.headers.get("origin")
    if not origin:
        return

    configured_origins = {
        item.strip().rstrip("/")
        for item in os.getenv("RESHIS_AVIA_ALLOWED_ORIGINS", "").split(",")
        if item.strip()
    }
    host = request.headers.get("host", "")
    same_origin = f"{request.url.scheme}://{host}".rstrip("/")
    allowed_origins = configured_origins or {same_origin}
    if origin.rstrip("/") not in allowed_origins:
        raise HTTPException(status_code=403, detail="Недопустимый источник запроса")


def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        max_age=int(SESSION_LIFETIME.total_seconds()),
        httponly=True,
        secure=cookie_is_secure(),
        samesite="lax",
        path="/",
    )


@app.get("/api/health", response_model=HealthResponse)
def health() -> dict:
    return {
        "status": "ok",
        "routes_loaded": len(ROUTES),
        "forecasts_loaded": len(FORECASTS),
    }


@app.get("/api/routes", response_model=RoutesResponse)
def routes() -> dict:
    return {"routes": list_routes()}


@app.get("/api/dates", response_model=DatesResponse)
def dates() -> dict:
    return {"dates": list_dates()}


@app.post("/api/forecast", response_model=ForecastResponse)
def forecast(request: ForecastRequest) -> dict:
    try:
        return calculate_forecast(request.route, request.date, request.price)
    except RouteNotFoundError:
        raise HTTPException(status_code=404, detail="Route not found") from None
    except ForecastNotFoundError:
        raise HTTPException(
            status_code=404, detail="Forecast for this route and date not found"
        ) from None


@app.post(
    "/api/auth/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(request: RegisterRequest, response: Response, http_request: Request) -> dict:
    validate_auth_origin(http_request)
    user = create_user(str(request.email), request.password)
    if user is None:
        raise HTTPException(status_code=409, detail="Аккаунт с таким email уже существует")
    set_session_cookie(response, create_session(user["id"]))
    response.headers["Cache-Control"] = "no-store"
    return user


@app.post("/api/auth/login", response_model=UserResponse)
def login(request: LoginRequest, response: Response, http_request: Request) -> dict:
    validate_auth_origin(http_request)
    user = authenticate_user(str(request.email), request.password)
    if user is None:
        raise HTTPException(status_code=401, detail="Неверный email или пароль")
    set_session_cookie(response, create_session(user["id"]))
    response.headers["Cache-Control"] = "no-store"
    return user


@app.get("/api/auth/me", response_model=UserResponse)
def current_user(response: Response, reshis_session: str | None = Cookie(default=None)) -> dict:
    user = get_user_by_session(reshis_session)
    if user is None:
        raise HTTPException(status_code=401, detail="Требуется вход в аккаунт")
    response.headers["Cache-Control"] = "no-store"
    return user


@app.get("/api/auth/session", response_model=UserResponse | None)
def current_session(
    response: Response,
    reshis_session: str | None = Cookie(default=None),
) -> dict | None:
    response.headers["Cache-Control"] = "no-store"
    return get_user_by_session(reshis_session)


@app.post("/api/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    response: Response,
    request: Request,
    reshis_session: str | None = Cookie(default=None),
) -> None:
    validate_auth_origin(request)
    delete_session(reshis_session)
    response.delete_cookie(
        key=SESSION_COOKIE,
        path="/",
        httponly=True,
        secure=cookie_is_secure(),
        samesite="lax",
    )
    response.headers["Cache-Control"] = "no-store"


if FRONTEND_DIST.is_dir():
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")
