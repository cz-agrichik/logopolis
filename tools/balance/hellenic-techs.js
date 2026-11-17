// Эллинский Кипр, «что если»: цены знаний при закупке за рубежом (buy — что платят за каждый λ прежней цены) и λ «с умом» по курсу обрядов.
//   node tools/balance/hellenic-techs.js '{"coinage":{"silver":12,"copper":6},"alphabet":{"silver":17,"papyrus":0.04}}'   ({} — как в игре)
// Игру не меняет: подменяет знания только в своём экземпляре ядра.
const path = require('path'), fs = require('fs'), vm = require('vm');
const root = path.join(__dirname, '..', '..');
const { loadCore } = require(path.join(root, 'tests', 'load-core'));
const BUY = JSON.parse(process.argv[2] || '{}');
const run = (buy, setL) => {
  const C = loadCore();
  C.run(`(function(){ const B = ${JSON.stringify(buy)}, L = ${JSON.stringify(setL || {})}; for (const T of TECHS) if (T.epoch === 3) { T.laborLogos = T.laborLogos || T.logos; if (B[T.id]) T.buy = B[T.id]; if (L[T.id]) T.logos = L[T.id]; } })()`);
  vm.runInContext(fs.readFileSync(path.join(root, 'tools/balance/balancer-core.js'), 'utf8'), C.ctx);
  return C.run(`(function(){ const R = Balancer.run({ last: 3 }), x = R.epochs[3];
    return { riteL: x.riteL, labor: x.scen.labor.w, mind: x.scen.mind, target: x.target, techs: x.techs.map(t => ({ id: t.id, logos: t.logos, mind: t.mind, labor: t.labor, mindW: t.mindW, laborW: t.laborW })), papyrus: x.rates.papyrus }; })()`);
};
const f = v => Math.round(v).toLocaleString('ru-RU');
const a = run(BUY);
const newL = Object.fromEntries(a.techs.map(t => [t.id, Math.round((t.laborW - t.mindW) / a.riteL)]));
const b = run(BUY, newL);
console.log(`1 λ ≈ ${f(a.riteL)} зерна, папирус ≈ ${f(a.papyrus)} зерна`);
for (const t of b.techs) console.log(`${t.id.padEnd(9)} λ ${t.logos}: с умом ${JSON.stringify(t.mind)} (${f(t.mindW)}) · через силу ${JSON.stringify(t.labor)} (${f(t.laborW)})`);
console.log(`знания λ: ${b.techs.reduce((s, t) => s + t.logos, 0)}; ресурсами первая треть: ${f(b.labor)} (цель ${f(b.target.want)}, ${Math.round(b.labor / b.target.want * 100)}%); с умом ${b.mind.logos} λ + ${f(b.mind.w)}`);
