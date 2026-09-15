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
  // Только латиница, цифры, _, -
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
    // Ограничение bcrypt
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

// ---------- СЛОВАРЬ ЧАСТЫХ ПАРОЛЕЙ ----------
// Короткий, но показательный список. В реальном проекте
// используйте файл на десятки тысяч слов (например, rockyou.txt).
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', 'qwerty', 'qwerty123',
  '12345678', '123456789', '1234567890', '11111111', '00000000',
  'iloveyou', 'admin', 'admin123', 'root', 'letmein', 'welcome',
  'monkey', 'dragon', 'sunshine', 'princess', 'football',
  'baseball', 'abc12345', 'abcdefgh', 'qazwsx', '1q2w3e4r',
  'qwertyuiop', 'asdfghjkl', 'zxcvbnm', 'qwe123', 'qweasd',
  'password!', 'p@ssw0rd', 'passw0rd', 'master', 'hello',
  'freedom', 'whatever', 'trustno1', 'starwars', 'superman',
  'batman', 'login', 'user', 'guest', 'test', 'test123',
  'minecraft', 'pokemon', 'samsung', 'iphone', 'google',
  'moscow', 'russia', 'london', 'paris', 'berlin'
]);

function isCommonPassword(password) {
  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) return true;
  // Проверяем "password" + цифры
  if (/^password\d*$/.test(lower)) return true;
  // Проверяем "qwerty" + цифры
  if (/^qwerty\d*$/.test(lower)) return true;
  // Только цифры (от 6 до 12)
  if (/^\d{6,12}$/.test(lower)) return true;
  return false;
}

// ---------- ДЕТЕКТОР «КЛАВИАТУРНОГО МУСОРА» ----------
// Ловит последовательности: qwerty, asdf, zxcv, 1234, abcd и т.п.
function isKeyboardMash(password) {
  const lower = password.toLowerCase();

  // 1. Проверка на последовательности клавиш (qwerty, asdf, zxcv)
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

  // 2. Проверка на повторяющиеся символы: aaaa, 1111, !!!!
  if (/(.)\1{3,}/.test(lower)) return true;

  // 3. Проверка на чередование: ababab, 121212
  if (/(..)\1{2,}/.test(lower)) return true;

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