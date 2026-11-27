'use strict';
// Платформа без браузера: вход (platform/account.js) — гость, выбор «без входа», ненастроенный вход, чтение JWT, выход, сброс.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');

function loadAccount({ config = {}, protocol = 'https:' } = {}) {
  const store = {};
  const ctx = {
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    location: { protocol }, navigator: { onLine: true }, Session: { extraKeys: [] },
    atob: s => Buffer.from(s, 'base64').toString('binary'), TextDecoder, crypto: require('crypto').webcrypto, performance, Uint8Array, JSON, Date, Math, String, Number, Promise,
  };
  vm.createContext(ctx);
  for (const f of ['platform/account-config.js', 'platform/account.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
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
    onSnapshot(cb) {
      (db.subs[path] = db.subs[path] || []).push(cb);
      cb(snap(path));
      return () => { db.subs[path] = db.subs[path].filter(x => x !== cb); };
    },
  });
  const store = {
    collection: c => ({ doc: id => ref(`${c}/${id}`) }),
    runTransaction: async fn => { if (!db.online) return down(); return fn({ get: r => r.get(), set: (r, d, o) => { r.set(d, o); } }); },
  };
  const fb = {
    apps: [],
    initializeApp() { fb.apps.push({}); },
    auth: Object.assign(() => auth, { GoogleAuthProvider: function () {} }),
    firestore: Object.assign(() => store, { FieldValue: { serverTimestamp: () => TS } }),
  };
  return { fb, db, docs: db.docs, writes: db.writes, auth, TS, setOnline: v => { db.online = v; } };
}
/** Браузер с игрой: свой localStorage и вход, база — общая (передать db второго браузера, чтобы играть под тем же аккаунтом). */
function loadWithFirebase(store0, db, anonPrefix) {
  const r = loadAccount({ config: { firebase: { apiKey: 'x', projectId: 'p' }, telegram: { clientId: 123 } } });
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
  const row = F.docs['users/g-1'];
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
  assert.equal(F.docs['users/g-1'].name, 'Ανδρέας Γ.');
  assert.equal(F.docs['users/g-1'].providerName, 'Andrey G', 'имя у Google — отдельно');
  assert.equal('createdAt' in F.writes.at(-1).data, false, 'дату регистрации не переписываем');
  await A.setName('x'.repeat(60));
  assert.equal(F.docs['users/g-1'].name.length, 40);
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
  assert.equal(F.docs['users/g-1'].name, 'Новое имя');
  assert.equal(A.state.profilePending, undefined);
  for (const w of F.writes) for (const k of Object.keys(w.data)) assert.ok(RULE_KEYS.includes(k), `поле ${k} есть в firestore.rules`);
});

test('имя без входа; вход в аккаунт, где имя другое, — спросить; выбрать браузер, аккаунт или не входить', async () => {
  const { A, F } = loadWithFirebase();
  A.load();
  assert.deepEqual(plain(await A.setName('Андрей')), { ok: true }, 'без входа — только здесь');
  assert.equal(F.writes.length, 0);
  F.docs['users/g-1'] = { provider: 'google', name: 'Ανδρέας', browserId: 'b-other', updatedAt: 1700000000000, createdAt: 1 };

  let r = await A.signIn('google');
  assert.equal(r.result, 'ask');
  assert.equal(typeof r.choice.localAt, 'number', 'когда имя поменяли здесь');
  delete r.choice.localAt;
  assert.deepEqual(plain(r.choice), { local: { name: 'Андрей' }, remote: { name: 'Ανδρέας' }, savedAt: 1700000000000, provider: 'google', login: true });
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
  assert.equal(F.docs['users/g-1'].browserId, A.state.id, 'выбрали — этот браузер стал главным');
  assert.equal(F.docs['users/g-1'].createdAt, 1, 'дату регистрации не трогаем');

  await A.signOut();
  await A.setName('Андрей');
  assert.equal((await A.signIn('google')).result, 'ask', 'новый вход — снова сверка: разное — спросить');
  assert.deepEqual(plain(await A.choose('local')), { ok: false, error: 'notConfirmed' });
  assert.equal(F.docs['users/g-1'].name, 'Ανδρέας');
  assert.deepEqual(plain(await A.choose('local', true)), { ok: true, pending: false });
  assert.equal(F.docs['users/g-1'].name, 'Андрей', 'в аккаунте — как в браузере');
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
  assert.equal(db.docs['users/g-1'].browserId, two.A.state.id, 'главный — второй');
  assert.equal(one.A.stale, true, 'первый узнал сразу, пока открыт');
  assert.equal(staleOne, 1);
  assert.equal((await one.A.setName('Старое')).result, 'stale', 'устаревший в аккаунт не пишет');
  assert.equal(db.docs['users/g-1'].name, 'Андрей');

  await two.A.setName('С телефона');
  assert.equal(db.docs['users/g-1'].name, 'С телефона', 'главный пишет смело');

  // первый перезагрузился: здесь «Старое» — в аккаунте этого нет, без второго экрана не заменяем
  assert.equal(one.A.state.name, 'Старое');
  assert.deepEqual(plain(await one.A.adopt()), { ok: false, error: 'notConfirmed' });
  assert.equal(one.A.state.name, 'Старое');
  assert.equal(one.A.staleLoss().lost, true);
  assert.deepEqual(plain(one.A.staleLoss().remote), { name: 'С телефона' }, 'что останется — по свежей строке');
  assert.equal(db.docs['users/g-1'].browserId, two.A.state.id, 'главный пока второй');
  // подтвердили: взял версию из аккаунта и стал главным, второй устарел
  assert.deepEqual(plain(await one.A.adopt(true)), { ok: true });
  assert.equal(one.A.state.name, 'С телефона');
  assert.equal(db.docs['users/g-1'].browserId, one.A.state.id);
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
  assert.equal(db.docs['users/g-1'].name, 'С телефона');
});

test('список игроков: Telegram — строка у анонимного пользователя Firebase; тот же браузер — та же строка', async () => {
  const { A, F } = loadWithFirebase();
  A.load();
  assert.equal((await A.signIn('telegram')).ok, true);
  assert.equal(A.state.fbUid, 'anon-1');
  const row = F.docs['users/anon-1'];
  assert.equal(row.provider, 'telegram');
  assert.equal(row.tgId, '42');
  assert.equal(row.tgUsername, 'andreas');
  assert.equal(row.email, null);
  assert.equal(row.name, 'Ανδρέας');
  await A.setName('Андрей');
  await A.signOut();
  assert.equal((await A.signIn('telegram')).result, 'same');
  assert.equal(A.state.fbUid, 'anon-1', 'анонимный пользователь остался после выхода');
  assert.equal(A.state.name, 'Андрей');
  assert.deepEqual(Object.keys(F.docs), ['users/anon-1']);
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
  assert.equal(F.docs['users/g-1'].name, 'Andrey G');
  assert.equal(A.linked(), true);

  const old = loadWithFirebase({ 'greekgame.account.v1': JSON.stringify({ id: 'b-old', provider: 'google', uid: 'g-1', name: 'Andrey G', email: 'andrey@example.com' }) });
  await old.F.auth.signInWithPopup();   // сессия Firebase в браузере жива
  old.A.load();
  assert.equal(old.A.state.fbUid, 'g-1');
  assert.equal((await old.A.sync()).result, 'push');
  assert.equal(old.F.docs['users/g-1'].browserId, 'b-old');
  assert.equal(old.F.docs['users/g-1'].createdAt, old.F.TS);
});

test('🚨 красные лампочки: затереть непустую другую версию без подтверждения нельзя; аккаунт поменяли не отсюда — главный не пишет', async () => {
  const { A, F } = loadWithFirebase();
  A.load();
  await A.signIn('google');
  await A.setName('Андрей');
  const errors = [];
  const alarm = A.alarm;
  A.alarm = (...a) => { errors.push(a[0]); return alarm.call(A, ...a); };
  // в обход интерфейса: заменить версию браузера / аккаунта без подтверждения
  assert.throws(() => A.takeRemote({ name: 'Чужое' }), e => e === 'unconfirmedOverwrite');
  assert.equal(A.state.name, 'Андрей', 'браузер не тронут');
  await assert.rejects(A.claim({ name: 'Чужое' }, false), e => e === 'unconfirmedOverwrite');
  assert.equal(F.docs['users/g-1'].name, 'Андрей', 'аккаунт не тронут');
  assert.equal(errors.length, 2, 'и оба раза — громко');
  // пустую или ту же — можно молча
  A.takeRemote({ name: 'Андрей' });
  await A.claim({ name: 'Андрей' }, false);

  // в аккаунте имя поменяли не отсюда (браузер тот же — например, вручную в консоли): главный не затирает, а устаревает
  let stale = 0;
  A.onStale = () => stale++;
  F.docs['users/g-1'].name = 'Из консоли';
  assert.equal((await A.setName('Моё')).result, 'stale');
  assert.equal(F.docs['users/g-1'].name, 'Из консоли');
  assert.equal(stale, 1);
  assert.equal(A.staleLoss().lost, true, 'и покажет, что здесь пропадёт');
  // при запуске — то же
  A.load(); A.onStale = () => stale++;
  assert.equal((await A.sync()).result, 'stale');
  assert.equal(F.docs['users/g-1'].name, 'Из консоли');
});
