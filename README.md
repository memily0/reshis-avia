# Решись Авиа

«Решись Авиа» — веб-приложение для оценки спроса и ожидаемых продаж авиабилетов при выбранной цене. Пользователь выбирает маршрут, дату и стоимость билета, после чего получает медианный прогноз, девять квантильных сценариев, загрузку рейса и число свободных мест. Основной прогноз доступен без регистрации; аккаунт используется как основа для персональных возможностей продукта.

## Стек

- **Backend:** Python 3.12, FastAPI, Pydantic, pandas, SQLite.
- **Frontend:** React 19, TypeScript, Vite, Recharts.
- **Тесты:** pytest, FastAPI TestClient, Playwright для браузерной проверки.
- **ML:** готовые прогнозы AutoGluon DirectTabular.

## Структура

```text
backend/
  app/            # API, расчёт прогноза, аккаунты и SQLite
  data/           # исходные маршруты и готовые прогнозы CSV
  tests/          # тесты API, модели и авторизации
frontend/
  src/            # React-компоненты, API-клиент и стили
  dist/           # production-сборка, создаётся локально и не хранится в Git
.env.example      # пример production-переменных без секретов
```

## Модель и расчёты

В приложении используются уже подготовленные квантильные прогнозы спроса AutoGluon DirectTabular. Веб-приложение не обучает модель: оно читает прогнозы из CSV и пересчитывает их для выбранной цены.

Для каждого квантиля `q` от 0,1 до 0,9 применяется формула:

```text
demand_q(price) = base_demand_q - price_sensitivity × (price - base_price)
```

Основной прогноз спроса — квантиль `0,5`. Продажи и свободные места рассчитываются так:

```text
sales = min(seats, max(0, demand_0.5))
free_seats = seats - sales
```

API:

- `GET /api/health` — состояние сервиса и число загруженных записей;
- `GET /api/routes` — доступные маршруты и ценовые диапазоны;
- `GET /api/dates` — доступные даты;
- `POST /api/forecast` — расчёт прогноза и девяти квантилей;
- `POST /api/auth/register` — регистрация;
- `POST /api/auth/login` — вход;
- `POST /api/auth/logout` — выход;
- `GET /api/auth/me` — текущий пользователь или `401`;
- `GET /api/auth/session` — состояние сессии для интерфейса.

## Локальный запуск

Нужны Python 3.12 и Node.js 20 или новее.

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt

cd frontend
npm ci
npm run dev
```

Во втором терминале из корня репозитория:

```bash
source .venv/bin/activate
uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

Vite откроет приложение на `http://127.0.0.1:5173` и направит запросы `/api` в FastAPI.

## Тесты и сборка

```bash
PYTHONPATH=. .venv/bin/pytest

cd frontend
npm run build
```

Backend-тесты проверяют формулы на всех 155 строках прогнозов и пяти ценовых границах, API-валидацию, регистрацию, вход, выход, cookies и публичный доступ к прогнозу.

## Регистрация и авторизация

Пользователи хранятся в SQLite. Пароли хешируются `scrypt` с отдельной случайной солью и никогда не сохраняются открытым текстом. После входа сервер создаёт случайный session token, записывает в SQLite только его SHA-256-хеш и отправляет исходный токен в `HttpOnly`, `SameSite=Lax` cookie.

Изменяющие auth-запросы проверяют заголовок `Origin`, ответы с данными аккаунта имеют `Cache-Control: no-store`. В production cookie необходимо помечать `Secure`.

## Подготовка к развёртыванию

Пример настроек находится в [`.env.example`](.env.example). Значения следует задавать через переменные окружения хостинга; сам `.env` не хранится в Git.

1. Подключить постоянный диск и направить `RESHIS_AVIA_DB` на файл внутри него, например `/var/lib/reshis-avia/users.db`.
2. Установить `RESHIS_AVIA_COOKIE_SECURE=true` для HTTPS.
3. Указать публичный адрес в `RESHIS_AVIA_ALLOWED_ORIGINS`, без завершающего `/`.
4. Собрать frontend до запуска backend:

   ```bash
   cd frontend && npm ci && npm run build && cd ..
   ```

5. Запустить один процесс Uvicorn:

   ```bash
   uvicorn backend.app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
   ```

После сборки FastAPI раздаёт `frontend/dist` и API с одного публичного адреса. Это сохраняет same-origin cookies и не требует CORS. HTTPS обычно завершается на reverse proxy хостинга. Для SQLite рекомендуется один процесс приложения и регулярная резервная копия постоянного диска.

## AI и ML

- **AutoGluon DirectTabular** использовался для получения готовых квантильных прогнозов спроса, загруженных в CSV.
- **Codex** использовался как инструмент разработки: реализация, аудит, тестирование и подготовка документации.
