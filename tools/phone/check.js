'use strict';
// Телефон: снимки всех экранов и проверка касаний — в альбомной ориентации, как на настоящем телефоне.
//   1) снимки: заслонка «на весь экран», карта, четыре вкладки, окно здания, Кипропедия, «Обучение», раунд, окна эпохи и плана;
//   2) касания: подсказка по долгому нажатию (и что она не нажимает), оглавление ☰, режим ⏫ (+1 уровень за касание),
//      «Строить» касанием карточки и 🔁 «ещё», крестики окна и панели; страница не шире экрана.
// Код выхода 1, если что-то не так.
//
//   node tools/phone/check.js <папка> [устройство Playwright | ширинаxвысота] [эпоха 0|1|2]
//   например: node tools/phone/check.js phone-out "iPhone SE landscape" 1     (нужен playwright: npm i)
const path = require('path');
const fs = require('fs');
const { chromium, devices } = require('playwright');
const ROOT = path.join(__dirname, '..', '..');
const OUT = path.resolve(process.argv[2] || 'phone-out');
const DEV = process.argv[3] || 'Pixel 7 landscape', EP = +(process.argv[4] || 1);

/** Город для снимков: эпоха ep, здания разных уровней на подходящих клетках, знания, благословение, срок набега. */
function setupCity(ep) {
  const s = Game.state;
  s.epoch = ep;
  s.techs = TECHS.filter(t => t.epoch < ep).map(t => t.id);
  s.techs.push(...(ep ? TECHS.filter(t => t.epoch === ep).slice(0, 3).map(t => t.id) : ['carving', 'cheesemaking']));
  s.pop = [20, 60, 120][ep]; s.logos = [80, 420, 900][ep];
  for (const k of Object.keys(s.res)) s.res[k] = 1200;
  const want = ep === 0 ? { house: 4, field: 3, goatpen: 2, lumber: 2, quarry: 2, workshop: 1, storehouse: 1 }
    : { house: 7, field: 5, goatpen: 2, lumber: 3, quarry: 3, workshop: 2, storehouse: 3, mine: 2, smelter: 1, port: 1, scribe: 1, forge: 1, vineyard: 1, olivegrove: 1 };
  let id = 900, lv = 0;
  for (const [type, n] of Object.entries(want)) {
    if (!BUILDINGS[type]) continue;
    for (let i = 0; i < n; i++) {
      const t = Game.map.find(t => !Game.buildingAt(t.x, t.y) && Game.canPlaceOn(type, t));
      if (!t) break;
      s.buildings.push({ id: id++, type, level: 1 + (lv++ * 3) % EPOCHS[ep].maxLevel, x: t.x, y: t.y });
    }
  }
  s.buffs = { harvest: 200 };
  if (ep >= 1) s.timers.raid = 400;
  Game.goat = null; Game.tick(0); UI.renderMap(); UI.renderAll();
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const m = DEV.match(/^(\d+)x(\d+)$/);
  const dev = m ? { ...devices['Pixel 7 landscape'], viewport: { width: +m[1], height: +m[2] }, screen: { width: +m[1], height: +m[2] } } : devices[DEV];
  if (!dev) { console.log('нет такого устройства в Playwright:', DEV); process.exit(1); }
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...dev, deviceScaleFactor: 1 });
  await ctx.route(/fonts\./, r => r.abort());
  const page = await ctx.newPage();
  const errs = [], fails = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', msg => { if (msg.type() === 'error' && !/Failed to load resource/.test(msg.text())) errs.push(msg.text()); });
  const ok = (cond, what) => { console.log((cond ? '  ✓ ' : '  ✗ ') + what); if (!cond) fails.push(what); };
  const ev = f => page.evaluate(f);
  const shot = async n => { await page.waitForTimeout(250); await page.screenshot({ path: path.join(OUT, n + '.png') }); };
  const center = async sel => { const b = await (await page.$(sel)).boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
  const cdp = await ctx.newCDPSession(page);
  const longPress = async (x, y) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await page.waitForTimeout(650);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(100);
  };

  await page.addInitScript(() => { try { sessionStorage.setItem('greekgame.mobileWarned', '1'); } catch (e) {} });
  await page.goto('file://' + path.join(ROOT, 'index.html') + '?reset'); await page.waitForTimeout(500);
  await page.addStyleTag({ content: '*{animation:none!important;transition:none!important;caret-color:transparent!important}' });
  console.log(DEV, await ev(() => innerWidth + '×' + innerHeight));
  // заслонка «на весь экран» — одно касание
  const gate = await ev(() => document.body.classList.contains('fs-need'));
  ok(gate === await ev(() => BrowserIO.canFullscreen()), 'заслонка «на весь экран» — там, где браузер это умеет');
  if (gate) { await shot('00_gate'); await page.tap('[data-fs-go]'); await page.waitForTimeout(400); }
  ok(!(await ev(() => document.body.classList.contains('fs-need'))), 'после касания заслонки её нет');
  await ev(() => { Game.paused = true; Math.random = () => 0.5; delete Game.state.planPending; UI.closeModal(); });
  await ev(`(${setupCity})(${EP})`);

  // 1. снимки
  await shot('01_map');
  for (const t of ['build', 'tech', 'rites', 'epoch']) { await page.tap(`#rail button[data-tab=${t}]`); await shot('02_' + t); }
  await page.tap('[data-close-drawer]'); await page.waitForTimeout(250);
  ok(!(await ev(() => document.body.classList.contains('drawer-open'))), 'крестик убирает выдвижную панель');
  await ev(() => UI.showBuilding(Game.state.buildings.find(b => b.type === 'field') || Game.state.buildings[0])); await shot('03_building');
  await page.tap('#modal .m-x'); await page.waitForTimeout(200);
  ok(await ev(() => $('#modal').classList.contains('hidden')), 'крестик закрывает окно здания');
  await ev(() => Pedia.open('b:house')); await shot('04_pedia');
  await page.tap('[data-nav-toggle]'); await shot('04_pedia_nav');
  await page.tap('#pediaNav .pn-item:nth-of-type(3)'); await page.waitForTimeout(250);
  ok(!(await ev(() => $('#pedia .pedia-box').classList.contains('nav-open'))), 'оглавление ☰ прячется, когда выбрали статью');
  await ev(() => Pedia.close());
  for (const sec of ['ov', 'decks', 'words']) { await ev(s => School.open(s), sec); await shot('05_school_' + sec); }
  await ev(() => School.close());
  await ev(() => Study.start()); await shot('06_study');
  await ev(() => Study.close()); await ev(() => UI.showEpoch(false)); await shot('07_epoch');
  await ev(() => UI.closeModal()); await ev(() => UI.showLearnPlan()); await shot('08_plan');
  await ev(() => UI.closeModal());
  const wide = await ev(() => [document.documentElement.scrollWidth, innerWidth]);
  ok(wide[0] <= wide[1], `страница не шире экрана (${wide[0]} ≤ ${wide[1]})`);

  // 2. касания
  let [x, y] = await center('#resources .rs:nth-child(2)');
  await longPress(x, y); await shot('09_tip');
  ok(await ev(() => !$('#touchTip').classList.contains('hidden') && $('#touchTip').textContent.length > 5), 'долгое нажатие на ресурс — подсказка');
  ok(await ev(() => $('#pedia').classList.contains('hidden')), '…и справка от него не открылась');
  const house = await ev(() => { const b = Game.state.buildings.find(b => b.type === 'house'); return [b.x, b.y]; });
  [x, y] = await center(`#map .tile[data-x="${house[0]}"][data-y="${house[1]}"]`);
  await longPress(x, y);
  ok(await ev(() => $('#modal').classList.contains('hidden')), 'долгое нажатие на здание не открывает его окно');
  // режим ⏫
  await page.tap('#rail [data-up-mode]'); await shot('10_upmode');
  const sum = () => ev(() => Game.state.buildings.reduce((a, b) => a + b.level, 0));
  const can = await ev(() => [...document.querySelectorAll('#map .tile.up-ok')].map(e => [+e.dataset.x, +e.dataset.y]));
  ok(can.length > 0, `⏫ отмечает, что можно улучшить (${can.length})`);
  const s0 = await sum();
  for (const [tx, ty] of can.slice(0, 3)) { [x, y] = await center(`#map .tile[data-x="${tx}"][data-y="${ty}"]`); await page.touchscreen.tap(x, y); await page.waitForTimeout(120); }
  ok(await sum() === s0 + Math.min(3, can.length), '⏫: каждое касание — +1 уровень');
  ok(await ev(() => $('#modal').classList.contains('hidden')), '⏫: окно здания не открывается');
  await page.tap('[data-up-done]');
  ok(await ev(() => !UI.upMode), '«Готово» выключает ⏫');
  // «Строить»: касание карточки, 🔁 ещё
  await page.tap('#rail button[data-tab=build]'); await page.waitForTimeout(300);
  await page.tap('#panel .item:not(.sp):not(.disabled) .item-ic'); await page.waitForTimeout(300);
  const placing = await ev(() => UI.placing);
  ok(!!placing && !(await ev(() => document.body.classList.contains('drawer-open'))), 'касание карточки — выбор клетки, панель уехала');
  await page.tap('[data-place-repeat]'); await shot('11_place');
  const n0 = await ev(() => Game.state.buildings.length);
  for (let i = 0; i < 2; i++) {
    const t = await ev(() => { const t = Game.map.find(t => !Game.buildingAt(t.x, t.y) && Game.canPlaceOn(UI.placing, t)); return t && [t.x, t.y]; });
    if (!t) break;
    [x, y] = await center(`#map .tile[data-x="${t[0]}"][data-y="${t[1]}"]`); await page.touchscreen.tap(x, y); await page.waitForTimeout(150);
  }
  ok(await ev(() => Game.state.buildings.length) - n0 === 2, '🔁 ещё: два здания подряд');
  await page.tap('[data-cancel-place]');

  ok(!errs.length, 'ошибок на странице нет' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await browser.close();
  console.log(fails.length ? `НЕ ТАК: ${fails.length}` : 'всё в порядке', '· снимки —', OUT);
  process.exit(fails.length ? 1 : 0);
})();
