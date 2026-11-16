'use strict';
// ============================================================
//  Балансер — расчёт. Работает поверх ядра игры (Game, BUILDINGS, TECHS, EPOCHS, BALANCE…) и возвращает
//  только числа; показывает их tools/balance/balancer.html (открыть с диска), а node tools/balance/balancer.js
//  печатает сводку в консоль.
//
//  «Ожидаемый город»:
//    • к концу эпохи e стоят производственные здания из plan[e], все — на пределе уровня эпохи;
//    • жилища, поля и склады досчитываются: мест — на население перехода и на всех работников, зерна — всем,
//      склада — под самую большую цену эпохи «с умом» (переход, чудо, знание, улучшение);
//    • изучены все знания эпохи; чудеса: (а) обязательные и без λ, (б) — ещё и необязательные за λ;
//    • начало эпохи e+1 — тот же город после перехода (чудеса прошлой эпохи стали обычными зданиями).
//  Курсы ресурсов — «трудовые»: сколько зерна дал бы на поле работник, пока делает единицу ресурса.
// ============================================================

const Balancer = (() => {
  // Производственные здания к концу эпохи по умолчанию (жилища, поля и склады — досчитываются)
  const PLAN = {
    0: { goatpen: 2, lumber: 2, quarry: 2, workshop: 2 },
    1: { goatpen: 2, lumber: 3, quarry: 3, workshop: 3, mine: 3, port: 2, foundry: 2, scribe: 2 },
    // «Виноградарство» переводит загоны в виноградники и рощи, «Железо» — литейни в кузницы (перестройка с тем же уровнем)
    2: { lumber: 3, quarry: 3, workshop: 3, mine: 3, port: 2, scribe: 2, vineyard: 2, olivegrove: 2, forge: 2 },
    3: { lumber: 3, quarry: 3, workshop: 3, mine: 3, port: 2, scribe: 2, vineyard: 3, olivegrove: 2, forge: 2 },
  };
  const DEFAULTS = { last: 2, stock: 0.6, foodMargin: 0.05 };

  function run(opts = {}) {
    const o = Object.assign({}, DEFAULTS, opts), plan = o.plan || PLAN;
    const G = Game, B = BUILDINGS, T = TECHS, E = EPOCHS, BAL = BALANCE, W = BAL.worth, ROUND = ROUND_LAMBDA;
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
    function storageTarget(e, s) {
      let best = { v: 0, what: null };
      const see = (cost, what) => { for (const [k, v] of Object.entries(G.liveCost(cost))) if (v > best.v) best = { v, res: k, what }; };
      if (E[e].advance) see(E[e].advance.res, { kind: 'advance' });
      for (const t of Object.keys(B).filter(t => B[t].special && B[t].epoch === e)) see(B[t].cost, { kind: 'wonder', id: t });
      for (const t of T.filter(t => t.epoch === e)) see(t.cost, { kind: 'tech', id: t.id });
      for (const type of new Set(s.buildings.filter(b => !B[b.type].special).map(b => b.type)))
        for (let l = 2; l <= LEVEL(e); l++) see(G.upgradeCost(type, l).cost, { kind: 'upgrade', id: type, level: l });
      return best;
    }
    /** Конец эпохи e: plan[e] на пределе уровня + жилища, поля, склады, досчитанные под условия. */
    function solveEnd(e) {
      const L = LEVEL(e);
      const base = Object.entries(plan[e] || {}).flatMap(([t, n]) => Array.from({ length: n }, () => mk(t, L)));
      const wb = wonders(e, false).map(t => mk(t, 1));
      const n = { house: 1, field: 1, storehouse: 0 }, advPop = E[e].advance ? E[e].advance.pop : 0;
      for (let it = 0; it < 300; it++) {
        const s = load({ epoch: e, techs: techsUpTo(e), buildings: base.concat(wb, ...['house', 'field', 'storehouse'].map(t => Array.from({ length: n[t] }, () => mk(t, L)))) });
        for (const b of s.buildings) if (b.from && !B[b.type].special) b.level = Math.max(b.level, L);   // бывшее чудо — до предела, как все
        const fx = G.effects(false), cap = G.popCap(fx), need = G.workersNeeded();
        if (cap < Math.max(advPop, need)) { n.house++; continue; }
        s.pop = cap;
        if (G.production(fx, cap, 0.001).rates.food < cap * BAL.foodPerPop * o.foodMargin) { n.field++; continue; }
        const target = storageTarget(e, s);
        if (G.storageCap(fx) < target.v && n.storehouse < 20) { n.storehouse++; continue; }
        return { epoch: e, techs: techsUpTo(e), buildings: copy(s.buildings), counts: n, target, L };
      }
      throw new Error('город не сошёлся для эпохи ' + e);
    }
    /** Город (б): тот же, но с необязательными чудесами за λ. */
    function withLogosWonders(city) {
      if (city.epoch == null || city.first) return city;
      const have = new Set(city.buildings.map(b => b.from || b.type));
      const add = wonders(city.epoch, true).filter(t => !have.has(t));
      const drop = new Set(add.map(t => B[t].upgradeOf).filter(Boolean));
      load({ epoch: city.epoch, techs: city.techs, buildings: city.buildings.filter(b => !drop.has(b.type)).concat(add.map(t => mk(t, 1))) });
      for (const b of G.state.buildings) if (b.from && !B[b.type].special) b.level = Math.max(b.level, city.L);
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
    function measure(city) {
      const s = load(city), fx = G.effects(false), fx0 = neutralFx();
      const pop = G.popCap(fx), storage = G.storageCap(fx), P = G.production(fx, pop, 0.001), gross = G.grossRates();
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
      const counts = {};
      for (const b of s.buildings) if (!B[b.type].special) { const c = counts[b.type] = counts[b.type] || { n: 0, levels: [] }; c.n++; c.levels.push(b.level); }
      const tiles = { plain: 0, forest: 0, hill: 0 }, use = { plain: 0, forest: 0, hill: 0, flex: 0 };
      for (const t of G.map) if (tiles[t.t] != null) tiles[t.t]++;
      for (const b of s.buildings) { const ter = B[b.type].terrain; if (ter.length === 1) use[ter[0]]++; else use.flex++; }
      const rates = laborRates(fx);
      const val = x => RES_KEYS.reduce((v, k) => v + (x[k] || 0) * (rates[k] != null ? rates[k] : (W[k] || 1)), 0);
      const coins = coinSources(rates, false);
      load(city); const coins0 = coinSources(rates, true);
      return { epoch: s.epoch, pop, storage, workers: G.workersNeeded(), net: P.rates, gross, mult, logos: fx.logos, counts,
        wonders: s.buildings.filter(b => B[b.type].special).map(b => b.type), rates, land: { tiles, use },
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
    function upgradeCosts(startCity, endCity) {
      load(endCity);
      const res = {}, pool = {}, built = {}, succ = {};
      let logos = 0;
      for (const b of startCity.buildings) if (!B[b.type].special) (pool[b.type] = pool[b.type] || []).push(b.level);
      for (const t of T) for (const [from, to] of Object.entries((t.retire && t.retire.buildings) || {}))
        for (const x of (typeof to === 'string' ? [to] : Object.values(to))) succ[x] = (succ[x] || []).concat(from);
      for (const b of endCity.buildings) {
        if (B[b.type].special) continue;
        let from = 1, how = 'new';
        const old = (succ[b.type] || []).find(x => pool[x] && pool[x].length);
        if (pool[b.type] && pool[b.type].length) { from = pool[b.type].shift(); how = 'had'; }
        else if (old) { from = pool[old].shift(); how = 'rebuild'; addTo(res, G.liveCost(B[b.type].cost)); }
        else if (b.from) { from = B[b.from].retire.level; how = 'wonder'; }
        if (how === 'new') {
          const own = built[b.type] = (built[b.type] || 0) + 1, startN = startCity.buildings.filter(x => x.type === b.type && !x.from).length;
          const mult = Math.pow(BAL.buildCostGrowth, startN + own - 1), c = {};
          for (const [k, v] of Object.entries(B[b.type].cost || {})) c[k] = Math.ceil(v * mult);
          addTo(res, G.liveCost(c));
        }
        for (let l = from + 1; l <= b.level; l++) { const u = G.upgradeCost(b.type, l); addTo(res, u.cost); logos += u.logos; }
      }
      return { res, logos };
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
      const end = solveEnd(e); ends.push(end); cities.push(end);
    }
    const stages = cities.map((c, i) => ({ index: i, first: !!c.first, endOf: c.first ? null : c.epoch, target: c.target || null,
      a: measure(c), b: measure(withLogosWonders(c)) }));
    const epochs = ends.map((end, e) => {
      const m0 = stages[e].a, m1 = stages[e + 1].a, rates = Object.assign({}, m0.rates, m1.rates), wh = wheatOf(rates);
      // средняя производительность эпохи — геометрическая (город растёт примерно по экспоненте); начало эпохи 0 почти ноль — не меньше 10% конца
      const prod = Math.sqrt(Math.max(m0.prod, m1.prod * 0.1) * m1.prod), lpr = ROUND * (m0.logos + m1.logos) / 2;
      const techs = techCosts(e).map(t => Object.assign(t, { mindW: wh(t.mind), laborW: wh(t.labor) }));
      const tl = techs.reduce((a, t) => a + t.logos, 0), tm = techs.reduce((a, t) => a + t.mindW, 0), tlab = techs.reduce((a, t) => a + t.laborW, 0);
      const wc = wonderCosts(e).map(w => Object.assign(w, { w: wh(w.cost) }));
      const adv = E[e].advance || null, advRes = adv ? G.liveCost(adv.res) : {};
      const must = wc.filter(w => w.kind === 'must'), optL = wc.filter(w => w.kind === 'logos'), resW = wc.filter(w => w.kind === 'res');
      const mustL = must.reduce((a, w) => a + w.logos, 0) + (adv ? adv.logos : 0);
      const up = upgradeCosts(cities[e], end); up.w = wh(up.res);
      const sum = list => list.reduce((a, c) => addTo(a, c), {});
      const mindRes = sum([...techs.map(t => t.mind), ...must.map(w => w.cost), ...optL.map(w => w.cost), ...resW.map(w => w.cost), up.res, advRes]);
      const laborRes = sum([...techs.map(t => t.labor), ...must.map(w => w.cost), ...resW.map(w => w.cost), up.res, advRes]);
      const scen = {
        mind: { logos: tl + mustL + optL.reduce((a, w) => a + w.logos, 0) + up.logos, res: mindRes, w: wh(mindRes) },
        labor: { logos: mustL + up.logos, res: laborRes, w: wh(laborRes) },
      };
      return { e, prod, lpr, rates, techs, tl, tm, tlab, wonders: wc, adv: adv ? { logos: adv.logos, res: advRes, w: wh(advRes) } : null, mustL, up,
        perL: tl ? (tlab - tm) / tl : null, scen };
    });
    return { stages, epochs, worth: W, round: ROUND };
  }
  return { run, PLAN, DEFAULTS };
})();
if (typeof module !== 'undefined') module.exports = Balancer;
