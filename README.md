# 📱 Магазин телефонов

Учебный проект: регистрация и авторизация с хешированием паролей Argon2id, базой данных SQLite,
задержками при подборе пароля, автоматическими тестами и бенчмарком хеширования.

![CI](https://github.com/alukonin38-ctrl/phone-shop/actions/workflows/ci.yml/badge.svg)
![Бенчмарк Argon2](https://github.com/alukonin38-ctrl/phone-shop/actions/workflows/argon2-benchmark.yml/badge.svg)

## Стек

- Frontend: HTML, CSS, JavaScript (ES-модули)
- Backend: Node.js 18+, Express
- БД: SQLite (sql.js — WebAssembly, без компиляции)
- Хеширование: Argon2id (`@node-rs/argon2`, параметры OWASP: 64 МБ, t=3, p=4)
- Тесты: Jest (юнит + E2E), CI: GitHub Actions

## Структура

```
index.html, main.js, styles.css, utils.js   фронтенд
server/
  server.js          точка входа, HTTP API (/api/register, /api/login)
  db.js              SQLite: users, login_attempts (путь можно задать через DB_PATH)
  hashService.js     Argon2id: параметры по умолчанию и переопределение через ENV/аргументы
  validators.js      проверки логина, пароля, списка 100k частых паролей, «клавиатурного мусора»
  rateLimiter.js     задержки 5 / 10 / 15 секунд после неудачных попыток
  __tests__/         тесты: валидаторы, Argon2, задержки, E2E API (Happy / Negative path)
  benchmarks/        бенчмарк Argon2id (в том числе 20 МБ памяти и parallelism = 1)
  scripts/           user-scenario.js — сценарий пользователя одной командой
docs/
  USER_SCENARIO.md   сценарий пользователя словами: happy + negative, критерии приёмки
  RUNNING.md         как всё запускать без VS Code (командная строка)
.github/workflows/   CI (тесты, покрытие, сценарий) и бенчмарк Argon2
CONTRIBUTING.md      схема веток, правила коммитов, настройка защиты main
```

## Быстрый старт

```powershell
cd server
npm ci
npm start          # http://localhost:5000
```

Фронтенд (`index.html`) использует ES-модули, поэтому открывать файл через `file://` нельзя —
нужен статический сервер. Во **втором** окне терминала:

```powershell
cd server
npm run front      # статика на http://localhost:5501 (то же, что npx http-server .. -p 5501)
```

Затем откройте `http://localhost:5501`. Если во фронтенде появляется «⚠️ Сервер недоступен» —
значит, не запущен backend (`npm start`) или занят порт 5000.

## Тесты (Happy path / Negative path)

```powershell
cd server
npm test              # все тесты
npm run test:unit     # быстрые юнит-тесты
npm run test:e2e      # E2E: сервер поднимается сам на свободном порту
npm run test:coverage # отчёт о покрытии в server/coverage
```

- E2E-тесты используют временную базу (`DB_PATH`), поэтому `server/users.db` не изменяется.
- В каждом файле тесты разделены на блоки `Happy path` и `Negative path`.
- Проверяются в том числе: соль и параметры Argon2id, чувствительность к регистру,
  отклонение частых паролей, коды 201/400/401/429 и эскалация задержек 5 → 10 → 15 секунд.

## Сценарий пользователя

```powershell
cd server
npm run scenario
```

Скрипт поднимает сервер, проходит 16 шагов (регистрация, ошибки ввода, вход, задержки,
блокировка) и печатает отчёт. Описание сценария: [`docs/USER_SCENARIO.md`](docs/USER_SCENARIO.md).

## Бенчмарк Argon2id

```powershell
cd server
npm run bench:20mb    # 20 МБ памяти, parallelism = 1 (цель задания)
npm run bench         # сравнение 4 наборов параметров, включая OWASP 64 МБ / t=3 / p=4
```

Бенчмарк измеряет медиану и 95-й процентиль времени хеширования и проверки, число хешей в секунду,
прирост памяти (RSS), пропускную способность при одновременном хешировании и теоретический расход
памяти. Отчёты (JSON + Markdown) складываются в `server/benchmarks/results/`.

Примерный результат на ноутбуке 8 ядер (i5-8350U): `m=20480, t=3, p=1` — около 43 мс на хеш
(≈23 хеша/с), при этом каждый хеш занимает ≈20 МБ, то есть 10 одновременных проверок потребуют ≈200 МБ.

## Ветки и CI

- Работа идёт в ветках `feature/...`, `fix/...`, `tests/...`, слияние — через pull request в `main`
  (подробнее: [`CONTRIBUTING.md`](CONTRIBUTING.md)).
- `.github/workflows/ci.yml`: тесты и сценарий пользователя на Node 20 и 22, отчёт о покрытии.
- `.github/workflows/argon2-benchmark.yml`: запускается вручную (можно указать память и parallelism),
  по понедельникам и при изменениях кода хеширования; отчёт попадает в артефакты и в сводку запуска.

## Документация

- [Сценарий пользователя](docs/USER_SCENARIO.md) — что и как проверяем, критерии приёмки.
- [Запуск без VS Code](docs/RUNNING.md) — все команды для PowerShell/CMD, частые проблемы.
- [Правила работы с репозиторием](CONTRIBUTING.md) — ветки, коммиты, защита `main`.

## Переменные окружения

Скопируйте `server/.env.example` в `server/.env`. Поддерживаются `PORT`, `PEPPER` (задел),
`ARGON2_MEMORY_COST`, `ARGON2_TIME_COST`, `ARGON2_PARALLELISM`, `DB_PATH`.
Значения Argon2 по умолчанию — рекомендации OWASP: 64 МБ, t=3, p=4.
