import { useEffect, useRef, useState } from "react";
import type { FormEvent, RefObject } from "react";

import { ApiError, loginUser, registerUser } from "./api";
import type { AuthMode, User } from "./types";


type AuthModalProps = {
  mode: AuthMode;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
  onModeChange: (mode: AuthMode) => void;
  onClose: () => void;
  onAuthenticated: (user: User, created: boolean) => void;
};


export function AuthModal({
  mode,
  returnFocusRef,
  onModeChange,
  onClose,
  onAuthenticated,
}: AuthModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLElement>(null);
  const isRegistration = mode === "register";

  useEffect(() => {
    const backgroundElements = document.querySelectorAll<HTMLElement>(".app-header, .page");
    backgroundElements.forEach((element) => {
      element.inert = true;
      element.setAttribute("aria-hidden", "true");
    });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
        "button:not([disabled]), input:not([disabled])",
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (!firstElement || !lastElement) {
        return;
      }
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }
    document.body.classList.add("modal-open");
    window.addEventListener("keydown", handleKeyDown);
    dialogRef.current?.querySelector<HTMLInputElement>("#auth-email")?.focus();
    return () => {
      document.body.classList.remove("modal-open");
      window.removeEventListener("keydown", handleKeyDown);
      backgroundElements.forEach((element) => {
        element.inert = false;
        element.removeAttribute("aria-hidden");
      });
      returnFocusRef.current?.focus();
    };
  }, [onClose, returnFocusRef]);

  function changeMode(nextMode: AuthMode) {
    setError("");
    setPassword("");
    setPasswordConfirmation("");
    onModeChange(nextMode);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (isRegistration) {
      if (password !== passwordConfirmation) {
        setError("Пароли не совпадают");
        return;
      }
      if (!/\p{L}/u.test(password)) {
        setError("Добавьте в пароль хотя бы одну букву");
        return;
      }
      if (!/\d/.test(password)) {
        setError("Добавьте в пароль хотя бы одну цифру");
        return;
      }
    }

    setSubmitting(true);
    try {
      const user = isRegistration
        ? await registerUser(email, password)
        : await loginUser(email, password);
      onAuthenticated(user, isRegistration);
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
      <section
        ref={dialogRef}
        className="auth-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
      >
        <button className="auth-close" type="button" onClick={onClose} aria-label="Закрыть">
          ×
        </button>

        <div className="auth-form-panel">
          <div className="auth-tabs" role="tablist" aria-label="Выбор действия">
            <button
              type="button"
              role="tab"
              aria-selected={!isRegistration}
              className={!isRegistration ? "active" : ""}
              onClick={() => changeMode("login")}
            >
              Вход
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isRegistration}
              className={isRegistration ? "active" : ""}
              onClick={() => changeMode("register")}
            >
              Регистрация
            </button>
          </div>

          <div className="auth-title-row">
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
