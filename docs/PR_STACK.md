# Стек pull request'ов (порядок слияния)

Работа разбита на 7 последовательных веток: каждая следующая содержит коммиты предыдущей,
поэтому PR-ы открываются «стопкой» — база каждого следующего PR — предыдущая ветка.

| № | Ветка (head) | База PR | Коммиты |
|---|---|---|---|
| 1 | `chore/tooling` | `main` | Jest, npm-скрипты, правила `.gitignore`, `.env.example` |
| 2 | `feat/argon2-params` | `chore/tooling` | параметры Argon2id через аргументы и ENV |
| 3 | `feat/argon2-benchmark` | `feat/argon2-params` | бенчмарк Argon2id (20 МБ, p=1, сравнение с OWASP) |
| 4 | `tests/happy-negative-and-e2e` | `feat/argon2-benchmark` | юнит-тесты Happy/Negative path, rateLimiter, E2E API |
| 5 | `feat/user-scenario` | `tests/happy-negative-and-e2e` | сценарий пользователя одной командой |
| 6 | `docs/run-guide` | `feat/user-scenario` | руководство «запуск без VS Code», README |
| 7 | `ci/github-actions` | `docs/run-guide` | workflow CI и бенчмарка, правила работы с ветками |

## Ссылки для создания PR

1. https://github.com/alukonin38-ctrl/phone-shop/compare/main...chore/tooling?expand=1
2. https://github.com/alukonin38-ctrl/phone-shop/compare/chore/tooling...feat/argon2-params?expand=1
3. https://github.com/alukonin38-ctrl/phone-shop/compare/feat/argon2-params...feat/argon2-benchmark?expand=1
4. https://github.com/alukonin38-ctrl/phone-shop/compare/feat/argon2-benchmark...tests/happy-negative-and-e2e?expand=1
5. https://github.com/alukonin38-ctrl/phone-shop/compare/tests/happy-negative-and-e2e...feat/user-scenario?expand=1
6. https://github.com/alukonin38-ctrl/phone-shop/compare/feat/user-scenario...docs/run-guide?expand=1
7. https://github.com/alukonin38-ctrl/phone-shop/compare/docs/run-guide...ci/github-actions?expand=1

Для каждого PR: открыть ссылку, убедиться, что в поле **base** стоит ветка из колонки «База PR»,
нажать **Create pull request** (описание подставится из шаблона).

## Правила слияния

1. Мержить **по порядку**, начиная с №1 — иначе в следующем PR появится «лишний» diff.
2. Использовать **Merge commit** или **Rebase and merge**. При *Squash and merge* коммиты
   предыдущих веток «схлопываются» в один, и нижележащие PR-ы начнут конфликтовать —
   стек в таком случае придётся пересобрать.
3. После слияния PR №1 база остальных PR автоматически переключится на `main` — дальше просто
   жмём **Merge**.
4. Проверки CI появляются после того, как в `main` попадёт ветка №7 (в ней лежит сам workflow).

## Если не хочется разбираться со стеком

Вся работа целиком лежит в ветке `ci/github-actions`. Достаточно открыть один PR
`main ← ci/github-actions`, дождаться зелёных проверок и замержить его, а остальные PR-ы закрыть.
