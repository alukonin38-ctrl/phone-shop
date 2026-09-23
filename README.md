# Магазин телефонов

Учебный проект: регистрация и авторизация с хешированием паролей и базой данных.

## Стек
- Frontend: HTML, CSS, JavaScript (ES Modules)
- Backend: Node.js, Express
- БД: SQLite
- Хеширование: Argon2id

## Структура
- `index.html`, `main.js`, `styles.css`, `utils.js` — фронтенд
- `server/` — бэкенд
  - `server.js` — точка входа
  - `db.js` — работа с SQLite
  - `hashService.js` — хеширование
  - `validators.js` — валидация
  - `rateLimiter.js` — задержки 5/10/15 с
  - `__tests__/` — юнит-тесты

## Запуск
1. `cd server && npm install`
2. `npm start`
3. Открыть `index.html` в браузере

## Тесты
`cd server && npm test`