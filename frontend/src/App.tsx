import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import { getCurrentUser, getDates, getForecast, getRoutes, logoutUser } from "./api";
import { AuthModal } from "./AuthModal";
import { ForecastForm } from "./ForecastForm";
import { ForecastResults } from "./ForecastResults";
import type { AuthMode, Forecast, RouteInfo, User } from "./types";

function CloudIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M19.35 10.04A7.49 7.49 0 0 0 5.5 8 5.994 5.994 0 0 0 6 19.97h13a4.998 4.998 0 0 0 .35-9.93Z" />
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
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [logoutPending, setLogoutPending] = useState(false);
  const [authNotice, setAuthNotice] = useState("");

  const requestId = useRef(0);
  const loginButtonRef = useRef<HTMLButtonElement>(null);

  const calculateForecast = useCallback(async (route: string, date: string, price: number) => {
    requestId.current += 1;
    const currentRequest = requestId.current;
    setLoading(true);
    setForecast(null);
    setError("");
    try {
      const result = await getForecast(route, date, price);
      if (currentRequest === requestId.current) setForecast(result);
    } catch {
      if (currentRequest === requestId.current) {
        setError("Не удалось рассчитать прогноз. Проверьте выбранные параметры.");
      }
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, []);

  function clearForecast() {
    // Запросы, отправленные до изменения формы, больше не актуальны.
    requestId.current += 1;
    setForecast(null);
    setError("");
    setLoading(false);
  }

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

        await calculateForecast(
          initialRoute.code,
          initialDate,
          initialRoute.base_price,
        );
      } catch {
        if (!cancelled) {
          setError("Не удалось загрузить данные. Проверьте, запущен ли backend.");
          setLoading(false);
        }
      }
    }

    loadInitialData();
    return () => {
      cancelled = true;
      requestId.current += 1;
    };
  }, [calculateForecast]);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        const currentUser = await getCurrentUser();
        if (!cancelled) setUser(currentUser);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    }

    loadSession();
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
    clearForecast();
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

    await calculateForecast(routeCode, date, numericPrice);
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-inner">
          <a className="brand" href="#main-content" aria-label="Решись Авиа — к содержанию">
            <span className="brand-mark"><CloudIcon /></span>
            <span className="brand-copy">
              <strong>Решись Авиа</strong>
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
              <button ref={loginButtonRef} className="open-auth-button" type="button" onClick={() => setAuthMode("login")}>
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
          returnFocusRef={loginButtonRef}
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

        <ForecastForm
          routes={routes}
          dates={dates}
          routeCode={routeCode}
          date={date}
          price={price}
          loading={loading}
          error={error}
          onRouteChange={handleRouteChange}
          onDateChange={(value) => {
            clearForecast();
            setDate(value);
          }}
          onPriceChange={(value) => {
            clearForecast();
            setPrice(value);
          }}
          onSubmit={handleSubmit}
        />

        <section className="results" aria-live="polite" aria-busy={loading}>
          {forecast ? (
            <ForecastResults forecast={forecast} />
          ) : (
            <div className="empty-state">
              {loading && <div className="loading-mark" />}
              <h2>{loading ? "Загружаем прогноз" : "Рассчитайте прогноз"}</h2>
              <p>Выберите параметры и нажмите «Рассчитать».</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}


export default App;
