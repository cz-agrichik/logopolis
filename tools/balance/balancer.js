'use strict';
// Балансер в консоли: короткая сводка по эпохам. Полный отчёт — страница tools/balance/balancer.html (открыть с диска).
//
//   node tools/balance/balancer.js            эпохи 0–2
//   node tools/balance/balancer.js --peek     ещё и первая треть эллинского Кипра
//
// Расчёт — tools/balance/balancer-core.js (общий для страницы и консоли), поверх ядра игры.
const path = require('path');
const fs = require('fs');
const vm = require('vm');
const { loadCore } = require(path.join(__dirname, '..', '..', 'tests', 'load-core'));

const C = loadCore();
vm.runInContext(fs.readFileSync(path.join(__dirname, 'balancer-core.js'), 'utf8'), C.ctx, { filename: 'balancer-core.js' });
const R = C.run(`Balancer.run({ last: ${process.argv.includes('--peek') ? 3 : 2} })`);
const f = x => x == null || !isFinite(x) ? '—' : Math.abs(x) >= 100 ? Math.round(x).toLocaleString('ru-RU') : x.toFixed(1);
for (const x of R.epochs) {
  console.log(`эпоха ${x.e}: выпуск ${f(x.prod)} зерна/с · ${Math.round(x.lpr)} λ/раунд · 1 λ ≈ ${f(x.perL)} зерна · ` +
    `с умом ${f(x.scen.mind.logos)} λ + ${f(x.scen.mind.w / x.prod / 3600)} ч · ресурсами ${f(x.scen.labor.logos)} λ + ${f(x.scen.labor.w / x.prod / 3600)} ч`);
}
console.log('Полный отчёт: откройте tools/balance/balancer.html');
