// server/__tests__/hashService.test.js
// Юнит-тесты для модуля hashService.js (Argon2id)

const { hashPassword, verifyPassword } = require('../hashService');

// ============================================================
// ТЕСТЫ ДЛЯ hashPassword
// ============================================================
describe('hashPassword', () => {
  test('возвращает строку', async () => {
    const hash = await hashPassword('MyPass123');
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);
  });

  test('хеш начинается с $argon2id$ (используется Argon2id)', async () => {
    const hash = await hashPassword('MyPass123');
    expect(hash.startsWith('$argon2id$')).toBe(true);
  });

  test('одинаковые пароли дают разные хеши (соль работает)', async () => {
    const hash1 = await hashPassword('MyPass123');
    const hash2 = await hashPassword('MyPass123');
    expect(hash1).not.toBe(hash2);
  });

  test('разные пароли дают разные хеши', async () => {
    const hash1 = await hashPassword('MyPass123');
    const hash2 = await hashPassword('OtherPass456');
    expect(hash1).not.toBe(hash2);
  });

  test('хеш не содержит исходный пароль', async () => {
    const password = 'SecretPassword42';
    const hash = await hashPassword(password);
    expect(hash.includes(password)).toBe(false);
  });
});

// ============================================================
// ТЕСТЫ ДЛЯ verifyPassword
// ============================================================
describe('verifyPassword', () => {
  test('верный пароль проходит проверку', async () => {
    const password = 'MyPass123';
    const hash = await hashPassword(password);
    const result = await verifyPassword(password, hash);
    expect(result).toBe(true);
  });

  test('неверный пароль не проходит проверку', async () => {
    const hash = await hashPassword('MyPass123');
    const result = await verifyPassword('WrongPass456', hash);
    expect(result).toBe(false);
  });

  test('проверка чувствительна к регистру', async () => {
    const hash = await hashPassword('MyPass123');
    const result = await verifyPassword('mypass123', hash);
    expect(result).toBe(false);
  });

  test('проверка чувствительна к пробелам', async () => {
    const hash = await hashPassword('MyPass123');
    const result = await verifyPassword('MyPass123 ', hash);
    expect(result).toBe(false);
  });

  test('возвращает false при повреждённом хеше', async () => {
    const result = await verifyPassword('MyPass123', 'это-не-хеш');
    expect(result).toBe(false);
  });

  test('возвращает false при пустом хеше', async () => {
    const result = await verifyPassword('MyPass123', '');
    expect(result).toBe(false);
  });
});

// ============================================================
// ИНТЕГРАЦИОННЫЙ ТЕСТ: hash → verify
// ============================================================
describe('hashPassword + verifyPassword (интеграция)', () => {
  test('полный цикл: хешируем, проверяем верный и неверный', async () => {
    const password = 'SafePassword2025!';
    const wrongPassword = 'SafePassword2025';

    const hash = await hashPassword(password);

    // Верный пароль
    expect(await verifyPassword(password, hash)).toBe(true);

    // Неверный пароль
    expect(await verifyPassword(wrongPassword, hash)).toBe(false);
  });

  test('несколько пользователей с одинаковым паролем — разные хеши', async () => {
    const password = 'SamePass123';
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);
    const hash3 = await hashPassword(password);

    expect(hash1).not.toBe(hash2);
    expect(hash2).not.toBe(hash3);
    expect(hash1).not.toBe(hash3);

    // Но все три принимают верный пароль
    expect(await verifyPassword(password, hash1)).toBe(true);
    expect(await verifyPassword(password, hash2)).toBe(true);
    expect(await verifyPassword(password, hash3)).toBe(true);
  });
});