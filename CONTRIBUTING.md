# Правила работы с репозиторием

## 1. Схема веток

```
main                       ← стабильная ветка, всегда «зелёная» (CI проходит)
 ├── feature/<название>     новая функциональность  (например feature/argon2-benchmark)
 ├── fix/<название>         исправление ошибок      (например fix/login-lock)
 └── tests/<название>       только тесты/CI         (например tests/happy-negative-paths)
```

* `main` **защищена**: прямые push запрещены, изменения попадают только через pull request.
* Одна ветка — одна задача. Название короткое, латиницей, с дефисами.
* Ветку создаём от свежего `main`, после мержа удаляем.

### Рабочий цикл

```powershell
git checkout main
git pull
git checkout -b feature/тесты-и-бенчмарк

# ... работа ...

git add .
git commit -m "Добавил тесты Happy/Negative path, бенчмарк Argon2 и CI"
git push -u origin feature/тесты-и-бенчмарк
# далее на GitHub: Compare & pull request → описание → Create pull request
```

Слияние выполняется через **Squash and merge**, после чего ветку удаляют.

## 2. Коммиты

* Сообщение на русском, в повелительном наклонении, до 72 символов в первой строке.
* Префикс по желанию: `feat:`, `fix:`, `test:`, `docs:`, `ci:`, `chore:`.
* В одном коммите — одна логическая правка; не смешивайте рефакторинг и новую функциональность.

Примеры: `feat: параметры Argon2 через ENV`, `test: E2E на блокировку 5/10/15 с`, `ci: workflow для бенчмарка`.

## 3. Что должно быть сделано в задаче (Definition of Done)

1. Логика покрыта тестами: **Happy path** и **Negative path** (границы, неверные типы, пустые значения).
2. `cd server && npm test` проходит локально.
3. `npm run scenario` проходит, если менялись API или валидация.
4. `npm run bench` запускается без ошибок, если менялось хеширование.
5. README и `docs/` обновлены, если изменились команды или поведение.
6. В коммит не попали `server/.env`, `server/users.db`, `node_modules`, результаты бенчмарков.

## 4. Защита `main` на GitHub (настраивается один раз)

Settings → Branches → Add branch protection rule → Branch name pattern: `main`:

- [x] Require a pull request before merging (минимум 1 approval)
- [x] Require status checks to pass → выбрать job **CI / Тесты (Node 20)**, **CI / Тесты (Node 22)** и **CI / Сценарий пользователя**
- [x] Require branches to be up to date before merging
- [x] Do not allow bypassing the above settings

После этого изменения в `main` попадают только через зелёный pull request.

## 5. Ветки и CI

| Ветка | Что запускается автоматически |
|---|---|
| `main`, `feature/**`, `fix/**`, `tests/**` | `.github/workflows/ci.yml` (тесты, покрытие, сценарий) |
| pull request в `main` | то же + шаблон описания PR (`.github/PULL_REQUEST_TEMPLATE.md`) |
| изменение `server/benchmarks/**` или `server/hashService.js` | `.github/workflows/argon2-benchmark.yml` |
| вручную | «Бенчмарк Argon2» → Run workflow (можно задать 20 МБ и parallelism = 1) |
