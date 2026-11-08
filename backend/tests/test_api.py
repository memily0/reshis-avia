from fastapi.testclient import TestClient

from backend.app.main import app


client = TestClient(app)


def test_health() -> None:
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.json() == {
        "status": "ok",
        "routes_loaded": 5,
        "forecasts_loaded": 155,
    }


def test_routes_and_dates() -> None:
    routes_response = client.get("/api/routes")
    dates_response = client.get("/api/dates")

    assert routes_response.status_code == 200
    assert len(routes_response.json()["routes"]) == 5
    assert dates_response.status_code == 200
    assert len(dates_response.json()["dates"]) == 31
    assert dates_response.json()["dates"][0] == "2026-06-01"
    assert dates_response.json()["dates"][-1] == "2026-07-01"


def test_forecast_endpoint() -> None:
    response = client.post(
        "/api/forecast",
        json={"route": "MOW-AER", "date": "2026-06-01", "price": 9000},
    )

    assert response.status_code == 200
    result = response.json()
    assert result["flight"]["route"] == "MOW-AER"
    assert result["demand"] == 847.0
    assert result["sales"] == 847.0
    assert len(result["quantiles"]) == 9


def test_unknown_route_returns_404() -> None:
    response = client.post(
        "/api/forecast",
        json={"route": "UNKNOWN", "date": "2026-06-01", "price": 9000},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Route not found"


def test_unavailable_date_returns_404() -> None:
    response = client.post(
        "/api/forecast",
        json={"route": "MOW-AER", "date": "2026-08-01", "price": 9000},
    )

    assert response.status_code == 404


def test_invalid_requests_return_422() -> None:
    invalid_requests = [
        {"route": "MOW-AER", "date": "not-a-date", "price": 9000},
        {"route": "MOW-AER", "date": "2026-06-01", "price": -1},
        {"route": "   ", "date": "2026-06-01", "price": 9000},
        {"route": "X" * 33, "date": "2026-06-01", "price": 9000},
        {"route": "MOW-AER", "date": "2026-06-01"},
    ]

    for request_data in invalid_requests:
        response = client.post("/api/forecast", json=request_data)
        assert response.status_code == 422
