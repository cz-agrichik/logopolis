'use strict';
// Все статьи Кипропедии текстом — чтобы прочитать подряд или сравнить до и после правки (diff).
//   node tools/pedia/dump.js <эпоха 0|1|2> <файл> [all]   — all: знания этой эпохи тоже изучены
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..', '..');
const epoch = +process.argv[2], out = process.argv[3], allTechs = process.argv[4] === 'all';
if (!out) { console.log('node tools/pedia/dump.js <эпоха> <файл> [all]'); process.exit(1); }
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  await p.route(/fonts\./, r => r.abort());
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await p.goto('file://' + path.join(ROOT, 'index.html') + '?reset'); await p.waitForTimeout(400);
  const texts = await p.evaluate(({ epoch, allTechs }) => {
    for (let i = 0; i < 3; i++) try { UI.closeModal(); } catch (e) {}
    const s = Game.state; s.epoch = epoch;
    s.techs = TECHS.filter(t => t.epoch < epoch || (allTechs && t.epoch === epoch)).map(t => t.id);
    Game.tick(0.01);
    const ids = [];
    for (const part of ['a:basics', 'a:study']) for (const g of PediaBook.navData(part).groups) for (const it of g.items) ids.push(it.id);
    const out = {};
    for (const id of ids) { Pedia.open(id); out[id] = document.querySelector('#pediaBody').innerText; Pedia.close(); }
    return out;
  }, { epoch, allTechs });
  fs.writeFileSync(out, Object.entries(texts).map(([k, v]) => `##### ${k}\n${v}\n`).join('\n'));
  console.log(Object.keys(texts).length, 'статей →', out, errs.length ? '\nошибки: ' + errs.join('; ') : '');
  await b.close();
})();
