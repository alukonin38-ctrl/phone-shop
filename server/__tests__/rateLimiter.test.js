// server/__tests__/rateLimiter.test.js
// Юнит-тесты для модуля rateLimiter.js (задержки 5 / 10 / 15 секунд).
// Модуль db мокается, чтобы тесты были быстрыми и не трогали реальную users.db.

jest.mock('../db', () => ({
  getAttempt: jest.fn(),
  setAttempt: jest.fn(),
  clearAttempt: jest.fn()
}));

const db = require('../db');
const { getLockRemaining, registerFailedAttempt, resetAttempts } = require('../rateLimiter');

const NOW = 1700000000000; // фиксированное «текущее время» для детерминированных проверок

beforeEach(() => {
  jest.clearAllMocks();
  db.getAttempt.mockReturnValue(null);
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ============================================================
// registerFailedAttempt — Happy path
// ============================================================
describe('registerFailedAttempt — Happy path', () => {
  test('1-я неудачная попытка → задержка 5 секунд', () => {
    expect(registerFailedAttempt('user1')).toEqual({ failedCount: 1, lockSeconds: 5 });
  });

  test('2-я неудачная попытка → задержка 10 секунд', () => {
    db.getAttempt.mockReturnValue({ login: 'user1', failed_count: 1, locked_until: 0 });
    expect(registerFailedAttempt('user1')).toEqual({ failedCount: 2, lockSeconds: 10 });
  });

  test('3-я неудачная попытка → задержка 15 секунд', () => {
    db.getAttempt.mockReturnValue({ login: 'user1', failed_count: 2, locked_until: 0 });
    expect(registerFailedAttempt('user1')).toEqual({ failedCount: 3, lockSeconds: 15 });
  });

  test('эскалация 5 → 10 → 15 → 15 (дальше не растёт)', () => {
    const attempts = new Map();
    db.getAttempt.mockImplementation(login => attempts.get(login) || null);
    db.setAttempt.mockImplementation((login, failedCount) => {
      attempts.set(login, { login, failed_count: failedCount, locked_until: 0 });
    });

    expect(registerFailedAttempt('user2').lockSeconds).toBe(5);
    expect(registerFailedAttempt('user2').lockSeconds).toBe(10);
    expect(registerFailedAttempt('user2').lockSeconds).toBe(15);
    expect(registerFailedAttempt('user2').lockSeconds).toBe(15);
    expect(registerFailedAttempt('user2').failedCount).toBe(5);
  });

  test('сохраняет в БД счётчик и время разблокировки (сейчас + 5 с)', () => {
    registerFailedAttempt('user3');

    expect(db.setAttempt).toHaveBeenCalledTimes(1);
    expect(db.setAttempt).toHaveBeenCalledWith('user3', 1, NOW + 5000);
  });

  test('сохраняет время разблокировки для 15 секунд', () => {
    db.getAttempt.mockReturnValue({ login: 'user4', failed_count: 2, locked_until: 0 });
    registerFailedAttempt('user4');

    expect(db.setAttempt).toHaveBeenCalledWith('user4', 3, NOW + 15000);
  });

  test('попытки разных пользователей не смешиваются', () => {
    const attempts = new Map();
    db.getAttempt.mockImplementation(login => attempts.get(login) || null);
    db.setAttempt.mockImplementation((login, failedCount) => {
      attempts.set(login, { login, failed_count: failedCount, locked_until: 0 });
    });

    expect(registerFailedAttempt('alice').lockSeconds).toBe(5);
    expect(registerFailedAttempt('bob').lockSeconds).toBe(5);
    expect(registerFailedAttempt('alice').lockSeconds).toBe(10);
  });
});

// ============================================================
// registerFailedAttempt — Negative path
// ============================================================
describe('registerFailedAttempt — Negative path', () => {
  test('после 100 неудачных попыток задержка всё ещё 15 секунд (нет переполнения)', () => {
    db.getAttempt.mockReturnValue({ login: 'user5', failed_count: 100, locked_until: NOW + 15000 });

    const result = registerFailedAttempt('user5');
    expect(result.failedCount).toBe(101);
    expect(result.lockSeconds).toBe(15);
  });

  test('не падает, если логин пустой', () => {
    expect(registerFailedAttempt('')).toEqual({ failedCount: 1, lockSeconds: 5 });
  });
});

// ============================================================
// getLockRemaining — Happy path
// ============================================================
describe('getLockRemaining — Happy path', () => {
  test('возвращает точное число оставшихся секунд', () => {
    db.getAttempt.mockReturnValue({ login: 'user6', failed_count: 1, locked_until: NOW + 5000 });
    expect(getLockRemaining('user6')).toBe(5);
  });

  test('округляет неполные секунды вверх', () => {
    db.getAttempt.mockReturnValue({ login: 'user6', failed_count: 1, locked_until: NOW + 4999 });
    expect(getLockRemaining('user6')).toBe(5);
  });

  test('возвращает 0, если записи о попытках нет', () => {
    expect(getLockRemaining('never_failed_user')).toBe(0);
  });
});

// ============================================================
// getLockRemaining — Negative path
// ============================================================
describe('getLockRemaining — Negative path', () => {
  test('возвращает 0, если блокировка уже истекла', () => {
    db.getAttempt.mockReturnValue({ login: 'user7', failed_count: 3, locked_until: NOW - 1000 });
    expect(getLockRemaining('user7')).toBe(0);
  });

  test('возвращает 0, если locked_until = 0 (без блокировки)', () => {
    db.getAttempt.mockReturnValue({ login: 'user7', failed_count: 1, locked_until: 0 });
    expect(getLockRemaining('user7')).toBe(0);
  });

  test('возвращает 0, если locked_until отсутствует', () => {
    db.getAttempt.mockReturnValue({ login: 'user7', failed_count: 1 });
    expect(getLockRemaining('user7')).toBe(0);
  });

  test('возвращает 0 при некорректном locked_until (NaN)', () => {
    db.getAttempt.mockReturnValue({ login: 'user7', failed_count: 1, locked_until: NaN });
    expect(getLockRemaining('user7')).toBe(0);
  });
});

// ============================================================
// resetAttempts — Happy path
// ============================================================
describe('resetAttempts — Happy path', () => {
  test('удаляет счётчик неудачных попыток после успешного входа', () => {
    resetAttempts('user8');
    expect(db.clearAttempt).toHaveBeenCalledWith('user8');
  });
});

// ============================================================
// resetAttempts — Negative path
// ============================================================
describe('resetAttempts — Negative path', () => {
  test('не бросает ошибку для пользователя без попыток', () => {
    db.clearAttempt.mockReturnValue(undefined);
    expect(() => resetAttempts('user_without_attempts')).not.toThrow();
  });

  test('не бросает ошибку при пустом логине', () => {
    expect(() => resetAttempts('')).not.toThrow();
    expect(db.clearAttempt).toHaveBeenCalledWith('');
  });
});
