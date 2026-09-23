// db.js — настоящая SQLite через sql.js (WebAssembly, без компиляции)
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.resolve(__dirname, 'users.db');
let db = null;

async function init() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      login TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS login_attempts (
      login TEXT PRIMARY KEY,
      failed_count INTEGER DEFAULT 0,
      locked_until INTEGER DEFAULT 0
    );
  `);

  save();
  console.log('SQLite база данных готова');
}

function save() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function findUserByLogin(login) {
  const stmt = db.prepare('SELECT * FROM users WHERE login = ?');
  stmt.bind([login]);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

function createUser(login, passwordHash) {
  db.run('INSERT INTO users (login, password_hash) VALUES (?, ?)', [login, passwordHash]);
  save();
  return findUserByLogin(login);
}

function getAttempt(login) {
  const stmt = db.prepare('SELECT * FROM login_attempts WHERE login = ?');
  stmt.bind([login]);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

function setAttempt(login, failedCount, lockedUntil) {
  const existing = getAttempt(login);
  if (existing) {
    db.run('UPDATE login_attempts SET failed_count = ?, locked_until = ? WHERE login = ?',
           [failedCount, lockedUntil, login]);
  } else {
    db.run('INSERT INTO login_attempts (login, failed_count, locked_until) VALUES (?, ?, ?)',
           [login, failedCount, lockedUntil]);
  }
  save();
}

function clearAttempt(login) {
  db.run('DELETE FROM login_attempts WHERE login = ?', [login]);
  save();
}

module.exports = {
  init,
  findUserByLogin,
  createUser,
  getAttempt,
  setAttempt,
  clearAttempt
};