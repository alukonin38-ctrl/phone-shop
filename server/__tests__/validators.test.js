// server/__tests__/validators.test.js
// Юнит-тесты для модуля validators.js.
// Структура: Happy path (корректные данные) и Negative path (ошибочные данные).

const {
  validateLogin,
  validatePassword,
  checkPasswordSafety,
  isCommonPassword,
  isKeyboardMash
} = require('../validators');

// ============================================================
// validateLogin — Happy path
// ============================================================
describe('validateLogin — Happy path', () => {
  test('принимает корректный логин', () => {
    expect(validateLogin('validUser123')).toEqual({ ok: true, value: 'validUser123' });
  });

  test('принимает логин с подчёркиванием и дефисом', () => {
    expect(validateLogin('user_123-test')).toEqual({ ok: true, value: 'user_123-test' });
  });

  test('обрезает пробелы по краям', () => {
    expect(validateLogin('  user123  ')).toEqual({ ok: true, value: 'user123' });
  });

  test('принимает логин ровно из 3 символов (нижняя граница)', () => {
    expect(validateLogin('abc')).toEqual({ ok: true, value: 'abc' });
  });

  test('принимает логин ровно из 20 символов (верхняя граница)', () => {
    const login = 'a'.repeat(20);
    expect(validateLogin(login)).toEqual({ ok: true, value: login });
  });
});

// ============================================================
// validateLogin — Negative path
// ============================================================
describe('validateLogin — Negative path', () => {
  test('отклоняет пустой логин', () => {
    const result = validateLogin('');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/обязателен/i);
  });

  test('отклоняет undefined', () => {
    const result = validateLogin(undefined);
    expect(result.ok).toBe(false);
  });

  test('отклоняет null', () => {
    expect(validateLogin(null).ok).toBe(false);
  });

  test('отклоняет число вместо строки', () => {
    expect(validateLogin(12345).ok).toBe(false);
  });

  test('отклоняет логин из одних пробелов', () => {
    expect(validateLogin('     ').ok).toBe(false);
  });

  test('отклоняет логин короче 3 символов', () => {
    const result = validateLogin('ab');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/не короче 3/i);
  });

  test('отклоняет логин длиннее 20 символов', () => {
    const result = validateLogin('a'.repeat(21));
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/не длиннее 20/i);
  });

  test('отклоняет логин с недопустимыми символами (пробел)', () => {
    const result = validateLogin('bad user');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/латиницу/i);
  });

  test('отклоняет логин с кириллицей', () => {
    const result = validateLogin('пользователь');
    expect(result.ok).toBe(false);
  });

  test('отклоняет логин со спецсимволами (@, !, #)', () => {
    expect(validateLogin('user@123').ok).toBe(false);
    expect(validateLogin('user!123').ok).toBe(false);
    expect(validateLogin('user#123').ok).toBe(false);
  });
});

// ============================================================
// validatePassword — Happy path
// ============================================================
describe('validatePassword — Happy path', () => {
  test('принимает корректный пароль', () => {
    expect(validatePassword('MyPass123')).toEqual({ ok: true });
  });

  test('принимает пароль ровно из 8 символов (нижняя граница)', () => {
    expect(validatePassword('MyPass12')).toEqual({ ok: true });
  });

  test('принимает длинный пароль со спецсимволами', () => {
    expect(validatePassword('My-Unique_P@ss42!')).toEqual({ ok: true });
  });
});

// ============================================================
// validatePassword — Negative path
// ============================================================
describe('validatePassword — Negative path', () => {
  test('отклоняет пустой пароль', () => {
    const result = validatePassword('');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/обязателен/i);
  });

  test('отклоняет undefined и null', () => {
    expect(validatePassword(undefined).ok).toBe(false);
    expect(validatePassword(null).ok).toBe(false);
  });

  test('отклоняет число вместо строки', () => {
    expect(validatePassword(12345678).ok).toBe(false);
  });

  test('отклоняет пароль короче 8 символов', () => {
    const result = validatePassword('Ab1');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/минимум 8/i);
  });

  test('отклоняет пароль длиннее 72 символов', () => {
    const result = validatePassword('A'.repeat(73) + 'a1');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/72/i);
  });

  test('отклоняет пароль без строчной буквы', () => {
    const result = validatePassword('MYPASS123');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/строчную/i);
  });

  test('отклоняет пароль без заглавной буквы', () => {
    const result = validatePassword('mypass123');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/заглавную/i);
  });

  test('отклоняет пароль без цифры', () => {
    const result = validatePassword('MyPassword');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/цифру/i);
  });
});

// ============================================================
// isCommonPassword — Happy path (частые пароли находятся)
// ============================================================
describe('isCommonPassword — Happy path', () => {
  test('находит точное совпадение из списка (password)', () => {
    expect(isCommonPassword('password')).toBe(true);
  });

  test('находит точное совпадение без учёта регистра', () => {
    expect(isCommonPassword('PASSWORD')).toBe(true);
    expect(isCommonPassword('PaSsWoRd')).toBe(true);
  });

  test('находит "password" + цифры', () => {
    expect(isCommonPassword('password123')).toBe(true);
    expect(isCommonPassword('password1')).toBe(true);
  });

  test('находит "qwerty" + цифры', () => {
    expect(isCommonPassword('qwerty123')).toBe(true);
    expect(isCommonPassword('qwerty1')).toBe(true);
  });

  test('находит пароль из одних цифр (6-12)', () => {
    expect(isCommonPassword('123456')).toBe(true);
    expect(isCommonPassword('1234567890')).toBe(true);
  });

  test('ловит пароль из 5 цифр, если он есть в списке', () => {
    // '12345' есть в 100k списке — код правильно его отклонит
    expect(isCommonPassword('12345')).toBe(true);
  });
});

// ============================================================
// isCommonPassword — Negative path (уникальные пароли пропускаются)
// ============================================================
describe('isCommonPassword — Negative path', () => {
  test('не считает частым уникальный пароль', () => {
    expect(isCommonPassword('MyUniqueP@ss42')).toBe(false);
  });

  test('не считает частым уникальный набор цифр', () => {
    // Это число вряд ли есть в списке
    expect(isCommonPassword('73912')).toBe(false);
  });

  test('не падает на пустой строке', () => {
    expect(typeof isCommonPassword('')).toBe('boolean');
  });
});

// ============================================================
// isKeyboardMash — Happy path (мусор находится)
// ============================================================
describe('isKeyboardMash — Happy path', () => {
  test('ловит последовательность qwerty', () => {
    expect(isKeyboardMash('qwerty123')).toBe(true);
  });

  test('ловит последовательность asdf', () => {
    expect(isKeyboardMash('asdfghjk')).toBe(true);
  });

  test('ловит последовательность zxcv', () => {
    expect(isKeyboardMash('zxcvbnm')).toBe(true);
  });

  test('ловит последовательность 1234', () => {
    expect(isKeyboardMash('12345678')).toBe(true);
  });

  test('ловит повторяющиеся символы aaaa', () => {
    expect(isKeyboardMash('aaaa1234')).toBe(true);
  });

  test('ловит чередование ababab', () => {
    expect(isKeyboardMash('abababab')).toBe(true);
  });
});

// ============================================================
// isKeyboardMash — Negative path (нормальные пароли пропускаются)
// ============================================================
describe('isKeyboardMash — Negative path', () => {
  test('не ловит нормальный пароль', () => {
    expect(isKeyboardMash('MyUnique42!')).toBe(false);
  });

  test('не ловит пароль с разбросанными символами', () => {
    expect(isKeyboardMash('Xk9#mQ2!')).toBe(false);
  });

  test('не считает мусором короткое повторение (3 символа)', () => {
    // (.)\1{3,} требует 4 и более одинаковых символов подряд
    expect(isKeyboardMash('Xz9qqq#7')).toBe(false);
  });
});

// ============================================================
// checkPasswordSafety — Happy path
// ============================================================
describe('checkPasswordSafety — Happy path', () => {
  test('принимает надёжный пароль', () => {
    expect(checkPasswordSafety('MyUniqueP@ss42')).toEqual({ ok: true });
  });

  test('принимает надёжный пароль со спецсимволами и цифрами', () => {
    expect(checkPasswordSafety('VerY-lOnG_p4ssw0rd!')).toEqual({ ok: true });
  });
});

// ============================================================
// checkPasswordSafety — Negative path
// ============================================================
describe('checkPasswordSafety — Negative path', () => {
  test('отклоняет слишком короткий пароль', () => {
    const result = checkPasswordSafety('Ab1');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/минимум 8/i);
  });

  test('отклоняет частый пароль', () => {
    const result = checkPasswordSafety('password1A');
    // "password1a" содержит "password" + цифру → часто
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/распространён/i);
  });

  test('отклоняет "клавиатурный мусор"', () => {
    const result = checkPasswordSafety('Qwerty123');
    // Qwerty123 — это "qwerty" + "123", но с заглавной Q
    // Проверка isKeyboardMash ловит "qwerty" → вернёт ошибку
    expect(result.ok).toBe(false);
  });

  test('пароль из одних букв без цифр не проходит', () => {
    const result = checkPasswordSafety('MyPassword');
    expect(result.ok).toBe(false);
  });

  test('пароль из одних заглавных не проходит', () => {
    const result = checkPasswordSafety('MYPASSWORD1');
    expect(result.ok).toBe(false);
  });

  test('пароль из одних цифр не проходит', () => {
    const result = checkPasswordSafety('12345678');
    expect(result.ok).toBe(false);
  });

  test('отклоняет пустой пароль и undefined', () => {
    expect(checkPasswordSafety('').ok).toBe(false);
    expect(checkPasswordSafety(undefined).ok).toBe(false);
  });
});