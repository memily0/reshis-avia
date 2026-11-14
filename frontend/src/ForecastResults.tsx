import type { Forecast } from "./types";
import { formatDate, numberFormatter, priceFormatter } from "./formatters";
import { ForecastChart } from "./ForecastChart";

function PlaneIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21.5 16.2 13.7 12V5.1c0-1-.7-3.1-1.7-3.1s-1.7 2.1-1.7 3.1V12l-7.8 4.2v2l7.8-2.4v4.3l-2 1.4V23l3.7-.8 3.7.8v-1.5l-2-1.4v-4.3l7.8 2.4v-2Z" />
    </svg>
  );
}


export function ForecastResults({ forecast }: { forecast: Forecast }) {
  const [originCode, destinationCode] = forecast.flight.route.split("-");
  const hasNegativeDemand = forecast.quantiles.some((item) => item.demand < 0);

  return (
    <>
      {hasNegativeDemand && (
        <p className="forecast-note" role="note">
          При этой цене формула даёт отрицательные значения спроса.
          В показателях, графике и таблице они показаны как 0: спрос не может быть отрицательным.
          Исходный расчёт модели не изменён.
        </p>
      )}
      <div className="overview-card">
        <div className="flight-summary">
          <div className="flight-route">
            <span>{originCode}</span>
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
            <strong>{numberFormatter.format(Math.max(0, forecast.demand))}</strong>
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
        <ForecastChart forecast={forecast} />

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
                  const demand = Math.max(0, item.demand);
                  const difference = demand - forecast.flight.seats;
                  return (
                    <tr key={item.quantile} className={item.is_median ? "median-row" : ""}>
                      <td>
                        <strong>P{Math.round(item.quantile * 100)}</strong>
                        {item.is_median && <small>Медиана</small>}
                      </td>
                      <td>{numberFormatter.format(demand)}</td>
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
  );
}
