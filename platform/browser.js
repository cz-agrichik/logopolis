'use strict';
// ============================================================
//  Платформа «браузер»: хранилище, перезапуск страницы, озвучка
// ============================================================

const Speech = {
  voice: null, warned: false,
  init() {
    if (!('speechSynthesis' in window)) return;
    const pick = () => {
      const vs = speechSynthesis.getVoices();
      this.voice = vs.find(v => /^el(-|_|$)/i.test(v.lang)) || null;
    };
    pick();
    speechSynthesis.onvoiceschanged = pick;
  },
  say(text, auto = false) {
    if (!('speechSynthesis' in window)) return;
    if (!this.voice) {
      if (!auto && !this.warned) {
        this.warned = true;
        UI.toast('В системе нет греческого голоса. Windows: Параметры → Время и язык → Речь → Добавить голоса → Ελληνικά');
      }
      return;
    }
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = this.voice.lang; u.voice = this.voice; u.rate = 0.9;
      speechSynthesis.speak(u);
    } catch (e) { /* без звука */ }
  },
};

/** Хранилище и перезапуск для ядра (Game.io). */
const BrowserIO = {
  load(key) { try { return localStorage.getItem(key); } catch (e) { return null; } },
  save(key, text) { try { localStorage.setItem(key, text); } catch (e) { /* хранилище недоступно — играем без сохранения */ } },
  remove(key) { try { localStorage.removeItem(key); } catch (e) {} },
  /** Перезагрузка без ?параметров — для новой игры и сброса. */
  restart() { location.replace(location.pathname + '?fresh=' + Date.now()); },
  /** Пометки на время сеанса (например, «уже предупредили про телефон»). */
  sessionGet(key) { try { return sessionStorage.getItem(key); } catch (e) { return null; } },
  sessionSet(key, v) { try { sessionStorage.setItem(key, v); } catch (e) {} },
  /** Телефон: попробовать во весь экран и в альбомную ориентацию (работает не везде — только по нажатию). */
  preferLandscape() { this.requestFullscreen(); },

  // ---------- полный экран (Fullscreen API; на iPhone его нет — там «На экран „Домой“») ----------
  /** Открыта как приложение с главного экрана — панелей браузера и так нет. */
  standalone() {
    try { return matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || navigator.standalone === true; } catch (e) { return false; }
  },
  /** Можно ли попросить полный экран (на iPhone — нельзя). */
  canFullscreen() { return !!(document.fullscreenEnabled || document.webkitFullscreenEnabled) && !this.standalone(); },
  isFullscreen() { return !!(document.fullscreenElement || document.webkitFullscreenElement) || this.standalone(); },
  /** Во весь экран и в альбомную ориентацию — только из обработчика нажатия. Обещание: true, если получилось. */
  requestFullscreen() {
    const lock = () => { try { const o = screen.orientation; if (o && o.lock) o.lock('landscape').catch(() => {}); } catch (e) {} };
    try {
      const el = document.documentElement, go = el.requestFullscreen || el.webkitRequestFullscreen;
      if (!go || this.isFullscreen()) { lock(); return Promise.resolve(this.isFullscreen()); }
      return Promise.resolve(go.call(el, { navigationUI: 'hide' })).then(() => { lock(); return true; }, () => false);
    } catch (e) { return Promise.resolve(false); }
  },
  /** iPhone / iPad: полный экран — только через «На экран „Домой“». */
  isIOS() { return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); },
};
