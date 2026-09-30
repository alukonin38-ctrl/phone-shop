// hashService.js — хеширование паролей через Argon2id
const argon2 = require('@node-rs/argon2');

/**
 * Параметры по умолчанию (рекомендации OWASP для Argon2id):
 * memoryCost = 64 МБ, timeCost = 3, parallelism = 4.
 */
const DEFAULT_PARAMS = {
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4
};

/**
 * Приводит значение к положительному целому числу.
 * Нужно, чтобы безопасно задавать параметры из ENV (ARGON2_MEMORY_COST и т.д.).
 * @param {unknown} value
 * @param {number} fallback
 * @returns {number}
 */
function positiveInt(value, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return Math.floor(num);
}

/**
 * Итоговые параметры Argon2id.
 * Приоритет: аргумент функции → переменная окружения → значение по умолчанию.
 * ENV: ARGON2_MEMORY_COST (КиБ), ARGON2_TIME_COST, ARGON2_PARALLELISM.
 * @param {{ memoryCost?: number, timeCost?: number, parallelism?: number }} [overrides]
 */
function getArgon2Params(overrides = {}) {
  return {
    algorithm: argon2.Algorithm.Argon2id,
    memoryCost: positiveInt(overrides.memoryCost ?? process.env.ARGON2_MEMORY_COST, DEFAULT_PARAMS.memoryCost),
    timeCost: positiveInt(overrides.timeCost ?? process.env.ARGON2_TIME_COST, DEFAULT_PARAMS.timeCost),
    parallelism: positiveInt(overrides.parallelism ?? process.env.ARGON2_PARALLELISM, DEFAULT_PARAMS.parallelism)
  };
}

/**
 * Создаёт Argon2id-хеш пароля.
 * Параметры соответствуют рекомендациям OWASP:
 *   memoryCost = 64 МБ, timeCost = 3, parallelism = 4
 * @param {string} password
 * @param {{ memoryCost?: number, timeCost?: number, parallelism?: number }} [overrides]
 *        необязательные параметры (используются тестами и бенчмарком)
 * @returns {Promise<string>} строка вида $argon2id$v=19$m=65536,t=3,p=4$...
 */
async function hashPassword(password, overrides = {}) {
  if (typeof password !== 'string' || password.length === 0) {
    throw new TypeError('Пароль должен быть непустой строкой');
  }
  return await argon2.hash(password, getArgon2Params(overrides));
}

/**
 * Проверяет пароль против сохранённого хеша.
 * @param {string} password
 * @param {string} storedHash
 * @returns {Promise<boolean>}
 */
async function verifyPassword(password, storedHash) {
  if (typeof password !== 'string' || !password || typeof storedHash !== 'string' || !storedHash) {
    return false;
  }
  try {
    return await argon2.verify(storedHash, password);
  } catch (err) {
    console.error('Ошибка проверки Argon2:', err);
    return false;
  }
}

module.exports = { hashPassword, verifyPassword, getArgon2Params, DEFAULT_PARAMS };