'use strict';
// Сверка цен эпох по ценнику труда (BALANCE.worth, README «Ценник ресурсов»): знания, путь «через силу», чудеса, переход.
// Принцип (README «Принципы»): утяжеляются только чудеса, знания и переходы; каждая эпоха длиннее прошлой — ориентир до ×3
// по номинальным ресурсам; путь «через силу» с каждой эпохой жёстче. Здания идут по общим правилам и сюда не входят.
//
//   node tools/balance/prices.js
const path = require('path');
const { loadCore } = require(path.join(__dirname, '..', '..', 'tests', 'load-core'));
const C = loadCore(); C.run('Game.genMap(); Game.state = Game.newState(); Learn.state = Learn.newState(); Game.tick(0);');
const G = C.get('Game'), B = C.get('BUILDINGS'), T = C.get('TECHS'), E = C.get('EPOCHS'), BAL = C.get('BALANCE');
const W = BAL.worth, val = c => Object.entries(c || {}).reduce((a, [k, v]) => a + v * (W[k] || 1), 0);
const k = x => (Math.round(x / 100) / 10) + 'k';
const rows = [];
for (let ep = 0; ep < E.length; ep++) {
  const techs = T.filter(t => t.epoch === ep);
  if (!techs.length) continue;
  G.state.epoch = ep; G.state.techs = T.filter(t => t.epoch < ep).map(t => t.id);
  const tv = techs.reduce((a, t) => a + val(t.cost), 0), tl = techs.reduce((a, t) => a + t.logos, 0);
  const lv = techs.reduce((a, t) => a + val(G.techPrice(t, 'labor').cost), 0);
  const sp = Object.entries(B).filter(([, b]) => b.special && b.epoch === ep);
  const wv = sp.reduce((a, [, b]) => a + val(b.cost), 0);
  const adv = E[ep].advance;
  rows.push({ ep, n: techs.length, tl, tv, lv, perL: (lv - tv) / tl, wv, wl: sp.reduce((a, [, b]) => a + b.logos, 0), av: adv ? val(adv.res) : 0, al: adv ? adv.logos : 0 });
  console.log(`\nЭпоха ${ep}: знаний ${techs.length}, λ ${tl}; ресурсы «с умом» ${k(tv)} (${k(tv / techs.length)} на знание)`);
  console.log(`  «через силу» ${k(lv)} — ${Math.round((lv - tv) / tl)} ед. ценника за 1 λ`);
  for (const [id, b] of sp) console.log(`  чудо ${id.padEnd(14)} λ ${String(b.logos).padStart(3)}  ${k(val(b.cost)).padStart(6)}  ${JSON.stringify(b.cost)}`);
  console.log(`  чудеса всего ${k(wv)}, λ ${rows.at(-1).wl}` + (adv ? `; переход ${k(val(adv.res))} + λ ${adv.logos}` : ''));
}
console.log('\nК прошлой эпохе:');
for (let i = 1; i < rows.length; i++) {
  const a = rows[i - 1], b = rows[i], x = (p, q) => q ? '×' + (p / q).toFixed(1) : '—';
  console.log(`  ${a.ep} → ${b.ep}: знания ${x(b.tv, a.tv)} (на знание ${x(b.tv / b.n, a.tv / a.n)}), «через силу» за 1 λ ${x(b.perL, a.perL)}, чудеса ${x(b.wv, a.wv)}, переход ${x(b.av, a.av)}`);
}
