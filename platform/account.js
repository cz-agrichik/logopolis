'use strict';
// ============================================================
//  Вход (аккаунт): кто играет — гость этого браузера или человек, вошедший через Google или Telegram.
//  Пока вход только запоминает идентификатор и имя; синхронизации прогресса между устройствами ещё нет.
//  Хранится отдельно от города и учёбы (ключ KEY в localStorage). «Стереть всё» стирает и его (Session.extraKeys).
//  Библиотеки Firebase и Telegram грузятся только по нажатию «Войти» — без входа игра ничего не тянет из сети.
//  Ошибки — кодами (тексты — в интерфейсе): notConfigured, offline, fileProtocol, cancelled, popupBlocked, domain, failed.
// ============================================================

const Account = {
  KEY: 'greekgame.account.v1',
  PROVIDERS: ['google', 'telegram'],
  /** { id — свой номер этого браузера (есть всегда), provider: null | 'google' | 'telegram', uid, name, email, username, photo, since,
   *    guest: время, когда выбрали «без входа»; askedAfterTutorial: предлагали ли войти после обучения }. */
  state: null,

  load() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(this.KEY) || 'null'); } catch (e) { s = null; }
    if (!s || !s.id) s = { id: 'b-' + Date.now().toString(36) + '-' + this.randomPart(), provider: null };
    this.state = s;
    this.save();
    return s;
  },
  save() { try { localStorage.setItem(this.KEY, JSON.stringify(this.state)); } catch (e) { /* хранилище недоступно */ } },
  /** Случайная часть номера браузера — из crypto, а не Math.random (игра свой генератор случайностей не делит со входом). */
  randomPart() {
    try { return Array.from(crypto.getRandomValues(new Uint32Array(2)), n => n.toString(36)).join(''); } catch (e) { return (performance.now() * 1e3 | 0).toString(36); }
  },

  signedIn() { return !!(this.state && this.state.provider); },
  /** Человек уже выбрал: вошёл или «пока без входа». */
  decided() { return this.signedIn() || !!(this.state && this.state.guest); },
  configured(p) { const C = ACCOUNT_CONFIG; return p === 'google' ? !!C.firebase : p === 'telegram' ? !!(C.telegram && C.telegram.clientId) : false; },
  /** Играть без входа (всё — в этом браузере). */
  chooseGuest() { this.state.guest = this.state.guest || Date.now(); this.save(); },
  /** Отметить, что после обучения войти уже предлагали. */
  markAsked(what) { this.state['asked' + what] = Date.now(); this.save(); },

  /** Войти. Обещание { ok: true } или { ok: false, error: код }. */
  async signIn(p) {
    if (!this.configured(p)) return { ok: false, error: 'notConfigured' };
    if (location.protocol === 'file:') return { ok: false, error: 'fileProtocol' };   // с диска вход не работает — только на сайте
    if (navigator.onLine === false) return { ok: false, error: 'offline' };
    try {
      const u = p === 'google' ? await this.google() : await this.telegram();
      Object.assign(this.state, { provider: p, uid: String(u.uid), name: u.name || '', email: u.email || '', username: u.username || '', photo: u.photo || '', since: Date.now() });
      this.save();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: typeof e === 'string' ? e : 'failed', detail: String(e && (e.code || e.message) || e) };
    }
  },
  /** Выйти: снова гость этого браузера (город и слова остаются здесь). */
  async signOut() {
    const was = this.state.provider;
    for (const k of ['provider', 'uid', 'name', 'email', 'username', 'photo', 'since']) delete this.state[k];
    this.state.provider = null;
    this.state.guest = this.state.guest || Date.now();
    this.save();
    try { if (was === 'google' && window.firebase && firebase.apps.length) await firebase.auth().signOut(); } catch (e) { /* и так вышли */ }
  },

  // ---------- поставщики ----------
  loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) return resolve();
      const el = document.createElement('script');
      el.src = src; el.async = true;
      el.onload = () => resolve();
      el.onerror = () => { el.remove(); reject('offline'); };
      document.head.appendChild(el);
    });
  },
  /** Google через Firebase Authentication (всплывающее окно). */
  async google() {
    const C = ACCOUNT_CONFIG;
    await this.loadScript(C.firebaseSdk + 'firebase-app-compat.js');
    await this.loadScript(C.firebaseSdk + 'firebase-auth-compat.js');
    if (!firebase.apps.length) firebase.initializeApp(C.firebase);
    try {
      const res = await firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider());
      const u = res.user;
      return { uid: u.uid, name: u.displayName, email: u.email, photo: u.photoURL };
    } catch (e) {
      const code = (e && e.code) || '';
      throw /popup-closed|cancelled-popup/.test(code) ? 'cancelled' : /popup-blocked/.test(code) ? 'popupBlocked'
        : /unauthorized-domain|operation-not-allowed/.test(code) ? 'domain' : /network/.test(code) ? 'offline' : 'failed';
    }
  },
  /** Telegram: «Log In With Telegram» (OpenID Connect) — всплывающее окно, ответ — id_token (JWT) и данные пользователя.
   *  Подпись токена здесь не проверяем: без своего сервера проверить её честно нельзя — пока только запоминаем, кто это. */
  async telegram() {
    const C = ACCOUNT_CONFIG;
    await this.loadScript(C.telegramSdk);
    const L = window.Telegram && window.Telegram.Login;
    if (!L || !L.auth) throw 'failed';
    const data = await new Promise(resolve => L.auth({ client_id: Number(C.telegram.clientId), lang: 'ru' }, resolve));
    if (!data || data.error) throw data && /closed|cancel/i.test(data.error) ? 'cancelled' : 'failed';
    const u = data.user || this.jwtClaims(data.id_token) || {};
    const uid = u.id || u.sub;
    if (!uid) throw 'failed';
    return { uid, name: u.name || [u.given_name, u.family_name].filter(Boolean).join(' '), username: u.preferred_username, photo: u.picture };
  },
  /** Данные из JWT без проверки подписи (только чтобы показать имя). */
  jwtClaims(token) {
    try {
      const b = String(token).split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const bin = atob(b + '==='.slice((b.length + 3) % 4));
      return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))));
    } catch (e) { return null; }
  },
};

// «Стереть всё» и аварийный сброс (?reset) стирают и вход — как при первом запуске
Session.extraKeys.push(Account.KEY);
