'use strict';
// Платформа без браузера: вход (platform/account.js) — гость, выбор «без входа», ненастроенный вход, чтение JWT, выход, сброс.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');

function loadAccount({ config = {}, protocol = 'https:', learn = false } = {}) {
  const store = {};
  const ctx = {
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    location: { protocol }, navigator: { onLine: true }, Session: { extraKeys: [] },
    atob: s => Buffer.from(s, 'base64').toString('binary'), TextDecoder, TextEncoder, Blob, Response, CompressionStream, DecompressionStream, crypto: require('crypto').webcrypto, performance, Uint8Array, JSON, Date, Math, String, Number, Promise,
  };
  vm.createContext(ctx);
  // learn — с ядром обучения (встроенные колоды из content/ru/words.js), как в игре
  const core = learn ? [...require('./load-core').CORE_FILES.filter(f => f.startsWith('core/util') || f.startsWith('core/defs') || f.startsWith('core/learning/')), 'content/ru/words.js'] : [];
  if (learn) core.unshift(core.pop());   // слова — раньше ядра
  for (const f of [...core, 'platform/account-config.js', 'platform/account.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  vm.runInContext(`Object.assign(ACCOUNT_CONFIG, ${JSON.stringify(config)}); this.Account = Account;`, ctx);
  return { A: ctx.Account, store, ctx };
}

test('вход: гость с номером браузера, «без входа», ненастроенный вход, выход, сброс стирает и вход', async () => {
  const { A, store, ctx } = loadAccount({ config: { firebase: null, telegram: null } });   // способы входа не настроены
  assert.deepEqual([...ctx.Session.extraKeys], [A.KEY], '«Стереть всё» и ?reset стирают и вход');
  const s = A.load();
  assert.match(s.id, /^b-/);
  assert.equal(A.signedIn(), false);
  assert.equal(A.decided(), false, 'на старте ещё не решили');
  assert.equal(JSON.parse(store[A.KEY]).id, s.id, 'номер браузера сохранён');
  assert.equal(A.load().id, s.id, 'и при следующем запуске тот же');
  A.chooseGuest();
  assert.equal(A.decided(), true);
  assert.equal(A.configured('google'), false);
  assert.deepEqual(JSON.parse(JSON.stringify(await A.signIn('google'))), { ok: false, error: 'notConfigured' });
  assert.equal(A.signedIn(), false);
});

test('вход: с диска не входим; Telegram — имя из id_token; выход оставляет номер браузера', async () => {
  const cfg = { firebase: { apiKey: 'x' }, telegram: { clientId: 123 } };
  const { A } = loadAccount({ config: cfg, protocol: 'file:' });
  A.load();
  assert.equal(A.configured('google') && A.configured('telegram'), true);
  assert.equal((await A.signIn('telegram')).error, 'fileProtocol');
  const claims = { sub: '42', name: 'Ανδρέας Γ.', preferred_username: 'andreas' };
  const token = 'h.' + Buffer.from(JSON.stringify(claims)).toString('base64url') + '.s';
  assert.deepEqual(JSON.parse(JSON.stringify(A.jwtClaims(token))), claims, 'JWT читается, и греческие буквы тоже');
  assert.equal(A.jwtClaims('мусор'), null);
  // вход «как будто прошёл» — выход возвращает гостя, номер браузера тот же
  const id = A.state.id;
  Object.assign(A.state, { provider: 'telegram', uid: '42', name: 'Ανδρέας' });
  assert.equal(A.signedIn(), true);
  await A.signOut();
  assert.equal(A.signedIn(), false);
  assert.equal(A.state.id, id);
  assert.equal(A.state.uid, undefined);
  assert.ok(A.decided(), 'после выхода — гость, снова не спрашиваем');
});

// ---------- список игроков (Firestore) — на поддельном Firebase ----------
/** Общая «база» Firestore: строки, история записей, подписчики (onSnapshot). online:false — ни чтение, ни запись не проходят. */
function fakeDb() { return { docs: {}, writes: [], subs: {}, online: true }; }
/** Поддельный Firebase одного браузера: свой вход (Google — g-1, анонимный — anon-N), общая база db. */
function fakeFirebase(db = fakeDb(), anonPrefix = 'anon-') {
  let current = null, seq = 0;
  const auth = {
    get currentUser() { return current; },
    onAuthStateChanged(cb) { setTimeout(() => cb(current)); return () => {}; },
    async signInWithPopup() { current = { uid: 'g-1', isAnonymous: false, displayName: 'Andrey G', email: 'andrey@example.com', photoURL: 'https://example.com/p.jpg' }; return { user: current }; },
    async signInAnonymously() { current = { uid: anonPrefix + (++seq), isAnonymous: true }; return { user: current }; },
    async signOut() { current = null; },
  };
  const TS = 'SERVER_TS';
  const down = () => Promise.reject({ code: 'unavailable' });
  const snap = path => ({ exists: path in db.docs, data: () => ({ ...db.docs[path] }) });
  const ref = path => ({
    get: () => db.online ? Promise.resolve(snap(path)) : down(),
    set: (d, opt) => {
      if (!db.online) return down();
      db.writes.push({ path, data: { ...d } });
      db.docs[path] = opt && opt.merge ? { ...db.docs[path], ...d } : { ...d };
      for (const cb of db.subs[path] || []) cb(snap(path));
      return Promise.resolve();
    },
    delete: () => { if (!db.online) return down(); db.writes.push({ path, deleted: true }); delete db.docs[path]; return Promise.resolve(); },
    onSnapshot(cb) {
      (db.subs[path] = db.subs[path] || []).push(cb);
      cb(snap(path));
      return () => { db.subs[path] = db.subs[path].filter(x => x !== cb); };
    },
    collection: c => ({ doc: id => ref(`${path}/${c}/${id}`) }),
  });
  const store = {
    collection: c => ({ doc: id => ref(`${c}/${id}`) }),
    runTransaction: async fn => {
      if (!db.online) return down();
      const r = await fn({ get: r => r.get(), set: (r, d, o) => { r.set(d, o); }, delete: r => { r.delete(); } });
      if (db.beforeCommit) { const f = db.beforeCommit; db.beforeCommit = null; f(); }   // что-то случилось, пока запись шла на сервер
      return r;
    },
  };
  const fb = {
    apps: [],
    initializeApp() { fb.apps.push({}); },
    auth: Object.assign(() => auth, { GoogleAuthProvider: function () {} }),
    firestore: Object.assign(() => store, { FieldValue: { serverTimestamp: () => TS }, Blob: { fromUint8Array: u8 => ({ toUint8Array: () => u8 }) } }),
  };
  return { fb, db, docs: db.docs, writes: db.writes, auth, TS, setOnline: v => { db.online = v; } };
}
/** Браузер с игрой: свой localStorage и вход, база — общая (передать db второго браузера, чтобы играть под тем же аккаунтом). */
function loadWithFirebase(store0, db, anonPrefix, learn = false) {
  const r = loadAccount({ config: { firebase: { apiKey: 'x', projectId: 'p' }, telegram: { clientId: 123 } }, learn });
  if (store0) Object.assign(r.store, store0);
  const F = fakeFirebase(db, anonPrefix);
  Object.assign(r.ctx, { window: r.ctx, firebase: F.fb, console: { warn() {} }, setTimeout });
  r.ctx.Telegram = { Login: { auth: (opts, cb) => cb({ id_token: 'x.y.z', user: { id: 42, name: 'Ανδρέας', preferred_username: 'andreas', picture: 'https://t.me/p.jpg' } }) } };
  r.A.loadScript = async () => {};
  return { ...r, F };
}
/** Поля, которые пропускают firestore.rules (hasOnly([...])) — запись не должна выходить за них. */
const RULE_KEYS = JSON.parse(fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8').match(/hasOnly\((\[[^\]]*\])\)/)[1].replace(/'/g, '"'));
const plain = v => JSON.parse(JSON.stringify(v));

test('вход: чью версию взять — целиком с одной стороны; разное — спросить', () => {
  const { A } = loadAccount();
  A.load();
  const n = name => ({ name });
  assert.equal(A.decide(n('Андрей'), null), 'push', 'в аккаунте пусто — берём браузер');
  assert.equal(A.decide(n(''), n('Ανδρέας')), 'pull', 'в браузере пусто — берём аккаунт');
  assert.equal(A.decide(n('Андрей'), n('Андрей')), 'same');
  assert.equal(A.decide(n('Андрей'), n('Ανδρέας')), 'ask');
});

test('список игроков: вход через Google — строка users/<uid>, этот браузер главный; имя пишется в аккаунт; без связи — допишем при запуске', async () => {
  const { A, F } = loadWithFirebase();
  A.load();
  assert.deepEqual(plain(await A.signIn('google')), { ok: true, result: 'push' });
  const row = F.docs['users/google:g-1'];
  assert.equal(row.accountId, 'google:g-1', 'главный id — по пользователю Firebase');
  assert.ok(row, 'строка у пользователя Firebase');
  assert.equal(row.provider, 'google');
  assert.equal(row.name, 'Andrey G', 'имени не было — взяли имя у Google');
  assert.equal(row.email, 'andrey@example.com');
  assert.equal(row.tgId, null);
  assert.equal(row.browserId, A.state.id, 'главный — этот браузер');
  assert.equal(row.createdAt, F.TS);
  assert.equal(row.lastLoginAt, F.TS);
  assert.equal(A.linked(), true);

  assert.deepEqual(plain(await A.setName('   ')), { ok: false, error: 'emptyName' });
  assert.deepEqual(plain(await A.setName('  Ανδρέας   Γ. ')), { ok: true, result: 'push' });
  assert.equal(F.docs['users/google:g-1'].name, 'Ανδρέας Γ.');
  assert.equal(F.docs['users/google:g-1'].providerName, 'Andrey G', 'имя у Google — отдельно');
  assert.equal('createdAt' in F.writes.at(-1).data, false, 'дату регистрации не переписываем');
  await A.setName('x'.repeat(60));
  assert.equal(F.docs['users/google:g-1'].name.length, 40);
  await A.setName('Ανδρέας Γ.');

  await A.signOut();
  assert.equal(A.signedIn(), false);
  assert.equal(A.state.name, 'Ανδρέας Γ.', 'имя остаётся в браузере и после выхода');
  assert.equal((await A.signIn('google')).result, 'same');

  F.setOnline(false);
  assert.equal((await A.setName('Новое имя')).result, 'pending', 'без связи — сохранили здесь');
  assert.equal(A.state.profilePending, true);
  F.setOnline(true);
  assert.equal((await A.sync()).result, 'ok', 'при запуске дописали');
  assert.equal(F.docs['users/google:g-1'].name, 'Новое имя');
  assert.equal(A.state.profilePending, undefined);
  for (const w of F.writes.filter(w => w.path.split('/').length === 2)) for (const k of Object.keys(w.data)) assert.ok(RULE_KEYS.includes(k), `поле ${k} есть в firestore.rules`);
});

test('имя без входа; вход в аккаунт, где имя другое, — спросить; выбрать браузер, аккаунт или не входить', async () => {
  const { A, F } = loadWithFirebase();
  A.load();
  assert.deepEqual(plain(await A.setName('Андрей')), { ok: true }, 'без входа — только здесь');
  assert.equal(F.writes.length, 0);
  F.docs['users/google:g-1'] = { provider: 'google', name: 'Ανδρέας', browserId: 'b-other', updatedAt: 1700000000000, createdAt: 1 };

  let r = await A.signIn('google');
  assert.equal(r.result, 'ask');
  assert.equal(typeof r.choice.localAt, 'number', 'когда имя поменяли здесь');
  delete r.choice.localAt;
  const nl = v => ({ name: v.name, learn: v.learn });
  assert.deepEqual(plain({ ...r.choice, local: nl(r.choice.local), remote: nl(r.choice.remote) }), { local: { name: 'Андрей', learn: null }, remote: { name: 'Ανδρέας', learn: null }, savedAt: 1700000000000, provider: 'google', login: true });
  assert.equal(A.signedIn(), false, 'пока не выбрали — не вошли');
  assert.deepEqual(plain(await A.choose(null)), { ok: true, cancelled: true });
  assert.equal(A.signedIn(), false);
  assert.equal(A.state.name, 'Андрей');
  assert.equal(F.writes.length, 0);

  await A.signIn('google');
  assert.deepEqual(plain(await A.choose('remote')), { ok: false, error: 'notConfirmed' }, '🚨 без второго экрана не заменяем');
  assert.equal(A.signedIn(), false);
  assert.equal(A.state.name, 'Андрей');
  assert.equal(F.writes.length, 0);
  assert.deepEqual(plain(await A.choose('remote', true)), { ok: true, pending: false }, 'выбор ждал и дождался подтверждения');
  assert.equal(A.signedIn(), true);
  assert.equal(A.state.name, 'Ανδρέας');
  assert.equal(F.docs['users/google:g-1'].browserId, A.state.id, 'выбрали — этот браузер стал главным');
  assert.equal(F.docs['users/google:g-1'].createdAt, 1, 'дату регистрации не трогаем');

  await A.signOut();
  await A.setName('Андрей');
  assert.equal((await A.signIn('google')).result, 'ask', 'новый вход — снова сверка: разное — спросить');
  assert.deepEqual(plain(await A.choose('local')), { ok: false, error: 'notConfirmed' });
  assert.equal(F.docs['users/google:g-1'].name, 'Ανδρέας');
  assert.deepEqual(plain(await A.choose('local', true)), { ok: true, pending: false });
  assert.equal(F.docs['users/google:g-1'].name, 'Андрей', 'в аккаунте — как в браузере');
});

test('один аккаунт — один главный браузер: вошли во втором — первый устарел; перезагрузился — главный снова он', async () => {
  const db = fakeDb();
  const one = loadWithFirebase(null, db), two = loadWithFirebase(null, db);
  let staleOne = 0, staleTwo = 0;
  one.A.load(); two.A.load();
  one.A.onStale = () => staleOne++; two.A.onStale = () => staleTwo++;
  await one.A.signIn('google');
  await one.A.setName('Андрей');

  assert.equal((await two.A.signIn('google')).result, 'pull', 'во втором имени не было — взяли из аккаунта');
  assert.equal(two.A.state.name, 'Андрей');
  assert.equal(db.docs['users/google:g-1'].browserId, two.A.state.id, 'главный — второй');
  assert.equal(one.A.stale, true, 'первый узнал сразу, пока открыт');
  assert.equal(staleOne, 1);
  assert.equal((await one.A.setName('Старое')).result, 'stale', 'устаревший в аккаунт не пишет');
  assert.equal(db.docs['users/google:g-1'].name, 'Андрей');

  await two.A.setName('С телефона');
  assert.equal(db.docs['users/google:g-1'].name, 'С телефона', 'главный пишет смело');

  // первый загрузил версию из аккаунта — без вопросов, его «Старое» не в счёт — и стал главным, второй устарел
  assert.equal(one.A.state.name, 'Старое');
  assert.deepEqual(plain(await one.A.adopt()), { ok: true });
  assert.equal(one.A.state.name, 'С телефона');
  assert.equal(db.docs['users/google:g-1'].browserId, one.A.state.id);
  assert.equal(two.A.stale, true);
  assert.equal(staleTwo, 1);
  one.A.load();   // после перезагрузки
  assert.equal((await one.A.sync()).result, 'ok', 'после перезагрузки — главный');

  // второй открыли заново (не следил — например, был закрыт): узнаёт при запуске
  two.A.load();
  assert.equal((await two.A.sync()).result, 'stale');
  // и при записи, даже если не узнал раньше
  two.A.load();
  two.A.linked = () => true;
  assert.equal((await two.A.saveToAccount()).result, 'stale');
  assert.equal(db.docs['users/google:g-1'].name, 'С телефона');
});

test('Telegram: строка по номеру Telegram — одна на всех устройствах; вошли во втором браузере — сверка и первый устарел', async () => {
  const db = fakeDb();
  const one = loadWithFirebase(null, db, 'anon-a'), two = loadWithFirebase(null, db, 'anon-b');
  one.A.load(); two.A.load();
  let staleOne = 0;
  one.A.onStale = () => staleOne++;
  assert.deepEqual(plain(await one.A.signIn('telegram')), { ok: true, result: 'push' });
  assert.equal(one.A.state.accountId, 'telegram:42', 'главный id — по номеру Telegram');
  const row = db.docs['users/telegram:42'];
  assert.equal(row.accountId, 'telegram:42');
  assert.equal(row.provider, 'telegram');
  assert.equal(row.tgId, '42');
  assert.equal(row.tgUsername, 'andreas');
  assert.equal(row.email, null);
  assert.equal(row.name, 'Ανδρέας');
  await one.A.setName('Андрей');

  // второй браузер (свой анонимный пользователь Firebase): имя задали и тут — другое, значит спросить
  await two.A.setName('Andreas');
  const r = await two.A.signIn('telegram');
  assert.equal(r.result, 'ask');
  assert.equal(r.choice.remote.name, 'Андрей', 'увидел строку первого');
  await two.A.choose('remote', true);
  assert.equal(two.A.state.name, 'Андрей');
  assert.equal(db.docs['users/telegram:42'].browserId, two.A.state.id, 'главный — второй');
  assert.equal(one.A.stale, true, 'первый устарел');
  assert.equal(staleOne, 1);
  assert.deepEqual(Object.keys(db.docs).filter(k => k.split('/').length === 2), ['users/telegram:42'], 'строка одна');

  // вышли и вошли снова в том же браузере — та же строка
  await two.A.signOut();
  assert.equal((await two.A.signIn('telegram')).result, 'same');
  assert.deepEqual(Object.keys(db.docs).filter(k => k.split('/').length === 2), ['users/telegram:42']);
});

test('список игроков: без связи вход всё равно состоялся — сверка при запуске; вошли до появления списка — тоже', async () => {
  const { A, F } = loadWithFirebase();
  A.load();
  F.setOnline(false);
  assert.equal((await A.signIn('google')).result, 'pending');
  assert.equal(A.signedIn(), true);
  assert.equal(A.linked(), false, 'сверка при входе не прошла');
  F.setOnline(true);
  assert.equal((await A.sync()).result, 'push');
  assert.equal(F.docs['users/google:g-1'].name, 'Andrey G');
  assert.equal(A.linked(), true);

  const old = loadWithFirebase({ 'greekgame.account.v1': JSON.stringify({ id: 'b-old', provider: 'google', uid: 'g-1', name: 'Andrey G', email: 'andrey@example.com' }) });
  await old.F.auth.signInWithPopup();   // сессия Firebase в браузере жива
  old.A.load();
  assert.equal(old.A.state.fbUid, 'g-1');
  assert.equal(old.A.state.accountId, 'google:g-1');
  assert.equal((await old.A.sync()).result, 'push');
  assert.equal(old.F.docs['users/google:g-1'].browserId, 'b-old');
  assert.equal(old.F.docs['users/google:g-1'].createdAt, old.F.TS);
});

test('🚨 ловушка: затереть непустую другую версию без подтверждения нельзя', async () => {
  const { A, F } = loadWithFirebase();
  A.load();
  await A.signIn('google');
  await A.setName('Андрей');
  const errors = [];
  const alarm = A.alarm;
  A.alarm = (...a) => { errors.push(a[0]); return alarm.call(A, ...a); };
  // в обход интерфейса: заменить версию браузера / аккаунта без подтверждения
  await assert.rejects(A.takeRemote({ name: 'Чужое' }), e => e === 'unconfirmedOverwrite');
  assert.equal(A.state.name, 'Андрей', 'браузер не тронут');
  await assert.rejects(A.claim({ name: 'Чужое' }, false), e => e === 'unconfirmedOverwrite');
  assert.equal(F.docs['users/google:g-1'].name, 'Андрей', 'аккаунт не тронут');
  assert.equal(errors.length, 2, 'и оба раза — громко');
  // пустую или ту же — можно молча
  await A.takeRemote({ name: 'Андрей' });
  await A.claim({ name: 'Андрей' }, false);
  // главный пишет, не сравнивая: что бы ни лежало в аккаунте, пока главный — он
  F.docs['users/google:g-1'].name = 'Из консоли';
  assert.equal((await A.setName('Моё')).result, 'push');
  assert.equal(F.docs['users/google:g-1'].name, 'Моё');
});

// ---------- обучение в аккаунте ----------
/** Браузер с ядром обучения: Learn пишет в localStorage этого браузера через Account.wrapIO (как в игре). */
function browserWithLearn(db, anonPrefix) {
  const r = loadWithFirebase(null, db, anonPrefix, true);
  r.run = code => vm.runInContext(code, r.ctx);
  r.run(`Learn.io = Account.wrapIO({ load: k => localStorage.getItem(k), save: (k, v) => localStorage.setItem(k, v), remove: k => localStorage.removeItem(k) });
         Learn.state = Learn.newState(); Learn.save();`);
  r.A.load();
  r.A.PUSH_EVERY = 10;
  /** Выучить n новых слов. */
  r.study = (n, last = Date.parse('2026-11-20T10:00:00Z')) => r.run(`(() => { const c = Learn.state.decks.flatMap(d => d.cards);
    let k = 0; for (const card of c) { const key = Decks.pkey(card); if (Learn.state.progress[key]) continue;
      Learn.state.progress[key] = { step: 3, rev: 1, due: ${last} + 864e5, right: 3, wrong: 0, built: true, last: ${last} }; if (++k >= ${n}) break; }
    Learn.save(); })()`);
  r.words = () => r.run('Object.keys(Learn.state.progress).length');
  return r;
}
/** Документ обучения в «базе»: поле json — уже распакованный JSON (в базе он сжат: gz). */
const learnDoc = (db, id) => {
  const d = db.docs[`users/${id}/data/learn`];
  return d && { ...d, json: d.gz ? require('zlib').gunzipSync(Buffer.from(d.gz.toUint8Array())).toString() : d.json };
};
const tick = ms => new Promise(res => setTimeout(res, ms));

test('обучение в аккаунте: компактно (без слов встроенных колод); вход — пишем; главный дописывает изменения сам', async () => {
  const db = fakeDb();
  const b = browserWithLearn(db);
  const full = b.store['greekgame.learn.v1'].length;
  b.study(30);
  assert.equal((await b.A.signIn('google')).result, 'push');
  const doc = learnDoc(db, 'google:g-1');
  assert.ok(doc, 'обучение — отдельным документом users/<id>/data/learn');
  const snap = JSON.parse(doc.json);
  assert.ok(doc.json.length < full / 10, `снимок ${doc.json.length} байт против ${full} у полного сохранения`);
  assert.equal(Object.keys(snap.progress).length, 30);
  assert.ok(snap.decks.filter(d => d.builtin).every(d => !d.cards), 'у встроенных колод — без слов');
  assert.equal(doc.browserId, b.A.state.id);

  // занимаемся дальше — главный сам пишет в аккаунт (не чаще раза в PUSH_EVERY) и только если поменялось
  const writes = db.writes.length;
  b.run('Learn.save()');   // сохранение без изменений
  await tick(30);
  assert.equal(db.writes.length, writes, 'ничего не поменялось — не пишем');
  b.study(5);
  assert.equal(b.A.state.profilePending, true);
  await tick(30);
  assert.equal(Object.keys(JSON.parse(learnDoc(db, 'google:g-1').json).progress).length, 35, 'дописали');
  assert.equal(b.A.state.profilePending, undefined);
  assert.equal(db.writes.at(-1).path, 'users/google:g-1/data/learn', 'строку игрока не трогали — в ней ничего не поменялось');
  for (const w of db.writes.filter(w => w.path.endsWith('/data/learn'))) assert.deepEqual(Object.keys(w.data).sort(), ['browserId', 'gz', 'size', 'updatedAt'], 'сжато');
});

test('обучение в аккаунте: второй браузер — пусто → взяли из аккаунта; оба с прогрессом → спросить; устаревший загружает из аккаунта', async () => {
  const db = fakeDb();
  const one = browserWithLearn(db), two = browserWithLearn(db);
  one.study(20);
  await one.A.signIn('google');

  // во втором учёбы нет — молча взяли из аккаунта, страницу надо перезагрузить
  assert.equal((await two.A.signIn('google')).result, 'pull');
  assert.equal(two.words(), 20);
  assert.equal(two.A.reloadNeeded, true);
  assert.equal(JSON.parse(two.store['greekgame.learn.v1']).progress && Object.keys(JSON.parse(two.store['greekgame.learn.v1']).progress).length, 20, 'и сохранили');
  assert.ok(JSON.parse(two.store['greekgame.learn.v1']).decks.some(d => d.builtin && d.cards.length > 10), 'слова встроенных колод — из игры');
  assert.equal(one.A.stale, true, 'первый устарел');

  // первый «перезагрузился» — взял из аккаунта (там то же) и снова главный
  two.study(7);
  await tick(30);
  assert.equal(Object.keys(JSON.parse(learnDoc(db, 'google:g-1').json).progress).length, 27);
  assert.deepEqual(plain(await one.A.adopt()), { ok: true });
  assert.equal(one.words(), 27, 'устаревший взял версию из аккаунта');
  assert.equal(two.A.stale, true);

  // третий браузер со своим прогрессом — спросить; «Пропадёт» — учёба
  const three = browserWithLearn(db);
  three.study(3);
  const r = await three.A.signIn('google');
  assert.equal(r.result, 'ask');
  assert.deepEqual(plain(three.A.losses(r.choice.local, r.choice.remote)), ['learn']);
  assert.deepEqual(plain(three.A.losses(r.choice.remote, r.choice.local)), ['learn']);
  assert.deepEqual(plain(three.run('Learn.summary(Account.choice().remote.learn)')), { learned: 27, learning: 0, own: 0, last: Date.parse('2026-11-20T10:00:00Z') });
  assert.deepEqual(plain(await three.A.choose('local')), { ok: false, error: 'notConfirmed' });
  assert.equal(Object.keys(JSON.parse(learnDoc(db, 'google:g-1').json).progress).length, 27, 'без подтверждения — не тронули');
  await three.A.choose('local', true);
  assert.equal(Object.keys(JSON.parse(learnDoc(db, 'google:g-1').json).progress).length, 3, 'выбрали браузер — в аккаунте как в нём');
});

test('обучение в аккаунте: аккаунт заведён до этого (обучения в нём нет) — главный при запуске дописывает; при входе это не потеря', async () => {
  const db = fakeDb();
  const b = browserWithLearn(db);
  db.docs['users/google:g-1'] = { accountId: 'google:g-1', provider: 'google', name: 'Andrey G', browserId: b.A.state.id, createdAt: 1 };
  b.study(4);
  assert.equal((await b.A.signIn('google')).result, 'pull', 'здесь нет имени, а в аккаунте нет учёбы — терять нечего: имя оттуда, учёба отсюда');
  assert.equal(b.A.state.name, 'Andrey G');
  assert.equal(Object.keys(JSON.parse(learnDoc(db, 'google:g-1').json).progress).length, 4);
  // при запуске (вошли раньше), обучения в аккаунте нет — главный дописывает
  delete db.docs['users/google:g-1/data/learn'];
  b.A.load();
  assert.equal((await b.A.sync()).result, 'ok');
  assert.ok(learnDoc(db, 'google:g-1'));
});

test('обучение в аккаунте: сжато; вход ждёт сверки (onBusy); поменяли, пока шла запись, — не теряем, дописываем', async () => {
  const db = fakeDb();
  const b = browserWithLearn(db);
  b.study(200);
  const busy = [];
  b.A.onBusy = v => busy.push(v);
  await b.A.signIn('google');
  assert.deepEqual(busy, [true, false], 'интерфейс ждал сверки и дождался');
  const raw = db.docs['users/google:g-1/data/learn'];
  const json = learnDoc(db, 'google:g-1').json;
  assert.ok(raw.gz.toUint8Array().length < json.length / 4, `сжато: ${raw.gz.toUint8Array().length} байт из ${json.length}`);
  assert.equal(raw.size, json.length);

  // запись в аккаунт идёт, а игрок как раз ответил ещё на одно слово
  b.study(1);
  db.beforeCommit = () => b.study(1);
  assert.equal((await b.A.saveToAccount()).result, 'push');
  assert.equal(Object.keys(JSON.parse(learnDoc(db, 'google:g-1').json).progress).length, 201);
  assert.equal(b.A.state.profilePending, true, 'второе слово записаться не успело — помним');
  await tick(40);
  assert.equal(Object.keys(JSON.parse(learnDoc(db, 'google:g-1').json).progress).length, 202, 'дописали');
  assert.equal(b.A.state.profilePending, undefined);
});

// ---------- читалка в аккаунте: свои тексты, карточки слов ----------
const OWN = 'greek-reader:own-texts:v1', DECK = 'greek-reader:deck:v2';
const textItem = (id, text, updated = '2026-11-20T10:00:00.000Z') => ({ id, title: text.slice(0, 12), text, created: updated, updated, stats: null });
const putTexts = (b, items) => { b.store[OWN] = JSON.stringify({ version: 1, texts: Object.fromEntries(items.map(t => [t.id, t])) }); };
const putCards = (b, keys) => { b.store[DECK] = JSON.stringify({ version: 2, cards: Object.fromEntries(keys.map(k => [k, { key: k, head: k, status: 'learning' }])) }); };
const textDocs = (db, id) => Object.keys(db.docs).filter(k => k.startsWith(`users/${id}/texts/`)).map(k => k.split('/').pop()).sort();

test('читалка в аккаунте: тексты — по документу на текст, пишутся только поменявшиеся; второй браузер скачивает', async () => {
  const db = fakeDb();
  const one = loadWithFirebase(null, db), two = loadWithFirebase(null, db);
  one.A.PUSH_EVERY = 10;
  putTexts(one, [textItem('t1', 'Πρώτο κείμενο. '.repeat(200)), textItem('t2', 'Δεύτερο.')]);
  putCards(one, ['ρίχνω', 'ματιά']);
  one.store['greek-reader:my-level'] = 'A2';
  one.A.load(); two.A.load();
  assert.equal((await one.A.signIn('google')).result, 'push');
  assert.deepEqual(textDocs(db, 'google:g-1'), ['t1', 't2']);
  const lib = JSON.parse(require('zlib').gunzipSync(Buffer.from(db.docs['users/google:g-1/data/library'].gz.toUint8Array())).toString());
  assert.deepEqual(Object.keys(lib.texts).sort(), ['t1', 't2'], 'в документе читалки — только оглавление');
  assert.ok(!JSON.stringify(lib).includes('Πρώτο κείμενο. Πρώτο'), 'самих текстов в нём нет');
  assert.deepEqual(Object.keys(lib.deck).sort(), ['ματιά', 'ρίχνω']);
  assert.equal(lib.level, 'A2');

  // поправили карточку — тексты не трогаем; поправили один текст — пишем только его; удалили — удаляем
  const n0 = db.writes.length;
  putCards(one, ['ρίχνω', 'ματιά', 'φορά']);
  assert.equal(one.A.libraryCheck(), true);
  await tick(30);
  assert.ok(db.writes.slice(n0).every(w => !w.path.includes('/texts/')), 'карточка — без текстов');
  const n1 = db.writes.length;
  putTexts(one, [textItem('t1', 'Πρώτο κείμενο. '.repeat(200)), textItem('t2', 'Δεύτερο, διορθωμένο.', '2026-11-21T10:00:00.000Z')]);
  one.A.libraryCheck(); await tick(30);
  assert.deepEqual(db.writes.slice(n1).filter(w => w.path.includes('/texts/')).map(w => w.path.split('/').pop()), ['t2']);
  putTexts(one, [textItem('t2', 'Δεύτερο, διορθωμένο.', '2026-11-21T10:00:00.000Z')]);
  one.A.libraryCheck(); await tick(30);
  assert.deepEqual(textDocs(db, 'google:g-1'), ['t2'], 'удалённый текст ушёл и из аккаунта');

  // второй браузер: читалка пустая — взяли из аккаунта, тексты скачались
  assert.equal((await two.A.signIn('google')).result, 'pull');
  assert.equal(two.A.reloadNeeded, true);
  assert.deepEqual(Object.keys(JSON.parse(two.store[OWN]).texts), ['t2']);
  assert.equal(JSON.parse(two.store[OWN]).texts.t2.text, 'Δεύτερο, διορθωμένο.');
  assert.deepEqual(Object.keys(JSON.parse(two.store[DECK]).cards).sort(), ['ματιά', 'ρίχνω', 'φορά']);
  assert.equal(two.store['greek-reader:my-level'], 'A2');
  assert.equal(one.A.stale, true);
});

test('читалка в аккаунте: при входе с разными текстами — спросить; в аккаунте поменялось, пока скачивали, — ничего не заменили', async () => {
  const db = fakeDb();
  const one = loadWithFirebase(null, db), two = loadWithFirebase(null, db);
  putTexts(one, [textItem('t1', 'Ένα.')]);
  one.A.load();
  await one.A.signIn('google');
  putTexts(two, [textItem('t9', 'Άλλο.')]);
  two.A.load();
  const r = await two.A.signIn('google');
  assert.equal(r.result, 'ask');
  assert.deepEqual(plain(two.A.losses(r.choice.local, r.choice.remote)), ['library']);
  assert.deepEqual(plain(two.A.librarySummary(r.choice.remote.library)), { texts: 1, cards: 0 });
  // пока игрок думал, в аккаунте текст поменяли — скачанное не сходится с оглавлением: не заменяем, выбор ждёт
  const doc = db.docs['users/google:g-1/texts/t1'];
  db.docs['users/google:g-1/texts/t1'] = { ...doc, gz: { toUint8Array: () => require('zlib').gzipSync(JSON.stringify(textItem('t1', 'Αλλαγμένο.'))) } };
  assert.deepEqual(plain(await two.A.choose('remote', true)), { ok: false, error: 'offline' });
  assert.deepEqual(Object.keys(JSON.parse(two.store[OWN]).texts), ['t9'], 'здесь ничего не тронули');
  assert.ok(two.A.held, 'выбор ждёт дальше');
  db.docs['users/google:g-1/texts/t1'] = doc;
  assert.equal((await two.A.choose('remote', true)).ok, true);
  assert.deepEqual(Object.keys(JSON.parse(two.store[OWN]).texts), ['t1']);
});

test('читалка в аккаунте: страница читалки (без обучения) пишет только читалку и не трогает обучение в аккаунте', async () => {
  const db = fakeDb();
  const game = browserWithLearn(db);
  game.study(10);
  await game.A.signIn('google');
  const learn0 = learnDoc(db, 'google:g-1').json;
  // та же вкладка, страница читалки: Learn там нет; localStorage тот же
  const lib = loadWithFirebase(null, db);
  Object.assign(lib.store, game.store);
  await lib.F.auth.signInWithPopup();
  lib.A.load();
  assert.equal(lib.A.linked(), true);
  putTexts(lib, [textItem('t5', 'Νέο κείμενο από τη βιβλιοθήκη.')]);
  assert.equal((await lib.A.sync({ noLink: true })).result, 'ok');
  assert.deepEqual(textDocs(db, 'google:g-1'), ['t5'], 'текст из читалки — в аккаунте');
  assert.equal(learnDoc(db, 'google:g-1').json, learn0, 'обучение в аккаунте не тронуто');
  // не сверились при входе — читалка сама сверку не проводит
  const fresh = loadWithFirebase(null, fakeDb());
  fresh.store['greekgame.account.v1'] = JSON.stringify({ id: 'b-x', provider: 'google', uid: 'g-1', fbUid: 'g-1', accountId: 'google:g-1', name: 'A', providerName: 'A' });
  fresh.A.load();
  assert.equal((await fresh.A.sync({ noLink: true })).result, 'pending');
});
