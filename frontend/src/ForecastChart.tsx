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
import type { Forecast } from "./types";
import { numberFormatter } from "./formatters";

export function ForecastChart({ forecast }: { forecast: Forecast }) {
  const chartData = forecast.quantiles.map((item) => ({
    ...item,
    demand: Math.max(0, item.demand),
    label: `${Math.round(item.quantile * 100)}%`,
  }));
  const medianDemand = chartData.find((item) => item.is_median)?.demand;

  return (
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
              domain={[0, "auto"]}
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
  );
}
