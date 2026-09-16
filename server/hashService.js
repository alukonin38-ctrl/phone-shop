// hashService.js — хеширование паролей через Argon2id
const argon2 = require('@node-rs/argon2');

/**
 * Создаёт Argon2id-хеш пароля.
 * Параметры соответствуют рекомендациям OWASP:
 *   memoryCost = 64 МБ, timeCost = 3, parallelism = 4
 * @param {string} password
 * @returns {Promise<string>} строка вида $argon2id$v=19$m=65536,t=3,p=4$...
 */
async function hashPassword(password) {
  return await argon2.hash(password, {
    memoryCost: 65536,   // 64 МБ памяти на каждый хеш
    timeCost: 3,         // 3 итерации
    parallelism: 4,      // 4 потока
    algorithm: argon2.Algorithm.Argon2id,
  });
}

/**
 * Проверяет пароль против сохранённого хеша.
 * @param {string} password
 * @param {string} storedHash
 * @returns {Promise<boolean>}
 */
async function verifyPassword(password, storedHash) {
  try {
    return await argon2.verify(storedHash, password);
  } catch (err) {
    console.error('Ошибка проверки Argon2:', err);
    return false;
  }
}

module.exports = { hashPassword, verifyPassword };