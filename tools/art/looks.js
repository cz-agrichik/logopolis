'use strict';
// Облики зданий по эпохам и уровням — как на карте (Looks.looks в ui/common/looks.js), с названием облика.
//   node tools/art/looks.js <файл.png> [тип,тип,…]           без списка — все обычные здания
const path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..', '..');
const out = process.argv[2], types = process.argv[3] ? process.argv[3].split(',') : null;
if (!out) { console.log('node tools/art/looks.js <файл.png> [типы через запятую]'); process.exit(1); }
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
  await p.route(/fonts\./, r => r.abort());
  await p.goto('file://' + path.join(ROOT, 'index.html') + '?reset'); await p.waitForTimeout(300);
  await p.evaluate(types => {
    types = types || Object.keys(Looks.ART);
    const open = EPOCHS.filter(E => !E.locked).length;
    let h = '<div style="padding:8px;background:#e9dcbc;font:12px sans-serif">';
    for (const t of types) for (let e = BUILDINGS[t].epoch; e < open; e++) {
      h += `<div style="display:flex;align-items:center;gap:6px;margin:3px 0"><div style="width:150px">${t} · эпоха ${e}</div>`;
      for (let L = 1; L <= EPOCHS[e].maxLevel; L += 2) {
        const ic = Looks.icons(t, L, e);
        h += `<div style="width:84px;text-align:center"><div class="tile t-${BUILDINGS[t].terrain[0]} has-b stage-${Looks.stage(L)} n${ic.length} bt-${t}" style="width:64px;height:64px;font-size:30px;margin:auto">
          <span class="bw">${ic[1] ? `<span class="b b2">${Art.svg(ic[1])}</span>` : ''}<span class="b b1">${Art.svg(ic[0])}</span></span><span class="lvl">${L}</span></div>
          <div style="font-size:9px;line-height:1.1;height:20px;overflow:hidden">${Looks.name(t, L, e)}</div></div>`;
      }
      h += '</div>';
    }
    document.body.innerHTML = h + '</div>';
  }, types);
  await p.screenshot({ path: out, fullPage: true });
  console.log('→', out);
  await b.close();
})();
