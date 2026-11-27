'use strict';
// ============================================================
//  Настройки входа (platform/account.js). Здесь только то, что и так видит любой браузер:
//  ключи Firebase для сайта и Client ID бота — не секреты. Секреты (токен бота, Client Secret,
//  ключи сервисных аккаунтов Firebase) сюда НЕ кладём никогда.
//  Пока значение null, кнопка входа честно пишет «пока не настроен».
// ============================================================

const ACCOUNT_CONFIG = {
  // Вход через Google — Firebase Authentication. Консоль Firebase → Project settings → General → Your apps → Web app →
  // SDK setup and configuration → Config: { apiKey, authDomain, projectId, appId }. В Authentication → Sign-in method включить Google,
  // в Authentication → Settings → Authorized domains добавить grecheskiy.com.
  firebase: null,
  // Вход через Telegram (новый вход Telegram — OpenID Connect): @BotFather → бот → Bot Settings → Login Widget →
  // Allowed URLs: https://grecheskiy.com. Client ID — число (это id бота: цифры токена до двоеточия; сам токен сюда не класть).
  telegram: null,   // { clientId: 1234567890 }

  // откуда грузить библиотеки входа (только по нажатию «Войти»)
  firebaseSdk: 'https://www.gstatic.com/firebasejs/10.12.2/',
  telegramSdk: 'https://oauth.telegram.org/js/telegram-login.js?3',
};
