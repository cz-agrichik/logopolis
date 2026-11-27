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
/** Поддельный Firebase: вход (Google — всплывающее окно, анонимный), Firestore users/<uid>. online:false — запись не проходит. */
function fakeFirebase() {
  const docs = {}, writes = [];
  let current = null, seq = 0, online = true;
  const auth = {
    get currentUser() { return current; },
    onAuthStateChanged(cb) { setTimeout(() => cb(current)); return () => {}; },
    async signInWithPopup() { current = { uid: 'g-1', isAnonymous: false, displayName: 'Andrey G', email: 'andrey@example.com', photoURL: 'https://example.com/p.jpg' }; return { user: current }; },
    async signInAnonymously() { current = { uid: 'anon-' + (++seq), isAnonymous: true }; return { user: current }; },
    async signOut() { current = null; },
  };
  const TS = 'SERVER_TS';
  const down = () => Promise.reject({ code: 'unavailable' });
  const fb = {
    apps: [],
    initializeApp() { fb.apps.push({}); },
    auth: Object.assign(() => auth, { GoogleAuthProvider: function () {} }),
    firestore: Object.assign(() => ({ collection: c => ({ doc: id => ({
      get: () => online ? Promise.resolve({ exists: `${c}/${id}` in docs, data: () => ({ ...docs[`${c}/${id}`] }) }) : down(),
      set: (d, opt) => {
        if (!online) return down();
        writes.push({ path: `${c}/${id}`, data: { ...d } });
        docs[`${c}/${id}`] = opt && opt.merge ? { ...docs[`${c}/${id}`], ...d } : { ...d };
        return Promise.resolve();
      },
    }) }) }), { FieldValue: { serverTimestamp: () => TS } }),
  };
  return { fb, docs, writes, auth, TS, setOnline: v => { online = v; } };
}
function loadWithFirebase(store0) {
  const r = loadAccount({ config: { firebase: { apiKey: 'x', projectId: 'p' }, telegram: { clientId: 123 } } });
  if (store0) Object.assign(r.store, store0);
  const F = fakeFirebase();
  Object.assign(r.ctx, { window: r.ctx, firebase: F.fb, console: { warn() {} }, setTimeout });
  r.ctx.Telegram = { Login: { auth: (opts, cb) => cb({ id_token: 'x.y.z', user: { id: 42, name: 'Ανδρέας', preferred_username: 'andreas', picture: 'https://t.me/p.jpg' } }) } };
  r.A.loadScript = async () => {};
  return { ...r, F };
}
/** Поля, которые пропускают firestore.rules (hasOnly([...])) — запись не должна выходить за них. */
const RULE_KEYS = JSON.parse(fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8').match(/hasOnly\((\[[^\]]*\])\)/)[1].replace(/'/g, '"'));

test('список игроков: вход через Google — строка users/<uid>; имя меняется и переживает новый вход; без связи — запишем позже', async () => {
  const { A, F } = loadWithFirebase();
  A.load();
  assert.equal((await A.signIn('google')).ok, true);
  const row = F.docs['users/g-1'];
  assert.ok(row, 'строка у пользователя Firebase');
  assert.equal(row.provider, 'google');
  assert.equal(row.name, 'Andrey G');
  assert.equal(row.email, 'andrey@example.com');
  assert.equal(row.tgId, null);
  assert.equal(row.browserId, A.state.id);
  assert.equal(row.createdAt, F.TS);
  assert.equal(row.lastLoginAt, F.TS);
  for (const w of F.writes) for (const k of Object.keys(w.data)) assert.ok(RULE_KEYS.includes(k), `поле ${k} есть в firestore.rules`);

  assert.deepEqual(JSON.parse(JSON.stringify(await A.setName('   '))), { ok: false, error: 'emptyName' });
  const r = await A.setName('  Ανδρέας   Γ. ');
  assert.deepEqual(JSON.parse(JSON.stringify(r)), { ok: true, pending: false });
  assert.equal(F.docs['users/g-1'].name, 'Ανδρέας Γ.');
  assert.equal(F.docs['users/g-1'].providerName, 'Andrey G', 'имя у Google — отдельно');
  assert.equal('createdAt' in F.writes.at(-1).data, false, 'дату регистрации не переписываем');
  await A.setName('x'.repeat(60));
  assert.equal(F.docs['users/g-1'].name.length, 40);
  await A.setName('Ανδρέας Γ.');

  await A.signOut();
  assert.equal(A.signedIn(), false);
  await A.signIn('google');
  assert.equal(A.state.name, 'Ανδρέας Γ.', 'новый вход: имя из списка игроков, а не из Google');
  assert.equal(F.docs['users/g-1'].name, 'Ανδρέας Γ.');

  F.setOnline(false);
  const off = await A.setName('Новое имя');
  assert.equal(off.ok && off.pending, true, 'без связи — сохранили здесь');
  assert.equal(A.state.profilePending, true);
  assert.equal(F.docs['users/g-1'].name, 'Ανδρέας Γ.');
  F.setOnline(true);
  assert.equal(await A.retryProfile(), true);
  assert.equal(F.docs['users/g-1'].name, 'Новое имя', 'при следующем запуске дописали');
  assert.equal(A.state.profilePending, undefined);
  assert.equal(await A.retryProfile(), false, 'в долгу ничего нет — в сеть не ходим');
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
  await A.signIn('telegram');
  assert.equal(A.state.fbUid, 'anon-1', 'анонимный пользователь остался после выхода');
  assert.equal(A.state.name, 'Андрей');
  assert.deepEqual(Object.keys(F.docs), ['users/anon-1']);
});

test('список игроков: вошли до появления списка — запишем при запуске', async () => {
  const { A, F } = loadWithFirebase({ 'greekgame.account.v1': JSON.stringify({ id: 'b-old', provider: 'google', uid: 'g-1', name: 'Andrey G', email: 'andrey@example.com' }) });
  await F.auth.signInWithPopup();   // сессия Firebase в браузере жива
  A.load();
  assert.equal(A.state.fbUid, 'g-1');
  assert.equal(A.state.profilePending, true);
  assert.equal(await A.retryProfile(), true);
  assert.equal(F.docs['users/g-1'].browserId, 'b-old');
  assert.equal(F.docs['users/g-1'].createdAt, F.TS);
});
