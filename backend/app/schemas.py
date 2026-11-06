from datetime import date

from pydantic import BaseModel, Field


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
    route: str = Field(min_length=1)
    date: date
    price: float = Field(ge=0, allow_inf_nan=False)


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
