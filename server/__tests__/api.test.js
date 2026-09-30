// server/__tests__/api.test.js
// E2E-тесты HTTP API (Happy path / Negative path).
// Сервер запускается отдельным процессом на свободном порту с временной БД (DB_PATH),
// поэтому боевая users.db и .env проекта не затрагиваются.

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const initSqlJs = require('sql.js');

const SERVER_DIR = path.resolve(__dirname, '..');
const SERVER_ENTRY = path.join(SERVER_DIR, 'server.js');

// Быстрые параметры Argon2 для тестов: проверяем логику API, а не стоимость хеширования.
const FAST_ARGON = {
  ARGON2_MEMORY_COST: '8192',
  ARGON2_TIME_COST: '1',
  ARGON2_PARALLELISM: '1'
};

let child = null;
let baseUrl = '';
let dbPath = '';
let serverLog = '';

/** Запускает сервер на свободном порту и ждёт строку о запуске. */
function startServer() {
  return new Promise((resolve, reject) => {
    dbPath = path.join(os.tmpdir(), `phone-shop-test-${process.pid}-${Date.now()}.db`);
    child = spawn(process.execPath, [SERVER_ENTRY], {
      cwd: SERVER_DIR,
      env: { ...process.env, ...FAST_ARGON, PORT: '0', DB_PATH: dbPath },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const timeout = setTimeout(
      () => reject(new Error(`Сервер не запустился за 30 с. Лог:\n${serverLog}`)),
      30000
    );

    child.stdout.on('data', chunk => {
      serverLog += chunk.toString();
      const match = serverLog.match(/Server running on (http:\/\/localhost:\d+)/);
      if (match) {
        clearTimeout(timeout);
        baseUrl = match[1];
        resolve(baseUrl);
      }
    });

    child.stderr.on('data', chunk => { serverLog += chunk.toString(); });

    child.on('exit', code => {
      if (!baseUrl) {
        clearTimeout(timeout);
        reject(new Error(`Сервер завершился с кодом ${code}. Лог:\n${serverLog}`));
      }
    });
  });
}

/** Останавливает сервер и удаляет временную БД. */
async function stopServer() {
  if (child && child.exitCode === null) {
    await new Promise(resolve => {
      child.once('exit', resolve);
      child.kill();
    });
  }
  try {
    if (dbPath && fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  } catch {
    // файл может остаться заблокированным на пару секунд — на результат тестов не влияет
  }
}

/** POST-запрос с JSON-телом. */
async function post(pathname, body) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {})
  });
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  return { status: response.status, data };
}

const register = (login, password, confirm = password) =>
  post('/api/register', { login, password, confirm });

const login = (loginName, password) => post('/api/login', { login: loginName, password });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/** Читает пользователя напрямую из SQLite-файла, который пишет запущенный сервер. */
async function readUserRow(loginName) {
  const SQL = await initSqlJs();
  const database = new SQL.Database(fs.readFileSync(dbPath));
  const stmt = database.prepare('SELECT * FROM users WHERE login = ?');
  stmt.bind([loginName]);
  const row = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  database.close();
  return row;
}

/** Читает строку из таблицы login_attempts (для проверки счётчиков и блокировок). */
async function readAttemptRow(loginName) {
  const SQL = await initSqlJs();
  const database = new SQL.Database(fs.readFileSync(dbPath));
  const stmt = database.prepare('SELECT * FROM login_attempts WHERE login = ?');
  stmt.bind([loginName]);
  const row = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  database.close();
  return row;
}

beforeAll(async () => {
  await startServer();
});

afterAll(async () => {
  await stopServer();
});

// ============================================================
// GET / — Happy path (health-check)
// ============================================================
describe('GET / — Happy path', () => {
  test('отвечает 200 и статусом ok', async () => {
    const response = await fetch(`${baseUrl}/`);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.status).toBe('ok');
    expect(data.message).toMatch(/работает/i);
  });
});

// ============================================================
// GET /api/unknown — Negative path
// ============================================================
describe('GET /api/unknown — Negative path', () => {
  test('несуществующий маршрут отвечает 404', async () => {
    const response = await fetch(`${baseUrl}/api/unknown`);
    expect(response.status).toBe(404);
  });
});

// ============================================================
// POST /api/register — Happy path
// ============================================================
describe('POST /api/register — Happy path', () => {
  const loginName = 'happy_user';
  const password = 'HappyPass123';

  test('регистрирует нового пользователя (201)', async () => {
    const response = await register(loginName, password);
    expect(response.status).toBe(201);
    expect(response.data.message).toMatch(/Регистрация успешна/i);
  });

  test('пароль в БД хранится как Argon2id-хеш, а не открытым текстом', async () => {
    const row = await readUserRow(loginName);
    expect(row).not.toBeNull();
    expect(row.password_hash.startsWith('$argon2id$')).toBe(true);
    expect(row.password_hash).not.toContain(password);
  });

  test('зарегистрированный пользователь может войти (200)', async () => {
    const response = await login(loginName, password);
    expect(response.status).toBe(200);
    expect(response.data.user.login).toBe(loginName);
    expect(response.data.message).toMatch(/Вход выполнен/i);
  });

  test('ответ на вход не содержит хеш пароля', async () => {
    const response = await login(loginName, password);
    expect(JSON.stringify(response.data)).not.toContain('$argon2id$');
  });

  test('логин обрезается от пробелов при регистрации и входе', async () => {
    const response = await register('  space_user  ', 'SpacePass123');
    expect(response.status).toBe(201);
    expect(await readUserRow('space_user')).not.toBeNull();

    const loginResponse = await login('  space_user  ', 'SpacePass123');
    expect(loginResponse.status).toBe(200);
  });
});

// ============================================================
// POST /api/register — Negative path
// ============================================================
describe('POST /api/register — Negative path', () => {
  test('пустое тело запроса → 400 «Заполните все поля»', async () => {
    const response = await post('/api/register', {});
    expect(response.status).toBe(400);
    expect(response.data.error).toMatch(/Заполните все поля/i);
  });

  test('не передан confirm → 400', async () => {
    const response = await post('/api/register', { login: 'no_confirm', password: 'NoConfirm123' });
    expect(response.status).toBe(400);
    expect(response.data.error).toMatch(/Заполните все поля/i);
  });

  test('логин короче 3 символов → 400', async () => {
    const response = await register('ab', 'ShortLogin123');
    expect(response.status).toBe(400);
    expect(response.data.error).toMatch(/не короче 3/i);
  });

  test('логин с кириллицей → 400', async () => {
    const response = await register('пользователь', 'CyrillicPass123');
    expect(response.status).toBe(400);
    expect(response.data.error).toMatch(/латиницу/i);
  });

  test('логин длиннее 20 символов → 400', async () => {
    const response = await register('a'.repeat(21), 'LongLoginPass123');
    expect(response.status).toBe(400);
    expect(response.data.error).toMatch(/не длиннее 20/i);
  });

  test('короткий пароль → 400', async () => {
    const response = await register('weak_pass_user', 'Ab1');
    expect(response.status).toBe(400);
    expect(response.data.error).toMatch(/минимум 8/i);
  });

  test('распространённый пароль → 400', async () => {
    const response = await register('common_pass_user', 'Password123');
    expect(response.status).toBe(400);
    expect(response.data.error).toMatch(/распространён/i);
  });

  test('пароль-«набор клавиш» ("Xcvb#721") → 400', async () => {
    const response = await register('keyboard_pass_user', 'Xcvb#721');
    expect(response.status).toBe(400);
    expect(response.data.error).toMatch(/клавиш/i);
  });

  test('пароль без цифр → 400', async () => {
    const response = await register('no_digit_user', 'NoDigitsHere');
    expect(response.status).toBe(400);
    expect(response.data.error).toMatch(/цифру/i);
  });

  test('пароли не совпадают → 400', async () => {
    const response = await register('mismatch_user', 'MismatchPass123', 'MismatchPass456');
    expect(response.status).toBe(400);
    expect(response.data.error).toMatch(/не совпадают/i);
  });

  test('повторная регистрация того же логина → 400', async () => {
    const first = await register('dup_user', 'Dup-Qx7mZ2');
    expect(first.status).toBe(201);

    const second = await register('dup_user', 'Dup-Qx7mZ2');
    expect(second.status).toBe(400);
    expect(second.data.error).toMatch(/уже существует/i);
  });

  test('отклонённые регистрации не создают пользователей в БД', async () => {
    expect(await readUserRow('weak_pass_user')).toBeNull();
    expect(await readUserRow('mismatch_user')).toBeNull();
    expect(await readUserRow('keyboard_pass_user')).toBeNull();
  });
});

// ============================================================
// POST /api/login — Happy path
// ============================================================
describe('POST /api/login — Happy path', () => {
  const loginName = 'login_happy_user';
  const password = 'LoginHappy123';

  beforeAll(async () => {
    await register(loginName, password);
  });

  test('верные логин и пароль → 200 и данные пользователя', async () => {
    const response = await login(loginName, password);
    expect(response.status).toBe(200);
    expect(response.data.message).toMatch(/Вход выполнен/i);
    expect(response.data.user.login).toBe(loginName);
    expect(typeof response.data.user.id).toBe('number');
  });

  test('логин регистрозависим: другой регистр → 401', async () => {
    const response = await login(loginName.toUpperCase(), password);
    expect(response.status).toBe(401);
  });

  test('после успешного входа счётчик неудачных попыток сбрасывается', async () => {
    // одна неудачная попытка → блокировка 5 секунд
    const failed = await login(loginName, 'WrongPass999');
    expect(failed.status).toBe(401);

    // ждём окончания блокировки и входим верно (счётчик должен обнулиться)
    await sleep(5300);
    const success = await login(loginName, password);
    expect(success.status).toBe(200);

    // если счётчик сброшен, следующая ошибка снова даёт 5 секунд, а не 10
    const failedAgain = await login(loginName, 'WrongPass999');
    expect(failedAgain.status).toBe(401);
    expect(failedAgain.data.lockSeconds).toBe(5);
  }, 20000);
});

// ============================================================
// POST /api/login — Negative path (валидация и неверные данные)
// ============================================================
describe('POST /api/login — Negative path', () => {
  const loginName = 'neg_pass_user';
  const password = 'NegPass1234';

  beforeAll(async () => {
    await register(loginName, password);
  });

  test('пустое тело запроса → 400', async () => {
    const response = await post('/api/login', {});
    expect(response.status).toBe(400);
    expect(response.data.error).toMatch(/Заполните все поля/i);
  });

  test('передан только логин → 400', async () => {
    const response = await post('/api/login', { login: 'only_login' });
    expect(response.status).toBe(400);
    expect(response.data.error).toMatch(/Заполните все поля/i);
  });

  test('невалидный логин (короче 3 символов) → 400', async () => {
    const response = await login('ab', password);
    expect(response.status).toBe(400);
    expect(response.data.error).toMatch(/не короче 3/i);
  });

  test('несуществующий пользователь → 401 и задержка 5 секунд', async () => {
    const response = await login('ghost_user_1', 'GhostPass123');
    expect(response.status).toBe(401);
    expect(response.data.error).toMatch(/Неверный логин или пароль/i);
    expect(response.data.lockSeconds).toBe(5);
  });

  test('неверный пароль существующего пользователя → 401 и задержка 5 секунд', async () => {
    const response = await login(loginName, 'WrongNegPass1');
    expect(response.status).toBe(401);
    expect(response.data.lockSeconds).toBe(5);
  });

  test('пароль неверного типа (число) → 401, а не 500', async () => {
    await sleep(5300);
    const response = await login(loginName, 12345678);
    expect(response.status).toBe(401);
  }, 15000);
});

// ============================================================
// POST /api/login — блокировка после неудачных попыток (Negative path)
// ============================================================
describe('POST /api/login — блокировка (Negative path)', () => {
  const loginName = 'lock_user';
  const password = 'LockUserPass1';

  beforeAll(async () => {
    await register(loginName, password);
  });

  test('неверный пароль → 401 и задержка ровно 5 секунд', async () => {
    const response = await login(loginName, 'WrongLockPass');
    expect(response.status).toBe(401);
    expect(response.data.lockSeconds).toBe(5);
  });

  test('во время задержки вход запрещён даже с верным паролем → 429', async () => {
    const response = await login(loginName, password);
    expect(response.status).toBe(429);
    expect(response.data.error).toMatch(/Слишком много попыток/i);
    expect(response.data.lockSeconds).toBeGreaterThan(0);
  });

  test('счётчик и время блокировки сохранены в БД', async () => {
    const attempt = await readAttemptRow(loginName);
    expect(attempt.failed_count).toBe(1);
    expect(Number(attempt.locked_until)).toBeGreaterThan(Date.now());
  });

  test('эскалация задержек: 5 → 10 → 15 секунд', async () => {
    await sleep(5300); // ждём окончания блокировки в 5 секунд
    const second = await login(loginName, 'WrongLockPass');
    expect(second.status).toBe(401);
    expect(second.data.lockSeconds).toBe(10);

    await sleep(10300); // ждём окончания блокировки в 10 секунд
    const third = await login(loginName, 'WrongLockPass');
    expect(third.status).toBe(401);
    expect(third.data.lockSeconds).toBe(15);

    const attempt = await readAttemptRow(loginName);
    expect(attempt.failed_count).toBe(3);
  }, 40000);

  test('верный вход после окончания блокировки обнуляет счётчик', async () => {
    await sleep(15300); // ждём окончания блокировки в 15 секунд

    const success = await login(loginName, password);
    expect(success.status).toBe(200);

    // resetAttempts удаляет запись из login_attempts
    expect(await readAttemptRow(loginName)).toBeNull();
  }, 40000);
});
