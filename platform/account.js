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
//  Что лежит в аккаунте (Firestore): users/<accountId> — строка в списке игроков (кто, имя, главный браузер, даты);
//  users/<accountId>/data/learn — обучение (core/learning/learn.js, snapshot: прогресс по словам, свои колоды, настройки, журнал;
//  без слов встроенных колод — они есть в игре); users/<accountId>/data/library — читалка: карточки слов, уровень, поля,
//  оглавление своих текстов (название, дата, отпечаток); сами тексты — users/<accountId>/texts/<id>, по документу на текст
//  (пишутся и читаются только те, что поменялись). Дальше по той же схеме: data/city — город.
//  Читалка — отдельная страница: там тоже работает Account (library/sync.js) — пишет в аккаунт и замечает «устарел».
//  Главный браузер пишет обучение не чаще раза в PUSH_EVERY (и сразу, когда вкладку прячут) — только если оно поменялось.
//  Обучение в аккаунте сжато (gzip, поле gz): ~50 КБ на все 2700 слов вместо ~330 КБ.
//  Каждый обмен с аккаунтом — транзакция Firestore: прочитали строку и обучение — одну и ту же версию; записали — значит, сервер
//  принял (без сети запись не «висит» в очереди, а падает — и изменения ждут, profilePending). Пока идёт сверка при входе,
//  интерфейс ждёт (onBusy); при запуске раунд карточек ждёт первой сверки (AccountUI.waitBeforeStudy).
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
   *    localAt — когда менялось имя в этом браузере (показать при выборе на входе);
   *    guest: когда выбрали «без входа»; askedAfterTutorial }. */
  state: null,
  /** Расхождение, ждущее выбора игрока (только в памяти): { acc — вход, который ещё не завершён (или null), remote — строка аккаунта, login }. */
  held: null,
  /** Этот браузер устарел: главный теперь другой. onStale — что показать (интерфейс). */
  stale: false,
  onStale: null,
  unwatch: null,
  /** Обучение из аккаунта легло в браузер — интерфейс перезагружает страницу. */
  reloadNeeded: false,
  /** Что сейчас лежит в аккаунте (по последнему чтению или записи): { row — ключ полей строки, learn — JSON обучения } — чтобы не писать то же. */
  sent: null,
  PUSH_EVERY: 20000,
  /** Счётчик изменений: запись в аккаунт снимает «есть незаписанное», только если пока она шла, ничего не поменялось. */
  rev: 0,
  /** Интерфейс: onBusy(true/false) — идёт сверка при входе (ждать); onChange() — поменялось «записано / есть незаписанное». */
  onBusy: null,
  onChange: null,
  MAX_DOC: 1000000,   // байт: документ Firestore — до 1 МиБ (и firestore.rules — до 1 000 000 знаков)
  /** Ключи читалки в localStorage (library/owntext.js, library/reader.js). */
  LIB: { texts: 'greek-reader:own-texts:v1', deck: 'greek-reader:deck:v2', level: 'greek-reader:my-level', margin: 'greek-reader:margin-notes' },
  LIB_MAX_CHARS: 300000,   // текст длиннее (читалка и так не даёт больше 100 000) — только в этом браузере
  MAX_TEXT_DOC: 600000,    // байт на документ текста (и firestore.rules)

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
    this.held = null; this.stale = false; this.unwatch = null; this.reloadNeeded = false; this.sent = null;
    this.lastLearnText = typeof Learn !== 'undefined' ? (() => { try { return localStorage.getItem(Learn.KEY); } catch (e) { return null; } })() : null;
    this.lastLibRaw = this.libRaw();
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
  /** Части — каждая целиком: get — значение в этом браузере (null — части здесь нет), set — заменить его значением из аккаунта,
   *  row — значение из аккаунта (null — в аккаунте этой части ещё нет: тогда её и не берём, а пишем туда здешнюю),
   *  empty — «здесь ничего нет». Город добавится сюда же, по записи на часть. */
  parts: {
    name: {
      get: () => Account.state.name || null,
      set: v => { Account.state.name = String(v || '').slice(0, 40); },
      row: r => r.name || null,
      empty: v => !v,
    },
    learn: {
      get: () => Account.hasLearn() ? Learn.snapshot() : null,
      set: v => Account.applyLearn(v),
      row: r => r._learn || null,
      empty: v => !v || Learn.isEmptySnap(v),
    },
    // читалка: карточки слов, уровень, поля и оглавление своих текстов; prepare — до замены скачать сами тексты (все сразу)
    library: {
      get: () => Account.libLocal(),
      prepare: (v, id) => Account.fetchTexts(v, id),
      set: (v, got) => Account.applyLibrary(v, got),
      row: r => r._library || null,
      empty: v => !v || (!Object.keys(v.texts || {}).length && !Object.keys(v.deck || {}).length),
    },
  },
  hasLearn() { return typeof Learn !== 'undefined' && !!Learn.state; },
  /** Обучение из аккаунта — в этот браузер (через обычное сохранение обучения); интерфейс потом перезагружает страницу. */
  applyLearn(v) {
    if (!v || !this.hasLearn() || this.same(v, Learn.snapshot())) return;
    this.applying = true;
    try { Learn.state = Learn.fromSnapshot(v); Learn.save(); } finally { this.applying = false; }
    this.reloadNeeded = true;
  },
  snapshot() { const o = {}; for (const k in this.parts) o[k] = this.parts[k].get(); return o; },
  fromRow(row) { const o = {}; for (const k in this.parts) o[k] = this.parts[k].row(row); return o; },
  same(a, b) { return JSON.stringify(a) === JSON.stringify(b); },
  /** Что пропадёт у victim, если взять версию winner: части, где у victim что-то есть, а winner (если у него эта часть есть) — другое. */
  losses(victim, winner) {
    return Object.keys(this.parts).filter(k => !this.parts[k].empty(victim[k]) && winner[k] != null && !this.same(victim[k], winner[k]));
  },
  /** Чью версию взять при входе. local — браузер, remote — аккаунт (null — в аккаунте ещё ничего нет).
   *  'push' — браузер → аккаунт, 'pull' — аккаунт → браузер, 'same' — одинаково, 'ask' — спросить игрока.
   *  Не спрашиваем, только когда одной из сторон терять нечего («в браузере пусто», «в аккаунте пусто»). */
  decide(local, remote) {
    if (!remote) return 'push';
    if (this.same(local, remote)) return 'same';
    if (!this.losses(local, remote).length) return 'pull';
    if (!this.losses(remote, local).length) return 'push';
    return 'ask';
  },
  /** Части, которых в браузере нет (например, имени), — взять из аккаунта: терять тут нечего. */
  async fillMissing(row, accountId = this.state.accountId) {
    if (!row) return;
    const local = this.snapshot(), v = this.fromRow(row);
    const ks = Object.keys(this.parts).filter(k => local[k] == null && v[k] != null);
    await this.replaceParts(ks, v, accountId);
    this.save();
  },
  /** Заменить части ks значениями v: сначала всё скачать (prepare), потом разом записать — без «половины» при обрыве связи. */
  async replaceParts(ks, v, accountId) {
    const got = {};
    for (const k of ks) if (this.parts[k].prepare) got[k] = await this.parts[k].prepare(v[k], accountId);
    for (const k of ks) this.parts[k].set(v[k], got[k]);
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
      if (this.onBusy) this.onBusy(true);   // окно входа закрылось — дальше сверка с аккаунтом, интерфейс ждёт
      try { return { ok: true, ...(await this.link(acc)) }; } finally { if (this.onBusy) this.onBusy(false); }
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
    this.rev++;
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
    try {
      if (d === 'pull') await this.takeRemote(remote, false, who.accountId); else await this.fillMissing(remote, who.accountId);   // до finish: тот подставит имя у поставщика, если имени нет нигде
    } catch (e) {
      if (e === 'unconfirmedOverwrite') throw e;
      if (acc) this.finish(acc);   // не скачали (оборвалась связь) — здесь ничего не заменили; вошли, сверим при следующем запуске
      return { result: this.failed(e) };
    }
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
    const id = h.acc ? h.acc.accountId : this.state.accountId;
    try {
      if (which === 'remote') await this.takeRemote(h.remote, true, id); else await this.fillMissing(h.remote, id);
    } catch (e) {
      if (e === 'unconfirmedOverwrite') throw e;
      this.held = h;   // не скачали — здесь ничего не заменили, выбор ждёт дальше
      this.warn(e);
      return { ok: false, error: 'offline' };
    }
    if (h.acc) this.finish(h.acc);
    const r = await this.claim(h.remote, h.login, which === 'local').then(() => true, e => this.failed(e));
    return { ok: true, pending: r !== true };
  },
  /** 🚨 Заменить версию браузера версией аккаунта (части, которых в аккаунте нет, остаются). Молча — только если здесь ничего
   *  не пропадёт; иначе нужен confirmed. */
  async takeRemote(row, confirmed = false, accountId = this.state.accountId) {
    const local = this.snapshot(), v = this.fromRow(row);
    if (!confirmed && this.losses(local, v).length) throw this.alarm('версия браузера чуть не заменилась без подтверждения', local, v);
    await this.replaceParts(Object.keys(this.parts).filter(k => v[k] != null), v, accountId);
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
  async sync({ noLink = false } = {}) {
    const s = this.state;
    if (!this.signedIn() || location.protocol === 'file:' || !ACCOUNT_CONFIG.firebase) return { result: 'pending' };
    if (!this.linked()) return noLink ? { result: 'pending' } : this.link();   // читалка сверку при входе не проводит — это дело игры
    try {
      const remote = await this.readRow(s);
      if (remote && remote.browserId !== s.id) return { result: this.goStale() };
      // строки нет (удалили в консоли), здесь есть незаписанное или в аккаунте не то (например, обучения там ещё нет) — главный пишет
      if (!remote || s.profilePending || !this.same(this.snapshot(), this.fromRow(remote))) await this.push();
      this.watch();
      return { result: 'ok' };
    } catch (e) {
      return { result: e === 'stale' ? 'stale' : this.failed(e) };
    }
  },
  /** Записать изменения этого браузера в аккаунт (смена имени, обучение). */
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
      if (remote) await this.takeRemote(remote, true);   // устаревшая версия браузера не в счёт
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
    if (this.signedIn()) { this.state.profilePending = true; this.save(); this.changed(); }
    this.warn(e);
    return 'pending';
  },
  warn(e) { try { console.warn('Аккаунт: не сверили —', (e && (e.code || e.message)) || e); } catch (x) { /* консоли нет */ } },

  // ---------- обучение поменялось — в аккаунт ----------
  /** Хранилище игры с «глазком»: обучение сохранилось — отметить и записать в аккаунт (main.js: Session.start(Account.wrapIO(BrowserIO))). */
  wrapIO(io) {
    const self = this;
    return Object.assign(Object.create(io), {
      save(k, text) { io.save(k, text); if (typeof Learn !== 'undefined' && k === Learn.KEY) self.learnSaved(text); },
    });
  },
  /** Обучение сохраняется раз в несколько секунд — в аккаунт идёт, только если поменялось, и не чаще раза в PUSH_EVERY. */
  learnSaved(text) {
    if (text === this.lastLearnText) return;
    this.lastLearnText = text;
    this.localChanged();
  },
  /** Читалка пишет в localStorage сама (и на своей странице) — раз в несколько секунд смотрим, не поменялось ли (AccountUI, library/sync.js). */
  libraryCheck() {
    const raw = this.libRaw();
    if (raw === this.lastLibRaw) return false;
    this.lastLibRaw = raw;
    this.localChanged();
    return true;
  },
  /** Здесь что-то поменялось: вошли и этот браузер главный — записать в аккаунт (не чаще раза в PUSH_EVERY). */
  localChanged() {
    this.rev++;
    if (this.applying || !this.state || !this.signedIn() || !this.linked() || this.stale) return;
    if (!this.state.profilePending) { this.state.profilePending = true; this.save(); this.changed(); }
    this.later();
  },
  /** Записать в аккаунт через PUSH_EVERY (если запись уже назначена — она и запишет). */
  later() {
    if (this.pushTimer) return;
    this.pushTimer = setTimeout(() => { this.pushTimer = null; this.flush(); }, this.PUSH_EVERY);
    if (this.pushTimer && this.pushTimer.unref) this.pushTimer.unref();   // в тестах (Node) не держать процесс
  },
  changed() { if (this.onChange) try { this.onChange(); } catch (e) { /* интерфейс */ } },
  /** Записать незаписанное сейчас (вкладку прячут или закрывают, появилась сеть). */
  flush() {
    const s = this.state;
    if (!s || !s.profilePending || !this.signedIn() || !this.linked() || this.stale || location.protocol === 'file:') return Promise.resolve({ result: 'none' });
    return this.saveToAccount();
  },

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
  userRef(db, id) { return db.collection('users').doc(id); },
  learnRef(db, id) { return this.userRef(db, id).collection('data').doc('learn'); },
  /** Строка аккаунта в списке игроков (null — ещё нет) и его обучение — в row._learn (null — обучения в аккаунте ещё нет). */
  async readRow(who) {
    if (!who.accountId) throw 'noAccountId';
    await this.session(who);
    const db = await this.fbDb();
    let snap = null, ls = null, lb = null;
    // строка, обучение и читалка — в одной транзакции: одна и та же версия аккаунта, даже если в этот момент пишет другой браузер
    await this.within(db.runTransaction(async t => {
      snap = await t.get(this.userRef(db, who.accountId));
      ls = snap.exists ? await t.get(this.learnRef(db, who.accountId)) : null;
      lb = snap.exists ? await t.get(this.partRef(db, who.accountId, 'library')) : null;
    }));
    if (!snap.exists) { this.sent = { row: null, learn: null, lib: null, libIndex: {} }; return null; }
    const row = snap.data();
    const json = ls && ls.exists ? await this.unpack(ls.data()) : null;
    const lib = lb && lb.exists ? await this.unpack(lb.data()) : null;
    row._learn = json ? JSON.parse(json) : null;
    row._library = lib ? JSON.parse(lib) : null;
    this.sent = { row: this.rowKey(row), learn: json, lib, libIndex: (row._library && row._library.texts) || {} };
    return row;
  },
  partRef(db, id, part) { return this.userRef(db, id).collection('data').doc(part); },
  textRef(db, id, tid) { return this.userRef(db, id).collection('texts').doc(tid); },

  // ---------- читалка: свои тексты, карточки слов, уровень, поля ----------
  libRaw() {
    try { return Object.values(this.LIB).map(k => localStorage.getItem(k)).join('\u0001'); } catch (e) { return null; }
  },
  readJson(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } },
  /** Свои тексты читалки: { id: текст } (как в library/owntext.js). */
  localTexts() { const db = this.readJson(this.LIB.texts); return (db && db.texts && typeof db.texts === 'object') ? db.texts : {}; },
  /** Отпечаток текста: по нему видно, поменялся ли он (без скачивания). Тот же JSON, что уходит в документ текста. */
  textHash(json) {
    let h = 0x811c9dc5;
    for (let i = 0; i < json.length; i++) { h ^= json.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return json.length.toString(36) + '-' + h.toString(36);
  },
  /** Снимок читалки: { texts: { id: { title, updated, hash } }, deck, level, margin } или null (хранилища нет). */
  libLocal() {
    try { localStorage.getItem(this.LIB.deck); } catch (e) { return null; }
    if (typeof localStorage === 'undefined') return null;
    const texts = {}, cache = this.hashCache || (this.hashCache = new Map());
    for (const [id, t] of Object.entries(this.localTexts())) {
      if (!t || typeof t.text !== 'string' || t.text.length > this.LIB_MAX_CHARS) continue;
      const key = `${t.updated}|${t.text.length}|${t.title}`;
      let c = cache.get(id);
      if (!c || c.key !== key) cache.set(id, c = { key, hash: this.textHash(JSON.stringify(t)) });
      texts[id] = { title: String(t.title || ''), updated: String(t.updated || ''), hash: c.hash };
    }
    const deck = this.readJson(this.LIB.deck);
    const get = k => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
    return { texts, deck: (deck && deck.cards) || {}, level: get(this.LIB.level), margin: get(this.LIB.margin) };
  },
  /** Сводка для экрана выбора: сколько своих текстов и карточек слов. */
  librarySummary(v) { return { texts: Object.keys((v && v.texts) || {}).length, cards: Object.keys((v && v.deck) || {}).length }; },
  /** Скачать тексты, которых здесь нет или которые другие, — одной транзакцией, со сверкой отпечатков. { id: текст }. */
  async fetchTexts(v, accountId) {
    const local = this.libLocal() || { texts: {} };
    const need = Object.keys(v.texts || {}).filter(id => !local.texts[id] || local.texts[id].hash !== v.texts[id].hash);
    if (!need.length) return {};
    const db = await this.fbDb(), docs = {};
    await this.within(db.runTransaction(async t => { for (const id of need) docs[id] = await t.get(this.textRef(db, accountId, id)); }), 30000);
    const got = {};
    for (const id of need) {
      const json = docs[id].exists ? await this.unpack(docs[id].data()) : null;
      if (!json || this.textHash(json) !== v.texts[id].hash) throw 'remoteChanged';   // в аккаунте уже другое — сверим заново
      got[id] = JSON.parse(json);
    }
    return got;
  },
  /** Читалку из аккаунта — в этот браузер: тексты из оглавления (скачанные — got, остальные уже здесь), карточки, уровень, поля.
   *  Свои тексты длиннее LIB_MAX_CHARS живут только здесь — остаются. */
  applyLibrary(v, got = {}) {
    if (!v || typeof localStorage === 'undefined') return;
    const have = this.localTexts(), texts = {};
    for (const id of Object.keys(v.texts || {})) if (got[id] || have[id]) texts[id] = got[id] || have[id];
    for (const [id, t] of Object.entries(have)) if (!(id in texts) && t && typeof t.text === 'string' && t.text.length > this.LIB_MAX_CHARS) texts[id] = t;
    const set = (k, val) => { if (val) localStorage.setItem(k, val); else localStorage.removeItem(k); };
    const before = this.libRaw();
    set(this.LIB.texts, JSON.stringify({ version: 1, texts }));
    set(this.LIB.deck, JSON.stringify({ version: 2, cards: v.deck || {} }));
    set(this.LIB.level, v.level || '');
    set(this.LIB.margin, v.margin || '');
    this.lastLibRaw = this.libRaw();
    if (this.lastLibRaw !== before) this.reloadNeeded = true;
  },
  /** Поля строки, по которым видно, поменялась ли она (без дат). */
  rowKey(r) { return JSON.stringify(['accountId', 'provider', 'name', 'providerName', 'email', 'tgId', 'tgUsername', 'photo', 'browserId'].map(k => r[k] == null ? null : r[k])); },
  /** Обучение для записи в аккаунт: JSON (null — обучения здесь нет). */
  learnJson() {
    const v = this.parts.learn.get();
    return v == null ? null : JSON.stringify(v);
  },
  /** Документ данных: JSON, сжатый gzip (Firestore Bytes, поле gz); браузер без CompressionStream — JSON строкой (поле json).
   *  extra — ещё поля (у текста — hash). Больше max байт — не пишем (throw 'tooBig'; когда понадобится — делить на несколько документов). */
  async packDoc(json, extra = {}, max = this.MAX_DOC) {
    const doc = Object.assign({ size: json.length, browserId: this.state.id, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, extra);
    if (typeof CompressionStream !== 'undefined' && firebase.firestore.Blob) {
      const bytes = new Uint8Array(await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
      if (bytes.length > max) throw 'tooBig';
      doc.gz = firebase.firestore.Blob.fromUint8Array(bytes);
    } else {
      if ((typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(json).length : json.length * 2) > max) throw 'tooBig';
      doc.json = json;
    }
    return doc;
  },
  /** Что записать в аккаунт помимо строки — только поменявшееся против sent (что в аккаунте сейчас):
   *  документ обучения, документ читалки, документы своих текстов (новые и исправленные) и удалённые тексты. */
  async plan(sent) {
    const p = { learnJson: this.learnJson(), learn: null, libJson: null, lib: null, texts: [], gone: [] };
    if (p.learnJson != null && p.learnJson !== sent.learn) p.learn = await this.packDoc(p.learnJson);
    const lib = this.parts.library.get();
    if (lib) {
      p.libJson = JSON.stringify(lib);
      if (p.libJson !== sent.lib) p.lib = await this.packDoc(p.libJson);
      const was = sent.libIndex || {}, items = this.localTexts();
      for (const [id, meta] of Object.entries(lib.texts)) if (!was[id] || was[id].hash !== meta.hash)
        p.texts.push([id, await this.packDoc(JSON.stringify(items[id]), { hash: meta.hash }, this.MAX_TEXT_DOC)]);
      for (const id of Object.keys(was)) if (!lib.texts[id]) p.gone.push(id);
    }
    return p;
  },
  writePlan(t, db, id, p) {
    if (p.learn) t.set(this.learnRef(db, id), p.learn);
    if (p.lib) t.set(this.partRef(db, id, 'library'), p.lib);
    for (const [tid, doc] of p.texts) t.set(this.textRef(db, id, tid), doc);
    for (const tid of p.gone) t.delete(this.textRef(db, id, tid));
  },
  /** Что в аккаунте после записи plan. */
  sentAfter(sent, p, rowKey) {
    return { row: rowKey, learn: p.learnJson != null ? p.learnJson : sent.learn, lib: p.libJson != null ? p.libJson : sent.lib,
      libIndex: p.libJson != null ? JSON.parse(p.libJson).texts : sent.libIndex };
  },
  /** JSON из документа данных (сжатого или нет). */
  async unpack(d) {
    if (d.gz) {
      const bytes = d.gz.toUint8Array ? d.gz.toUint8Array() : d.gz;
      return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
    }
    return d.json || null;
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
      if (this.losses(v, this.snapshot()).length) throw this.alarm('версия аккаунта чуть не заменилась без подтверждения', v, this.snapshot());
    }
    const rev = this.rev, db = await this.fbDb(), data = this.rowData(remote, login), sent = this.sent || {};
    const p = await this.plan(sent);   // то, что в аккаунте уже такое же, — не пишем
    // строка, обучение, читалка и тексты — одной транзакцией: либо записалось всё, либо ничего
    await this.within(db.runTransaction(async t => {
      t.set(this.userRef(db, s.accountId), data, { merge: true });
      this.writePlan(t, db, s.accountId, p);
    }), 30000);
    this.sent = this.sentAfter(sent, p, this.rowKey(data));
    s.linked = s.accountId; this.stale = false;
    if (rev === this.rev) delete s.profilePending; else { s.profilePending = true; this.later(); }   // пока писали, здесь что-то поменялось — допишем
    this.save();
    this.changed();
    this.watch();
  },
  /** Записать изменения, только если этот браузер всё ещё главный; нет — он устарел (throw 'stale') и ничего не пишет. */
  async push() {
    const s = this.state;
    await this.session(s);
    const rev = this.rev, db = await this.fbDb(), ref = this.userRef(db, s.accountId);
    const sent = this.sent || {};
    const p = await this.plan(sent);
    let other = false, rowKey = sent.row;
    await this.within(db.runTransaction(async t => {
      const snap = await t.get(ref), row = snap.exists ? snap.data() : null;
      other = !!(row && row.browserId !== s.id);
      if (other) return;
      const data = this.rowData(row, false);
      rowKey = this.rowKey(data);
      if (!row || rowKey !== this.rowKey(row)) t.set(ref, data, { merge: true });   // строка — только если что-то в ней поменялось
      this.writePlan(t, db, s.accountId, p);
    }), 30000);
    if (other) { this.goStale(); throw 'stale'; }
    this.sent = this.sentAfter(sent, p, rowKey);
    if (rev === this.rev) delete s.profilePending; else { s.profilePending = true; this.later(); }   // пока писали, здесь что-то поменялось — допишем
    this.save();
    this.changed();
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
if (typeof Session !== 'undefined') Session.extraKeys.push(Account.KEY);   // на странице читалки сеанса игры нет
