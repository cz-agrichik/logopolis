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
  assert.ok(!('sentences' in dict) && !('text' in dict));
});
