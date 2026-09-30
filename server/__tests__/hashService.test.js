// server/__tests__/hashService.test.js
// Юнит-тесты для модуля hashService.js (Argon2id).
// Структура: Happy path (корректные данные) и Negative path (ошибочные данные).

const {
  hashPassword,
  verifyPassword,
  getArgon2Params,
  DEFAULT_PARAMS
} = require('../hashService');

// Быстрые параметры для тестов: проверяем логику, а не стоимость хеширования.
const FAST = { memoryCost: 8192, timeCost: 1, parallelism: 1 };

// ============================================================
// getArgon2Params — Happy path
// ============================================================
describe('getArgon2Params — Happy path', () => {
  test('по умолчанию возвращает параметры OWASP (64 МБ, t=3, p=4)', () => {
    const params = getArgon2Params();
    expect(params.memoryCost).toBe(65536);
    expect(params.timeCost).toBe(3);
    expect(params.parallelism).toBe(4);
    expect(params.memoryCost).toBe(DEFAULT_PARAMS.memoryCost);
  });

  test('принимает переопределение 20 МБ и parallelism = 1', () => {
    const params = getArgon2Params({ memoryCost: 20480, parallelism: 1 });
    expect(params.memoryCost).toBe(20480);
    expect(params.parallelism).toBe(1);
    expect(params.timeCost).toBe(DEFAULT_PARAMS.timeCost);
  });

  test('читает параметры из переменных окружения', () => {
    process.env.ARGON2_MEMORY_COST = '20480';
    process.env.ARGON2_PARALLELISM = '1';
    try {
      const params = getArgon2Params();
      expect(params.memoryCost).toBe(20480);
      expect(params.parallelism).toBe(1);
    } finally {
      delete process.env.ARGON2_MEMORY_COST;
      delete process.env.ARGON2_PARALLELISM;
    }
  });

  test('аргумент функции приоритетнее переменной окружения', () => {
    process.env.ARGON2_MEMORY_COST = '20480';
    try {
      expect(getArgon2Params({ memoryCost: 19456 }).memoryCost).toBe(19456);
    } finally {
      delete process.env.ARGON2_MEMORY_COST;
    }
  });
});

// ============================================================
// hashPassword — Happy path
// ============================================================
describe('hashPassword — Happy path', () => {
  test('возвращает непустую строку', async () => {
    const hash = await hashPassword('MyPass123', FAST);
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);
  });

  test('по умолчанию использует Argon2id с параметрами OWASP (m=65536,t=3,p=4)', async () => {
    const hash = await hashPassword('MyPass123');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(hash).toContain('m=65536,t=3,p=4');
  });

  test('параметры 20 МБ + parallelism = 1 попадают в строку хеша', async () => {
    const hash = await hashPassword('MyPass123', { memoryCost: 20480, timeCost: 3, parallelism: 1 });
    expect(hash).toContain('m=20480,t=3,p=1');
  });

  test('одинаковые пароли дают разные хеши (соль работает)', async () => {
    const hash1 = await hashPassword('MyPass123', FAST);
    const hash2 = await hashPassword('MyPass123', FAST);
    expect(hash1).not.toBe(hash2);
  });

  test('разные пароли дают разные хеши', async () => {
    const hash1 = await hashPassword('MyPass123', FAST);
    const hash2 = await hashPassword('OtherPass456', FAST);
    expect(hash1).not.toBe(hash2);
  });

  test('хеш не содержит исходный пароль', async () => {
    const password = 'SecretPassword42';
    const hash = await hashPassword(password, FAST);
    expect(hash.includes(password)).toBe(false);
  });

  test('хеширует пароль максимальной длины (72 символа)', async () => {
    const longPassword = 'A' + 'a1' + 'x'.repeat(69); // ровно 72 символа
    expect(longPassword.length).toBe(72);
    const hash = await hashPassword(longPassword, FAST);
    expect(await verifyPassword(longPassword, hash)).toBe(true);
  });
});

// ============================================================
// hashPassword — Negative path
// ============================================================
describe('hashPassword — Negative path', () => {
  test('пустая строка → TypeError', async () => {
    await expect(hashPassword('', FAST)).rejects.toThrow(TypeError);
  });

  test('undefined → TypeError', async () => {
    await expect(hashPassword(undefined, FAST)).rejects.toThrow(TypeError);
  });

  test('null → TypeError', async () => {
    await expect(hashPassword(null, FAST)).rejects.toThrow(TypeError);
  });

  test('число вместо пароля → TypeError', async () => {
    await expect(hashPassword(12345678, FAST)).rejects.toThrow(TypeError);
  });

  test('объект вместо пароля → TypeError', async () => {
    await expect(hashPassword({ password: 'MyPass123' }, FAST)).rejects.toThrow(TypeError);
  });
});

// ============================================================
// verifyPassword — Happy path
// ============================================================
describe('verifyPassword — Happy path', () => {
  test('верный пароль проходит проверку', async () => {
    const password = 'MyPass123';
    const hash = await hashPassword(password, FAST);
    expect(await verifyPassword(password, hash)).toBe(true);
  });

  test('работает с хешем, созданным с параметрами 20 МБ и parallelism = 1', async () => {
    const password = 'MyPass123';
    const hash = await hashPassword(password, { memoryCost: 20480, timeCost: 3, parallelism: 1 });
    expect(await verifyPassword(password, hash)).toBe(true);
  });

  test('работает с хешем пароля максимальной длины (72 символа)', async () => {
    const password = 'Zz9' + 'q'.repeat(69);
    const hash = await hashPassword(password, FAST);
    expect(await verifyPassword(password, hash)).toBe(true);
  });
});

// ============================================================
// verifyPassword — Negative path
// ============================================================
describe('verifyPassword — Negative path', () => {
  test('неверный пароль не проходит проверку', async () => {
    const hash = await hashPassword('MyPass123', FAST);
    expect(await verifyPassword('WrongPass456', hash)).toBe(false);
  });

  test('проверка чувствительна к регистру', async () => {
    const hash = await hashPassword('MyPass123', FAST);
    expect(await verifyPassword('mypass123', hash)).toBe(false);
  });

  test('проверка чувствительна к пробелам', async () => {
    const hash = await hashPassword('MyPass123', FAST);
    expect(await verifyPassword('MyPass123 ', hash)).toBe(false);
  });

  test('возвращает false при повреждённом хеше', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(await verifyPassword('MyPass123', 'это-не-хеш')).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });

  test('возвращает false при пустом хеше', async () => {
    expect(await verifyPassword('MyPass123', '')).toBe(false);
  });

  test('возвращает false при null вместо хеша', async () => {
    expect(await verifyPassword('MyPass123', null)).toBe(false);
  });

  test('возвращает false для чужого формата хеша (bcrypt-строка)', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(await verifyPassword('MyPass123', '$2b$10$abcdefghijklmnopqrstuvwxyz0123456789')).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });

  test('возвращает false, если пароль не строка', async () => {
    const hash = await hashPassword('MyPass123', FAST);
    expect(await verifyPassword(12345678, hash)).toBe(false);
  });

  test('возвращает false, если пароль пустой', async () => {
    const hash = await hashPassword('MyPass123', FAST);
    expect(await verifyPassword('', hash)).toBe(false);
  });
});

// ============================================================
// ИНТЕГРАЦИОННЫЙ ТЕСТ: hash → verify
// ============================================================
describe('hashPassword + verifyPassword — Happy path (интеграция)', () => {
  test('полный цикл: хешируем, проверяем верный и неверный пароль', async () => {
    const password = 'SafePassword2025!';
    const wrongPassword = 'SafePassword2025';

    const hash = await hashPassword(password, FAST);

    // Верный пароль
    expect(await verifyPassword(password, hash)).toBe(true);

    // Неверный пароль
    expect(await verifyPassword(wrongPassword, hash)).toBe(false);
  });

  test('несколько пользователей с одинаковым паролем — разные хеши', async () => {
    const password = 'SamePass123';
    const hash1 = await hashPassword(password, FAST);
    const hash2 = await hashPassword(password, FAST);
    const hash3 = await hashPassword(password, FAST);

    expect(hash1).not.toBe(hash2);
    expect(hash2).not.toBe(hash3);
    expect(hash1).not.toBe(hash3);

    // Но все три принимают верный пароль
    expect(await verifyPassword(password, hash1)).toBe(true);
    expect(await verifyPassword(password, hash2)).toBe(true);
    expect(await verifyPassword(password, hash3)).toBe(true);
  });
});

describe('hashPassword + verifyPassword — Negative path (интеграция)', () => {
  test('хеш одного пользователя не подходит для пароля другого', async () => {
    const hash1 = await hashPassword('FirstPass123', FAST);
    const hash2 = await hashPassword('SecondPass456', FAST);

    expect(await verifyPassword('SecondPass456', hash1)).toBe(false);
    expect(await verifyPassword('FirstPass123', hash2)).toBe(false);
  });

  test('изменение одного символа в хеше ломает проверку', async () => {
    const password = 'MyPass123';
    const hash = await hashPassword(password, FAST);
    const lastChar = hash.slice(-1);
    const tampered = hash.slice(0, -1) + (lastChar === 'A' ? 'B' : 'A');

    expect(await verifyPassword(password, tampered)).toBe(false);
  });
});