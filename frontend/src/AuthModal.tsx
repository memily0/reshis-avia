import { FormEvent, useEffect, useState } from "react";

import { ApiError, loginUser, registerUser } from "./api";
import type { AuthMode, User } from "./types";


type AuthModalProps = {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  onClose: () => void;
  onAuthenticated: (user: User, created: boolean) => void;
};


function PlaneBadge() {
  return (
    <span className="auth-cloud" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path d="M21.5 16.2 13.7 12V5.1c0-1-.7-3.1-1.7-3.1s-1.7 2.1-1.7 3.1V12l-7.8 4.2v2l7.8-2.4v4.3l-2 1.4V23l3.7-.8 3.7.8v-1.5l-2-1.4v-4.3l7.8 2.4v-2Z" />
      </svg>
    </span>
  );
}


export function AuthModal({
  mode,
  onModeChange,
  onClose,
  onAuthenticated,
}: AuthModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    document.body.classList.add("modal-open");
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.classList.remove("modal-open");
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  function changeMode(nextMode: AuthMode) {
    setError("");
    setPassword("");
    setPasswordConfirmation("");
    onModeChange(nextMode);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (mode === "register" && password !== passwordConfirmation) {
      setError("Пароли не совпадают");
      return;
    }
    if (mode === "register" && password.length < 8) {
      setError("Пароль должен содержать не менее 8 символов");
      return;
    }
    if (mode === "register" && !/\p{L}/u.test(password)) {
      setError("Добавьте в пароль хотя бы одну букву");
      return;
    }
    if (mode === "register" && !/\d/.test(password)) {
      setError("Добавьте в пароль хотя бы одну цифру");
      return;
    }

    setSubmitting(true);
    try {
      const user = mode === "register"
        ? await registerUser(email, password)
        : await loginUser(email, password);
      onAuthenticated(user, mode === "register");
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Сервис временно недоступен. Попробуйте ещё раз.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const isRegistration = mode === "register";

  return (
    <div
      className="auth-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="auth-close" type="button" onClick={onClose} aria-label="Закрыть">
          ×
        </button>

        <div className="auth-intro">
          <PlaneBadge />
          <div>
            <h2>Решись Авиа</h2>
            <p>Сервис прогнозирования спроса на авиабилеты</p>
          </div>
        </div>

        <div className="auth-form-panel">
          <div className="auth-tabs" aria-label="Выбор действия">
            <button
              type="button"
              className={!isRegistration ? "active" : ""}
              onClick={() => changeMode("login")}
            >
              Вход
            </button>
            <button
              type="button"
              className={isRegistration ? "active" : ""}
              onClick={() => changeMode("register")}
            >
              Регистрация
            </button>
          </div>

          <div className="auth-title-row">
            <span>{isRegistration ? "Новый аккаунт" : "С возвращением"}</span>
            <h2 id="auth-title">{isRegistration ? "Создайте аккаунт" : "Войдите в аккаунт"}</h2>
            <p>
              {isRegistration
                ? "Достаточно email и надёжного пароля."
                : "Введите данные, указанные при регистрации."}
            </p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label htmlFor="auth-email">
              <span>Email</span>
              <input
                id="auth-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
                autoComplete="email"
                required
                autoFocus
              />
            </label>

            <label htmlFor="auth-password">
              <span>Пароль</span>
              <input
                id="auth-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={isRegistration ? "Минимум 8 символов" : "Введите пароль"}
                autoComplete={isRegistration ? "new-password" : "current-password"}
                minLength={isRegistration ? 8 : 1}
                maxLength={128}
                required
              />
              {isRegistration && <small>Используйте буквы и хотя бы одну цифру.</small>}
            </label>

            {isRegistration && (
              <label htmlFor="auth-password-confirmation">
                <span>Повторите пароль</span>
                <input
                  id="auth-password-confirmation"
                  type="password"
                  value={passwordConfirmation}
                  onChange={(event) => setPasswordConfirmation(event.target.value)}
                  placeholder="Повторите пароль"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  required
                />
              </label>
            )}

            {error && <p className="auth-error" role="alert">{error}</p>}

            <button className="auth-submit" type="submit" disabled={submitting}>
              {submitting
                ? "Проверяем…"
                : isRegistration ? "Создать аккаунт" : "Войти"}
            </button>
          </form>

          <p className="auth-switch">
            {isRegistration ? "Уже есть аккаунт?" : "Ещё нет аккаунта?"}
            <button
              type="button"
              onClick={() => changeMode(isRegistration ? "login" : "register")}
            >
              {isRegistration ? "Войти" : "Зарегистрироваться"}
            </button>
          </p>
        </div>
      </section>
    </div>
  );
}
