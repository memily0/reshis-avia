export type RouteInfo = {
  code: string;
  name: string;
  base_price: number;
  price_min: number;
  price_max: number;
};

export type FlightInfo = {
  route: string;
  route_name: string;
  date: string;
  seats: number;
  base_price: number;
  price_min: number;
  price_max: number;
  price_sensitivity: number;
};

export type QuantileForecast = {
  quantile: number;
  base_demand: number;
  demand: number;
  is_median: boolean;
};

export type Forecast = {
  flight: FlightInfo;
  price: number;
  demand: number;
  sales: number;
  free_seats: number;
  quantiles: QuantileForecast[];
};

export type User = {
  id: number;
  email: string;
  created_at: string;
};

export type AuthMode = "login" | "register";
