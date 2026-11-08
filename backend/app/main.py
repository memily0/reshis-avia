from fastapi import Cookie, FastAPI, HTTPException, Response, status

from backend.app.auth import (
    SESSION_COOKIE,
    SESSION_LIFETIME,
    authenticate_user,
    cookie_is_secure,
    create_session,
    create_user,
    delete_session,
    get_user_by_session,
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


app = FastAPI(
    title="Решись Авиа API",
    description="API для оценки спроса и продаж авиабилетов",
    version="0.1.0",
)


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
def register(request: RegisterRequest, response: Response) -> dict:
    user = create_user(str(request.email), request.password)
    if user is None:
        raise HTTPException(status_code=409, detail="Аккаунт с таким email уже существует")
    set_session_cookie(response, create_session(user["id"]))
    return user


@app.post("/api/auth/login", response_model=UserResponse)
def login(request: LoginRequest, response: Response) -> dict:
    user = authenticate_user(str(request.email), request.password)
    if user is None:
        raise HTTPException(status_code=401, detail="Неверный email или пароль")
    set_session_cookie(response, create_session(user["id"]))
    return user


@app.get("/api/auth/me", response_model=UserResponse)
def current_user(reshis_session: str | None = Cookie(default=None)) -> dict:
    user = get_user_by_session(reshis_session)
    if user is None:
        raise HTTPException(status_code=401, detail="Требуется вход в аккаунт")
    return user


@app.post("/api/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response, reshis_session: str | None = Cookie(default=None)) -> None:
    delete_session(reshis_session)
    response.delete_cookie(
        key=SESSION_COOKIE,
        path="/",
        httponly=True,
        secure=cookie_is_secure(),
        samesite="lax",
    )
