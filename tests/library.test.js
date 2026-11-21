'use strict';
// Библиотека: разбор своего текста по словарю сайта (library/owntext.js) и данные на диске.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const Own = require('../library/owntext.js');
const LIB = path.join(__dirname, '..', 'library');
const readJs = file => { const s = fs.readFileSync(path.join(LIB, file), 'utf8'); return JSON.parse(s.slice(s.indexOf('{'), s.trimEnd().replace(/;$/, '').lastIndexOf('}') + 1)); };

const dict = () => ({
  forms: {
    'έριξε': ['ρίχνω', 'VERB', 'Tense=Past', 'бросил'], 'ρίχνει': ['ρίχνω', 'VERB', '', 'бросает'],
    'μια': ['ένας', 'DET', '', '(артикль)'], 'ματιά': ['ματιά', 'NOUN', '', 'взгляд'],
    'καμιά': ['καμιά', 'DET', '', 'какой-нибудь'], 'φορά': ['φορά', 'NOUN', '', 'раз'],
    'σε': ['σε', 'ADP', '', 'в'], 'ήταν': ['είμαι', 'AUX', '', 'был'], 'οδοσ': ['η οδός', 'NOUN', '', 'улица'],
  },
  lemmas: { 'ρίχνω': { head: 'ρίχνω', ru: 'бросать' }, 'ματιά': { head: 'η ματιά', ru: 'взгляд' } },
  phrases: [[['ρίχνω', 'ένας', 'ματιά'], 'ρίχνω μια ματιά', 'взглянуть'], [['καμιά', 'φορά'], 'καμιά φορά', 'иногда']],
});
const form = (d, w) => Array.from(d.text).slice(w.start, w.end).join('');

test('свой текст: слова, предложения, элизия, ударения, имена', () => {
  const d = Own.build('Ο Νίκος έριξε μια γρήγορη ματιά. Καμιά φορά;\nΣ\' αυτή την ΟΔΟΣ ηταν ήσυχα…', dict());
  assert.deepStrictEqual(d.sentences.map(([a, b]) => Array.from(d.text).slice(a, b).join('')),
    ['Ο Νίκος έριξε μια γρήγορη ματιά.', 'Καμιά φορά;', 'Σ\' αυτή την ΟΔΟΣ ηταν ήσυχα…']);
  const by = Object.fromEntries(d.words.map(w => [form(d, w), w]));
  assert.ok(by['Νίκος'].unknown && by['γρήγορη'].unknown);
  assert.strictEqual(by['έριξε'].key, 'ρίχνω'); assert.strictEqual(by['έριξε'].seen, 'бросил');
  assert.strictEqual(by['Σ\''].key, 'σε', 'элизия σ\' → σε');
  assert.strictEqual(by['ΟΔΟΣ'].key, 'η οδός', 'заглавные и конечная сигма');
  assert.ok(by['ηταν'].guess && by['ηταν'].key === 'είμαι', 'без ударения — по форме без ударений');
  assert.deepStrictEqual(d.meta, { source: 'own', complete: true, known: 8, guessed: 1, total: 14 });
  assert.ok(d.words.every(w => w.s >= 0 && w.start >= d.sentences[w.s][0] && w.end <= d.sentences[w.s][1]));
});

test('свой текст: обороты по леммам, с промежутком, только внутри предложения', () => {
  const d = Own.build('Ρίχνει μια γρήγορη ματιά. Έριξε μια. Ματιά! Καμιά φορά.', dict());
  assert.deepStrictEqual(d.phrases.map(p => [p[0].map(i => form(d, d.words[i])), p[1]]),
    [[['Ρίχνει', 'μια', 'ματιά'], 'ρίχνω μια ματιά'], [['Καμιά', 'φορά'], 'καμιά φορά']]);
  const far = Own.build('Έριξε μια πολύ πολύ πολύ μεγάλη ματιά.', dict());
  assert.strictEqual(far.phrases.length, 0, 'больше двух чужих слов внутри — не оборот');
});

test('библиотека: каталог и словарь сайта на месте; в словаре нет предложений книг', () => {
  const cat = readJs('catalog.js'), dict = readJs('dict.js');
  assert.ok(cat.books.length >= 1 && cat.books.every(b => b.license), 'у книги сайта есть license');
  for (const b of cat.books) assert.ok(fs.existsSync(path.join(LIB, 'books', b.id + '.js')), b.id);
  assert.deepStrictEqual(cat.dict, { forms: Object.keys(dict.forms).length, lemmas: Object.keys(dict.lemmas).length, phrases: dict.phrases.length });
  for (const [f, a] of Object.entries(dict.forms)) {
    assert.strictEqual(f, Own.fold(f), 'ключ формы — как fold()');
    assert.ok(!/PROPN/.test(a[1]), 'имя собственное в словаре: ' + f);
  }
  assert.ok(dict.phrases.every(p => p[0].length >= 2 && p[0].length <= 5));
  // уровни: «B1», «A2–B1» (соседние), «?» или нет поля
  const LEVEL = /^(\?|(A1|A2|B1|B2|C1|C2)|A1–A2|A2–B1|B1–B2|B2–C1|C1–C2)$/;
  for (const [k, e] of Object.entries(dict.lemmas)) if (e.level != null) assert.match(e.level, LEVEL, 'уровень леммы ' + k);
  for (const p of dict.phrases) if (p[3] != null && p[3] !== '') assert.match(p[3], LEVEL, 'уровень оборота ' + p[1]);
  assert.ok(!('sentences' in dict) && !('text' in dict));
});

test('мои тексты: хранилище в браузере — сохранить, править, удалить, вернуть, перенос старого, копия и загрузка', () => {
  const mem = {};
  const storage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
  mem['greek-reader:own-text'] = 'Παλιό κείμενο.';
  const S = Own.Store(storage);
  assert.strictEqual(S.migrate().title, 'Παλιό κείμενο.');
  assert.ok(!('greek-reader:own-text' in mem) && S.migrate() === null, 'старый ключ перенесён один раз');
  const a = S.put({ title: '', text: 'Πρώτη γραμμή\nκαι άλλη', stats: { known: 3, total: 4, phrases: 0 } });
  assert.strictEqual(a.title, 'Πρώτη γραμμή', 'название по умолчанию — первая строка');
  const b = S.put({ id: a.id, title: 'Моё', text: 'Νέο κείμενο' });
  assert.strictEqual(b.id, a.id); assert.strictEqual(b.created, a.created); assert.strictEqual(S.get(a.id).title, 'Моё');
  assert.strictEqual(S.list().length, 2);
  const removed = S.remove(a.id); assert.strictEqual(S.list().length, 1);
  S.restore(removed); assert.strictEqual(S.get(a.id).text, 'Νέο κείμενο');
  // копия → в чистый браузер; повторная загрузка ничего не дублирует; свежая правка из копии обновляет
  const backup = S.exportJson();
  const mem2 = {};
  const S2 = Own.Store({ getItem: k => (k in mem2 ? mem2[k] : null), setItem: (k, v) => { mem2[k] = String(v); }, removeItem: k => { delete mem2[k]; } });
  assert.deepStrictEqual(S2.importFile('copy.json', backup), { added: 2, updated: 0, skipped: 0 });
  assert.deepStrictEqual(S2.importFile('copy.json', backup), { added: 0, updated: 0, skipped: 2 });
  const newer = JSON.parse(backup); newer.texts[0].text = 'Αλλαγμένο'; newer.texts[0].updated = '2999-01-01T00:00:00.000Z';
  assert.deepStrictEqual(S2.importFile('copy.json', JSON.stringify(newer)), { added: 0, updated: 1, skipped: 1 });
  assert.deepStrictEqual(S2.importFile('Σημειώσεις.txt', 'Ένα κείμενο.'), { added: 1, updated: 0, skipped: 0 });
  assert.ok(S2.list().some(t => t.title === 'Σημειώσεις'));
  assert.throws(() => S2.importFile('x.json', '{"texts": []}'), /не копия/);
  assert.throws(() => S2.importFile('ru.txt', 'по-русски'), /нет греческого/);
  // хранилище испорчено — начинаем с пустого, а не падаем
  mem2['greek-reader:own-texts:v1'] = '{oops';
  assert.deepStrictEqual(S2.list(), []);
});
