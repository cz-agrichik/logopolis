'use strict';
// ============================================================
//  Вход (аккаунт): кто играет — гость этого браузера или человек, вошедший через Google или Telegram.
//  Имя в игре есть и без входа (хранится в этом браузере). Вошедшие записываются в список игроков — Firestore проекта Firebase,
//  коллекция `users`, документ на аккаунт. Ключ — главный id аккаунта (accountId), один для любого способа входа:
//  'google:<uid в Firebase>' или 'telegram:<номер в Telegram>' — один и тот же на всех устройствах. В строке: способ входа,
//  имя в игре, имя у поставщика, почта или номер и @ник Telegram, фото, номер главного браузера, даты.
//  Google — вход Firebase Authentication. Telegram — аккаунт по номеру Telegram; для доступа к базе браузер входит в Firebase
//  анонимно. Правила — firestore.rules; список целиком видит владелец проекта в консоли.
//
//  Браузер и аккаунт. Главная версия — в аккаунте; пишет в неё один браузер — тот, где вошли последним («главный»,
//  его номер — browserId в строке аккаунта). Остальные браузеры этого аккаунта заведомо устарели.
//  • Вход (link) — единственное место, где браузер и аккаунт сравниваются: то, что переносится (parts — сейчас имя, потом город
//    и учёба), берётся ЦЕЛИКОМ с одной стороны. В аккаунте пусто — пишем туда браузер; в браузере пусто — берём аккаунт;
//    одинаково — ничего; разное — спрашиваем игрока, какую версию оставить (choose). После этого браузер — главный (claim).
//  • Главный пишет свои изменения в аккаунт (push), пока он главный. Больше никаких сравнений.
//  • Вошли в другом браузере — главный теперь тот, а этот устарел (stale): узнаём при запуске, при записи и сразу, пока игра
//    открыта (watch). Устаревшему не предлагаем ничего, кроме одного: загрузить версию из аккаунта (adopt) — после этого главный он.
//
//  🚨 Выбор при входе затирает одну из версий. Поэтому заменить непустую и другую версию браузера или аккаунта можно только
//  с подтверждением игрока (choose(which, true) — его даёт второй экран «Точно заменить?»; без него — 'notConfirmed').
//  Ловушка на ошибки в коде: takeRemote и claim без подтверждения такую замену не делают — кричат в консоль (alarm) и бросают
//  'unconfirmedOverwrite'. Вход не запоминается, пока игрок не выбрал (held — только в памяти); отказаться можно без потерь.
//
//  Локально (ключ KEY в localStorage) — кто вошёл и имя; «Стереть всё» стирает и его (Session.extraKeys).
//  Библиотеки Firebase и Telegram грузятся только для входа и для тех, кто вошёл, — без входа игра ничего не тянет из сети.
//  Ошибки — кодами (тексты — в интерфейсе): notConfigured, offline, fileProtocol, cancelled, popupBlocked, domain, failed, emptyName.
// ============================================================

const Account = {
  KEY: 'greekgame.account.v1',
  PROVIDERS: ['google', 'telegram'],
  /** { id — свой номер этого браузера (есть всегда), name — имя в игре (и без входа; при выходе остаётся),
   *    provider: null | 'google' | 'telegram', uid — id у поставщика, providerName — имя у поставщика, email, username, photo, since,
   *    fbUid — пользователь Firebase (Google), accountId — главный id аккаунта (ключ строки в списке игроков),
   *    linked — accountId, с которым этот браузер сверился при входе и стал главным
   *    (нет — сверка при входе ещё не прошла: пройдёт при следующем запуске); profilePending — изменения ещё не дошли до аккаунта;
   *    localAt — когда версия этого браузера менялась (показать при выборе на входе);
   *    guest: когда выбрали «без входа»; askedAfterTutorial }. */
  state: null,
  /** Расхождение, ждущее выбора игрока (только в памяти): { acc — вход, который ещё не завершён (или null), remote — строка аккаунта, login }. */
  held: null,
  /** Этот браузер устарел: главный теперь другой. onStale — что показать (интерфейс). */
  stale: false,
  onStale: null,
  unwatch: null,

  load() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(this.KEY) || 'null'); } catch (e) { s = null; }
    if (!s || !s.id) s = { id: 'b-' + Date.now().toString(36) + '-' + this.randomPart(), provider: null };
    // вошли до списка игроков: у Google пользователь Firebase — тот же uid; сверим при запуске
    if (s.provider && s.providerName === undefined) {
      s.providerName = s.name || '';
      if (s.provider === 'google') s.fbUid = s.uid;
    }
    // строки раньше лежали под uid Firebase — теперь под главным id; сверка при запуске заведёт новую
    if (s.provider && !s.accountId) s.accountId = this.accountIdOf(s);
    delete s.nameEdited; delete s.synced; delete s.lastPushed;   // от прежних сборок
    this.state = s;
    this.held = null; this.stale = false; this.unwatch = null;
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

  // ---------- что переносится между браузером и аккаунтом ----------
  /** Части — каждая целиком: get — значение в этом браузере, set — заменить его значением из аккаунта, row — значение из строки аккаунта,
   *  empty — «здесь ничего нет». Город и учёба добавятся сюда же, по записи на часть. */
  parts: {
    name: {
      get: () => Account.state.name || '',
      set: v => { Account.state.name = String(v || '').slice(0, 40); },
      row: r => r.name || '',
      empty: v => !v,
    },
  },
  snapshot() { const o = {}; for (const k in this.parts) o[k] = this.parts[k].get(); return o; },
  fromRow(row) { const o = {}; for (const k in this.parts) o[k] = this.parts[k].row(row); return o; },
  same(a, b) { return JSON.stringify(a) === JSON.stringify(b); },
  isEmpty(snap) { return Object.keys(this.parts).every(k => this.parts[k].empty(snap[k])); },
  /** Чью версию взять при входе. local — браузер, remote — аккаунт (null — в аккаунте ещё ничего нет).
   *  'push' — браузер → аккаунт, 'pull' — аккаунт → браузер, 'same' — одинаково, 'ask' — спросить игрока. */
  decide(local, remote) {
    if (!remote) return 'push';
    if (this.same(local, remote)) return 'same';
    if (this.isEmpty(local)) return 'pull';
    return 'ask';
  },
  /** Главный id аккаунта — ключ строки в списке игроков: один для любого способа входа и одинаковый на всех устройствах. */
  accountIdOf(who) {
    if (who.provider === 'google') return who.fbUid ? 'google:' + who.fbUid : null;
    if (who.provider === 'telegram') return who.uid ? 'telegram:' + who.uid : null;
    return null;
  },
  linked() { const s = this.state; return !!(s.accountId && s.linked === s.accountId); },

  /** Войти. Обещание { ok: true } — вошли; { ok: true, choice } — вошли в аккаунт, но в нём и здесь разное: ждём choose();
   *  { ok: false, error: код }. */
  async signIn(p) {
    if (!this.configured(p)) return { ok: false, error: 'notConfigured' };
    if (location.protocol === 'file:') return { ok: false, error: 'fileProtocol' };   // с диска вход не работает — только на сайте
    if (navigator.onLine === false) return { ok: false, error: 'offline' };
    try {
      const u = p === 'google' ? await this.google() : await this.telegram();
      const acc = { provider: p, uid: String(u.uid), providerName: (u.name || u.username || u.email || '').trim(), email: u.email || '',
        username: u.username || '', photo: u.photo || '', fbUid: u.fbUid || null };
      acc.accountId = this.accountIdOf(acc);
      return { ok: true, ...(await this.link(acc)) };
    } catch (e) {
      return { ok: false, error: typeof e === 'string' ? e : 'failed', detail: String(e && (e.code || e.message) || e) };
    }
  },
  /** Вход завершён: запомнить аккаунт в браузере. Имени ещё нет — берём имя у поставщика. */
  finish(acc) {
    Object.assign(this.state, acc, { since: Date.now() });
    if (!this.state.name) this.state.name = acc.providerName;
    this.save();
  },
  /** Выйти: снова гость этого браузера. Город, слова и имя остаются здесь; войдёт снова — снова сверим при входе. */
  async signOut() {
    const was = this.state.provider;
    for (const k of ['provider', 'uid', 'providerName', 'email', 'username', 'photo', 'since', 'fbUid', 'accountId', 'linked', 'profilePending']) delete this.state[k];
    this.state.provider = null;
    this.state.guest = this.state.guest || Date.now();
    this.held = null; this.stale = false;
    this.unwatchRow();
    this.save();
    // Google — выходим и из Firebase; анонимного пользователя (Telegram) оставляем: войдёт снова — та же строка в списке
    try { if (was === 'google' && window.firebase && firebase.apps.length) await firebase.auth().signOut(); } catch (e) { /* и так вышли */ }
  },
  /** Поменять имя в игре (до 40 знаков) — и без входа. Вошли — пишем в аккаунт: { ok, result: 'push' | 'pending' | 'stale' | 'ask', choice? }. */
  async setName(name) {
    name = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    if (!name) return { ok: false, error: 'emptyName' };
    this.state.name = name;
    this.state.localAt = Date.now();
    this.save();
    if (!this.signedIn()) return { ok: true };
    return { ok: true, ...(await this.saveToAccount()) };
  },

  // ---------- браузер и аккаунт (Firestore) ----------
  /** Сверка при входе. acc — новый вход (ещё не запомнен; при расхождении запомним только после выбора); без acc — вошли раньше,
   *  а сверка не прошла (не было связи). Обещание { result: 'push' | 'pull' | 'same' | 'ask' | 'pending', choice? }. */
  async link(acc = null) {
    const who = acc || this.state;
    let remote;
    try {
      remote = await this.readRow(who);
    } catch (e) {
      if (acc) this.finish(acc);   // не прочитали (нет связи, Firebase не настроен) — вошли всё равно, сверим при следующем запуске
      return { result: this.failed(e) };
    }
    const d = this.decide(this.snapshot(), remote && this.fromRow(remote));
    if (d === 'ask') { this.held = { acc, remote, login: !!acc }; return { result: 'ask', choice: this.choice() }; }
    if (d === 'pull') this.takeRemote(remote);   // до finish: тот подставит имя у поставщика, если здесь имени нет
    if (acc) this.finish(acc);
    return { result: await this.claim(remote, !!acc).then(() => d, e => this.failed(e)) };
  },
  /** Что показать игроку при расхождении: версии браузера и аккаунта, когда сохранена версия аккаунта, способ входа, вход ли это. */
  choice() {
    const h = this.held;
    if (!h) return null;
    return { local: this.snapshot(), remote: this.fromRow(h.remote), savedAt: this.millis(h.remote.updatedAt), localAt: this.state.localAt || null,
      provider: (h.acc || this.state).provider, login: h.login };
  },
  millis(t) { return t && t.toMillis ? t.toMillis() : typeof t === 'number' ? t : null; },
  /** Выбор игрока: 'local' — оставить версию браузера (в аккаунте станет так же), 'remote' — взять из аккаунта (здесь станет так же),
   *  null — не выбирать: новый вход отменяется, а у вошедших спросим при следующем запуске.
   *  🚨 Заменить можно только с confirmed = true — его даёт второй экран «Точно заменить?»; без него — { ok: false, error: 'notConfirmed' },
   *  и выбор ждёт дальше. Обещание { ok, pending?, cancelled? }. */
  async choose(which, confirmed = false) {
    const h = this.held;
    if (!h) return { ok: false, error: 'failed' };
    if (which !== 'local' && which !== 'remote') {
      this.held = null;
      if (h.acc && h.acc.provider === 'google') { try { await firebase.auth().signOut(); } catch (e) { /* и так вышли */ } }
      return { ok: true, cancelled: true };
    }
    if (confirmed !== true) return { ok: false, error: 'notConfirmed' };
    this.held = null;
    if (which === 'remote') this.takeRemote(h.remote, true);
    if (h.acc) this.finish(h.acc);
    const r = await this.claim(h.remote, h.login, which === 'local').then(() => true, e => this.failed(e));
    return { ok: true, pending: r !== true };
  },
  /** 🚨 Заменить версию браузера версией аккаунта. Молча — только если здесь пусто или то же самое; иначе нужен confirmed. */
  takeRemote(row, confirmed = false) {
    const local = this.snapshot(), v = this.fromRow(row);
    if (!confirmed && !this.isEmpty(local) && !this.same(local, v)) throw this.alarm('версия браузера чуть не заменилась без подтверждения', local, v);
    for (const k in this.parts) this.parts[k].set(v[k]);
    this.state.localAt = this.millis(row.updatedAt) || Date.now();
    this.save();
  },
  /** Громко сообщить о попытке затереть версию без подтверждения (это ошибка в коде — так быть не должно). */
  alarm(what, was, now) {
    try { console.error('🚨 Аккаунт: ' + what, { было: was, стало: now }); } catch (e) { /* консоли нет */ }
    return 'unconfirmedOverwrite';
  },

  /** При запуске (вошли раньше). Сверка при входе не прошла — пройти её; этот браузер главный — дописать незаписанное и следить;
   *  главный другой — устарел. Обещание { result: 'ok' | 'stale' | 'ask' | … | 'pending' }. */
  async sync() {
    const s = this.state;
    if (!this.signedIn() || location.protocol === 'file:' || !ACCOUNT_CONFIG.firebase) return { result: 'pending' };
    if (!this.linked()) return this.link();
    try {
      const remote = await this.readRow(s);
      if (remote && remote.browserId !== s.id) return { result: this.goStale() };
      if (!remote || s.profilePending) await this.push();   // строки нет (удалили в консоли) или здесь есть незаписанное
      this.watch();
      return { result: 'ok' };
    } catch (e) {
      return { result: e === 'stale' ? 'stale' : this.failed(e) };
    }
  },
  /** Записать изменения этого браузера в аккаунт (смена имени). */
  async saveToAccount() {
    if (this.stale) return { result: 'stale' };
    if (!this.linked()) return this.link();   // сверка при входе ещё не прошла — сначала она
    try { await this.push(); return { result: 'push' }; } catch (e) { return { result: e === 'stale' ? 'stale' : this.failed(e) }; }
  },
  /** Этот браузер устарел: взять версию из аккаунта (аккаунт главнее — без вопросов) и снова стать главным.
   *  Интерфейс после этого перезагружает страницу. Обещание { ok } или { ok: false, error: 'offline' } — здесь ничего не поменяли. */
  async adopt() {
    try {
      const remote = await this.readRow(this.state);
      if (remote) this.takeRemote(remote, true);   // устаревшая версия браузера не в счёт
      await this.claim(remote, false);
      return { ok: true };
    } catch (e) { this.warn(e); return { ok: false, error: 'offline' }; }
  },
  goStale() {
    if (!this.stale && this.signedIn()) {
      this.stale = true;
      this.unwatchRow();
      if (this.onStale) this.onStale();
    }
    return 'stale';
  },
  failed(e) {
    if (this.signedIn()) { this.state.profilePending = true; this.save(); }
    this.warn(e);
    return 'pending';
  },
  warn(e) { try { console.warn('Аккаунт: не сверили —', (e && (e.code || e.message)) || e); } catch (x) { /* консоли нет */ } },

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
  within(promise, ms = 8000) { return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject('offline'), ms))]); },
  /** Сессия Firebase, без которой правила не пустят: Google — именно этот пользователь (потерялась — сверим после следующего входа);
   *  Telegram — любой, если нет — анонимный (в консоли должен быть включён Authentication → Anonymous). */
  async session(who) {
    if (!ACCOUNT_CONFIG.firebase) throw 'notConfigured';
    const auth = await this.fbAuth();
    const u = await this.within(this.fbUser(auth));
    if (who.provider === 'google') { if (!u || u.uid !== who.fbUid) throw 'sessionLost'; return; }
    if (!u) await this.within(auth.signInAnonymously());
  },
  /** Строка аккаунта в списке игроков (null — ещё нет). */
  async readRow(who) {
    if (!who.accountId) throw 'noAccountId';
    await this.session(who);
    const db = await this.fbDb();
    const snap = await this.within(db.collection('users').doc(who.accountId).get());
    return snap.exists ? snap.data() : null;
  },
  /** Своя строка: аккаунт, части браузера, номер этого браузера (главный — он), даты. remote — строка до записи (null — новая). */
  rowData(remote, login) {
    const s = this.state, ts = firebase.firestore.FieldValue.serverTimestamp();
    const tg = s.provider === 'telegram';
    const cut = (v, n) => v ? String(v).slice(0, n) : null;   // те же пределы, что в firestore.rules
    const data = { accountId: s.accountId, provider: s.provider, name: cut(s.name || s.providerName, 40) || '', providerName: cut(s.providerName, 200) || '', email: cut(s.email, 200),
      tgId: tg ? cut(s.uid, 40) : null, tgUsername: tg ? cut(s.username, 64) : null, photo: cut(s.photo, 1000), browserId: s.id, updatedAt: ts };
    if (login) data.lastLoginAt = ts;
    if (!remote) data.createdAt = ts;
    return data;
  },
  /** Стать главным: записать строку целиком из этого браузера (после сверки при входе или «перезагрузиться» у устаревшего).
   *  🚨 Затереть в аккаунте непустую и другую версию — только с confirmed (игрок выбрал «Оставить это» и подтвердил). */
  async claim(remote, login, confirmed = false) {
    const s = this.state;
    if (remote && !confirmed) {
      const v = this.fromRow(remote);
      if (!this.isEmpty(v) && !this.same(v, this.snapshot())) throw this.alarm('версия аккаунта чуть не заменилась без подтверждения', v, this.snapshot());
    }
    const db = await this.fbDb();
    await this.within(db.collection('users').doc(s.accountId).set(this.rowData(remote, login), { merge: true }));
    s.linked = s.accountId; this.stale = false;
    delete s.profilePending;
    this.save();
    this.watch();
  },
  /** Записать изменения, только если этот браузер всё ещё главный; нет — он устарел (throw 'stale') и ничего не пишет. */
  async push() {
    const s = this.state;
    await this.session(s);
    const db = await this.fbDb(), ref = db.collection('users').doc(s.accountId);
    let other = false;
    await this.within(db.runTransaction(async t => {
      const snap = await t.get(ref), row = snap.exists ? snap.data() : null;
      other = !!(row && row.browserId !== s.id);
      if (!other) t.set(ref, this.rowData(row, false), { merge: true });
    }));
    if (other) { this.goStale(); throw 'stale'; }
    delete s.profilePending;
    this.save();
  },
  /** Пока игра открыта — следить за своей строкой: главным стал другой браузер — этот устарел. */
  watch() {
    if (this.unwatch || this.stale) return;
    try {
      this.unwatch = firebase.firestore().collection('users').doc(this.state.accountId).onSnapshot(snap => {
        const row = snap.exists ? snap.data() : null;
        if (row && row.browserId && row.browserId !== this.state.id) this.goStale();
      }, e => this.warn(e));
    } catch (e) { this.warn(e); }
  },
  unwatchRow() { if (this.unwatch) { try { this.unwatch(); } catch (e) { /* уже */ } this.unwatch = null; } },

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
   *  Аккаунт — номер Telegram. */
  async telegram() {
    const C = ACCOUNT_CONFIG;
    await this.loadScript(C.telegramSdk);
    const L = window.Telegram && window.Telegram.Login;
    if (!L || !L.auth) throw 'failed';
    const data = await new Promise(resolve => L.auth({ client_id: Number(C.telegram.clientId), lang: 'ru' }, resolve));
    if (!data || data.error) throw data && /closed|cancel/i.test(data.error) ? 'cancelled' : 'failed';
    const u = data.user || this.jwtClaims(data.id_token) || {};
    const uid = u.id || u.sub;   // id — номер пользователя Telegram (sub — запасной)
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
