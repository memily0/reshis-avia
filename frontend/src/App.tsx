import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
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

import { getCurrentUser, getDates, getForecast, getRoutes, logoutUser } from "./api";
import { AuthModal } from "./AuthModal";
import type { AuthMode, Forecast, RouteInfo, User } from "./types";


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


function CloudIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M19.35 10.04A7.49 7.49 0 0 0 5.5 8 5.994 5.994 0 0 0 6 19.97h13a4.998 4.998 0 0 0 .35-9.93Z" />
    </svg>
  );
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
      <path d="M3.5 10h13M12 5.5l4.5 4.5-4.5 4.5" />
    </svg>
  );
}


function getChartDomain(forecast: Forecast | null): [number, number] {
  if (!forecast) {
    return [0, 100];
  }

  const values = [
    forecast.flight.seats,
    ...forecast.quantiles.map((item) => item.demand),
  ];
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const padding = Math.max(50, (maximum - minimum) * 0.12);

  return [
    Math.floor((minimum - padding) / 100) * 100,
    Math.ceil((maximum + padding) / 100) * 100,
  ];
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
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [logoutPending, setLogoutPending] = useState(false);
  const [authNotice, setAuthNotice] = useState("");

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
        if (cancelled) {
          return;
        }
        if (loadedRoutes.length === 0 || loadedDates.length === 0) {
          throw new Error("Forecast reference data is empty");
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

  useEffect(() => {
    let cancelled = false;
    getCurrentUser()
      .then((currentUser) => {
        if (!cancelled) {
          setUser(currentUser);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAuthLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const closeAuthModal = useCallback(() => setAuthMode(null), []);

  function handleAuthenticated(nextUser: User, created: boolean) {
    setUser(nextUser);
    setAuthMode(null);
    setAuthNotice(created ? "Аккаунт создан — вы вошли в систему" : "Вы вошли в аккаунт");
  }

  async function handleLogout() {
    setLogoutPending(true);
    try {
      await logoutUser();
      setUser(null);
      setAuthNotice("Вы вышли из аккаунта");
    } catch {
      setAuthNotice("Не удалось выйти. Попробуйте ещё раз.");
    } finally {
      setLogoutPending(false);
    }
  }

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
    if (
      !routeCode
      || !date
      || price.trim() === ""
      || !Number.isFinite(numericPrice)
      || numericPrice < 0
    ) {
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
  const destinationCode = forecast?.flight.route.split("-")[1];
  const chartDomain = getChartDomain(forecast);

  return (
    <div className="app-shell">
      <div className="cloud-backdrop" aria-hidden="true">
        <span className="cloud-shape cloud-one"><CloudIcon /></span>
        <span className="cloud-shape cloud-two"><CloudIcon /></span>
        <span className="cloud-shape cloud-three"><CloudIcon /></span>
        <span className="cloud-shape cloud-four"><CloudIcon /></span>
        <span className="cloud-shape cloud-five"><CloudIcon /></span>
        <span className="cloud-shape cloud-six"><CloudIcon /></span>
        <span className="cloud-shape cloud-seven"><CloudIcon /></span>
        <span className="cloud-shape cloud-eight"><CloudIcon /></span>
        <span className="cloud-shape cloud-nine"><CloudIcon /></span>
        <span className="cloud-shape cloud-ten"><CloudIcon /></span>
      </div>

      <header className="app-header">
        <div className="header-inner">
          <a className="brand" href="#main-content" aria-label="Решись Авиа — к содержанию">
            <span className="brand-mark"><CloudIcon /></span>
            <span className="brand-copy">
              <strong>Решись Авиа</strong>
              <small>Revenue intelligence</small>
            </span>
          </a>

          <div className="header-meta">
            <div className="header-context">
              <span className="model-status"><i /> DirectTabular активна</span>
              <span className="data-period">Данные: 01.06–01.07.2026</span>
            </div>

            {authLoading ? (
              <span className="auth-skeleton" aria-label="Проверяем сессию" />
            ) : user ? (
              <div className="user-menu">
                <span className="user-avatar">{user.email.charAt(0).toUpperCase()}</span>
                <span className="user-email">{user.email}</span>
                <button type="button" onClick={handleLogout} disabled={logoutPending}>
                  {logoutPending ? "Выходим…" : "Выйти"}
                </button>
              </div>
            ) : (
              <button className="open-auth-button" type="button" onClick={() => setAuthMode("login")}>
                <span aria-hidden="true">↗</span>
                Войти
              </button>
            )}
          </div>
        </div>
      </header>

      {authMode && (
        <AuthModal
          mode={authMode}
          onModeChange={setAuthMode}
          onClose={closeAuthModal}
          onAuthenticated={handleAuthenticated}
        />
      )}

      {authNotice && (
        <div className="auth-notice" role="status">
          <i />
          <span>{authNotice}</span>
          <button type="button" onClick={() => setAuthNotice("")} aria-label="Закрыть уведомление">×</button>
        </div>
      )}

      <main id="main-content" className="page">
        <div className="page-heading">
          <div>
            <h1>Прогноз спроса</h1>
            <p>Оцените продажи и загрузку рейса при выбранной стоимости билета.</p>
          </div>
          <span className="scenario-badge">9 сценариев модели</span>
        </div>

        <form className="forecast-form" onSubmit={handleSubmit} aria-label="Параметры рейса">
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
              onChange={(event) => handleRouteChange(event.target.value)}
              disabled={routes.length === 0}
            >
              {routes.map((route) => (
                <option key={route.code} value={route.code}>
                  {destinationName(route)}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field" htmlFor="date">
            <span>Дата вылета</span>
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
          </label>

          <label className="form-field price-field" htmlFor="price">
            <span>Стоимость билета</span>
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
              <b>₽</b>
            </div>
            {selectedRoute && (
              <small>Рекомендуется {priceFormatter.format(selectedRoute.price_min)}–{priceFormatter.format(selectedRoute.price_max)}</small>
            )}
          </label>

          <button className="calculate-button" type="submit" disabled={loading}>
            {loading ? "Рассчитываем…" : "Рассчитать"}
            {!loading && <ArrowIcon />}
          </button>

          {error && <p className="form-error" role="alert">{error}</p>}
        </form>

        <section className="results" aria-live="polite" aria-busy={loading}>
          {forecast ? (
            <>
              <div className="overview-card">
                <div className="flight-summary">
                  <div className="flight-route">
                    <span>{forecast.flight.route.split("-")[0]}</span>
                    <i><PlaneIcon /></i>
                    <span>{destinationCode}</span>
                  </div>
                  <div className="flight-copy">
                    <h2>{forecast.flight.route_name}</h2>
                    <p>{formatDate(forecast.flight.date)} · билет {priceFormatter.format(forecast.price)}</p>
                  </div>
                </div>

                <div className="metrics-grid" aria-label="Основные показатели прогноза">
                  <article>
                    <span>Вместимость</span>
                    <strong>{numberFormatter.format(forecast.flight.seats)}</strong>
                    <small>мест</small>
                  </article>
                  <article className="primary-metric">
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
              </div>

              <div className="analytics-grid">
                <article className="chart-card">
                  <div className="card-heading">
                    <div>
                      <h3>Диапазон спроса</h3>
                      <p>Девять квантилей прогноза при выбранной цене</p>
                    </div>
                    <div className="chart-legend" aria-label="Легенда графика">
                      <span><i className="legend-demand" />Спрос</span>
                      <span><i className="legend-median" />Медиана</span>
                      <span><i className="legend-capacity" />Вместимость</span>
                    </div>
                  </div>

                  <div className="chart-wrap" aria-label="График девяти квантилей спроса">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 30, right: 20, left: 2, bottom: 8 }}>
                        <CartesianGrid stroke="#e8edf4" vertical={false} />
                        <XAxis
                          dataKey="label"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#7b8495", fontSize: 12 }}
                          dy={10}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#7b8495", fontSize: 12 }}
                          tickFormatter={(value) => numberFormatter.format(Number(value))}
                          domain={chartDomain}
                          width={54}
                        />
                        <Tooltip
                          cursor={{ stroke: "#bfdbfe", strokeWidth: 1.5 }}
                          formatter={(value) => [numberFormatter.format(Number(value)), "Спрос"]}
                          labelFormatter={(label) => `Квантиль ${label}`}
                          contentStyle={{
                            border: "1px solid #dbe3ef",
                            borderRadius: 10,
                            boxShadow: "0 12px 32px rgba(35, 52, 83, 0.12)",
                            fontFamily: "Manrope Variable",
                          }}
                        />
                        <ReferenceLine
                          y={forecast.flight.seats}
                          stroke="#94a3b8"
                          strokeDasharray="5 5"
                          ifOverflow="extendDomain"
                        />
                        <Line
                          type="monotone"
                          dataKey="demand"
                          name="Спрос"
                          stroke="#2563eb"
                          strokeWidth={3}
                          dot={{ r: 3.5, fill: "#ffffff", stroke: "#2563eb", strokeWidth: 2 }}
                          activeDot={{ r: 5.5, fill: "#2563eb", stroke: "#ffffff", strokeWidth: 2 }}
                          isAnimationActive={false}
                        />
                        {medianDemand !== undefined && (
                          <ReferenceDot
                            x="50%"
                            y={medianDemand}
                            r={6}
                            fill="#172033"
                            stroke="#ffffff"
                            strokeWidth={3}
                          />
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </article>

                <aside className="scenario-card" aria-labelledby="scenario-heading">
                  <div className="card-heading scenario-card-heading">
                    <div>
                      <h3 id="scenario-heading">Сценарии</h3>
                      <p>Спрос относительно вместимости</p>
                    </div>
                  </div>

                  <div className="scenario-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Сценарий</th>
                          <th>Спрос</th>
                          <th>К местам</th>
                        </tr>
                      </thead>
                      <tbody>
                        {forecast.quantiles.map((item) => {
                          const difference = item.demand - forecast.flight.seats;
                          return (
                            <tr key={item.quantile} className={item.is_median ? "median-row" : ""}>
                              <td>
                                <strong>P{Math.round(item.quantile * 100)}</strong>
                                {item.is_median && <small>Медиана</small>}
                              </td>
                              <td>{numberFormatter.format(item.demand)}</td>
                              <td>
                                <span className={difference > 0 ? "capacity-delta over" : "capacity-delta"}>
                                  {difference > 0 ? "+" : ""}{numberFormatter.format(difference)}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <p className="scenario-note">Положительное значение означает спрос выше доступных мест.</p>
                </aside>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <div className="loading-mark" />
              <h2>{loading ? "Загружаем прогноз" : "Прогноз недоступен"}</h2>
              <p>Данные появятся после успешного расчёта.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}


export default App;
