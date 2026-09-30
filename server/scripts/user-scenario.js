#!/usr/bin/env node
// scripts/user-scenario.js
// Сценарий пользователя: путь «регистрация → вход → каталог» и негативные ветки
// (слабый пароль, занятый логин, неверный пароль, блокировка 5/10 секунд).
//
// Скрипт сам поднимает сервер на свободном порту с временной БД,
// поэтому запускать сервер вручную не нужно.
//
// Запуск без VS Code (из папки server):
//   node scripts/user-scenario.js
//   node scripts/user-scenario.js --url=http://localhost:5000   // проверить уже запущенный сервер
//   node scripts/user-scenario.js --keep-running                // не выключать сервер после сценария
//   npm run scenario

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SERVER_DIR = path.resolve(__dirname, '..');
const SERVER_ENTRY = path.join(SERVER_DIR, 'server.js');

// ---------------- Аргументы ----------------
function parseArgs(argv) {
  const args = {};
  for (const raw of argv) {
    const match = raw.match(/^--([^=]+)(?:=(.*))?$/);
    if (match) args[match[1]] = match[2] === undefined ? true : match[2];
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const useColor = !process.env.NO_COLOR;
const color = (code, text) => (useColor ? `\u001b[${code}m${text}\u001b[0m` : text);
const green = text => color('32', text);
const red = text => color('31', text);
const gray = text => color('90', text);
const bold = text => color('1', text);
const yellow = text => color('33', text);

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// ---------------- Запуск и остановка сервера ----------------
let child = null;
let baseUrl = args.url ? String(args.url).replace(/\/$/, '') : '';
let dbPath = '';
let serverLog = '';

function startServer() {
  return new Promise((resolve, reject) => {
    dbPath = path.join(os.tmpdir(), `phone-shop-scenario-${process.pid}-${Date.now()}.db`);
    child = spawn(process.execPath, [SERVER_ENTRY], {
      cwd: SERVER_DIR,
      env: { ...process.env, PORT: '0', DB_PATH: dbPath },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const timeout = setTimeout(
      () => reject(new Error(`Сервер не запустился за 30 секунд. Лог:\n${serverLog}`)),
      30000
    );

    child.stdout.on('data', chunk => {
      serverLog += chunk.toString();
      const match = serverLog.match(/Server running on (http:\/\/localhost:\d+)/);
      if (match && !baseUrl) {
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
    // временный файл может остаться заблокированным — не критично
  }
}

// ---------------- HTTP ----------------
async function request(method, pathname, body) {
  const options = { method, headers: {} };
  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${baseUrl}${pathname}`, options);
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  return { status: response.status, data };
}

const register = (login, password, confirm = password) =>
  request('POST', '/api/register', { login, password, confirm });

const login = (loginName, password) => request('POST', '/api/login', { login: loginName, password });

// ---------------- Отчёт о шагах ----------------
const results = [];

function step(ok, title, details = '') {
  results.push({ ok, title, details });
  const mark = ok ? green('✔') : red('✘');
  const detail = details ? gray(` — ${details}`) : '';
  console.log(`  ${mark} ${title}${detail}`);
}

function checkStatus(response, expected, title) {
  const ok = response.status === expected;
  const details = `статус ${response.status}` +
    (response.data && response.data.error ? `, ответ: "${response.data.error}"` : '');
  step(ok, title, details);
  return ok;
}

// ---------------- Сам сценарий ----------------
async function runScenario() {
  const suffix = Math.random().toString(36).slice(2, 6);
  const user1 = `scen_${suffix}`;
  const user2 = `scen2_${suffix}`;
  const password1 = 'ScenarioPass123';
  const password2 = 'SecondUserPass9';

  console.log(`\n${bold('Пользователь открывает страницу магазина и проходит регистрацию')}`);
  const health = await request('GET', '/');
  checkStatus(health, 200, 'Сервер отвечает на запрос проверки');

  const created = await register(user1, password1);
  checkStatus(created, 201, `Регистрация нового пользователя "${user1}"`);

  console.log(`\n${bold('Пользователь ошибается при вводе данных (негативные сценарии)')}`);
  checkStatus(await register(user1, password1), 400, 'Повторная регистрация того же логина отклонена');
  checkStatus(await register('ab', password1), 400, 'Слишком короткий логин отклонён');
  checkStatus(await register(`weak_${suffix}`, 'password123'), 400, 'Слишком простой пароль отклонён');
  checkStatus(
    await register(`mism_${suffix}`, 'Mismatch Pass 123', 'Mismatch Pass 456'),
    400,
    'Несовпадающие пароли отклонены'
  );

  console.log(`\n${bold('Пользователь входит в аккаунт')}`);
  const success = await login(user1, password1);
  const successOk = checkStatus(success, 200, 'Вход с верным паролем выполнен');
  if (successOk) {
    step(success.data.user.login === user1, `В ответе вернулся логин "${success.data.user.login}"`);
  }

  console.log(`\n${bold('Пользователь путает пароль и получает задержку')}`);
  const wrong = await login(user1, 'WrongPassword9');
  checkStatus(wrong, 401, 'Вход с неверным паролем отклонён');
  step(
    wrong.data && wrong.data.lockSeconds === 5,
    `Сервер попросил подождать ${wrong.data ? wrong.data.lockSeconds : '?'} секунд`
  );

  const whileLocked = await login(user1, password1);
  checkStatus(whileLocked, 429, 'Во время задержки вход запрещён даже с верным паролем');

  console.log(gray('  … ждём 5 секунд, пока задержка истечёт'));
  await sleep(5300);

  const secondWrong = await login(user1, 'WrongPassword9');
  checkStatus(secondWrong, 401, 'Ещё одна ошибка пароля отклонена');
  step(
    secondWrong.data && secondWrong.data.lockSeconds === 10,
    `Задержка выросла до ${secondWrong.data ? secondWrong.data.lockSeconds : '?'} секунд`
  );

  console.log(`\n${bold('Другой пользователь входит в это же время')}`);
  checkStatus(await register(user2, password2), 201, `Регистрация второго пользователя "${user2}"`);
  checkStatus(await login(user2, password2), 200, 'Второй пользователь вошёл, его задержки не касаются');

  console.log(`\n${bold('Прочие проверки')}`);
  checkStatus(await request('GET', '/api/unknown'), 404, 'Несуществующий маршрут отвечает 404');
}

// ---------------- Запуск ----------------
async function main() {
  console.log(bold('Сценарий пользователя «Магазин телефонов»'));

  if (baseUrl) {
    console.log(gray(`Использую уже запущенный сервер: ${baseUrl}`));
  } else {
    process.stdout.write(gray('Запускаю сервер на свободном порту с временной базой данных... '));
    await startServer();
    console.log(green(`готово (${baseUrl})`));
  }

  const startedAt = Date.now();
  await runScenario();

  const failed = results.filter(item => !item.ok);
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);

  console.log(`\n${bold('Итог сценария')}`);
  console.log(`  шагов выполнено: ${results.length}, успешно: ${green(results.length - failed.length)}, провалено: ${failed.length ? red(failed.length) : '0'}`);
  console.log(gray(`  время выполнения: ${seconds} с`));

  if (failed.length) {
    console.log(yellow('\nЧто пошло не по сценарию:'));
    for (const item of failed) {
      console.log(`  ${red('✘')} ${item.title}${item.details ? gray(` — ${item.details}`) : ''}`);
    }
  } else {
    console.log(green('\nВсе шаги сценария прошли успешно.'));
  }

  console.log(gray('\nПроверить то же самое в браузере:'));
  console.log(gray('  1) cd server && npm start'));
  console.log(gray('  2) в другой консоли: npx http-server .. -p 5501   (или python -m http.server 5501)'));
  console.log(gray('  3) открыть http://localhost:5501 и повторить шаги вручную'));

  if (args['keep-running']) {
    console.log(gray(`\nСервер оставлен запущенным: ${baseUrl} (остановите его через Ctrl+C)`));
  } else {
    await stopServer();
  }

  process.exit(failed.length ? 1 : 0);
}

main().catch(async err => {
  console.error(red(`\nСценарий упал с ошибкой: ${err.message}`));
  if (serverLog) console.error(gray(serverLog));
  await stopServer();
  process.exit(1);
});
