// rateLimiter.js — задержки 5 / 10 / 15 секунд
const db = require('./db');

// Возвращает оставшееся время блокировки в секундах (0 — не заблокирован)
function getLockRemaining(login) {
  const row = db.getAttempt(login);
  if (!row) return 0;
  const remaining = Math.ceil((row.locked_until - Date.now()) / 1000);
  return remaining > 0 ? remaining : 0;
}

// Увеличивает счётчик неудачных попыток.
// Возвращает { failedCount, lockSeconds }
function registerFailedAttempt(login) {
  const row = db.getAttempt(login);
  const failedCount = (row ? row.failed_count : 0) + 1;

  let lockSeconds = 0;
  if (failedCount === 1) lockSeconds = 5;
  else if (failedCount === 2) lockSeconds = 10;
  else if (failedCount >= 3) lockSeconds = 15;

  const lockedUntil = Date.now() + lockSeconds * 1000;
  db.setAttempt(login, failedCount, lockedUntil);

  return { failedCount, lockSeconds };
}

// Сброс попыток после успешного входа
function resetAttempts(login) {
  db.clearAttempt(login);
}

module.exports = { getLockRemaining, registerFailedAttempt, resetAttempts };