from datetime import date, datetime

from pydantic import BaseModel, EmailStr, Field, field_validator


class RouteInfo(BaseModel):
    code: str
    name: str
    base_price: float
    price_min: float
    price_max: float


class RoutesResponse(BaseModel):
    routes: list[RouteInfo]


class DatesResponse(BaseModel):
    dates: list[date]


class ForecastRequest(BaseModel):
    route: str = Field(min_length=1, max_length=32)
    date: date
    price: float = Field(ge=0, allow_inf_nan=False)

    @field_validator("route")
    @classmethod
    def validate_route(cls, route: str) -> str:
        normalized_route = route.strip()
        if not normalized_route:
            raise ValueError("Route cannot be empty")
        return normalized_route


class FlightInfo(BaseModel):
    route: str
    route_name: str
    date: date
    seats: int
    base_price: float
    price_min: float
    price_max: float
    price_sensitivity: float


class QuantileForecast(BaseModel):
    quantile: float
    base_demand: float
    demand: float
    is_median: bool


class ForecastResponse(BaseModel):
    flight: FlightInfo
    price: float
    demand: float
    sales: float
    free_seats: float
    quantiles: list[QuantileForecast]


class HealthResponse(BaseModel):
    status: str
    routes_loaded: int
    forecasts_loaded: int


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

    @field_validator("password")
    @classmethod
    def validate_password(cls, password: str) -> str:
        if not any(character.isalpha() for character in password):
            raise ValueError("Password must contain a letter")
        if not any(character.isdigit() for character in password):
            raise ValueError("Password must contain a digit")
        return password


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class UserResponse(BaseModel):
    id: int
    email: EmailStr
    created_at: datetime
