'use strict';
// ============================================================
//  Экономика: бонусы, производство, вместимость, работники, игровой такт
// ============================================================

Object.assign(Game, {
  /** Чего не хватает для цены: { items: [[ресурс, сколько]], logos } или null. */
  missing(cost, logos = 0) {
    const items = [];
    for (const [k, v] of Object.entries(cost || {})) {
      const d = Math.ceil(v - (this.state.res[k] || 0));
      if (d > 0) items.push([k, d]);
    }
    const l = logos > this.state.logos ? Math.ceil(logos - this.state.logos) : 0;
    return items.length || l ? { items, logos: l } : null;
  },
  /** Почему нельзя заплатить: причина-код (см. content/ru/messages.js) или null. */
  lackReason(cost, logos = 0) {
    const cap = this.storageCap();
    const over = Object.entries(cost || {}).filter(([, v]) => v > cap).map(([k]) => k);
    if (over.length) return { code: 'overStorage', res: over, cap };
    const m = this.missing(cost, logos);
    return m ? { code: 'lack', items: m.items, logos: m.logos } : null;
  },

  /**
   * Сводка бонусов.
   * Постоянные (знания, чудеса) СКЛАДЫВАЮТСЯ: +20% и +30% = +50% — в bonus[ресурс] и bbonus[здание].
   * Благословения обрядов тоже СКЛАДЫВАЮТСЯ между собой (два ×2 на один ресурс = ×3) — в buff[ресурс] и bbuff[здание]
   * хранится прибавка; на постоянные бонусы они умножаются. withBuffs = false — сводка без благословений.
   */
  effects(withBuffs = true) {
    const fx = { bonus: {}, bbonus: {}, buff: {}, bbuff: {}, logos: 1, cap: 0, houseCap: 0, storage: 0, storagePct: 0, growth: 1, goats: false, raidShield: false };
    for (const k of RES_KEYS) { fx.bonus[k] = 0; fx.buff[k] = 0; }
    const apply = e => {
      if (!e) return;
      if (e.all) for (const k of RES_KEYS) fx.bonus[k] += e.all;
      if (e.mult) for (const [k, v] of Object.entries(e.mult)) fx.bonus[this.liveKey(k)] += v;   // бонус к ушедшему ресурсу — преемнику
      if (e.bmult) for (const [k, v] of Object.entries(e.bmult)) fx.bbonus[k] = (fx.bbonus[k] || 0) + v;
      for (const k of ['logos', 'cap', 'houseCap', 'storage', 'storagePct', 'growth']) if (e[k]) fx[k] += e[k];
      if (e.goats) fx.goats = true;
      if (e.raidShield) fx.raidShield = true;
    };
    const applyBuff = e => {
      if (!e) return;
      if (e.all) for (const k of RES_KEYS) fx.buff[k] += e.all;
      if (e.mult) for (const [k, v] of Object.entries(e.mult)) fx.buff[this.liveKey(k)] += v;
      if (e.bmult) for (const [k, v] of Object.entries(e.bmult)) fx.bbuff[k] = (fx.bbuff[k] || 0) + v;
      if (e.logos) fx.logos += e.logos;
      if (e.growth) fx.growth += e.growth;
      if (e.workers) fx.workers = (fx.workers || 0) + e.workers;
    };
    for (const id of this.state.techs) apply(TECH_BY_ID[id] && TECH_BY_ID[id].effect);
    for (const b of this.state.buildings) {
      const B = BUILDINGS[b.type];
      if (B.special && !this.retired(b.type)) apply(B.effect);   // чудо прошлой эпохи бонуса не даёт
      if (B.logosBonus) fx.logos += B.logosBonus + (B.logosBonusPerLevel || 0) * (b.level - 1);
    }
    if (withBuffs) for (const [id, left] of Object.entries(this.state.buffs || {})) if (left > 0 && RITUAL_BY_ID[id]) applyBuff(RITUAL_BY_ID[id].buff);
    return fx;
  },
  /** Итоговый множитель здания по ресурсу: (1 + сумма постоянных бонусов) × (1 + сумма благословений). */
  bonusMult(type, k, fx = this.fx || this.effects()) {
    return (1 + fx.bonus[k] + (fx.bbonus[type] || 0)) * (1 + fx.buff[k] + (fx.bbuff[type] || 0));
  },
  logosMult() { return this.effects().logos; },

  /** Множитель выпуска на уровне L: ×1.15 за уровень труда, ×1.25 / ×1.4 за уровни мудрости (BALANCE.wisdomLevels). */
  levelMult(L) {
    let m = 1;
    for (let l = 2; l <= L; l++) m *= (BALANCE.wisdomLevels[l] || {}).growth || BALANCE.levelGrowth;
    return m;
  },
  /** Во сколько раз растёт выпуск при переходе на уровень L. */
  levelStep(L) { return (BALANCE.wisdomLevels[L] || {}).growth || BALANCE.levelGrowth; },
  workersOf(b) {
    const B = BUILDINGS[b.type];
    if (!B.workers || this.obsoleteType(b.type)) return 0;   // устаревшее здание стоит — работники свободны
    return B.workers + Math.floor((b.level - 1) / 2);
  },
  /** Производство здания в секунду при полной занятости. */
  prodOf(b, fx = this.fx || this.effects(), level = b.level) {
    const B = BUILDINGS[b.type], out = {};
    if (!B.prod) return out;
    const lm = this.levelMult(level);
    for (const [k0, v0] of Object.entries(B.prod)) {
      if (B.prodTech && B.prodTech[k0] && !this.hasTech(B.prodTech[k0])) continue;
      let k = k0, v = v0;
      const r = this.retiredRes(k0);
      if (r) { if (v0 < 0 || !r.prodToo) continue; k = r.into; v = v0 * r.rate; }   // ушедший ресурс: либо не делается, либо делается новый
      out[k] = (out[k] || 0) + (v > 0 ? v * lm * this.bonusMult(b.type, k, fx) : v * lm);
    }
    // переработчик, у которого не осталось выхода (литейня без бронзы), стоит и сырьё не тратит
    if (!Object.values(out).some(v => v > 0)) return {};
    return out;
  },
  houseCapOf(b, fx = this.fx || this.effects(), level = b.level) {
    const B = BUILDINGS[b.type];
    if (!B.cap) return 0;
    return Math.round(B.cap * this.levelMult(level)) + (this.form(b.type).capBonus || 0) + fx.houseCap;
  },
  /** Рост вместимости склада по уровням: как выпуск, но на 10-м и 11-м резче (BALANCE.storeGrowth). */
  storeMult(L) {
    let m = 1;
    for (let l = 2; l <= L; l++) m *= BALANCE.storeGrowth[l] || (BALANCE.wisdomLevels[l] || {}).growth || BALANCE.levelGrowth;
    return m;
  },
  storageOf(b, level = b.level) { return BUILDINGS[b.type].storage ? Math.round(BUILDINGS[b.type].storage * this.storeMult(level)) : 0; },
  storageCap(fx = this.fx || this.effects()) {
    let cap = BALANCE.baseStorage + fx.storage;
    for (const b of this.state.buildings) cap += this.storageOf(b);
    return Math.floor(cap * (1 + fx.storagePct));
  },
  popCap(fx = this.fx || this.effects()) {
    let cap = BALANCE.baseCap + fx.cap;
    for (const b of this.state.buildings) cap += this.houseCapOf(b, fx);
    return cap;
  },
  // ---------- сводки для интерфейсов ----------
  /** Показывать ли ресурс: он уже есть, или его эпоха наступила и нужное знание изучено. */
  resVisible(k) {
    const s = this.state, R = RES[k];
    if (this.retiredRes(k)) return false;   // ушедший ресурс пропадает из шапки
    if (s.res[k] >= 1) return true;
    if (R.epoch > s.epoch) return false;
    return !R.tech || this.hasTech(R.tech);
  },
  /** Какие ресурсы сейчас усилены благословениями. */
  buffedRes() {
    const out = new Set();
    for (const id of Object.keys(this.state.buffs || {})) {
      const b = (RITUAL_BY_ID[id] || {}).buff || {};
      if (b.all) RES_KEYS.forEach(k => out.add(k));
      Object.keys(b.mult || {}).forEach(k => out.add(this.liveKey(k)));
      for (const t of Object.keys(b.bmult || {})) Object.entries(BUILDINGS[t].prod || {}).forEach(([k, v]) => v > 0 && out.add(k));
    }
    return out;
  },
  /** Работники: сколько нужно, сколько рук, хватает ли и на сколько работают зерно и остальное. */
  labor() {
    return { need: this.need, hands: Math.floor(this.hands), short: this.eff < 0.999, effFood: this.effFood, effOther: this.effOther };
  },

  /** Зерно в приоритете: поля и загоны получают руки первыми. */
  foodFirst(b) { const P = BUILDINGS[b.type].prod || {}; return P.food > 0 && !Object.values(P).some(v => v < 0); },
  workersNeeded() {
    let n = 0;
    for (const b of this.state.buildings) n += this.workersOf(b);
    return n;
  },

  // ---------- выпуск ----------
  /**
   * Выпуск в секунду при данных бонусах и руках. mark — отметить здания (простой, отдых): это делает только такт.
   * Рук не хватает — сначала поля и загоны (зерно), остальные здания делят то, что осталось.
   * log — массив, куда записать вклад каждого здания (для справки «Доход по ресурсам»).
   */
  production(fx, hands, dt = 1, mark = false, log = null) {
    const s = this.state;
    let needFood = 0, needOther = 0;
    for (const b of s.buildings) { const w = this.workersOf(b); if (this.foodFirst(b)) needFood += w; else needOther += w; }
    const need = needFood + needOther;
    const eff = need > 0 ? Math.min(1, hands / need) : 1;
    const effFood = needFood > 0 ? Math.min(1, hands / needFood) : 1;
    const effOther = needOther > 0 ? Math.min(1, Math.max(0, hands - needFood) / needOther) : 1;
    const storage = this.storageCap(fx);
    const rates = {};
    for (const k of RES_KEYS) rates[k] = 0;

    for (const b of s.buildings) {
      const p = this.prodOf(b, fx);
      // здания-переработчики (гавань, литейня…) не тратят сырьё на то, что некуда положить:
      // все выходы полны — отдыхают, часть полна — сырья уходит пропорционально меньше
      const outs = Object.keys(p).filter(k => p[k] > 0), ins = Object.keys(p).filter(k => p[k] < 0);
      let share = 1;
      if (ins.length && outs.length) share = outs.filter(k => s.res[k] < storage - 0.01).length / outs.length;
      if (mark) b.rest = ins.length && share < 1 ? (share === 0 ? 'full' : 'part') : null;
      if (share === 0) { if (mark) b.idle = false; if (log) log.push({ b, skip: 'full' }); continue; }
      const e = this.foodFirst(b) ? effFood : effOther;
      let ok = true;
      for (const k of ins) if (s.res[k] < -p[k] * share * e * dt) ok = false;
      if (mark) b.idle = !ok;
      if (!ok) { if (log) log.push({ b, skip: 'idle' }); continue; }
      for (const [k, v] of Object.entries(p)) {
        const x = v * e * (v < 0 ? share : 1);
        rates[k] += x;
        if (log) log.push({ b, k, v: x, e, share: v < 0 ? share : 1 });
      }
    }
    rates.food -= s.pop * BALANCE.foodPerPop;
    return { rates, need, eff, effFood, effOther, storage };
  },
  /** Источники бонусов — то же, что складывает effects(): [{ kind: 'tech'|'wonder'|'rite', id, effect, left }]. */
  bonusSources() {
    const s = this.state, out = [];
    for (const id of s.techs) { const e = TECH_BY_ID[id] && TECH_BY_ID[id].effect; if (e) out.push({ kind: 'tech', id, effect: e }); }
    for (const b of s.buildings) { const B = BUILDINGS[b.type]; if (B.special && B.effect && !this.retired(b.type)) out.push({ kind: 'wonder', id: b.type, effect: B.effect }); }
    for (const [id, left] of Object.entries(s.buffs || {})) if (left > 0 && RITUAL_BY_ID[id] && RITUAL_BY_ID[id].buff) out.push({ kind: 'rite', id, effect: RITUAL_BY_ID[id].buff, left });
    return out;
  },
  /** Из чего складывается множитель здания type по ресурсу k: { perm: [{kind,id,v}], buff: [{kind,id,v}] }. */
  bonusParts(type, k) {
    const out = { perm: [], buff: [] };
    for (const src of this.bonusSources()) {
      const e = src.effect, v = (e.all || 0) + ((e.mult || {})[k] || 0) + ((e.bmult || {})[type] || 0);
      if (v) out[src.kind === 'rite' ? 'buff' : 'perm'].push({ kind: src.kind, id: src.id, v, left: src.left });
    }
    return out;
  },
  /**
   * Разбор дохода для справки: строки по (ресурс, тип здания, уровень) и расход на жителей. Ничего не меняет;
   * сумма строк по ресурсу равна доходу в секунду (тот же расчёт, что в такте).
   */
  incomeBreakdown() {
    const s = this.state, fx = this.effects();
    const hands = s.pop * (1 + (fx.workers || 0)), log = [];
    const P = this.production(fx, hands, 0.001, false, log);
    const res = {};
    for (const k of RES_KEYS) res[k] = { total: P.rates[k], rows: [], skipped: [] };
    const rows = {};
    for (const x of log) {
      const t = x.b.type, L = x.b.level;
      if (x.skip) {
        for (const k of Object.keys(BUILDINGS[t].prod || {})) {
          const key = k + '|' + t + '|' + L + '|' + x.skip;
          (rows[key] = rows[key] || { k, type: t, level: L, skip: x.skip, n: 0 }).n++;
        }
        continue;
      }
      const key = x.k + '|' + t + '|' + L + '|' + x.e + '|' + x.share;
      const r = rows[key] = rows[key] || { k: x.k, type: t, level: L, n: 0, perOne: x.v, total: 0, base: BUILDINGS[t].prod[x.k], lm: this.levelMult(L), eff: x.e, share: x.share };
      r.n++; r.total += x.v;
    }
    for (const r of Object.values(rows)) {
      if (r.skip) { res[r.k].skipped.push(r); continue; }
      if (r.base > 0) {
        r.perm = 1 + fx.bonus[r.k] + (fx.bbonus[r.type] || 0);
        r.buff = 1 + fx.buff[r.k] + (fx.bbuff[r.type] || 0);
      }
      res[r.k].rows.push(r);
    }
    for (const k of RES_KEYS) res[k].rows.sort((a, b) => b.total - a.total);
    res.food.eaten = { pop: s.pop, per: BALANCE.foodPerPop, total: -s.pop * BALANCE.foodPerPop };
    const plain = this.plainRates();
    return { res, hands: Math.floor(hands), need: P.need, effFood: P.effFood, effOther: P.effOther, storage: P.storage,
      supplies: Object.fromEntries(RES_KEYS.map(k => [k, Math.max(0, plain[k] || 0) * BALANCE.suppliesSec])) };
  },
  /** Множитель Логоса за карточки и из чего он сложен: { total, parts: [{ kind: 'tech'|'wonder'|'building'|'rite', id, v, level, left }] }. */
  logosBreakdown() {
    const s = this.state, parts = [];
    for (const src of this.bonusSources()) if (src.effect.logos) parts.push({ kind: src.kind, id: src.id, v: src.effect.logos, left: src.left });
    for (const b of s.buildings) {
      const B = BUILDINGS[b.type];
      if (B.logosBonus) parts.push({ kind: 'building', id: b.type, level: b.level, v: B.logosBonus + (B.logosBonusPerLevel || 0) * (b.level - 1) });
    }
    return { total: this.effects().logos, parts };
  },
  /** Вместимость складов и из чего она сложена: база + здания + прибавки, × (1 + проценты). */
  storageBreakdown() {
    const fx = this.effects(), rows = {}, flat = [], pct = [];
    for (const b of this.state.buildings) {
      const v = this.storageOf(b);
      if (v) (rows[b.type + ':' + b.level] = rows[b.type + ':' + b.level] || { type: b.type, level: b.level, n: 0, each: v }).n++;
    }
    for (const src of this.bonusSources()) {
      if (src.kind === 'rite') continue;
      if (src.effect.storage) flat.push({ kind: src.kind, id: src.id, v: src.effect.storage });
      if (src.effect.storagePct) pct.push({ kind: src.kind, id: src.id, v: src.effect.storagePct });
    }
    const list = Object.values(rows).sort((a, b) => b.level - a.level);
    const sum = BALANCE.baseStorage + list.reduce((a, r) => a + r.each * r.n, 0) + fx.storage;
    return { base: BALANCE.baseStorage, rows: list, flat, pct, sum, mult: 1 + fx.storagePct, total: this.storageCap(fx) };
  },
  /** Выпуск без благословений (и без «Всей семьёй») — для «Сбора припасов». */
  plainRates() { return this.production(this.effects(false), this.state.pop, 0.001).rates; },

  /** Идёт время: благословения и перерывы обрядов истекают (без выпуска). */
  passTime(dt) {
    const s = this.state;
    if (dt <= 0) return;
    for (const id of Object.keys(s.buffs)) { s.buffs[id] -= dt; if (s.buffs[id] <= 0) delete s.buffs[id]; }
    for (const id of Object.keys(s.cooldowns || {})) { s.cooldowns[id] -= dt; if (s.cooldowns[id] <= 0) delete s.cooldowns[id]; }
  },

  // ---------- игровой такт ----------
  tick(dt) {
    const s = this.state;
    const fx = this.fx = this.effects();
    const cap = this.popCap(fx);
    const hands = s.pop * (1 + (fx.workers || 0));   // «Всей семьёй» удваивает рабочие руки
    const { rates, need, eff, effFood, effOther, storage } = this.production(fx, hands, dt, true);

    for (const k of RES_KEYS) s.res[k] = Math.min(storage, Math.max(0, s.res[k] + rates[k] * dt));

    // население
    const growthTime = BALANCE.growthTime / fx.growth;
    if (s.res.food > 5 && s.pop < cap) {
      s.popAcc += dt;
      while (s.popAcc >= growthTime && s.pop < cap) { s.popAcc -= growthTime; s.pop++; }
    } else s.popAcc = 0;
    if (s.pop > cap) s.pop = cap;
    if (s.res.food <= 0 && rates.food < 0) {
      s.starveAcc += dt;
      if (s.starveAcc >= 8 && s.pop > 1) { s.starveAcc = 0; s.pop--; this.log('starve'); }
    } else s.starveAcc = 0;

    this.passTime(dt);

    this.rates = rates; this.eff = eff; this.effFood = effFood; this.effOther = effOther; this.hands = hands;
    this.cap = cap; this.need = need; this.storage = storage;
  },
});
