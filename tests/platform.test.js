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
  const { A, store, ctx } = loadAccount();
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
