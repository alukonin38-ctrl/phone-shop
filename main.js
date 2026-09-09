import { hashPassword, verifyPassword, saveUser, findUser, isCryptoSupported } from './auth.js';
import { formatPrice } from './utils.js';

// ----- Проверка поддержки криптографии -----
if (!isCryptoSupported()) {
    alert('⚠️ Ваш браузер не поддерживает криптографические операции, либо сайт открыт не по HTTPS. Для работы используйте HTTPS или localhost.');
}

// ----- Список телефонов (данные) -----
const phones = [
    { name: 'iPhone 14', price: 79990, img: 'https://fdn2.gsmarena.com/vv/pics/apple/apple-iphone-14-2.jpg' },
    { name: 'iPhone 15', price: 89990, img: 'https://fdn2.gsmarena.com/vv/pics/apple/apple-iphone-15-1.jpg' },
    { name: 'iPhone 15 Pro', price: 109990, img: 'https://fdn2.gsmarena.com/vv/pics/apple/apple-iphone-15-pro-1.jpg' },
    { name: 'Samsung Galaxy S23', price: 69990, img: 'https://fdn2.gsmarena.com/vv/pics/samsung/samsung-galaxy-s23-5g-1.jpg' },
    { name: 'Samsung Galaxy S24', price: 79990, img: 'https://fdn2.gsmarena.com/vv/pics/samsung/samsung-galaxy-s24-5g-1.jpg' },
    { name: 'Xiaomi 13', price: 49990, img: 'https://fdn2.gsmarena.com/vv/pics/xiaomi/xiaomi-13-1.jpg' },
    { name: 'Xiaomi 14', price: 59990, img: 'https://fdn2.gsmarena.com/vv/pics/xiaomi/xiaomi-14-1.jpg' },
    { name: 'Google Pixel 8', price: 69990, img: 'https://fdn2.gsmarena.com/vv/pics/google/google-pixel-8-1.jpg' },
    { name: 'Google Pixel 9', price: 89990, img: 'https://fdn2.gsmarena.com/vv/pics/google/google-pixel-9-1.jpg' },
    { name: 'OnePlus 11', price: 64990, img: 'https://fdn2.gsmarena.com/vv/pics/oneplus/oneplus-11-5g-1.jpg' },
    { name: 'OnePlus 12', price: 74990, img: 'https://fdn2.gsmarena.com/vv/pics/oneplus/oneplus-12-1.jpg' },
    { name: 'Nothing Phone 1', price: 39990, img: 'https://fdn2.gsmarena.com/vv/pics/nothing/nothing-phone-1-1.jpg' },
    { name: 'Nothing Phone 2', price: 49990, img: 'https://fdn2.gsmarena.com/vv/pics/nothing/nothing-phone-2-1.jpg' },
    { name: 'Sony Xperia 1 V', price: 99990, img: 'https://fdn2.gsmarena.com/vv/pics/sony/sony-xperia-1-v-1.jpg' },
    { name: 'Honor 90', price: 39990, img: 'https://fdn2.gsmarena.com/vv/pics/honor/honor-90-1.jpg' },
    { name: 'Realme GT 5', price: 44990, img: 'https://fdn2.gsmarena.com/vv/pics/realme/realme-gt5-1.jpg' }
];

// ----- DOM элементы -----
const authSection = document.getElementById('authSection');
const catalogSection = document.getElementById('catalogSection');
const loginTab = document.getElementById('loginTab');
const registerTab = document.getElementById('registerTab');
const tabBtns = document.querySelectorAll('.tab-btn');

const loginInput = document.getElementById('loginInput');
const passwordInput = document.getElementById('passwordInput');
const loginBtn = document.getElementById('loginBtn');
const loginMessage = document.getElementById('loginMessage');

const regLoginInput = document.getElementById('regLoginInput');
const regPasswordInput = document.getElementById('regPasswordInput');
const regPasswordConfirmInput = document.getElementById('regPasswordConfirmInput');
const registerBtn = document.getElementById('registerBtn');
const registerMessage = document.getElementById('registerMessage');

const userNameDisplay = document.getElementById('userNameDisplay');
const logoutBtn = document.getElementById('logoutBtn');
const phonesGrid = document.getElementById('phonesGrid');

// ----- Переключение вкладок -----
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tabId = btn.dataset.tab;
        if (tabId === 'loginTab') {
            loginTab.classList.remove('hidden');
            registerTab.classList.add('hidden');
        } else {
            registerTab.classList.remove('hidden');
            loginTab.classList.add('hidden');
        }
        clearMessages();
    });
});

function clearMessages() {
    loginMessage.textContent = '';
    loginMessage.className = 'message';
    registerMessage.textContent = '';
    registerMessage.className = 'message';
}

// ----- Рендер каталога -----
function renderCatalog() {
    phonesGrid.innerHTML = '';
    phones.forEach(phone => {
        const card = document.createElement('div');
        card.className = 'phone-card';
        card.innerHTML = `
            <img src="${phone.img}" alt="${phone.name}" class="phone-image" loading="lazy" />
            <h3>${phone.name}</h3>
            <div class="price">${formatPrice(phone.price)}</div>
        `;
        phonesGrid.appendChild(card);
    });
}

// ----- Функция входа (с обработкой ошибок) -----
async function loginUser(login, password) {
    try {
        const user = findUser(login);
        if (!user) {
            loginMessage.textContent = '❌ Пользователь не найден';
            loginMessage.className = 'message error';
            return false;
        }
        const isValid = await verifyPassword(password, user.hash, user.salt);
        if (isValid) {
            loginMessage.textContent = '';
            loginMessage.className = 'message';
            sessionStorage.setItem('currentUser', login);
            showCatalog(login);
            return true;
        } else {
            loginMessage.textContent = '❌ Неверный пароль';
            loginMessage.className = 'message error';
            return false;
        }
    } catch (error) {
        console.error('Ошибка входа:', error);
        loginMessage.textContent = '⚠️ Ошибка при проверке пароля. Убедитесь, что сайт открыт через HTTPS или localhost.';
        loginMessage.className = 'message error';
        return false;
    }
}

// ----- Функция регистрации (с обработкой ошибок) -----
async function registerUser(login, password, confirm) {
    try {
        if (password !== confirm) {
            registerMessage.textContent = '❌ Пароли не совпадают';
            registerMessage.className = 'message error';
            return false;
        }
        if (password.length < 6) {
            registerMessage.textContent = '❌ Пароль должен содержать не менее 6 символов';
            registerMessage.className = 'message error';
            return false;
        }
        if (findUser(login)) {
            registerMessage.textContent = '❌ Пользователь с таким логином уже существует';
            registerMessage.className = 'message error';
            return false;
        }
        const { hash, salt } = await hashPassword(password);
        const user = { login, hash, salt };
        saveUser(user);
        registerMessage.textContent = '✅ Регистрация успешна! Теперь войдите.';
        registerMessage.className = 'message success';
        regLoginInput.value = '';
        regPasswordInput.value = '';
        regPasswordConfirmInput.value = '';
        setTimeout(() => {
            tabBtns.forEach(b => b.classList.remove('active'));
            document.querySelector('[data-tab="loginTab"]').classList.add('active');
            loginTab.classList.remove('hidden');
            registerTab.classList.add('hidden');
            registerMessage.textContent = '';
            registerMessage.className = 'message';
        }, 1500);
        return true;
    } catch (error) {
        console.error('Ошибка регистрации:', error);
        registerMessage.textContent = '⚠️ Ошибка при хешировании пароля. Убедитесь, что сайт открыт через HTTPS или localhost.';
        registerMessage.className = 'message error';
        return false;
    }
}

// ----- Показ каталога -----
function showCatalog(login) {
    authSection.classList.add('hidden');
    catalogSection.classList.remove('hidden');
    userNameDisplay.textContent = login;
    renderCatalog();
}

// ----- Выход -----
function logout() {
    sessionStorage.removeItem('currentUser');
    catalogSection.classList.add('hidden');
    authSection.classList.remove('hidden');
    loginTab.classList.remove('hidden');
    registerTab.classList.add('hidden');
    tabBtns.forEach(b => b.classList.remove('active'));
    document.querySelector('[data-tab="loginTab"]').classList.add('active');
    loginInput.value = '';
    passwordInput.value = '';
    clearMessages();
}

// ----- Обработчики событий -----
loginBtn.addEventListener('click', async () => {
    const login = loginInput.value.trim();
    const password = passwordInput.value;
    if (!login || !password) {
        loginMessage.textContent = '⚠️ Заполните все поля';
        loginMessage.className = 'message error';
        return;
    }
    await loginUser(login, password);
});

registerBtn.addEventListener('click', async () => {
    const login = regLoginInput.value.trim();
    const password = regPasswordInput.value;
    const confirm = regPasswordConfirmInput.value;
    if (!login || !password || !confirm) {
        registerMessage.textContent = '⚠️ Заполните все поля';
        registerMessage.className = 'message error';
        return;
    }
    await registerUser(login, password, confirm);
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        if (!loginTab.classList.contains('hidden')) {
            loginBtn.click();
        } else if (!registerTab.classList.contains('hidden')) {
            registerBtn.click();
        }
    }
});

logoutBtn.addEventListener('click', logout);

// ----- Проверка сессии при загрузке -----
const savedUser = sessionStorage.getItem('currentUser');
if (savedUser && findUser(savedUser)) {
    showCatalog(savedUser);
} else {
    sessionStorage.removeItem('currentUser');
}