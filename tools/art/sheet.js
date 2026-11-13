'use strict';
// Лист рисунков: каждый ключ Art крупно, с подписью — чтобы рисовать и сравнивать (assets/art.js).
//   node tools/art/sheet.js <файл.png> [ключ,ключ,…]        без списка — все здания (house0, house1, …)
const path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..', '..');
const out = process.argv[2], list = process.argv[3] ? process.argv[3].split(',') : null;
if (!out) { console.log('node tools/art/sheet.js <файл.png> [ключи через запятую]'); process.exit(1); }
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1300, height: 400 }, deviceScaleFactor: 1 });
  await p.route(/fonts\./, r => r.abort());
  await p.goto('file://' + path.join(ROOT, 'index.html') + '?reset'); await p.waitForTimeout(300);
  await p.evaluate(list => {
    const keys = list || Object.values(Looks.ART).filter((v, i, a) => a.indexOf(v) === i).flatMap(pre => [0, 1, 2, 3, 4, 5].map(i => pre + i)).filter(k => Art.has(k));
    document.body.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:8px;padding:8px;background:#e9dcbc">${keys.map(k => `<div style="width:124px;text-align:center;font:11px sans-serif">
      <div style="width:120px;height:120px;margin:auto;background:${/field|vineyard|olive/.test(k) ? '#c9b98a' : '#d8c9a0'};border-radius:6px">${Art.has(k) ? Art.svg(k).replace('class="ico', 'style="width:120px;height:120px" class="ico') : '—'}</div>${k}</div>`).join('')}</div>`;
  }, list);
  await p.screenshot({ path: out, fullPage: true });
  console.log('→', out);
  await b.close();
})();
