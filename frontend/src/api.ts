import type { Forecast, RouteInfo } from "./types";


async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`);
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
