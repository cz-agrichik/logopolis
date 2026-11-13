'use strict';
// Проверка Кипропедии против ядра — в каждой открытой эпохе:
//   1) каждая статья открывается без ошибок и не подменяется «Как играть» (так справка прячет упавшую статью);
//   2) таблицы уровней зданий: места / склад, рост, цена (ресурсы и λ) — как в ядре;
//   3) обряды: λ для текущей эпохи; 4) знания: цена «с умом»; 5) «Хозяйство в цифрах»: вместимость.
// Числа в справке не сокращаются (13456, не 13.5k) — ищем их как есть.
//
//   node tools/pedia/audit.js        (нужен playwright: npm i)
const path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..', '..');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.route(/fonts\./, r => r.abort());
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });   // шрифты в проверке не грузим
  await page.goto('file://' + path.join(ROOT, 'index.html') + '?reset'); await page.waitForTimeout(400);
  const epochs = await page.evaluate(() => EPOCHS.filter(E => !E.locked).length);
  let total = 0;
  for (let ep = 0; ep < epochs; ep++) {
    const bad = await page.evaluate(ep => {
      for (let i = 0; i < 3; i++) try { UI.closeModal(); } catch (e) {}
      const s = Game.state; s.epoch = ep; s.techs = TECHS.filter(t => t.epoch < ep).map(t => t.id); Game.tick(0.001);
      const bad = [];
      const body = id => { Pedia.open(id); return document.querySelector('#pediaBody'); };
      // 1. все статьи
      const ids = [];
      for (const part of ['a:basics', 'a:study']) for (const g of PediaBook.navData(part).groups) for (const it of g.items) ids.push(it.id);
      const basics = body('a:basics').textContent;
      for (const id of ids) if (id !== 'a:basics' && body(id).textContent === basics) bad.push(`статья ${id} не открылась (показана «Как играть»)`);
      // 2. уровни зданий
      for (const type of Object.keys(BUILDINGS).filter(t => !BUILDINGS[t].special)) {
        const B = BUILDINGS[type], rows = [...body('b:' + type).querySelectorAll('table.levels tr')].slice(1);
        if (rows.length !== Game.topLevel()) bad.push(`${type}: строк уровней ${rows.length}, а уровней ${Game.topLevel()}`);
        rows.forEach(tr => {
          const td = [...tr.children].map(x => x.textContent.trim()), L = +td[0];
          if (L < 2) return;
          const exp = B.storage ? Math.round(B.storage * Game.storeMult(L)) : B.cap ? Math.round(B.cap * Game.levelMult(L)) : null;
          if (exp != null && !td[1].includes(String(exp))) bad.push(`${type} ур. ${L}: показано «${td[1]}», в ядре ${exp}`);
          const g = B.storage ? Game.storeMult(L) / Game.storeMult(L - 1) : B.logosBonus ? null : Game.levelStep(L);
          if (g != null && td[2] !== '×' + num(g)) bad.push(`${type} ур. ${L}: рост «${td[2]}», в ядре ×${num(g)}`);
          const { cost, logos } = Game.upgradeCost(type, L), cell = td[td.length - 1];
          if (logos && !cell.includes(String(logos))) bad.push(`${type} ур. ${L}: цена «${cell}», в ядре λ ${logos}`);
          for (const v of Object.values(cost)) if (!cell.includes(String(v))) bad.push(`${type} ур. ${L}: цена «${cell}», нет ${v}`);
        });
      }
      // 3. обряды
      const rel = body('a:religion');
      Cat.rites.filter(R => R.epoch <= ep).forEach(R => {
        const row = [...rel.querySelectorAll('table tr')].find(tr => tr.textContent.includes(R.name));
        if (!row) bad.push('нет обряда ' + R.id);
        else if (R.logos && !row.textContent.includes('λ ' + Game.ritualLogos(R))) bad.push(`обряд ${R.id}: «${row.textContent.slice(-60)}», в ядре λ ${Game.ritualLogos(R)}`);
      });
      // 4. знания
      Cat.techs.forEach(T => {
        const p = Game.techPrice(T), cell = body('t:' + T.id).querySelector('table tr td:nth-child(2)').textContent;
        if (!cell.includes(String(T.logos))) bad.push(`знание ${T.id}: «${cell}», в ядре λ ${T.logos}`);
        for (const v of Object.values(p.cost)) if (!cell.includes(String(v))) bad.push(`знание ${T.id}: «${cell}», нет ${v}`);
      });
      // 5. склады
      if (!body('a:income').textContent.includes(String(Game.storageCap()))) bad.push('«Хозяйство в цифрах»: нет вместимости ' + Game.storageCap());
      Pedia.close();
      return bad;
    }, ep);
    total += bad.length;
    console.log(`эпоха ${ep}: ${bad.length ? bad.length + ' расхождений' : 'всё сходится'}`);
    for (const b of bad.slice(0, 30)) console.log('  ' + b);
  }
  if (errs.length) console.log('ошибки на странице:\n  ' + errs.join('\n  '));
  await browser.close();
  process.exit(total || errs.length ? 1 : 0);
})();
