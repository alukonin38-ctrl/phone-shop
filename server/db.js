// db.js — простое JSON-хранилище вместо SQLite
// Данные хранятся в файле users.json рядом с этим файлом

const fs = require('fs');
const path = require('path');

const DB_PATH = path.resolve(__dirname, 'users.json');

// Начальная структура БД
const DEFAULT_DB = {
  users: [],           // [{ id, login, password_hash, created_at }]
  login_attempts: []   // [{ login, failed_count, locked_until }]
};

// Загрузка БД из файла
function loadDb() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2), 'utf8');
    return JSON.parse(JSON.stringify(DEFAULT_DB));
  }
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    const data = JSON.parse(raw);
    // На случай, если структура неполная
    data.users = data.users || [];
    data.login_attempts = data.login_attempts || [];
    return data;
  } catch (e) {
    console.error('Ошибка чтения users.json, создаём новый:', e.message);
    fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2), 'utf8');
    return JSON.parse(JSON.stringify(DEFAULT_DB));
  }
}

// Сохранение БД в файл
function saveDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

// ============ USERS ============

function findUserByLogin(login) {
  const db = loadDb();
  return db.users.find(u => u.login === login) || null;
}

function createUser(login, passwordHash) {
  const db = loadDb();
  const id = db.users.length > 0 ? Math.max(...db.users.map(u => u.id)) + 1 : 1;
  const user = {
    id,
    login,
    password_hash: passwordHash,
    created_at: new Date().toISOString()
  };
  db.users.push(user);
  saveDb(db);
  return user;
}

// ============ LOGIN ATTEMPTS ============

function getAttempt(login) {
  const db = loadDb();
  return db.login_attempts.find(a => a.login === login) || null;
}

function setAttempt(login, failedCount, lockedUntil) {
  const db = loadDb();
  const existing = db.login_attempts.find(a => a.login === login);
  if (existing) {
    existing.failed_count = failedCount;
    existing.locked_until = lockedUntil;
  } else {
    db.login_attempts.push({ login, failed_count: failedCount, locked_until: lockedUntil });
  }
  saveDb(db);
}

function clearAttempt(login) {
  const db = loadDb();
  const index = db.login_attempts.findIndex(a => a.login === login);
  if (index !== -1) {
    db.login_attempts.splice(index, 1);
    saveDb(db);
  }
}

module.exports = {
  findUserByLogin,
  createUser,
  getAttempt,
  setAttempt,
  clearAttempt
};