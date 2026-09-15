require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');
const { validateLogin, checkPasswordSafety } = require('./validators');
const { getLockRemaining, registerFailedAttempt, resetAttempts } = require('./rateLimiter');
const { hashPassword, verifyPassword } = require('./hashService');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ===================== РЕГИСТРАЦИЯ =====================
app.post('/api/register', async (req, res) => {
  const { login, password, confirm } = req.body;

  if (!login || !password || !confirm) {
    return res.status(400).json({ error: 'Заполните все поля' });
  }

  const loginCheck = validateLogin(login);
  if (!loginCheck.ok) return res.status(400).json({ error: loginCheck.error });

  const passwordCheck = checkPasswordSafety(password);
  if (!passwordCheck.ok) return res.status(400).json({ error: passwordCheck.error });

  if (password !== confirm) {
    return res.status(400).json({ error: 'Пароли не совпадают' });
  }

  try {
    const cleanLogin = loginCheck.value;

    const existing = db.findUserByLogin(cleanLogin);
    if (existing) {
      return res.status(400).json({ error: 'Пользователь уже существует' });
    }

    // Двухслойное хеширование: SHA-256 + bcrypt (bcryptjs)
    const hash = await hashPassword(password);

    db.createUser(cleanLogin, hash);

    res.status(201).json({ message: 'Регистрация успешна' });
  } catch (err) {
    console.error('Ошибка регистрации:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// ===================== ВХОД =====================
app.post('/api/login', async (req, res) => {
  const { login, password } = req.body;

  if (!login || !password) {
    return res.status(400).json({ error: 'Заполните все поля' });
  }

  const loginCheck = validateLogin(login);
  if (!loginCheck.ok) return res.status(400).json({ error: loginCheck.error });
  const cleanLogin = loginCheck.value;

  try {
    // Проверяем блокировку
    const lockRemaining = getLockRemaining(cleanLogin);
    if (lockRemaining > 0) {
      return res.status(429).json({
        error: `Слишком много попыток. Повторите через ${lockRemaining} с.`,
        lockSeconds: lockRemaining
      });
    }

    // Ищем пользователя
    const user = db.findUserByLogin(cleanLogin);

    if (!user) {
      const { lockSeconds } = registerFailedAttempt(cleanLogin);
      return res.status(401).json({
        error: `Неверный логин или пароль. Подождите ${lockSeconds} с.`,
        lockSeconds
      });
    }

    // Проверяем пароль
    const isMatch = await verifyPassword(password, user.password_hash);
    if (!isMatch) {
      const { lockSeconds } = registerFailedAttempt(cleanLogin);
      return res.status(401).json({
        error: `Неверный логин или пароль. Подождите ${lockSeconds} с.`,
        lockSeconds
      });
    }

    // Успех — сбрасываем счётчик неудачных попыток
    resetAttempts(cleanLogin);

    res.json({
      message: 'Вход выполнен',
      user: { id: user.id, login: user.login }
    });
  } catch (err) {
    console.error('Ошибка входа:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// ===================== ПРОВЕРКА =====================
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Phone Shop API работает' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});