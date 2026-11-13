'use strict';
// Загружает ядро (обычные скрипты с глобальными именами) в отдельный контекст Node — без браузера.
// Порядок — как в index.html. Встроенные колоды берутся из content/ru/words.js (это данные, не интерфейс).
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const CORE_FILES = [
  'core/util.js', 'core/defs.js',
  'core/learning/greek.js', 'core/learning/decks.js', 'core/learning/srs.js', 'core/learning/lesson.js',
  'core/learning/journal.js', 'core/learning/learn.js',
  'core/city/state.js', 'core/city/economy.js', 'core/city/build.js', 'core/city/research.js',
  'core/city/rituals.js', 'core/city/epochs.js', 'core/city/world.js', 'core/city/changes.js', 'core/session.js',
];
const CONTENT_FILES = ['content/ru/words.js'];

/** Новый независимый экземпляр ядра. seed — для повторяемой случайности. */
function loadCore({ seed = 42, now = Date.parse('2026-11-08T10:00:00Z') } = {}) {
  let a = seed;
  const random = () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  const clock = { now };
  const FakeDate = class extends Date { constructor(...args) { super(...(args.length ? args : [clock.now])); } static now() { return clock.now; } };
  const MathX = Object.create(Math); MathX.random = random;
  const ctx = vm.createContext({ console, Math: MathX, Date: FakeDate });
  for (const f of [...CONTENT_FILES, ...CORE_FILES]) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  const get = name => vm.runInContext(name, ctx);
  return { ctx, get, clock, run: code => vm.runInContext(code, ctx) };
}

/** Хранилище в памяти — вместо localStorage. */
function memoryIO(init = {}) {
  const data = Object.assign({}, init);
  return { data, load: k => (k in data ? data[k] : null), save: (k, v) => { data[k] = v; }, remove: k => { delete data[k]; }, restart() { this.restarted = true; } };
}

module.exports = { loadCore, memoryIO, ROOT, CORE_FILES };
