'use strict';
// ============================================================
//  Вход (аккаунт): кто играет — гость этого браузера или человек, вошедший через Google или Telegram.
//  Вошедшие записываются в список игроков — Firestore проекта Firebase, коллекция `users`, документ на пользователя Firebase:
//  способ входа, имя в игре (его можно поменять), имя у поставщика, почта или @ник Telegram, фото, номер браузера, даты.
//  Google — пользователь Firebase Authentication; Telegram — анонимный пользователь Firebase (подпись Telegram без своего
//  сервера не проверить: строка помечена provider: 'telegram', это «со слов браузера»). Правила доступа — firestore.rules:
//  игрок читает и пишет только свою строку, список целиком видит владелец проекта в консоли. Прогресс игры туда пока не пишем.
//  Локально (ключ KEY в localStorage) — кто вошёл; «Стереть всё» стирает и его (Session.extraKeys).
//  Библиотеки Firebase и Telegram грузятся только по нажатию «Войти» (и при сохранении имени) — без входа игра ничего не тянет из сети.
//  Ошибки — кодами (тексты — в интерфейсе): notConfigured, offline, fileProtocol, cancelled, popupBlocked, domain, failed, emptyName.
// ============================================================

const Account = {
  KEY: 'greekgame.account.v1',
  PROVIDERS: ['google', 'telegram'],
  /** { id — свой номер этого браузера (есть всегда), provider: null | 'google' | 'telegram', uid — id у поставщика,
   *    name — имя в игре (можно поменять), providerName — имя у поставщика, email, username, photo, since,
   *    fbUid — пользователь Firebase (строка в списке игроков), profilePending — строку не удалось записать, повторим;
   *    nameEdited — имя поменяли, а в список ещё не записали; guest: когда выбрали «без входа»; askedAfterTutorial }. */
  state: null,

  load() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(this.KEY) || 'null'); } catch (e) { s = null; }
    if (!s || !s.id) s = { id: 'b-' + Date.now().toString(36) + '-' + this.randomPart(), provider: null };
    // вошли до списка игроков: записать в список при запуске (у Google пользователь Firebase — тот же uid)
    if (s.provider && s.providerName === undefined) {
      s.providerName = s.name || '';
      if (s.provider === 'google') s.fbUid = s.uid;
      s.profilePending = true;
    }
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
      const name = (u.name || u.username || u.email || '').trim();
      Object.assign(this.state, { provider: p, uid: String(u.uid), name, providerName: name, email: u.email || '', username: u.username || '',
        photo: u.photo || '', since: Date.now(), fbUid: u.fbUid || null });
      delete this.state.nameEdited;
      this.save();
      await this.saveProfile(true).catch(e => this.profileFailed(e));   // в список игроков; не вышло — вход всё равно состоялся
      return { ok: true };
    } catch (e) {
      return { ok: false, error: typeof e === 'string' ? e : 'failed', detail: String(e && (e.code || e.message) || e) };
    }
  },
  /** Выйти: снова гость этого браузера (город и слова остаются здесь). */
  async signOut() {
    const was = this.state.provider;
    for (const k of ['provider', 'uid', 'name', 'providerName', 'email', 'username', 'photo', 'since', 'fbUid', 'profilePending', 'nameEdited']) delete this.state[k];
    this.state.provider = null;
    this.state.guest = this.state.guest || Date.now();
    this.save();
    // Google — выходим и из Firebase; анонимного пользователя (Telegram) оставляем: войдёт снова — та же строка в списке
    try { if (was === 'google' && window.firebase && firebase.apps.length) await firebase.auth().signOut(); } catch (e) { /* и так вышли */ }
  },

  // ---------- список игроков (Firestore) ----------
  /** Firebase: приложение и вход; библиотеки — по требованию. */
  async fbAuth() {
    const C = ACCOUNT_CONFIG;
    await this.loadScript(C.firebaseSdk + 'firebase-app-compat.js');
    await this.loadScript(C.firebaseSdk + 'firebase-auth-compat.js');
    if (!firebase.apps.length) firebase.initializeApp(C.firebase);
    return firebase.auth();
  },
  async fbDb() {
    await this.fbAuth();
    await this.loadScript(ACCOUNT_CONFIG.firebaseSdk + 'firebase-firestore-compat.js');
    return firebase.firestore();
  },
  /** Пользователь Firebase после того, как библиотека восстановила сессию (или null). */
  fbUser(auth) {
    if (auth.currentUser) return Promise.resolve(auth.currentUser);
    return new Promise(resolve => { const off = auth.onAuthStateChanged(u => { off(); resolve(u); }); });
  },
  /** Не дольше ms: без сети Firestore ждёт сколько угодно — а нам надо ответить игроку. */
  within(promise, ms = 10000) { return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject('offline'), ms))]); },
  /** Записать (обновить) свою строку в списке игроков. login — это вход: отметить время входа.
   *  Имя: поменяли здесь (nameEdited) — пишем наше; иначе, если в списке уже есть имя (меняли раньше), берём его. Обещание true/false. */
  async saveProfile(login = false) {
    const s = this.state;
    if (!this.signedIn() || !ACCOUNT_CONFIG.firebase) return false;
    const db = await this.fbDb();
    let u = await this.within(this.fbUser(firebase.auth()));
    // Telegram: строка — у анонимного пользователя Firebase этого браузера (заводим при первом входе)
    if (s.provider === 'telegram' && (!u || !u.isAnonymous || u.uid !== s.fbUid)) { s.fbUid = await this.anonymous(); u = firebase.auth().currentUser; }
    if (!s.fbUid || !u || u.uid !== s.fbUid) { s.profilePending = true; this.save(); return false; }   // сессия Firebase потерялась — до следующего входа
    const ref = db.collection('users').doc(s.fbUid), ts = firebase.firestore.FieldValue.serverTimestamp();
    const snap = await this.within(ref.get());
    const old = snap.exists ? snap.data() : null;
    if (old && old.name && !s.nameEdited) s.name = old.name;
    const tg = s.provider === 'telegram';
    const cut = (v, n) => v ? String(v).slice(0, n) : null;   // те же пределы, что в firestore.rules
    const data = { provider: s.provider, name: cut(s.name || s.providerName, 40) || '', providerName: cut(s.providerName, 200) || '', email: cut(s.email, 200),
      tgId: tg ? cut(s.uid, 40) : null, tgUsername: tg ? cut(s.username, 64) : null, photo: cut(s.photo, 1000), browserId: s.id, updatedAt: ts };
    if (login) data.lastLoginAt = ts;
    if (!old) data.createdAt = ts;
    await this.within(ref.set(data, { merge: true }));
    delete s.profilePending; delete s.nameEdited;
    this.save();
    return true;
  },
  profileFailed(e) {
    this.state.profilePending = true;
    this.save();
    try { console.warn('Список игроков: не записали —', (e && (e.code || e.message)) || e); } catch (x) { /* консоли нет */ }
    return false;
  },
  /** Не записали в прошлый раз — попробовать снова (при запуске игры; только тем, у кого строка в долгу). */
  retryProfile() {
    if (!this.signedIn() || !this.state.profilePending || !ACCOUNT_CONFIG.firebase || location.protocol === 'file:') return Promise.resolve(false);
    return this.saveProfile().catch(e => this.profileFailed(e));
  },
  /** Поменять имя в игре (до 40 знаков). Обещание { ok, pending? } — pending: сохранили здесь, в список запишем позже. */
  async setName(name) {
    name = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    if (!name) return { ok: false, error: 'emptyName' };
    if (!this.signedIn()) return { ok: false, error: 'notSignedIn' };
    this.state.name = name; this.state.nameEdited = true;
    this.save();
    const saved = await this.saveProfile().catch(e => this.profileFailed(e));
    return { ok: true, pending: !saved };
  },

  /** Заранее загрузить библиотеку входа (когда показали кнопки): тогда окно входа откроется прямо по нажатию —
   *  браузеры охотнее пропускают всплывающее окно, если между нажатием и окном ничего не грузится. */
  preload(p) {
    if (!this.configured(p) || location.protocol === 'file:') return;
    const C = ACCOUNT_CONFIG;
    const fb = C.firebase ? [C.firebaseSdk + 'firebase-app-compat.js', C.firebaseSdk + 'firebase-auth-compat.js'] : [];   // и для Telegram: строка в списке игроков
    const srcs = p === 'telegram' ? [C.telegramSdk, ...fb] : fb;
    srcs.reduce((pr, src) => pr.then(() => this.loadScript(src)), Promise.resolve()).catch(() => {});
  },

  // ---------- поставщики ----------
  /** Загрузить скрипт один раз: повторный вызов ждёт ту же загрузку (заранее начатую — тоже); не загрузился — можно попробовать снова. */
  scripts: {},
  loadScript(src) {
    if (this.scripts[src]) return this.scripts[src];
    return (this.scripts[src] = new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = src; el.async = true;
      el.onload = () => resolve();
      el.onerror = () => { el.remove(); delete this.scripts[src]; reject('offline'); };
      document.head.appendChild(el);
    }));
  },
  /** Google через Firebase Authentication (всплывающее окно). */
  async google() {
    const auth = await this.fbAuth();
    try {
      const res = await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
      const u = res.user;
      return { uid: u.uid, fbUid: u.uid, name: u.displayName, email: u.email, photo: u.photoURL };
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
  /** Анонимный пользователь Firebase для игрока из Telegram — чтобы записать его в список игроков (saveProfile). Тот же браузер — тот же пользователь.
   *  Не вышло (анонимный вход выключен в консоли, нет сети) — null: вход через Telegram всё равно состоялся, запишем при следующем запуске. */
  async anonymous() {
    if (!ACCOUNT_CONFIG.firebase) return null;
    try {
      const auth = await this.fbAuth();
      let u = await this.within(this.fbUser(auth));
      if (!u || !u.isAnonymous) { if (u) await auth.signOut(); u = (await this.within(auth.signInAnonymously())).user; }
      return u.uid;
    } catch (e) {
      try { console.warn('Анонимный вход Firebase не удался —', (e && (e.code || e.message)) || e); } catch (x) { /* консоли нет */ }
      return null;
    }
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
