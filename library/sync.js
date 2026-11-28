// ============================================================
//  Читалка и аккаунт. Вошли в игре через Google или Telegram — свои тексты, карточки слов, уровень и поля читалки
//  хранятся и в аккаунте (platform/account.js: часть library, тексты — по документу на текст).
//  Здесь только запись в аккаунт и «этот браузер устарел»: войти, ответить «Что оставить?» и загрузить версию
//  из аккаунта можно только в игре — там же и обучение. Читалка пишет в localStorage сама — смотрим раз в 5 секунд.
// ============================================================
(function () {
  "use strict";
  const A = typeof Account !== "undefined" && typeof ACCOUNT_CONFIG !== "undefined" ? Account : null;
  window.LibrarySync = { signedIn: () => !!(A && A.state && A.signedIn() && A.linked()) };
  if (!A) return;
  A.load();
  if (!A.signedIn() || !A.linked()) return;   // не вошли или сверка при входе ещё не прошла — это дело игры
  A.onStale = showStale;
  A.sync({ noLink: true });
  setInterval(() => A.libraryCheck(), 5000);
  const now = () => { A.libraryCheck(); A.flush(); };
  document.addEventListener("visibilitychange", () => { if (document.hidden) now(); });
  window.addEventListener("pagehide", now);
  window.addEventListener("online", () => A.flush());
  window.addEventListener("storage", () => A.libraryCheck());

  /** Под аккаунтом зашли в другом браузере: здесь ничего не правим — версию из аккаунта загрузит игра. */
  function showStale() {
    if (document.getElementById("acc-stale")) return;
    const box = document.createElement("div");
    box.id = "acc-stale";
    box.className = "acc-stale";
    box.innerHTML = `<div class="acc-stale__box" role="alertdialog" aria-labelledby="acc-stale-h">
      <h2 id="acc-stale-h">🔄 Этот браузер устарел</h2>
      <p>Под вашим аккаунтом зашли в игру в другом браузере или на другом устройстве — главная версия теперь в аккаунте,
        а здесь устаревшая. Откройте игру: она загрузит версию из аккаунта, и можно будет продолжить здесь.</p>
      <a class="acc-stale__btn" href="../index.html">Открыть игру</a></div>`;
    document.body.appendChild(box);
  }
})();
