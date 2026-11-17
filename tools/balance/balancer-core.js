'use strict';
// ============================================================
//  Балансер — расчёт. Работает поверх ядра игры (Game, BUILDINGS, TECHS, EPOCHS, BALANCE…) и возвращает
//  только числа; показывает их tools/balance/balancer.html (открыть с диска), а node tools/balance/balancer.js
//  печатает сводку в консоль.
//
//  «Ожидаемый город» к концу эпохи e:
//    • сколько зданий каждого типа — допущение (plan[e], правится на странице); изучены все знания эпохи;
//      чудеса: (а) обязательные и без λ, (б) — ещё и необязательные за λ;
//    • уровни: ресурсы игрок тратит до последнего, а λ — нет. На уровни за Логос за эпоху уходит бюджет (budget[e], правится):
//      сначала — склады под самую большую цену эпохи и жилища под население перехода, остальное — по одному уровню туда,
//      где он прибавляет больше всего выпуска города (в зерне) на 1 λ. Уровни за ресурсы — сразу, пока цена влезает в склад;
//    • начало эпохи e+1 — тот же город после перехода (чудеса прошлой эпохи стали обычными зданиями).
//  Курсы ресурсов — «трудовые»: сколько зерна дал бы на поле работник, пока делает единицу ресурса.
// ============================================================

const Balancer = (() => {
  // Сколько зданий каждого типа стоит к концу эпохи (по умолчанию). Земли хватает: равнин 68 (у моря 25), леса 22, холмов 18.
  // Жилищ — чтобы мест было с запасом ~10% на всех работников; складов — чтобы влезала самая большая цена эпохи.
  // «Виноградарство» переводит загоны в виноградники и рощи, «Железо» — литейни в кузницы (перестройка с тем же уровнем).
  const PLAN = {
    0: { house: 9, field: 3, goatpen: 4, lumber: 5, quarry: 5, workshop: 4, storehouse: 3 },
    1: { house: 12, field: 4, goatpen: 6, lumber: 10, quarry: 6, workshop: 6, storehouse: 4, mine: 6, port: 4, foundry: 3, scribe: 1 },
    2: { house: 12, field: 4, lumber: 10, quarry: 6, workshop: 10, storehouse: 6, mine: 6, port: 5, scribe: 2, vineyard: 4, olivegrove: 12, forge: 6 },
    3: { house: 14, field: 4, lumber: 10, quarry: 6, workshop: 12, storehouse: 6, mine: 6, port: 6, scribe: 3, vineyard: 4, olivegrove: 12, forge: 6 },
  };
  // Сколько λ игрок тратит за эпоху на уровни зданий (ориентир; остальной Логос уходит на знания, чудеса и переход)
  const BUDGET = { 0: 100, 1: 300, 2: 1000, 3: 1200 };
  // Цель пути «ресурсами» на всю эпоху (зерно) и какая часть эпохи уже описана в игре. Для недописанной эпохи цель части —
  // доля по выпуску: части равны по времени, мощь растёт как в описанной части (геометрически), значит, на первую из n частей
  // приходится (g − 1) / (gⁿ − 1), где g — во сколько раз вырос город за описанную часть.
  const TARGET = { 3: { labor: 7e6, techs: 5e6, part: 1 / 3 } };   // labor — весь путь «ресурсами», techs — из него знания «через силу»
  // курс обрядов — BALANCE.riteRate медных λ за минуту выпуска на начало эпохи × BALANCE.logosInflation (дальше заданных — последняя)
  // payback — за сколько часов должно окупаться необязательное чудо; raidStock — какая доля склада в среднем лежит в запасах (для стен)
  const DEFAULTS = { last: 2, stock: 0.6, payback: 1.5, raidStock: 1 / 3 };

  function run(opts = {}) {
    const o = Object.assign({}, DEFAULTS, opts), plan = o.plan || PLAN, budget = Object.assign({}, BUDGET, o.budget || {});
    const G = Game, B = BUILDINGS, T = TECHS, E = EPOCHS, BAL = BALANCE, W = BAL.worth;
    if (!G.map || !G.map.length) G.genMap();
    G.state = G.newState();
    const LEVEL = e => E[e].maxLevel;
    const techsUpTo = e => T.filter(t => t.epoch <= e).map(t => t.id);
    const wonders = (e, withLogos) => {
      const must = new Set(E.slice(0, e + 1).flatMap(x => (x.advance && x.advance.specials) || []));
      let list = Object.keys(B).filter(t => B[t].special && B[t].epoch <= e && (must.has(t) || !B[t].logos || withLogos));
      return list.filter(t => !list.some(u => B[u].upgradeOf === t));   // заменённое улучшением чудо
    };
    let uid = 1;
    const mk = (type, level) => ({ id: uid++, type, level, x: 0, y: uid });
    const copy = list => list.map(b => Object.assign({}, b));

    /** Поставить город в ядро: эпоха, знания, здания; запасы — stock склада; жители — все места. */
    function load(st) {
      const s = G.state;
      s.epoch = st.epoch; s.techs = st.techs.slice(); s.buffs = {}; s.stash = [];
      s.buildings = copy(st.buildings);
      G.retireWonders();
      const cap = G.storageCap(G.effects(false));
      for (const k of RES_KEYS) s.res[k] = cap * o.stock;
      s.pop = G.popCap(G.effects(false));
      G.fx = G.effects();
      return s;
    }
    /** Самая большая цена эпохи, которая должна влезать в склад: переход, чудеса, знания — и «с умом», и «через силу» (закупка).
     *  Знания — по порядку, как их изучают (до «Финикийцев» цены в товарах, после — в серебре). */
    function storageNeed(e) {
      let best = { v: 0, what: null };
      const see = (cost, what) => { for (const [k, v] of Object.entries(G.liveCost(cost))) if (v > best.v) best = { v, res: k, what }; };
      if (E[e].advance) see(E[e].advance.res, { kind: 'advance' });
      for (const t of Object.keys(B).filter(t => B[t].special && B[t].epoch === e)) see(B[t].cost, { kind: 'wonder', id: t });
      const saved = G.state.techs;
      G.state.techs = T.filter(t => t.epoch < e).map(t => t.id);
      for (const t of T.filter(t => t.epoch === e)) {
        see(t.cost, { kind: 'tech', id: t.id });
        see(G.techPrice(t, 'labor').cost, { kind: 'tech', id: t.id, labor: true });
        G.state.techs.push(t.id);
      }
      G.state.techs = saved;
      return best;
    }
    const succ = {};   // устаревшие → во что перестраиваются (загон → виноградник/роща, литейня → кузница)
    for (const t of T) for (const [from, to] of Object.entries((t.retire && t.retire.buildings) || {}))
      for (const x of (typeof to === 'string' ? [to] : Object.values(to))) succ[x] = (succ[x] || []).concat(from);

    /** Конец эпохи e из города на её начало: здания из plan[e], уровни — по бюджету λ. */
    function buildEnd(e, prev) {
      const L = LEVEL(e), isL = l => !!BAL.wisdomLevels[l];
      // сколько λ игрок заработает за эпоху (для домов писцов): бюджет на уровни + обязательное + знания «с умом»
      const epochL = budget[e] + (E[e].advance ? E[e].advance.logos : 0) + wonderCosts(e).filter(w => w.kind === 'must').reduce((a, w) => a + w.logos, 0)
        + T.filter(t => t.epoch === e).reduce((a, t) => a + t.logos, 0);
      // начало эпохи: прошлый город после перехода (чудеса прошлой эпохи стали обычными зданиями)
      const st0 = load({ epoch: e, techs: prev.techs, buildings: prev.buildings });
      const pool = {}, carried = [];
      for (const b of st0.buildings) {
        if (B[b.type].special) continue;
        if (b.from) carried.push(Object.assign({}, b, { start: b.level, how: 'had' }));   // бывшее чудо — сверх плана, остаётся
        else (pool[b.type] = pool[b.type] || []).push(b.level);
      }
      for (const t of Object.keys(pool)) pool[t].sort((a, b) => b - a);
      const startN = {}; for (const t of Object.keys(pool)) startN[t] = pool[t].length;
      const blds = carried.slice();
      for (const [t, n] of Object.entries(plan[e] || {})) {
        if (!B[t] || B[t].special || B[t].epoch > e) continue;
        for (let i = 0; i < n; i++) {
          const old = pool[t] && pool[t].length ? t : (succ[t] || []).find(x => pool[x] && pool[x].length);
          const lv = old ? pool[old].shift() : 1;
          blds.push(Object.assign(mk(t, lv), { start: lv, how: !old ? 'new' : old === t ? 'had' : 'rebuild', rebuiltFrom: old !== t ? old : null }));
        }
      }
      const keepW = st0.buildings.filter(b => B[b.type].special);   // чудеса прошлых эпох, которые ещё чудеса
      const have = new Set(keepW.map(b => b.type).concat(st0.buildings.map(b => b.from).filter(Boolean)));
      const newW = wonders(e, false).filter(t => !have.has(t) && !(B[t].retire && B[t].retire.epoch <= e));
      const drop = new Set(newW.map(t => B[t].upgradeOf).filter(Boolean));
      const s = load({ epoch: e, techs: techsUpTo(e), buildings: blds.concat(keepW.filter(b => !drop.has(b.type)), newW.map(t => mk(t, 1))) });
      const fx = G.effects(false), need = storageNeed(e), advPop = E[e].advance ? E[e].advance.pop : 0;
      const rates = laborRates(fx);
      const fits = (b, l) => { const cap = G.storageCap(fx); return Object.values(G.upgradeCost(b.type, l).cost).every(v => v <= cap); };
      const frozen = b => G.sunsetType(b.type) || G.obsoleteType(b.type);   // доживающее и устаревшее не улучшают
      const freeUp = b => { while (!frozen(b) && b.level < L && !isL(b.level + 1) && fits(b, b.level + 1)) b.level++; };   // уровни за ресурсы — до последнего
      const canStep = b => !B[b.type].special && !frozen(b) && b.level < L && isL(b.level + 1);
      const cost = b => G.upgradeCost(b.type, b.level + 1).logos;
      const step = b => { b.level++; freeUp(b); };
      const others = () => s.buildings.filter(b => !B[b.type].special);
      for (const b of others()) freeUp(b);
      let spent = 0;
      const spend = b => { spent += cost(b); step(b); for (const x of others()) freeUp(x); };   // склад подрос — догоняем уровни за ресурсы
      // 1) склады — под самую большую цену эпохи; 2) жилища — под население перехода
      for (let guard = 0; guard < 200 && G.storageCap(fx) < need.v; guard++) {
        const b = s.buildings.filter(x => x.type === 'storehouse' && canStep(x)).sort((a, c) => a.level - c.level)[0];
        if (!b || spent + cost(b) > budget[e]) break;
        spend(b);
      }
      for (let guard = 0; guard < 200 && G.popCap(fx) < advPop; guard++) {
        const b = s.buildings.filter(x => x.type === 'house' && canStep(x)).sort((a, c) => a.level - c.level)[0];
        if (!b || spent + cost(b) > budget[e]) break;
        spend(b);
      }
      // 3) дома писцов — пока уровень окупается Логосом до конца эпохи: прибавка множителя × λ, который ещё заработают
      //    (половина λ эпохи: бюджет на уровни + обязательное + знания «с умом»), ÷ нынешний множитель ≥ цене уровня
      const scribes = () => G.state.buildings.filter(x => x.type === 'scribe' && canStep(x)).sort((a, c) => a.level - c.level);
      for (let guard = 0; guard < 50; guard++) {
        const b = scribes()[0]; if (!b) break;
        const m0 = G.effects(false).logos, lv = b.level; step(b); const m1 = G.effects(false).logos; b.level = lv;
        if ((m1 - m0) / m0 * epochL / 2 < cost(b) || spent + cost(b) > budget[e]) break;
        spend(b);
      }
      // 4) остальное — ровно: следующий уровень за λ получает самое отстающее производственное здание (при равных — с меньшей ценой);
      //    если зерна не хватает — сначала поля; если новых работников некуда поселить — сначала жилище
      const prodB = () => G.state.buildings.filter(x => !B[x.type].special && !['house', 'storehouse', 'scribe'].includes(x.type) && canStep(x));
      const lowest = list => list.sort((a, c) => a.level - c.level || cost(a) - cost(c))[0];
      const houses = () => G.state.buildings.filter(x => x.type === 'house' && canStep(x));
      for (let guard = 0; guard < 3000; guard++) {
        const food = G.production(fx, G.popCap(fx), 0.001).rates.food;
        let b = food < 0 ? lowest(prodB().filter(x => x.type === 'field')) || lowest(prodB()) : lowest(prodB());
        if (!b) break;
        const lv = b.level; step(b); const short = G.workersNeeded() > G.popCap(fx); b.level = lv;
        if (short) { const h = lowest(houses()); if (h && spent + cost(h) <= budget[e]) { spend(h); continue; } break; }
        if (spent + cost(b) > budget[e]) break;
        spend(b);
      }
      s.pop = G.popCap(fx);
      return { epoch: e, techs: techsUpTo(e), buildings: copy(s.buildings), target: need, L, spent, budget: budget[e], startN };
    }
    /** Город (б): тот же, но с необязательными чудесами за λ. */
    function withLogosWonders(city) {
      if (city.epoch == null || city.first) return city;
      const have = new Set(city.buildings.map(b => b.from || b.type));
      const add = wonders(city.epoch, true).filter(t => !have.has(t));
      const drop = new Set(add.map(t => B[t].upgradeOf).filter(Boolean));
      load({ epoch: city.epoch, techs: city.techs, buildings: city.buildings.filter(b => !drop.has(b.type)).concat(add.map(t => mk(t, 1))) });
      return Object.assign({}, city, { buildings: copy(G.state.buildings) });
    }
    function neutralFx() {
      const f = G.effects(false);
      for (const k of Object.keys(f.bonus)) f.bonus[k] = 0;
      for (const k of Object.keys(f.bbonus)) f.bbonus[k] = 0;
      f.scale = {}; f.trade = {};
      return f;
    }
    /** «Трудовые» курсы в зерне: работник стоит столько зерна, сколько дал бы на поле; сырьё и попутный выпуск — по уже найденным курсам. */
    function laborRates(fx) {
      const lvl = Math.max(1, ...G.state.buildings.filter(b => !B[b.type].special).map(b => b.level));
      const per = type => { const b = { id: 0, type, level: lvl, x: 0, y: 0 }; return { p: G.prodOf(b, fx), w: G.workersOf(b) }; };
      const f = per('field'), wage = f.p.food / f.w, r = { food: 1 };
      const solve = (type, k) => {
        if (G.obsoleteType(type)) return;
        const { p, w } = per(type);
        if (!(p[k] > 0)) return;
        let cost = w * wage;
        for (const [x, v] of Object.entries(p)) { if (x === k) continue; if (r[x] == null) return; cost += -v * r[x]; }
        if (cost > 0) r[k] = r[k] == null ? cost / p[k] : Math.min(r[k], cost / p[k]);
      };
      for (let pass = 0; pass < 3; pass++) for (const [t, k] of [['lumber', 'wood'], ['quarry', 'stone'], ['mine', 'copper'], ['workshop', 'goods'], ['workshop', 'silver'],
        ['goatpen', 'cheese'], ['foundry', 'bronze'], ['forge', 'iron'], ['vineyard', 'amphora'], ['olivegrove', 'amphora']]) solve(t, k);
      // папирус не производится: его «настоящая» цена — BALANCE.ships.price монет за лист (грузом выходит ≈40, за монеты — 60)
      if (G.resVisible('papyrus') && BAL.ships && r.silver != null) r.papyrus = BAL.ships.price * r.silver;
      return r;
    }
    /** Серебро (монеты) с одного здания уровня города: само, через гавань (амфоры — торговая линия, медь — основная). */
    function coinSources(rates, bare) {
      if (bare) G.state.buildings = G.state.buildings.filter(b => !B[b.type].special);
      const fx = G.effects(false), lvl = Math.max(1, ...G.state.buildings.filter(b => !B[b.type].special).map(b => b.level));
      const one = type => { const b = { id: 0, type, level: lvl, x: 0, y: 0 }; return { p: G.prodOf(b, fx), t: G.tradeOf(b, fx), w: G.workersOf(b) }; };
      const port = one('port'), out = {};
      const ws = one('workshop'); if (ws.p.silver) out.workshop = { v: ws.p.silver, w: ws.p.silver / ws.w };
      for (const type of ['vineyard', 'olivegrove']) {
        const x = one(type);
        if (x.p.amphora && port.t) { const v = x.p.amphora * port.t.silver / -port.t.amphora; out[type] = { v, w: v / x.w }; }
      }
      const m = one('mine');
      if (m.p.copper && port.p.copper < 0 && rates.silver) {
        const perCu = ((port.p.silver || 0) + (port.p.food || 0) / rates.silver) / -port.p.copper, share = m.p.copper / -port.p.copper;
        out.mine = { v: m.p.copper * perCu, w: m.p.copper * perCu / (m.w + port.w * share) };   // руки гавани — по доле её меди
      }
      return out;
    }
    /** Вывоз излишков в долгую: продажа амфор (trade.sell) и основная работа гаваней (inKeep — медь только сверх полсклада)
     *  берут не больше, чем приходит, — запас стоит на «полскладе». Если на снимке такие здания уводят сырьё в минус,
     *  урезаем их работу (и сырьё, и выход) до нуля по сырью. */
    function steady(fx, pop) {
      const log = [], P = G.production(fx, pop, 0.001, false, log);
      const groups = [l => l.trade && B[l.b.type].trade && B[l.b.type].trade.sell, l => !l.trade && B[l.b.type].inKeep];
      for (const g of groups) {
        const sum = {};
        for (const l of log) if (l.k && g(l)) sum[l.k] = (sum[l.k] || 0) + l.v;
        for (const k of Object.keys(sum)) if (sum[k] < 0 && P.rates[k] < 0) {
          const cut = Math.min(1, P.rates[k] / sum[k]);
          for (const [kk, v] of Object.entries(sum)) P.rates[kk] -= v * cut;
        }
      }
      return P;
    }
    function measure(city) {
      const s = load(city), fx = G.effects(false), fx0 = neutralFx();
      const pop = G.popCap(fx), storage = G.storageCap(fx), P = steady(fx, pop), gross = G.grossRates();
      const mult = {};
      for (const k of RES_KEYS) {
        let a = 0, b0 = 0;
        for (const b of s.buildings) {
          const p = G.prodOf(b, fx)[k] || 0, q = G.prodOf(b, fx0)[k] || 0;
          if (q > 0) { a += p; b0 += q; }
          const t = G.tradeOf(b, fx), t0 = G.tradeOf(b, fx0);
          if (t && t0 && t0[k] > 0) { a += t[k]; b0 += t0[k]; }
        }
        if (b0 > 0) mult[k] = a / b0;
      }
      // из чего набирается множитель: по типам зданий (во сколько раз каждый тип даёт больше) и источники бонусов
      const bonus = {};
      for (const k of RES_KEYS) {
        const byType = {};
        for (const b of s.buildings) {
          const p = G.prodOf(b, fx)[k] || 0, q = G.prodOf(b, fx0)[k] || 0, t = G.tradeOf(b, fx), t0 = G.tradeOf(b, fx0);
          const qq = (q > 0 ? q : 0) + (t0 && t0[k] > 0 ? t0[k] : 0), pp = (q > 0 ? p : 0) + (t0 && t0[k] > 0 ? t[k] : 0);
          if (qq > 0) { const x = byType[b.type] = byType[b.type] || { n: 0, q: 0, p: 0, trade: false }; x.n++; x.q += qq; x.p += pp; if (t0 && t0[k] > 0) x.trade = true; }
        }
        if (!Object.keys(byType).length) continue;
        const types = Object.keys(byType), sources = [];
        for (const src of G.bonusSources()) {
          if (src.kind === 'rite') continue;
          const e = src.effect || {};
          if (e.all) sources.push({ kind: src.kind, id: src.id, v: e.all, scope: 'all' });
          for (const [kk, v] of Object.entries(e.mult || {})) if (G.liveKey(kk) === k) sources.push({ kind: src.kind, id: src.id, v, scope: 'res' });
          for (const [type, v] of Object.entries(e.bmult || {})) if (types.includes(type)) sources.push({ kind: src.kind, id: src.id, v, scope: type });
          for (const [type, v] of Object.entries(e.scale || {})) if (types.includes(type)) sources.push({ kind: src.kind, id: src.id, v, scope: type, scale: true });
          for (const [type, v] of Object.entries(e.trade || {})) if (types.includes(type) && byType[type].trade) sources.push({ kind: src.kind, id: src.id, v, scope: type, trade: true });
        }
        bonus[k] = { byType: types.map(t => ({ type: t, n: byType[t].n, mult: byType[t].p / byType[t].q, share: byType[t].q })), sources };
      }
      // множитель λ: 1 + знания и чудеса + дома писцов (каждый: 8% + 2% за уровень выше первого)
      const LB = G.logosBreakdown(), logosParts = [];
      for (const pt of LB.parts) {
        if (pt.kind === 'rite') continue;
        const same = logosParts.find(x => x.kind === pt.kind && x.id === pt.id && x.level === pt.level);
        if (same) { same.n++; same.v += pt.v; } else logosParts.push(Object.assign({ n: 1 }, pt));
      }
      const counts = {};
      for (const b of s.buildings) if (!B[b.type].special) { const c = counts[b.type] = counts[b.type] || { n: 0, levels: [] }; c.n++; c.levels.push(b.level); }
      const tiles = { plain: 0, forest: 0, hill: 0 }, use = { plain: 0, forest: 0, hill: 0, flex: 0 };
      for (const t of G.map) if (tiles[t.t] != null) tiles[t.t]++;
      for (const b of s.buildings) { const ter = B[b.type].terrain; if (ter.length === 1) use[ter[0]]++; else use.flex++; }
      const rates = laborRates(fx);
      const exists = k => RES[k].epoch <= s.epoch && (!RES[k].tech || G.hasTech(RES[k].tech)) && !G.retiredRes(k);
      for (const k of Object.keys(rates)) if (!exists(k)) delete rates[k];   // ресурса в этой эпохе ещё (или уже) нет
      const val = x => RES_KEYS.reduce((v, k) => v + (x[k] || 0) * (rates[k] != null ? rates[k] : (W[k] || 1)), 0);
      const wonderList = s.buildings.filter(b => B[b.type].special).map(b => b.type), workers = G.workersNeeded();
      const coins = coinSources(rates, false);
      load(city); const coins0 = coinSources(rates, true);
      return { epoch: s.epoch, pop, storage, workers, eff: P.eff, food: P.rates.food, net: P.rates, gross, mult, bonus, logos: fx.logos, logosParts, counts,
        wonders: wonderList, rates, land: { tiles, use },
        prod: val(P.rates), prodGross: val(gross), prodWorth: RES_KEYS.reduce((v, k) => v + (P.rates[k] || 0) * (W[k] || 1), 0), coins, coins0 };
    }

    // ---------- цены ----------
    const addTo = (acc, cost) => { for (const [k, v] of Object.entries(cost || {})) acc[k] = (acc[k] || 0) + v; return acc; };
    const wheatOf = rates => cost => Object.entries(cost || {}).reduce((v, [k, n]) => v + n * (rates[k] != null ? rates[k] : (W[k] || 1)), 0);
    function techCosts(e) {
      G.state.epoch = e; G.state.techs = T.filter(t => t.epoch < e).map(t => t.id);
      return T.filter(t => t.epoch === e).map(t => {
        const m = G.techPrice(t), l = G.techPrice(t, 'labor');
        G.state.techs.push(t.id);   // следующие — уже после этого (ушедшие ресурсы)
        return { id: t.id, logos: m.logos, mind: m.cost, labor: l.cost };
      });
    }
    /** Постройки и улучшения за эпоху (здания помнят, с какого уровня начали эпоху и как появились): по типам — сколько было,
     *  новых, перестроенных, с каких уровней до каких, λ по уровням за Логос, ресурсы на постройку и на улучшения. */
    function upgradeCosts(endCity) {
      load(endCity);   // цены — по правилам конца эпохи (ушедшие ресурсы, железо на 10-м…)
      const res = {}, detail = {}, built = {};
      let logos = 0;
      for (const b of endCity.buildings) {
        if (B[b.type].special) continue;
        const d = detail[b.type] = detail[b.type] || { type: b.type, n: 0, had: 0, built: 0, rebuilt: [], wonder: 0, from: {}, to: {}, buildRes: {}, upRes: {}, logos: 0, logosLv: {} };
        const from = b.start || 1;
        d.n++; d.from[from] = (d.from[from] || 0) + 1; d.to[b.level] = (d.to[b.level] || 0) + 1;
        if (b.from) d.wonder++;
        else if (b.how === 'had') d.had++;
        else if (b.how === 'rebuild') { d.rebuilt.push(b.rebuiltFrom); addTo(d.buildRes, G.liveCost(B[b.type].cost)); }
        else {
          d.built++;
          const own = built[b.type] = (built[b.type] || 0) + 1, mult = Math.pow(BAL.buildCostGrowth, ((endCity.startN || {})[b.type] || 0) + own - 1), c = {};
          for (const [k, v] of Object.entries(B[b.type].cost || {})) c[k] = Math.ceil(v * mult);
          addTo(d.buildRes, G.liveCost(c));
        }
        for (let l = from + 1; l <= b.level; l++) {
          const u = G.upgradeCost(b.type, l);
          addTo(d.upRes, u.cost);
          if (u.logos) { d.logos += u.logos; d.logosLv[l] = (d.logosLv[l] || 0) + u.logos; }
        }
      }
      for (const d of Object.values(detail)) { addTo(res, d.buildRes); addTo(res, d.upRes); logos += d.logos; }
      return { res, logos, detail: Object.values(detail) };
    }
    function wonderCosts(e) {
      load({ epoch: e, techs: techsUpTo(e), buildings: [] });
      const must = new Set((E[e].advance && E[e].advance.specials) || []);
      return Object.keys(B).filter(t => B[t].special && B[t].epoch === e)
        .map(t => ({ id: t, logos: B[t].logos || 0, cost: G.liveCost(B[t].cost), kind: must.has(t) ? 'must' : B[t].logos ? 'logos' : 'res' }));
    }

    // ---------- расчёт ----------
    const first = { epoch: 0, techs: [], buildings: copy(G.newState().buildings), first: true, L: 1 };
    const cities = [first], ends = [];
    for (let e = 0; e <= o.last && e < E.length; e++) {
      if (!E[e].maxLevel) break;
      const end = buildEnd(e, cities[cities.length - 1]); ends.push(end); cities.push(end);
    }
    const stages = cities.map((c, i) => ({ index: i, first: !!c.first, endOf: c.first ? null : c.epoch, target: c.target || null,
      a: measure(c), b: measure(withLogosWonders(c)) }));
    const epochs = ends.map((end, e) => {
      const m0 = stages[e].a, m1 = stages[e + 1].a, rates = Object.assign({}, m0.rates, m1.rates), wh = wheatOf(rates);
      // средняя производительность эпохи — геометрическая (город растёт примерно по экспоненте); начало эпохи 0 почти ноль — не меньше 10% конца
      const prod = Math.sqrt(Math.max(m0.prod, m1.prod * 0.1) * m1.prod);
      const techs = techCosts(e).map(t => Object.assign(t, { mindW: wh(t.mind), laborW: wh(t.labor) }));
      const tl = techs.reduce((a, t) => a + t.logos, 0), tm = techs.reduce((a, t) => a + t.mindW, 0), tlab = techs.reduce((a, t) => a + t.laborW, 0);
      const wc = wonderCosts(e).map(w => Object.assign(w, { w: wh(w.cost) }));
      const adv = E[e].advance || null, advRes = adv ? G.liveCost(adv.res) : {};
      const must = wc.filter(w => w.kind === 'must'), optL = wc.filter(w => w.kind === 'logos'), resW = wc.filter(w => w.kind === 'res');
      const mustL = must.reduce((a, w) => a + w.logos, 0) + (adv ? adv.logos : 0);
      const up = upgradeCosts(end); up.w = wh(up.res); up.budget = end.budget;
      for (const d of up.detail) { d.w = wh(d.buildRes) + wh(d.upRes); }
      const sum = list => list.reduce((a, c) => addTo(a, c), {});
      const mindRes = sum([...techs.map(t => t.mind), ...must.map(w => w.cost), ...optL.map(w => w.cost), ...resW.map(w => w.cost), up.res, advRes]);
      const laborRes = sum([...techs.map(t => t.labor), ...must.map(w => w.cost), ...resW.map(w => w.cost), up.res, advRes]);
      const scen = {
        mind: { logos: tl + mustL + optL.reduce((a, w) => a + w.logos, 0) + up.logos, res: mindRes, w: wh(mindRes) },
        labor: { logos: mustL + up.logos, res: laborRes, w: wh(laborRes) },
      };
      const techMind = sum(techs.map(t => t.mind)), techLabor = sum(techs.map(t => t.labor));
      // слагаемые итога: что входит в какой сценарий
      const part = (key, logos, res, mind, labor) => ({ key, logos, res, w: wh(res), mind, labor });
      const parts = [
        part('techMind', tl, techMind, true, false),
        part('techLabor', 0, techLabor, false, true),
        part('must', must.reduce((a, w) => a + w.logos, 0), sum(must.map(w => w.cost)), true, true),
        part('optLogos', optL.reduce((a, w) => a + w.logos, 0), sum(optL.map(w => w.cost)), true, false),
        part('resWonders', 0, sum(resW.map(w => w.cost)), true, true),
        part('up', up.logos, up.res, true, true),
        part('advance', adv ? adv.logos : 0, advRes, true, true),
      ];
      // мощь города «на начало» и в конце эпохи. Самый момент перехода — слишком строго: берём чуть позже — четверть пути
      // от перехода к концу эпохи (рост примерно экспоненциальный — геометрически); в начале игры город почти ноль —
      // для медно-каменного века легко достижимая треть от конца эпохи
      const startAssumed = e === 0, prodStart = m0.prod, prod0 = startAssumed ? m1.prod / 3 : Math.pow(m0.prod, 0.75) * Math.pow(m1.prod, 0.25);
      // твёрдый курс обрядов: 1 минута выпуска на начало = riteRate медных λ × инфляция λ эпохи → столько зерна в 1 номинальном λ
      const LI = BAL.logosInflation, infl = LI[e] != null ? LI[e] : LI[LI.length - 1], riteSet = LI[e] != null;
      const RR = BAL.riteRate, real = RR[e] != null ? RR[e] : RR[RR.length - 1], riteRate = real * infl, riteL = prod0 * 60 / riteRate;
      // цель пути «ресурсами» (TARGET): на всю эпоху и на описанную часть — по доле выпуска
      const T = TARGET[e], g = m1.prod / m0.prod, n = T ? 1 / T.part : 1;
      const target = T ? { labor: T.labor, part: T.part, share: n > 1 ? (g - 1) / (Math.pow(g, n) - 1) : 1 } : null;
      if (target) { target.want = target.labor * target.share; target.have = scen.labor.w;
        if (T.techs) { target.techsWant = T.techs * target.share; target.techsThird = T.techs * T.part; target.techsHave = tlab; } }
      // корабли: сколько монет за лист выходит у каждого пакета груза по курсу эпохи (цель — ≈40; за монеты — buy)
      const ships = rates.papyrus != null && rates.silver ? BAL.ships.packs.map(pk => ({ id: pk.id,
        coins: Object.entries(pk.want).reduce((v, [k, n]) => v + n * (rates[k] != null ? rates[k] : NaN), 0) / rates.silver / BAL.ships.give.papyrus })) : null;
      return { e, ships, prod, prod0, prodStart, prod0Assumed: startAssumed, prod1: m1.prod, riteL, riteRate, riteReal: real, infl, riteSet, rates, techs, tl, tm, tlab, techMind, techLabor, parts, wonders: wc, adv: adv ? { logos: adv.logos, res: advRes, w: wh(advRes) } : null, mustL, up,
        perL: tl ? (tlab - tm) / tl : null, scen, target };
    });
    // ---------- окупаемость необязательных чудес ----------
    // Город конца эпохи со всеми чудесами; прибавка чуда — насколько падает чистый выпуск без него (по курсам этого города),
    // доля выпуска конца эпохи переносится на мощь середины эпохи (между «началом» и концом, геометрически).
    // Стены (raidShield): сколько в среднем уносили бы «народы моря» — середина raidLoot от запасов (raidStock склада) раз в среднее raidEvery.
    epochs.forEach((x, e) => {
      const full = withLogosWonders(cities[e + 1]), must = new Set((E[e].advance && E[e].advance.specials) || []);
      const base = measure(full), rates = base.rates, val = r => RES_KEYS.reduce((v, k) => v + (r[k] || 0) * (rates[k] != null ? rates[k] : 0), 0);
      const net = val(base.net), mid = Math.sqrt(x.prod0 * x.prod1);
      x.payback = { hours: o.payback, mid, list: Object.keys(B).filter(t => B[t].special && B[t].epoch === e && !must.has(t) && full.buildings.some(b => b.type === t)).map(t => {
        const without = measure(Object.assign({}, full, { buildings: full.buildings.filter(b => b.type !== t) }));
        const ef = B[t].effect || {}, res = G.liveCost(B[t].cost), resW = val(res), logos = B[t].logos || 0;
        let gainEnd = net - val(without.net), shield = 0;
        if (ef.raidShield && e === 1) {
          load(full);
          const cap = G.storageCap(G.effects(false)) / (1 + (ef.storagePct || 0)), [a, b] = BAL.raidLoot, [p, q] = BAL.raidEvery;
          shield = (a + b) / 2 * o.raidStock * cap * RES_KEYS.reduce((v, k) => v + (rates[k] != null && G.resVisible(k) ? rates[k] : 0), 0) / ((p + q) / 2);
        }
        // остаток: чем чудо станет после устаревания — сколько стоило бы построить такое здание и поднять до его уровня (по ценам этой эпохи);
        // если и это здание в следующей эпохе устаревает (литейня) — сколько вернёт его продажа: весь λ уровней и половина постройки
        let rest = null;
        const R = B[t].retire;
        if (R) {
          load(full);
          const rr = { cost: G.liveCost(G.buildCost(R.into)), logos: 0 };
          for (let L = 2; L <= R.level; L++) { const u = G.upgradeCost(R.into, L); addTo(rr.cost, u.cost); rr.logos += u.logos; }
          const killer = T.find(tt => tt.epoch <= R.epoch && tt.retire && tt.retire.buildings && tt.retire.buildings[R.into]);
          rest = { into: R.into, level: R.level, epoch: R.epoch, res: rr.cost, logos: rr.logos, obsolete: !!killer };
          if (killer) {
            rest.res = {}; for (const [k, v] of Object.entries(G.liveCost(B[R.into].cost))) rest.res[k] = Math.floor(v / 2);
            const succ = killer.retire.buildings[R.into]; rest.successor = typeof succ === 'string' ? succ : null;
          }
          rest.resW = val(rest.res); rest.logosW = rest.logos * x.riteL; rest.w = rest.resW + rest.logosW;
        }
        const share = gainEnd / net, gainMid = share * mid + shield, logosW = logos * x.riteL;
        const priceW = logosW + resW, sec = o.payback * 3600, earn = gainMid * sec, fairW = earn;   // остаток в цену не входит — это проверка
        return { id: t, logos, logosW, res, resW, priceW, share, gainMid, shield, hours: gainMid > 0 ? priceW / gainMid / 3600 : null,
          earn, rest, fairW, fairL: logos ? Math.max(0, (fairW - resW) / x.riteL) : null, retire: R || null };
      }) };
    });
    return { stages, epochs, worth: W };
  }
  return { run, PLAN, BUDGET, DEFAULTS, TARGET };
})();
if (typeof module !== 'undefined') module.exports = Balancer;
