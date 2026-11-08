'use strict';
// Границы слоёв: ядро не знает о странице, хранилище браузера, интерфейсах и текстах.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, CORE_FILES } = require('./load-core');

const stripComments = src => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');

for (const f of CORE_FILES) {
  test('ядро чистое: ' + f, () => {
    const code = stripComments(fs.readFileSync(path.join(ROOT, f), 'utf8'));
    for (const bad of ['document', 'window', 'localStorage', 'sessionStorage', 'location', 'navigator', 'speechSynthesis'])
      assert.ok(!new RegExp('\\b' + bad + '\\b').test(code), `${f}: обращение к «${bad}»`);
    for (const bad of ['UI', 'Study', 'School', 'Pedia', 'PediaBook', 'Lex', 'Msg', 'Cat', 'Looks', 'Art'])
      assert.ok(!new RegExp('\\b' + bad + '\\.').test(code), `${f}: ядро зовёт слой интерфейса/текстов «${bad}»`);
    const cyr = code.match(/[Ѐ-ӿ]+/);
    assert.ok(!cyr, `${f}: русский текст в коде ядра: «${cyr && cyr[0]}» — тексты живут в content/ru`);
  });
}
