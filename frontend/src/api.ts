import type { Forecast, RouteInfo, User } from "./types";


export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}


async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = "Не удалось выполнить запрос";
    try {
      const data = await response.json() as { detail?: string };
      if (typeof data.detail === "string") {
        message = data.detail;
      }
    } catch {
      message = `Ошибка сервера (${response.status})`;
    }
    throw new ApiError(message, response.status);
  }
  return response.json() as Promise<T>;
}


export async function getRoutes(): Promise<RouteInfo[]> {
  const response = await fetch("/api/routes");
  const data = await readJson<{ routes: RouteInfo[] }>(response);
  return data.routes;
}


export async function getDates(): Promise<string[]> {
  const response = await fetch("/api/dates");
  const data = await readJson<{ dates: string[] }>(response);
  return data.dates;
}


export async function getForecast(
  route: string,
  date: string,
  price: number,
): Promise<Forecast> {
  const response = await fetch("/api/forecast", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ route, date, price }),
  });
  return readJson<Forecast>(response);
}


export async function getCurrentUser(): Promise<User | null> {
  const response = await fetch("/api/auth/me", { credentials: "include" });
  if (response.status === 401) {
    return null;
  }
  return readJson<User>(response);
}


export async function registerUser(email: string, password: string): Promise<User> {
  const response = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });
  return readJson<User>(response);
}


export async function loginUser(email: string, password: string): Promise<User> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });
  return readJson<User>(response);
}


export async function logoutUser(): Promise<void> {
  const response = await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) {
    throw new ApiError("Не удалось выйти из аккаунта", response.status);
  }
}
