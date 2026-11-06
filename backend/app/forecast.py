from datetime import date
from pathlib import Path

import pandas as pd


DATA_DIR = Path(__file__).resolve().parents[1] / "data"
QUANTILES = [round(value / 10, 1) for value in range(1, 10)]

ROUTE_COLUMNS = [
    "route",
    "name",
    "base_price",
    "price_sensitivity",
    "price_min",
    "price_max",
]
FORECAST_COLUMNS = [
    "route",
    "date",
    "seats",
]
FORECAST_COLUMNS += [
    f"{quantile:.1f}_base_demand" for quantile in QUANTILES
]


class RouteNotFoundError(Exception):
    pass


class ForecastNotFoundError(Exception):
    pass


def load_data(data_dir: Path = DATA_DIR) -> tuple[pd.DataFrame, pd.DataFrame]:
    routes_path = data_dir / "routes.csv"
    forecast_paths = sorted(data_dir.glob("*my_forecast.csv"))

    if len(forecast_paths) != 1:
        raise RuntimeError("Expected exactly one file ending with my_forecast.csv")

    routes = pd.read_csv(routes_path)
    forecasts = pd.read_csv(forecast_paths[0], parse_dates=["date"])

    missing_route_columns = set(ROUTE_COLUMNS) - set(routes.columns)
    missing_forecast_columns = set(FORECAST_COLUMNS) - set(forecasts.columns)
    if missing_route_columns:
        raise RuntimeError(f"Missing route columns: {sorted(missing_route_columns)}")
    if missing_forecast_columns:
        raise RuntimeError(
            f"Missing forecast columns: {sorted(missing_forecast_columns)}"
        )

    if routes["route"].duplicated().any():
        raise RuntimeError("routes.csv contains duplicate route codes")
    if forecasts.duplicated(["route", "date"]).any():
        raise RuntimeError("Forecast CSV contains duplicate route and date rows")
    if not set(forecasts["route"]).issubset(set(routes["route"])):
        raise RuntimeError("Forecast CSV contains routes absent from routes.csv")

    required_route_values = routes[ROUTE_COLUMNS]
    required_forecast_values = forecasts[FORECAST_COLUMNS]
    if required_route_values.isna().any().any():
        raise RuntimeError("routes.csv contains missing required values")
    if required_forecast_values.isna().any().any():
        raise RuntimeError("Forecast CSV contains missing required values")

    return routes, forecasts


ROUTES, FORECASTS = load_data()


def list_routes() -> list[dict]:
    result = []
    for row in ROUTES.itertuples(index=False):
        result.append(
            {
                "code": row.route,
                "name": row.name,
                "base_price": float(row.base_price),
                "price_min": float(row.price_min),
                "price_max": float(row.price_max),
            }
        )
    return result


def list_dates() -> list[date]:
    return sorted(timestamp.date() for timestamp in FORECASTS["date"].unique())


def calculate_forecast(route_code: str, flight_date: date, price: float) -> dict:
    route_rows = ROUTES[ROUTES["route"] == route_code]
    if route_rows.empty:
        raise RouteNotFoundError(route_code)

    date_value = pd.Timestamp(flight_date)
    forecast_rows = FORECASTS[
        (FORECASTS["route"] == route_code) & (FORECASTS["date"] == date_value)
    ]
    if forecast_rows.empty:
        raise ForecastNotFoundError(f"{route_code} on {flight_date.isoformat()}")

    route = route_rows.iloc[0]
    forecast = forecast_rows.iloc[0]
    price_difference = price - float(route["base_price"])
    price_sensitivity = float(route["price_sensitivity"])

    quantiles = []
    for quantile in QUANTILES:
        base_demand = float(forecast[f"{quantile:.1f}_base_demand"])
        adjusted_demand = base_demand - price_sensitivity * price_difference
        quantiles.append(
            {
                "quantile": quantile,
                "base_demand": base_demand,
                "demand": adjusted_demand,
                "is_median": quantile == 0.5,
            }
        )

    demand = next(item["demand"] for item in quantiles if item["is_median"])
    seats = int(forecast["seats"])
    sales = min(float(seats), max(0.0, demand))

    return {
        "flight": {
            "route": route_code,
            "route_name": route["name"],
            "date": flight_date,
            "seats": seats,
            "base_price": float(route["base_price"]),
            "price_min": float(route["price_min"]),
            "price_max": float(route["price_max"]),
            "price_sensitivity": price_sensitivity,
        },
        "price": price,
        "demand": demand,
        "sales": sales,
        "free_seats": seats - sales,
        "quantiles": quantiles,
    }
