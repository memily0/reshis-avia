from datetime import date

import pandas as pd
import pytest

from backend.app.forecast import (
    DATA_DIR,
    FORECASTS,
    QUANTILES,
    ROUTES,
    calculate_forecast,
    load_data,
)


ROUTE = "MOW-AER"
DATE = date(2026, 6, 1)
BASE_PRICE = 9000.0


def test_real_csv_files_are_loaded() -> None:
    routes, forecasts = load_data(DATA_DIR)

    assert len(routes) == 5
    assert len(forecasts) == 155
    assert forecasts["date"].min() == pd.Timestamp("2026-06-01")
    assert forecasts["date"].max() == pd.Timestamp("2026-07-01")
    assert len(ROUTES) == 5
    assert len(FORECASTS) == 155


def test_demand_at_base_price_equals_median_base_demand() -> None:
    result = calculate_forecast(ROUTE, DATE, BASE_PRICE)

    assert result["demand"] == 847.0
    assert result["sales"] == 847.0
    assert result["free_seats"] == 53.0


def test_higher_price_reduces_demand() -> None:
    base_result = calculate_forecast(ROUTE, DATE, BASE_PRICE)
    higher_price_result = calculate_forecast(ROUTE, DATE, BASE_PRICE + 1000)

    assert higher_price_result["demand"] == pytest.approx(
        base_result["demand"] - 141
    )


def test_lower_price_increases_demand() -> None:
    base_result = calculate_forecast(ROUTE, DATE, BASE_PRICE)
    lower_price_result = calculate_forecast(ROUTE, DATE, BASE_PRICE - 1000)

    assert lower_price_result["demand"] == pytest.approx(
        base_result["demand"] + 141
    )


def test_sales_cannot_be_negative() -> None:
    result = calculate_forecast(ROUTE, DATE, 20_000)

    assert result["demand"] < 0
    assert result["sales"] == 0
    assert result["free_seats"] == result["flight"]["seats"]


def test_sales_cannot_exceed_capacity() -> None:
    result = calculate_forecast(ROUTE, DATE, 0)

    assert result["demand"] > result["flight"]["seats"]
    assert result["sales"] == result["flight"]["seats"]
    assert result["free_seats"] == 0


def test_all_quantiles_are_calculated_and_median_matches_demand() -> None:
    result = calculate_forecast(ROUTE, DATE, BASE_PRICE + 500)

    assert [item["quantile"] for item in result["quantiles"]] == QUANTILES
    assert len(result["quantiles"]) == 9
    for item in result["quantiles"]:
        assert item["demand"] == pytest.approx(item["base_demand"] - 0.141 * 500)

    median = next(item for item in result["quantiles"] if item["is_median"])
    assert median["demand"] == result["demand"]
