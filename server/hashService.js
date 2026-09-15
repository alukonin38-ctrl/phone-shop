// hashService.js — двухслойное хеширование пароля
const bcrypt = require('bcryptjs');
const { sha256 } = require('./sha256');

/**
 * Создаёт хеш пароля:
 *  1) SHA-256 от (password + pepper)
 *  2) bcrypt от результата
 *
 * Pepper — секретная строка из .env, добавляется перед SHA-256.
 */
async function hashPassword(password) {
  const pepper = process.env.PEPPER || 'default-pepper-change-me';
  const preHash = sha256(password + pepper);       // 64 hex-символа
  const bcryptHash = await bcrypt.hash(preHash, 10);
  return bcryptHash;
}

/**
 * Проверяет пароль против сохранённого bcrypt-хеша.
 */
async function verifyPassword(password, storedHash) {
  const pepper = process.env.PEPPER || 'default-pepper-change-me';
  const preHash = sha256(password + pepper);
  return bcrypt.compare(preHash, storedHash);
}

module.exports = { hashPassword, verifyPassword };