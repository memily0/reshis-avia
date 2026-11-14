import type { FormEvent } from "react";
import type { RouteInfo } from "./types";
import { formatDate, priceFormatter } from "./formatters";

type ForecastFormProps = {
  routes: RouteInfo[];
  dates: string[];
  routeCode: string;
  date: string;
  price: string;
  loading: boolean;
  error: string;
  onRouteChange: (route: string) => void;
  onDateChange: (date: string) => void;
  onPriceChange: (price: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M3.5 10h13M12 5.5l4.5 4.5-4.5 4.5" />
    </svg>
  );
}


export function ForecastForm({
  routes, dates, routeCode, date, price, loading, error,
  onRouteChange, onDateChange, onPriceChange, onSubmit,
}: ForecastFormProps) {
  const selectedRoute = routes.find((route) => route.code === routeCode);

  return (
    <form className="forecast-form" onSubmit={onSubmit} aria-label="Параметры рейса">
      <label className="form-field origin-field" htmlFor="origin">
        <span>Откуда</span>
        <input id="origin" value="Москва" disabled />
      </label>

      <div className="route-arrow" aria-hidden="true"><ArrowIcon /></div>

      <label className="form-field destination-field" htmlFor="destination">
        <span>Куда</span>
        <select
          id="destination"
          value={routeCode}
          onChange={(event) => onRouteChange(event.target.value)}
          disabled={routes.length === 0}
        >
          {routes.map((route) => (
            <option key={route.code} value={route.code}>
              {route.name.replace("Москва — ", "")}
            </option>
          ))}
        </select>
      </label>

      <label className="form-field date-field" htmlFor="date">
        <span>Дата вылета</span>
        <select
          id="date"
          value={date}
          onChange={(event) => onDateChange(event.target.value)}
          disabled={dates.length === 0}
        >
          {dates.map((availableDate) => (
            <option key={availableDate} value={availableDate}>
              {formatDate(availableDate)}
            </option>
          ))}
        </select>
      </label>

      <label className="form-field price-field" htmlFor="price">
        <span>Стоимость билета</span>
        <div className="price-input">
          <input
            id="price"
            type="number"
            min="0"
            step="any"
            value={price}
            onChange={(event) => onPriceChange(event.target.value)}
            inputMode="decimal"
            required
          />
          <b>₽</b>
        </div>
      </label>

      <button className="calculate-button" type="submit" disabled={loading}>
        {loading ? "Рассчитываем…" : "Рассчитать"}
        {!loading && <ArrowIcon />}
      </button>

      {selectedRoute && (
        <p className="price-hint">
          Диапазон цен в данных: {priceFormatter.format(selectedRoute.price_min)}–{priceFormatter.format(selectedRoute.price_max)}.{" "}
          Можно задать любую неотрицательную цену.
        </p>
      )}

      {error && <p className="form-error" role="alert">{error}</p>}
    </form>
  );
}
