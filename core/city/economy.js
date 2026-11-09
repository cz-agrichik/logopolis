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
      if (e.mult) for (const [k, v] of Object.entries(e.mult)) fx.bonus[k] += v;
      if (e.bmult) for (const [k, v] of Object.entries(e.bmult)) fx.bbonus[k] = (fx.bbonus[k] || 0) + v;
      for (const k of ['logos', 'cap', 'houseCap', 'storage', 'storagePct', 'growth']) if (e[k]) fx[k] += e[k];
      if (e.goats) fx.goats = true;
      if (e.raidShield) fx.raidShield = true;
    };
    const applyBuff = e => {
      if (!e) return;
      if (e.all) for (const k of RES_KEYS) fx.buff[k] += e.all;
      if (e.mult) for (const [k, v] of Object.entries(e.mult)) fx.buff[k] += v;
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
    return B.workers ? B.workers + Math.floor((b.level - 1) / 2) : 0;
  },
  /** Производство здания в секунду при полной занятости. */
  prodOf(b, fx = this.fx || this.effects(), level = b.level) {
    const B = BUILDINGS[b.type], out = {};
    if (!B.prod) return out;
    const lm = this.levelMult(level);
    for (const [k, v] of Object.entries(B.prod)) {
      if (B.prodTech && B.prodTech[k] && !this.hasTech(B.prodTech[k])) continue;
      out[k] = v > 0 ? v * lm * this.bonusMult(b.type, k, fx) : v * lm;
    }
    return out;
  },
  houseCapOf(b, fx = this.fx || this.effects(), level = b.level) {
    const B = BUILDINGS[b.type];
    if (!B.cap) return 0;
    return Math.round(B.cap * this.levelMult(level)) + (this.form(b.type).capBonus || 0) + fx.houseCap;
  },
  storageOf(b, level = b.level) { return BUILDINGS[b.type].storage ? Math.round(BUILDINGS[b.type].storage * this.levelMult(level)) : 0; },
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
      Object.keys(b.mult || {}).forEach(k => out.add(k));
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
   */
  production(fx, hands, dt = 1, mark = false) {
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
      if (share === 0) { if (mark) b.idle = false; continue; }
      const e = this.foodFirst(b) ? effFood : effOther;
      let ok = true;
      for (const k of ins) if (s.res[k] < -p[k] * share * e * dt) ok = false;
      if (mark) b.idle = !ok;
      if (!ok) continue;
      for (const [k, v] of Object.entries(p)) rates[k] += v * e * (v < 0 ? share : 1);
    }
    rates.food -= s.pop * BALANCE.foodPerPop;
    return { rates, need, eff, effFood, effOther, storage };
  },
  /** Выпуск без благословений (и без «Всей семьёй») — для «Сбора припасов». */
  plainRates() { return this.production(this.effects(false), this.state.pop, 0.001).rates; },

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

    for (const id of Object.keys(s.buffs)) { s.buffs[id] -= dt; if (s.buffs[id] <= 0) delete s.buffs[id]; }
    for (const id of Object.keys(s.cooldowns || {})) { s.cooldowns[id] -= dt; if (s.cooldowns[id] <= 0) delete s.cooldowns[id]; }

    this.rates = rates; this.eff = eff; this.effFood = effFood; this.effOther = effOther; this.hands = hands;
    this.cap = cap; this.need = need; this.storage = storage;
  },
});
