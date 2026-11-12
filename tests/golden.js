'use strict';
// ============================================================
//  «Золотой эталон»: детерминированный прогон игры в браузере.
//  Снимает скриншоты всех экранов, тексты панелей и справки, состояние после
//  сценария — чтобы после рефакторинга сравнить «до» и «после» побайтно.
//
//  node tests/golden.js <папка-для-результата> [путь к index.html]
//  python3 tests/compare.py <эталон> <результат>
//
//  Случайность зафиксирована (seed), время — поддельные часы Playwright,
//  шрифты из сети отключены, CSS-анимации остановлены.
// ============================================================
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const OUT = path.resolve(process.argv[2] || 'golden-out');
const INDEX = path.resolve(process.argv[3] || path.join(__dirname, '..', 'index.html'));
const URL = 'file://' + INDEX;
const T0 = new Date('2026-11-08T10:00:00Z').getTime();

fs.mkdirSync(OUT, { recursive: true });
const texts = {};
const errors = [];

// Состояние обучения: в новых версиях — Learn.state, в старых — внутри Game.state
const LS = `(typeof Learn !== 'undefined' ? Learn.state : Game.state)`;
const CITY_FIELDS = ['v', 'epoch', 'res', 'logos', 'logosEarned', 'pop', 'popAcc', 'starveAcc', 'techs', 'techPath', 'buildings', 'nextId', 'buffs', 'cooldowns', 'stash', 'timers', 'finished'];

const SEED_SCRIPT = `(() => {
  let a = 42;
  Math.random = function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  try { Object.defineProperty(navigator, 'userAgent', { get: () => 'Mozilla/5.0 (X11; Linux x86_64) Chrome/130 Desktop' }); } catch (e) {}
})();`;

async function newPage(browser, viewport = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, acceptDownloads: true });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await ctx.addInitScript(SEED_SCRIPT);
  const page = await ctx.newPage();
  await page.clock.install({ time: T0 });
  await page.clock.pauseAt(T0 + 1000);   // время идёт только по команде теста
  page.on('pageerror', e => errors.push(e.message + '\n' + (e.stack || '')));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_|net::/.test(m.text())) errors.push('console: ' + m.text()); });
  return { ctx, page };
}

const CALM_CSS = '*, *::before, *::after { transition: none !important; backdrop-filter: none !important; caret-color: transparent !important; }';
async function shot(page, name, clip) {
  await page.mouse.move(2, 2);
  await page.addStyleTag({ content: CALM_CSS }).catch(() => {});
  await page.screenshot({ path: path.join(OUT, name + '.png'), animations: 'disabled', caret: 'hide', clip });
}
async function text(page, name, sel) {
  texts[name] = await page.$eval(sel, e => e.innerText).catch(() => '(нет элемента ' + sel + ')');
}
const panelTabs = ['build', 'tech', 'rites', 'epoch'];

/** Журнал как текст — до и после переноса текстов в словарь. */
const LOG_TEXT = `(() => (Game.state.log || []).map(l => l.msg != null ? l.msg : (typeof UI !== 'undefined' && UI.logText ? UI.logText(l) : JSON.stringify(l))))()`;

/** Богатое состояние: много зданий обеих эпох, знания, благословения. */
const RICH_STATE = `(() => {
  const s = Game.state;
  s.res = Object.fromEntries(RES_KEYS.map((k, i) => [k, 150 + i * 37]));
  s.logos = 777; s.logosEarned = 1234; s.pop = 14;
  s.techs = ['cheesemaking', 'carving', 'granary'];
  const plain = Game.map.filter(t => t.t === 'plain' && !t.coast && !Game.buildingAt(t.x, t.y));
  const coast = Game.map.filter(t => t.t === 'plain' && t.coast && !Game.buildingAt(t.x, t.y));
  const hills = Game.map.filter(t => t.t === 'hill' && !Game.buildingAt(t.x, t.y));
  const forest = Game.map.filter(t => t.t === 'forest' && !Game.buildingAt(t.x, t.y));
  let id = 100; const put = (type, L, t) => t && s.buildings.push({ id: id++, type, level: L, x: t.x, y: t.y });
  ['house', 'field', 'storehouse', 'workshop'].forEach((type, r) => [1, 3, 4, 6].forEach((L, i) => put(type, L, plain[r * 4 + i])));
  [1, 4].forEach((L, i) => put('quarry', L, hills[i])); [2, 5].forEach((L, i) => put('goatpen', L, forest[i])); [1, 4].forEach((L, i) => put('lumber', L, forest[3 + i]));
  put('sp_lemba', 1, plain[20]); put('shrine1', 1, plain[21]);
  s.buffs = { harvest: 200, hearth: 95 };
  s.cooldowns = { elders: 30 };
  s.stash = ['sp_troodos'];
  Game.tick(0); UI.renderMap(); UI.lastPanel = null; UI.renderAll();
})()`;

const BRONZE_STATE = `(() => {
  const s = Game.state;
  s.epoch = 1; s.techs = TECHS.filter(t => t.epoch === 0).map(t => t.id).concat(['smelting', 'seafaring']);
  s.res = Object.fromEntries(RES_KEYS.map((k, i) => [k, 900 + i * 41]));
  s.logos = 2500; s.pop = 40;
  const free = t => !Game.buildingAt(t.x, t.y);
  const plain = Game.map.filter(t => t.t === 'plain' && !t.coast && free(t));
  const coast = Game.map.filter(t => t.t === 'plain' && t.coast && free(t));
  const hills = Game.map.filter(t => t.t === 'hill' && free(t));
  let id = 300; const put = (type, L, t) => t && s.buildings.push({ id: id++, type, level: L, x: t.x, y: t.y });
  [1, 6, 8, 10].forEach((L, i) => put('house', L, plain[i]));
  [1, 6, 10].forEach((L, i) => put('mine', L, hills[i]));
  [1, 6, 10].forEach((L, i) => put('port', L, coast[i * 2]));
  put('foundry', 7, plain[6]); put('scribe', 3, plain[7]); put('sp_walls', 1, plain[8]);
  s.buffs = { settlers: 600, harvest: 300, hearth: 300, herds: 300, festival: 600 };
  Game.tick(0); UI.renderMap(); UI.lastPanel = null; UI.renderAll();
})()`;

/** Решатель раунда: верно на всё, кроме заданных номеров заданий. */
const SOLVE = `((wrongAt) => {
  const shotsWanted = {};
  let guard = 0;
  const types = [];
  while (Study.tasks[Study.i] && guard++ < 100) {
    const t = Study.tasks[Study.i];
    types.push(t.type);
    const bad = wrongAt.includes(Study.i);
    if (t.type === 'intro') { Study.next(); continue; }
    if (t.type === 'gr2ru' || t.type === 'ru2gr') {
      const f = t.type === 'gr2ru' ? 'back' : 'front';
      let i = t.opts.indexOf(t.p.card[f]); if (bad) i = (i + 1) % t.opts.length;
      Study.pickOption(i);
    } else if (t.type === 'spell') {
      let i = t.opts.indexOf(t.spot.from); if (bad) i = (i + 1) % t.opts.length;
      Study.pickOption(i);
    } else if (t.type === 'build') {
      const used = new Set(); let swapped = false;
      t.target.forEach((pc, idx) => {
        let k = t.tiles.findIndex((x, j) => !x.used && !used.has(j) && x.ch === pc);
        if (bad && !swapped && idx === 1) { const d = t.tiles.findIndex(x => !x.used && !t.target.includes(x.ch)); if (d >= 0) { k = d; swapped = true; } }
        used.add(k); Study.buildTap(k);
      });
    } else if (t.type === 'match') {
      t.left.forEach((p, i) => { Study.matchTap('L' + i); Study.matchTap('R' + t.right.indexOf(p)); });
    } else if (t.type === 'flip') { Study.flipShow(); Study.flipGrade(!bad); }
    Study.next();
  }
  return types;
})`;

(async () => {
  /** Закрыть вступление новой игры; где есть «Что будем учить?» — снять его и выбрать «С нуля». */
  async function startGame(page, snap = false) {
    if (await page.$('[data-action=plan]')) {
      await page.click('[data-action=plan]');
      if (snap) { await shot(page, '01b_plan'); await text(page, 'plan', '#modalBox'); }
      await page.click('[data-plan=a1]');
      await page.evaluate(() => { const t = document.querySelector('#toasts'); if (t) t.innerHTML = ''; });
    } else await page.click('[data-action=close]');
  }

  const browser = await chromium.launch();

  // ---------- 1. Первый запуск, вкладки, богатое состояние ----------
  {
    const { ctx, page } = await newPage(browser);
    await page.goto(URL + '?reset');
    await shot(page, '01_intro');
    await text(page, 'intro', '#modalBox');
    await startGame(page, true);
    await shot(page, '02_start');
    for (const tab of panelTabs) { await page.click(`[data-tab=${tab}]`); await shot(page, '03_tab_' + tab); await text(page, 'tab_' + tab, '#panel'); }
    await page.click('[data-tab=build]');
    await page.evaluate(RICH_STATE);
    await shot(page, '04_rich');
    await text(page, 'top_rich', '#topbar');
    for (const tab of panelTabs) { await page.click(`[data-tab=${tab}]`); await text(page, 'rich_tab_' + tab, '#panel'); await shot(page, '05_rich_tab_' + tab); }
    // окна зданий
    for (const type of ['house', 'field', 'workshop', 'shrine1']) {
      await page.evaluate(type => { const b = Game.state.buildings.filter(x => x.type === type).pop(); UI.showBuilding(b); }, type);
      await shot(page, '06_modal_' + type); await text(page, 'modal_' + type, '#modalBox');
      await page.evaluate(() => UI.closeModal());
    }
    // клик-сбор, постройка через интерфейс
    await page.click('[data-tab=build]');
    await page.click('[data-build=house]');
    await shot(page, '07_placing');
    const tile = await page.evaluate(() => { const t = Game.map.find(t => t.t === 'plain' && !Game.buildingAt(t.x, t.y) && Game.canPlaceOn('house', t)); return [t.x, t.y]; });
    await page.click(`.tile[data-x="${tile[0]}"][data-y="${tile[1]}"]`, { force: true });
    await page.evaluate(() => { const t = Game.map.find(t => t.t === 'forest' && !Game.buildingAt(t.x, t.y)); document.querySelector(`.tile[data-x="${t.x}"][data-y="${t.y}"]`).click(); });
    await page.clock.runFor(1500);
    await shot(page, '08_after_build');
    texts.log_rich = await page.evaluate(LOG_TEXT);
    // ход времени
    await page.clock.runFor(60000);
    texts.state_after_minute = await page.evaluate(() => JSON.stringify({ res: Game.state.res, pop: Game.state.pop, buffs: Game.state.buffs, rates: Game.rates }));
    await shot(page, '09_after_minute');
    await ctx.close();
  }

  // ---------- 2. Бронзовый век: шапка, благословения, гавани ----------
  {
    const { ctx, page } = await newPage(browser);
    await page.goto(URL + '?reset');
    await startGame(page);
    await page.evaluate(BRONZE_STATE);
    await shot(page, '10_bronze');
    await text(page, 'top_bronze', '#topbar');
    for (const tab of panelTabs) { await page.click(`[data-tab=${tab}]`); await text(page, 'bronze_tab_' + tab, '#panel'); await shot(page, '11_bronze_tab_' + tab); }
    await page.evaluate(() => { const b = Game.state.buildings.find(x => x.type === 'port'); UI.showBuilding(b); });
    await shot(page, '12_modal_port'); await text(page, 'modal_port', '#modalBox');
    await page.evaluate(() => UI.closeModal());
    // нехватка рук и тающий ресурс
    await page.evaluate(() => { Game.state.pop = 6; Game.state.res.food = 40; Game.tick(0.01); UI.renderTop(); });
    await shot(page, '13_short', { x: 0, y: 0, width: 1440, height: 130 });
    await text(page, 'top_short', '#topbar');
    // сценарий экономики
    const econ = await page.evaluate(() => {
      const out = [];
      for (let i = 0; i < 300; i++) { Game.tick(1); if (i % 50 === 0) out.push(JSON.stringify(Game.state.res)); }
      Game.raid();
      out.push(JSON.stringify(Game.state.res));
      return out;
    });
    texts.econ_bronze = econ.join('\n');
    texts.log_bronze = await page.evaluate(LOG_TEXT);
    await page.clock.runFor(4000);
    await shot(page, '14_after_raid');
    await ctx.close();
  }

  // ---------- 3. Узкий экран: полоса благословений ----------
  {
    const { ctx, page } = await newPage(browser, { width: 1200, height: 800 });
    await page.goto(URL + '?reset');
    await startGame(page);
    await page.evaluate(BRONZE_STATE);
    await shot(page, '15_narrow');
    await ctx.close();
  }

  // ---------- 4. Сценарий команд ядра ----------
  {
    const { ctx, page } = await newPage(browser);
    await page.goto(URL + '?reset');
    await startGame(page);
    const res = await page.evaluate(`(() => {
      const s = Game.state, out = [];
      // ядро отдаёт коды и данные; тексты — через словарь (если он есть в этой версии)
      const M = typeof Msg !== 'undefined' ? Msg : null;
      const rite = r => M && r && typeof r === 'object' ? M.riteResult(r) : r;
      const free = (type) => Game.map.find(t => !Game.buildingAt(t.x, t.y) && Game.canPlaceOn(type, t));
      const tryBuild = type => { const t = free(type); const ok = !!t && Game.build(type, t.x, t.y); out.push(\`build \${type}: \${ok}\`); };
      s.res.wood = 300; s.res.stone = 300; s.res.food = 300;
      ['field', 'field', 'house', 'lumber', 'quarry', 'house'].forEach(tryBuild);
      for (let i = 0; i < 400; i++) { Game.tick(1); Game.events(1); }
      Game.addLogos(600);
      out.push('perform elders: ' + rite(Game.perform('elders')));
      out.push('perform harvest: ' + rite(Game.perform('harvest')));
      out.push('research cheesemaking: ' + Game.research('cheesemaking', 'logos'));
      out.push('research carving labor: ' + Game.research('carving', 'labor'));
      const f = s.buildings.find(b => b.type === 'field');
      for (let i = 0; i < 4; i++) out.push('upgrade field: ' + Game.upgrade(f) + ' L' + f.level);
      for (let i = 0; i < 600; i++) { Game.tick(1); Game.events(1); }
      if (Game.goat) { const g = Game.catchGoat(); out.push('goat: ' + JSON.stringify(M ? { x: g.x, y: g.y, gained: M.resList(g.gains) || 'склады полны', line: M.goatLine(g.roll) } : g)); }
      const sp = s.buildings.length; tryBuild('sp_lemba'); out.push('lemba built: ' + (s.buildings.length > sp));
      out.push('statuses: ' + JSON.stringify(Object.keys(BUILDINGS).map(k => [k, Game.buildStatus(k).ok, !!Game.buildStatus(k).locked])));
      out.push('techs: ' + JSON.stringify(TECHS.map(T => [T.id, Game.techStatus(T).ok || false, !!Game.techStatus(T).locked])));
      out.push('rites: ' + JSON.stringify(RITUALS.map(R => [R.id, !!Game.ritualStatus(R).ok])));
      out.push('reqs: ' + JSON.stringify((Game.epochReqs() || []).map(r => [M ? M.req(r).have : r.have, r.ok])));
      const st = {};
      for (const k of CITY_FIELDS_JSON) st[k] = s[k];
      st.goats = s.stats.goats;
      st.learn = { decks: LSX.decks.length, progress: Object.keys(LSX.progress).length, settings: LSX.settings };
      out.push('state: ' + JSON.stringify(st));
      return out.join('\\n');
    })()`.replace(/CITY_FIELDS_JSON/g, JSON.stringify(CITY_FIELDS)).replace(/LSX/g, LS));
    texts.core_script = res;
    texts.log_script = await page.evaluate(LOG_TEXT);
    // офлайн: уйти на 2 часа
    await page.evaluate(() => { Game.save(); Game.resetting = true; });   // не пересохранять при уходе
    const p2 = await ctx.newPage();
    await p2.clock.install({ time: T0 + 2 * 3600e3 });
    await p2.clock.pauseAt(T0 + 2 * 3600e3 + 1000);
    p2.on('pageerror', e => errors.push(e.message));
    await p2.goto(URL);
    await shot(p2, '16_away');
    await text(p2, 'away', '#modalBox');
    await ctx.close();
  }

  // ---------- 5. Обучение: раунды, все задания ----------
  {
    const { ctx, page } = await newPage(browser);
    await page.goto(URL + '?reset');
    await startGame(page);
    const roundLog = [];
    for (let r = 0; r < 10; r++) {
      await page.evaluate(() => Study.start());
      if (r === 0) { await shot(page, '20_intro_card'); }
      // снимки каждого нового типа задания
      const seen = await page.evaluate(() => Study.tasks.map(t => t.type));
      const types = await page.evaluate(`${SOLVE}([${r % 3 === 1 ? '2, 5' : ''}])`);
      await shot(page, `21_round_end_${r}`);
      await text(page, `round_end_${r}`, '#stBody');
      roundLog.push(types.join(','));
      await page.evaluate(() => Study.close());
      await page.clock.setSystemTime(T0 + (r + 1) * (r % 3 === 2 ? 26 * 3600e3 : 90e3));
    }
    texts.rounds = roundLog.join('\n');
    texts.progress = await page.evaluate(`JSON.stringify(${LS}.progress)`);
    texts.learn_stats = await page.evaluate(`(() => { const L = ${LS}; const st = L.stats; return JSON.stringify({ stats: { right: st.right, wrong: st.wrong, rounds: st.rounds, learned: st.learned }, log: L.learnLog, logos: Game.state.logos }); })()`);
    // отдельные экраны заданий
    const kinds = ['gr2ru', 'ru2gr', 'spell', 'build', 'match', 'flip'];
    for (const k of kinds) {
      const ok = await page.evaluate(k => {
        Study.start();
        let i = Study.tasks.findIndex(t => t.type === k);
        if (i < 0) {
          // задания нет в раунде — подставляем вручную
          const cards = (typeof Learn !== 'undefined' ? Learn.state : Game.state).decks[0].cards, mk = c => ({ card: c, kind: 'due', lvl: 1 });
          if (k === 'spell') Study.tasks.unshift({ type: 'spell', p: mk(cards.find(c => spellSpots(c.front).length)) });
          else if (k === 'match') Study.tasks.unshift({ type: 'match', items: cards.slice(2, 6).map(mk) });
          else return false;
          i = 0;
        }
        Study.i = i; Study.render(); return true;
      }, k);
      if (ok) { await shot(page, '22_task_' + k); await text(page, 'task_' + k, '#stBody'); }
      if (ok && k === 'build') {
        await page.evaluate(() => {
          const t = Study.tasks[Study.i], used = new Set(); let swapped = false;
          t.target.forEach((pc, idx) => {
            let k = t.tiles.findIndex((x, j) => !x.used && !used.has(j) && x.ch === pc);
            if (!swapped && idx === 1) { const d = t.tiles.findIndex(x => !x.used && !t.target.includes(x.ch)); if (d >= 0) { k = d; swapped = true; } }
            used.add(k); Study.buildTap(k);
          });
        });
        await shot(page, '23_build_wrong'); await text(page, 'build_wrong', '#stBody');
      }
      await page.evaluate(() => Study.close());
    }
    await shot(page, '24_top_after_learning', { x: 0, y: 0, width: 1440, height: 70 });
    await text(page, 'study_btn', '#studyBtn');

    // ---------- 6. Экран «Обучение» ----------
    for (const sec of ['ov', 'decks', 'words', 'pace', 'io', 'reset']) {
      await page.evaluate(sec => School.open(sec), sec);
      await shot(page, '30_school_' + sec); await text(page, 'school_' + sec, '#schoolBody');
    }
    await page.evaluate(() => School.open('words'));
    await page.selectOption('[data-wf=st]', 'learning');
    await text(page, 'school_words_learning', '#schoolBody');
    await page.evaluate(() => School.close());

    // ---------- 7. Кипропедия ----------
    await page.evaluate(() => Pedia.open());
    for (const part of ['game', 'study']) {
      await page.click(`[data-part=${part}]`);
      const ids = await page.$$eval('#pediaNav .pn-item', a => a.map(x => x.dataset.pedia));
      for (const id of ids) {
        await page.evaluate(id => { Pedia.current = id; Pedia.render(); }, id);
        texts['pedia_' + id] = await page.$eval('#pediaBody', e => e.innerText);
      }
      texts['pedia_nav_' + part] = await page.$eval('#pediaNav', e => e.innerText);
    }
    for (const id of ['a:basics', 'a:cards', 'b:house', 't:bronze', 'r:copper', 'e:1']) {
      await page.evaluate(id => { Pedia.current = id; Pedia.render(); }, id);
      await shot(page, '40_pedia_' + id.replace(':', '_'));
    }
    await ctx.close();
  }

  fs.writeFileSync(path.join(OUT, 'texts.json'), JSON.stringify(texts, null, 1));
  fs.writeFileSync(path.join(OUT, 'errors.txt'), errors.join('\n\n'));
  console.log(`готово: ${fs.readdirSync(OUT).filter(f => f.endsWith('.png')).length} снимков, ${Object.keys(texts).length} текстов, ошибок: ${errors.length}`);
  if (errors.length) console.log(errors.slice(0, 5).join('\n'));
  await browser.close();
})();
