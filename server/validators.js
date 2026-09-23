const fs = require('fs');
const path = require('path');

// ---------- ЗАГРУЗКА СПИСКА ЧАСТЫХ ПАРОЛЕЙ ----------
let COMMON_PASSWORDS = new Set();

function loadCommonPasswords() {
  const filePath = path.join(__dirname, '100k-most-used-passwords-NCSC.txt');
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    // Разбиваем по строкам, убираем пустые, приводим к нижнему регистру
    const lines = data.split(/\r?\n/).map(line => line.trim().toLowerCase()).filter(Boolean);
    COMMON_PASSWORDS = new Set(lines);
    console.log(`Загружено ${COMMON_PASSWORDS.size} частых паролей.`);
  } catch (err) {
    console.error('Не удалось загрузить файл с частыми паролями:', err.message);
    // Если файла нет — используем минимальный набор (на случай, если забыли положить файл)
    COMMON_PASSWORDS = new Set([
      'password', '123456', '12345678', 'qwerty', 'abc123', 'monkey', '1234567',
      'letmein', 'trustno1', 'dragon', 'baseball', '111111', 'iloveyou', 'master',
      'sunshine', 'ashley', 'bailey', 'passw0rd', 'shadow', '123123', '654321',
      'superman', 'qazwsx', 'michael', 'football'
    ]);
  }
}

// Загружаем список один раз при старте сервера
loadCommonPasswords();

// ---------- ВАЛИДАЦИЯ ЛОГИНА ----------
function validateLogin(login) {
  if (!login || typeof login !== 'string') {
    return { ok: false, error: 'Логин обязателен' };
  }
  const trimmed = login.trim();
  if (trimmed.length < 3) {
    return { ok: false, error: 'Логин должен быть не короче 3 символов' };
  }
  if (trimmed.length > 20) {
    return { ok: false, error: 'Логин должен быть не длиннее 20 символов' };
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return { ok: false, error: 'Логин может содержать только латиницу, цифры, "_" и "-"' };
  }
  return { ok: true, value: trimmed };
}

// ---------- ВАЛИДАЦИЯ ПАРОЛЯ ----------
function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { ok: false, error: 'Пароль обязателен' };
  }
  if (password.length < 8) {
    return { ok: false, error: 'Пароль должен содержать минимум 8 символов' };
  }
  if (password.length > 72) {
    return { ok: false, error: 'Пароль не должен превышать 72 символа' };
  }
  if (!/[a-z]/.test(password)) {
    return { ok: false, error: 'Пароль должен содержать хотя бы одну строчную букву' };
  }
  if (!/[A-Z]/.test(password)) {
    return { ok: false, error: 'Пароль должен содержать хотя бы одну заглавную букву' };
  }
  if (!/[0-9]/.test(password)) {
    return { ok: false, error: 'Пароль должен содержать хотя бы одну цифру' };
  }
  return { ok: true };
}

// ---------- ПРОВЕРКА НА ЧАСТЫЙ ПАРОЛЬ ----------
function isCommonPassword(password) {
  const lower = password.toLowerCase();

  // 1. Точное совпадение со списком
  if (COMMON_PASSWORDS.has(lower)) return true;

  // 2. "password" + любые символы
  if (/^password/.test(lower)) return true;

  // 3. "qwerty" + любые символы
  if (/^qwerty/.test(lower)) return true;

  // 4. Только цифры (6-12)
  if (/^\d{6,12}$/.test(lower)) return true;

  // 5. Убрать цифры в конце и проверить в списке
  const withoutTrailingDigits = lower.replace(/\d+$/, '');
  if (withoutTrailingDigits.length >= 4 && COMMON_PASSWORDS.has(withoutTrailingDigits)) {
    return true;
  }

  return false;
}
// ---------- ДЕТЕКТОР «КЛАВИАТУРНОГО МУСОРА» ----------
function isKeyboardMash(password) {
  const lower = password.toLowerCase();
  const rows = [
    'qwertyuiop',
    'asdfghjkl',
    'zxcvbnm',
    '1234567890',
    'abcdefghijklmnopqrstuvwxyz'
  ];
  for (const row of rows) {
    for (let len = 4; len <= lower.length; len++) {
      for (let i = 0; i + len <= lower.length; i++) {
        const sub = lower.slice(i, i + len);
        if (row.includes(sub) || row.split('').reverse().join('').includes(sub)) {
          return true;
        }
      }
    }
  }
  if (/(.)\1{3,}/.test(lower)) return true; // aaaa, 1111
  if (/(..)\1{2,}/.test(lower)) return true; // ababab, 121212
  return false;
}

// ---------- КОМПЛЕКСНАЯ ПРОВЕРКА ПАРОЛЯ ----------
function checkPasswordSafety(password) {
  const baseCheck = validatePassword(password);
  if (!baseCheck.ok) return baseCheck;

  if (isCommonPassword(password)) {
    return { ok: false, error: 'Пароль слишком распространён. Придумайте другой.' };
  }
  if (isKeyboardMash(password)) {
    return { ok: false, error: 'Пароль похож на набор подряд идущих клавиш. Придумайте другой.' };
  }
  return { ok: true };
}

module.exports = {
  validateLogin,
  validatePassword,
  checkPasswordSafety,
  isCommonPassword,
  isKeyboardMash
};