# Как запускать проект без VS Code (только командная строка)

Все команды выполняются из корня проекта, если не указано иное.
Подходят PowerShell, Windows Terminal или `cmd`.

## 1. Что нужно установить один раз

| Требование | Проверка | Примечание |
|---|---|---|
| Node.js 18+ | `node -v` | проект проверен на Node 24, CI гоняет Node 20 и 22 |
| npm (идёт с Node) | `npm -v` | |
| Зависимости сервера | — | `cd server; npm ci` |

```powershell
cd server
npm ci            # точная установка по package-lock.json
# если интернета нет, а папка node_modules уже есть — этот шаг можно пропустить
```

## 2. Все основные команды (шпаргалка)

| Команда (из папки `server`) | Что делает |
|---|---|
| `npm test` | все тесты: юнит-тесты + E2E API (Happy и Negative path) |
| `npm run test:unit` | только быстрые юнит-тесты (валидаторы, Argon2, задержки) |
| `npm run test:e2e` | только E2E: поднимает сервер и проверяет HTTP API |
| `npm run test:coverage` | тесты + отчёт о покрытии в `server/coverage` |
| `npm run test:watch` | тесты в режиме наблюдения (перезапуск при изменениях) |
| `npm run scenario` | сценарий пользователя целиком (16 шагов, ~7 секунд) |
| `npm run bench` | бенчмарк Argon2id по всем пресетам |
| `npm run bench:20mb` | бенчмарк только для «20 МБ памяти + parallelism 1» |
| `npm start` | запуск сервера (`http://localhost:5000`) |
| `npm run dev` | сервер с автоперезапуском (nodemon) |
| `npm run front` | статический сервер для фронтенда на `http://localhost:5501` |

## 3. Тесты: подробнее

```powershell
cd server

npm test                                  # всё сразу
npm test -- api.test.js                   # только файл E2E
npm test -- -t "Negative path"            # только тесты, где встречается строка
npm test -- -t "блокировка"               # например, только про блокировки
npm run test:coverage                     # покрытие: текст в консоль + HTML в server/coverage/lcov-report
start coverage/lcov-report/index.html     # открыть отчёт в браузере (Windows)
```

Как устроены тесты:

- `__tests__/validators.test.js` — логин/пароль/частые пароли/набор с клавиатуры;
- `__tests__/hashService.test.js` — Argon2id: соль, параметры, длина, ошибки;
- `__tests__/rateLimiter.test.js` — задержки 5 → 10 → 15 секунд (база данных замокана);
- `__tests__/api.test.js` — E2E: сервер поднимается отдельным процессом на свободном порту
  и с временной базой (`DB_PATH` в папке временных файлов), поэтому боевая `users.db` не меняется.

В каждом файле тесты разделены на блоки `Happy path` и `Negative path`.

## 4. Сценарий пользователя

```powershell
cd server
npm run scenario                          # сам поднимет сервер и всё проверит
npm run scenario -- --keep-running        # сервер останется запущенным после проверки
npm run scenario -- --url=http://localhost:5000   # проверять уже запущенный сервер
```

Скрипт печатает шаги с галочками и в конце — итог; код выхода `0`, если всё прошло.
Описание сценария словами: `docs/USER_SCENARIO.md`.

## 5. Бенчмарк Argon2id (в том числе 20 МБ и parallelism = 1)

```powershell
cd server

npm run bench:20mb                        # 20 МБ памяти, один поток
npm run bench                             # 4 набора: OWASP 64 МБ, 19 МБ, 20 МБ/p=1, 20 МБ/p=4

# свои параметры:
node benchmarks/argon2.bench.js --memory=20480 --parallelism=1 --time=3 --iterations=30
node benchmarks/argon2.bench.js --memory=65536 --parallelism=4 --time=3 --concurrency=1,4,8
```

Что измеряется: медиана/95-й процентиль времени хеширования и проверки, число хешей в секунду,
прирост памяти процесса (RSS), пропускная способность при одновременном хешировании
и теоретический расход памяти (память × число одновременных хешей).

Результаты сохраняются в `server/benchmarks/results/argon2-bench-<дата>.json` и `.md`
(в git они не коммитятся).

## 6. Запуск сервера без VS Code

```powershell
cd server
npm start
# Server running on http://localhost:5000
```

Порт и параметры Argon2 можно переопределить переменными окружения
(файл `server/.env`, шаблон — `server/.env.example`):

```powershell
$env:PORT=5050
$env:ARGON2_MEMORY_COST=20480   # КиБ: 20480 = 20 МБ
$env:ARGON2_PARALLELISM=1
npm start
```

## 7. Запуск фронтенда без VS Code (без расширения Live Server)

`index.html` подключает `main.js` как ES-модуль, поэтому просто открыть файл двойным щелчком
(`file://`) нельзя — браузер заблокирует загрузку модуля. Нужен любой статический сервер:

```powershell
# из корня проекта
npx http-server . -p 5501        # вариант 1 (скачается один раз)
python -m http.server 5501       # вариант 2, если есть Python
npx serve -l 5501                # вариант 3
```

Затем откройте `http://localhost:5501`.

## 8. Ручные запросы к API (PowerShell)

```powershell
# регистрация
$body = @{ login = 'ivan_2025'; password = 'ScenarioPass123'; confirm = 'ScenarioPass123' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:5000/api/register -ContentType 'application/json' -Body $body

# вход
Invoke-RestMethod -Method Post -Uri http://localhost:5000/api/login -ContentType 'application/json' `
  -Body (@{ login = 'ivan_2025'; password = 'ScenarioPass123' } | ConvertTo-Json)

# негативный сценарий: неверный пароль — увидеть код 401 и текст ошибки
try {
  Invoke-RestMethod -Method Post -Uri http://localhost:5000/api/login -ContentType 'application/json' `
    -Body (@{ login = 'ivan_2025'; password = 'WrongPass1' } | ConvertTo-Json)
} catch {
  $_.Exception.Response.StatusCode.value__    # 401
  $_.ErrorDetails.Message                     # JSON с сообщением и lockSeconds
}
```

## 9. Ветки, коммиты и GitHub Actions

Схема работы описана в `CONTRIBUTING.md`: работаем в ветке `feature/...`, затем pull request в `main`.
Проверки запускаются автоматически (`.github/workflows/ci.yml`), бенчмарк — вручную
(`.github/workflows/argon2-benchmark.yml`, кнопка «Run workflow»).

Локально те же проверки можно прогнать так:

```powershell
cd server
npm ci
npm test
npm run scenario
```

Если установлен Docker и утилита `act`, можно выполнить workflow прямо на машине:

```powershell
act -j tests            # job «Тесты» из ci.yml
```

## 10. Частые проблемы

| Симптом | Решение |
|---|---|
| `EADDRINUSE: address already in use :::5000` | порт занят: `$env:PORT=5001; npm start` или закрыть старое окно сервера |
| `Cannot find module 'express'` | не установлены зависимости: `cd server; npm ci` |
| Фронтенд пишет «Сервер недоступен» | сервер не запущен либо порт в `main.js` не совпадает с `PORT` |
| E2E-тест падает на старте («Сервер не запустился») | сервер падает при старте: запустите `npm start` вручную и посмотрите лог |
| В `users.db` остались старые пользователи | удалите `server/users.db` (файл не коммитится) и перезапустите сервер |
