import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { getDates, getForecast, getRoutes } from "./api";
import type { Forecast, RouteInfo } from "./types";


const numberFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 1,
});

const priceFormatter = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});


function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}


function destinationName(route: RouteInfo): string {
  return route.name.replace("Москва — ", "");
}


function PlaneIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21.5 16.2 13.7 12V5.1c0-1-.7-3.1-1.7-3.1s-1.7 2.1-1.7 3.1V12l-7.8 4.2v2l7.8-2.4v4.3l-2 1.4V23l3.7-.8 3.7.8v-1.5l-2-1.4v-4.3l7.8 2.4v-2Z" />
    </svg>
  );
}


function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4 10h12M12 6l4 4-4 4" />
    </svg>
  );
}


function App() {
  const [routes, setRoutes] = useState<RouteInfo[]>([]);
  const [dates, setDates] = useState<string[]>([]);
  const [routeCode, setRouteCode] = useState("");
  const [date, setDate] = useState("");
  const [price, setPrice] = useState("");
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const selectedRoute = useMemo(
    () => routes.find((route) => route.code === routeCode),
    [routeCode, routes],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadInitialData() {
      try {
        const [loadedRoutes, loadedDates] = await Promise.all([
          getRoutes(),
          getDates(),
        ]);
        if (cancelled || loadedRoutes.length === 0 || loadedDates.length === 0) {
          return;
        }

        const initialRoute = loadedRoutes[0];
        const initialDate = loadedDates[0];
        setRoutes(loadedRoutes);
        setDates(loadedDates);
        setRouteCode(initialRoute.code);
        setDate(initialDate);
        setPrice(String(initialRoute.base_price));

        const initialForecast = await getForecast(
          initialRoute.code,
          initialDate,
          initialRoute.base_price,
        );
        if (!cancelled) {
          setForecast(initialForecast);
        }
      } catch {
        if (!cancelled) {
          setError("Не удалось загрузить данные. Проверьте, запущен ли backend.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadInitialData();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleRouteChange(nextRouteCode: string) {
    setRouteCode(nextRouteCode);
    const nextRoute = routes.find((route) => route.code === nextRouteCode);
    if (nextRoute) {
      setPrice(String(nextRoute.base_price));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const numericPrice = Number(price);
    if (!routeCode || !date || price.trim() === "" || numericPrice < 0) {
      setError("Заполните все поля и укажите неотрицательную цену.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      setForecast(await getForecast(routeCode, date, numericPrice));
    } catch {
      setError("Не удалось рассчитать прогноз. Проверьте выбранные параметры.");
    } finally {
      setLoading(false);
    }
  }

  const chartData = forecast?.quantiles.map((item) => ({
    ...item,
    label: `${Math.round(item.quantile * 100)}%`,
  }));
  const medianDemand = forecast?.quantiles.find((item) => item.is_median)?.demand;

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#main-content" aria-label="Решись Авиа — к содержанию">
          <span className="brand-mark"><PlaneIcon /></span>
          <span>Решись Авиа</span>
        </a>
        <div className="system-status">
          <span className="status-dot" />
          Данные модели загружены
        </div>
      </header>

      <main id="main-content" className="page">
        <div className="page-heading">
          <div>
            <h1>Прогноз спроса</h1>
            <p>Оцените продажи для маршрута, даты и стоимости билета.</p>
          </div>
          <span className="model-note">DirectTabular · 9 сценариев</span>
        </div>

        <div className="workspace">
          <aside className="control-panel" aria-labelledby="parameters-heading">
            <div className="panel-heading">
              <span className="step-number">01</span>
              <div>
                <h2 id="parameters-heading">Параметры рейса</h2>
                <p>Выберите направление и задайте цену.</p>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="field-group">
                <label htmlFor="origin">Пункт отправления</label>
                <input id="origin" value="Москва" disabled />
              </div>

              <div className="route-divider" aria-hidden="true">
                <span />
                <ArrowIcon />
                <span />
              </div>

              <div className="field-group">
                <label htmlFor="destination">Пункт назначения</label>
                <select
                  id="destination"
                  value={routeCode}
                  onChange={(event) => handleRouteChange(event.target.value)}
                  disabled={routes.length === 0}
                >
                  {routes.map((route) => (
                    <option key={route.code} value={route.code}>
                      {destinationName(route)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field-group">
                <label htmlFor="date">Дата вылета</label>
                <select
                  id="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  disabled={dates.length === 0}
                >
                  {dates.map((availableDate) => (
                    <option key={availableDate} value={availableDate}>
                      {formatDate(availableDate)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field-group">
                <label htmlFor="price">Стоимость билета</label>
                <div className="price-input">
                  <input
                    id="price"
                    type="number"
                    min="0"
                    step="100"
                    value={price}
                    onChange={(event) => setPrice(event.target.value)}
                    inputMode="numeric"
                  />
                  <span>₽</span>
                </div>
                {selectedRoute && (
                  <p className="field-hint">
                    Рекомендуемый диапазон: {priceFormatter.format(selectedRoute.price_min)}–{priceFormatter.format(selectedRoute.price_max)}
                  </p>
                )}
              </div>

              <button className="submit-button" type="submit" disabled={loading}>
                {loading ? "Выполняем расчёт…" : "Рассчитать прогноз"}
                {!loading && <ArrowIcon />}
              </button>

              {error && <p className="form-error" role="alert">{error}</p>}
            </form>
          </aside>

          <section className="results" aria-live="polite" aria-busy={loading}>
            {forecast ? (
              <>
                <div className="result-summary">
                  <div>
                    <span className="section-label">Результат расчёта</span>
                    <h2>{forecast.flight.route_name}</h2>
                    <p>{formatDate(forecast.flight.date)} · билет {priceFormatter.format(forecast.price)}</p>
                  </div>
                  <div className="route-code">{forecast.flight.route}</div>
                </div>

                <div className="metrics" aria-label="Основные показатели прогноза">
                  <article>
                    <span>Вместимость</span>
                    <strong>{numberFormatter.format(forecast.flight.seats)}</strong>
                    <small>мест</small>
                  </article>
                  <article className="metric-primary">
                    <span>Прогноз спроса</span>
                    <strong>{numberFormatter.format(forecast.demand)}</strong>
                    <small>билетов</small>
                  </article>
                  <article>
                    <span>Ожидаемые продажи</span>
                    <strong>{numberFormatter.format(forecast.sales)}</strong>
                    <small>билетов</small>
                  </article>
                  <article>
                    <span>Свободные места</span>
                    <strong>{numberFormatter.format(forecast.free_seats)}</strong>
                    <small>мест</small>
                  </article>
                </div>

                <div className="chart-card">
                  <div className="chart-heading">
                    <div>
                      <h3>Сценарии спроса</h3>
                      <p>Квантили прогноза при выбранной стоимости билета</p>
                    </div>
                    <div className="chart-legend" aria-label="Легенда графика">
                      <span><i className="legend-line" />Спрос</span>
                      <span><i className="legend-dot" />Медиана</span>
                      <span><i className="legend-capacity" />Вместимость</span>
                    </div>
                  </div>

                  <div className="chart-wrap" aria-label="График девяти квантилей спроса">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 20, right: 18, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke="#e4e3de" strokeDasharray="3 4" vertical={false} />
                        <XAxis
                          dataKey="label"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#6f746f", fontSize: 12 }}
                          dy={10}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#6f746f", fontSize: 12 }}
                          tickFormatter={(value) => numberFormatter.format(Number(value))}
                          width={52}
                        />
                        <Tooltip
                          cursor={{ stroke: "#b9bcb7", strokeDasharray: "3 3" }}
                          formatter={(value) => [numberFormatter.format(Number(value)), "Спрос"]}
                          labelFormatter={(label) => `Квантиль ${label}`}
                          contentStyle={{
                            border: "1px solid #d8d8d2",
                            borderRadius: 8,
                            boxShadow: "0 8px 24px rgba(31, 39, 34, 0.08)",
                          }}
                        />
                        <ReferenceLine
                          y={forecast.flight.seats}
                          stroke="#a3a8a3"
                          strokeDasharray="5 5"
                          ifOverflow="extendDomain"
                        />
                        <Line
                          type="monotone"
                          dataKey="demand"
                          name="Спрос"
                          stroke="#1d5c43"
                          strokeWidth={2.5}
                          dot={{ r: 3.5, fill: "#1d5c43", strokeWidth: 0 }}
                          activeDot={{ r: 5, fill: "#1d5c43", stroke: "#ffffff", strokeWidth: 2 }}
                          isAnimationActive={false}
                        />
                        {medianDemand !== undefined && (
                          <ReferenceDot
                            x="50%"
                            y={medianDemand}
                            r={6}
                            fill="#c65f32"
                            stroke="#ffffff"
                            strokeWidth={3}
                          />
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="chart-footer">
                    <span>Низкий сценарий</span>
                    <span>Медианный сценарий</span>
                    <span>Высокий сценарий</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="empty-state">
                <div className="loading-mark" />
                <h2>{loading ? "Загружаем прогноз" : "Прогноз пока недоступен"}</h2>
                <p>Данные появятся здесь после успешного расчёта.</p>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}


export default App;
