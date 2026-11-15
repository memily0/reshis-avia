# Решись Авиа

Веб-приложение для прогнозирования спроса на авиабилеты.

Можно выбрать маршрут, дату и цену билета, посмотреть ожидаемый спрос, количество продаж и свободных мест. Также есть график прогноза и регистрация пользователей.

## Стэк

- Backend: Python, FastAPI, SQLite
- Frontend: React, TypeScript, Recharts
- ML: AutoGluon

## Запуск

```bash
pip install -r backend/requirements.txt
uvicorn backend.app.main:app --reload
```

```bash
cd frontend
npm install
npm run dev
```

Сайт откроется на `http://localhost:5173`

## Модель

Для прогноза использовался AutoGluon.
