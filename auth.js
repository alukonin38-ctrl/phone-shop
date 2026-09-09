// Проверка поддержки криптографии
export function isCryptoSupported() {
    return !!(window.crypto && window.crypto.subtle);
}

// Генерация соли
async function generateSalt() {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Хеширование пароля
export async function hashPassword(password) {
    if (!isCryptoSupported()) {
        throw new Error('Криптография не поддерживается');
    }
    const salt = await generateSalt();
    const encoder = new TextEncoder();
    const data = encoder.encode(password + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return { hash, salt };
}

// Проверка пароля
export async function verifyPassword(password, storedHash, storedSalt) {
    if (!isCryptoSupported()) {
        throw new Error('Криптография не поддерживается');
    }
    const encoder = new TextEncoder();
    const data = encoder.encode(password + storedSalt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return computedHash === storedHash;
}

// Работа с localStorage
const STORAGE_KEY = 'users';

export function getUsers() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
}

export function saveUser(user) {
    const users = getUsers();
    users.push(user);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
}

export function findUser(login) {
    const users = getUsers();
    return users.find(u => u.login === login) || null;
}