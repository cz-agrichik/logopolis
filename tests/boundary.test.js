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

// index.html: все скрипты из ASSETS существуют, а каждый .js из слоёв подключён
test('index.html: список скриптов полон, версия — одна', () => {
  const { ASSETS } = require('./load-core');
  for (const f of ASSETS) assert.ok(fs.existsSync(path.join(ROOT, f)), `нет файла ${f}`);
  const walk = d => fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(d + '/' + e.name) : [d + '/' + e.name]);
  for (const d of ['core', 'content', 'ui', 'assets', 'platform']) for (const f of walk(d).filter(f => f.endsWith('.js')))
    assert.ok(ASSETS.includes(f), `${f} не подключён в index.html (ASSETS)`);
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.equal((html.match(/\?v=\d/g) || []).length, 0, 'номера версий — только в ASSET_V');
  assert.match(html, /var ASSET_V = \d+;/);
});
