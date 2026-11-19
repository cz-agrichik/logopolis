'use strict';
// Балансер в консоли: короткая сводка по эпохам. Полный отчёт — страница tools/balance/balancer.html (открыть с диска).
//
//   node tools/balance/balancer.js            эпохи 0–2
//   node tools/balance/balancer.js --peek     ещё и эллинский Кипр
//
// Расчёт — tools/balance/balancer-core.js (общий для страницы и консоли), поверх ядра игры.
const path = require('path');
const fs = require('fs');
const vm = require('vm');
const { loadCore } = require(path.join(__dirname, '..', '..', 'tests', 'load-core'));

const C = loadCore();
vm.runInContext(fs.readFileSync(path.join(__dirname, 'balancer-core.js'), 'utf8'), C.ctx, { filename: 'balancer-core.js' });
const S = C.get('BALANCE').ships;
const R = C.run(`Balancer.run({ last: ${process.argv.includes('--peek') ? 3 : 2} })`);
const f = x => x == null || !isFinite(x) ? '—' : Math.abs(x) >= 100 ? Math.round(x).toLocaleString('ru-RU') : x.toFixed(1);
for (const x of R.epochs) {
  console.log(`эпоха ${x.e}: выпуск ${f(x.prod0)} → ${f(x.prod1)} зерна/с · 1 λ ≈ ${f(x.perL)} зерна (по курсу обрядов ${f(x.riteL)}) · ` +
    `с умом ${f(x.scen.mind.logos)} λ + ${f(x.scen.mind.w)} зерна · ресурсами ${f(x.scen.labor.logos)} λ + ${f(x.scen.labor.w)} зерна` +
    (x.target ? `\n   цель «ресурсами» на эпоху ${f(x.target.labor)} зерна; описана ${f(x.target.part * 100)}% эпохи — по выпуску это ${f(x.target.share * 100)}% цели = ${f(x.target.want)}, сейчас ${f(x.target.have)} (${f(x.target.have / x.target.want * 100)}%)` +
      (x.target.techsWant ? `\n   из них знания «через силу»: на эпоху ${f(x.target.labor && x.target.techsWant / x.target.share)}; на описанную часть по выпуску ${f(x.target.techsWant)}, ровно по доле времени — ${f(x.target.techsThird)}; сейчас ${f(x.target.techsHave)}` : '') : '') +
    (x.ships ? `\n   корабли: монет за лист папируса по курсу эпохи — ${x.ships.map(p => `${p.id} ${p.coins.toFixed(1)}`).join(', ')} (цель ≈40; настоящая цена — ${S.price}, за монеты — ${S.buy.silver / S.give.papyrus})` : ''));
}
console.log('Полный отчёт: откройте tools/balance/balancer.html');
