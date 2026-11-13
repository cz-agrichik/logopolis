'use strict';
// ============================================================
//  Справочные расчёты для Кипропедии и подсказок: «где добыть» и «на что идёт»,
//  таблица уровней здания, что устаревает и во что, разброс цен.
//  Только числа и id — тексты из них собирает content/ru/pedia.js.
//  Всё считается «сейчас»: по текущей эпохе и изученным знаниям (ушедший ресурс — уже преемником).
// ============================================================

Object.assign(Game, {
  /** Самый высокий уровень зданий во всех открытых эпохах. */
  topLevel() { return Math.max(...EPOCHS.map(E => E.maxLevel || 0)); },

  /** Выпуск здания на 1-м уровне «сейчас»: ушедший ресурс заменён преемником (товары → серебро);
   *  знания-условия (prodTech) не учитываются — справка показывает, что здание умеет. */
  refProd(type) {
    const out = {};
    for (const [k0, v0] of Object.entries(BUILDINGS[type].prod || {})) {
      const r = this.retiredRes(k0);
      if (!r) out[k0] = (out[k0] || 0) + v0;
      else if (v0 > 0 && r.prodToo) out[r.into] = (out[r.into] || 0) + Math.round(v0 * r.rate * 1000) / 1000;
    }
    return out;
  },

  /** Устаревает ли тип здания: { tech, into: [типы] } — после какого знания и во что перестраивается; иначе null. */
  obsoleteAfter(type) {
    const T = TECHS.find(t => t.retire && t.retire.buildings && t.retire.buildings[type]);
    if (!T) return null;
    const into = T.retire.buildings[type];
    return { tech: T.id, into: typeof into === 'string' ? [into] : Object.values(into) };
  },

  /** Уходит ли ресурс: { tech, into, rate, stock, prodToo, done } — после какого знания, во что и по какому курсу; иначе null. */
  resourceGone(k) {
    const T = TECHS.find(t => t.retire && t.retire.res && t.retire.res[k]);
    if (!T) return null;
    const r = T.retire.res[k];
    return { tech: T.id, into: r.into, rate: r.rate, stock: r.stock, prodToo: !!r.prodToo, done: this.hasTech(T.id) };
  },

  /**
   * Откуда берётся и на что идёт ресурс k «сейчас».
   *   from: [{ type, via: 'prod' | 'trade', tech }] — здания (trade — торговая линия после знания tech);
   *   to:   [{ kind: 'building', type, via: 'input' | 'trade' | 'cost', tech } | { kind: 'tech', id } | { kind: 'epoch', epoch }];
   *   gather — местность, где ресурс собирают кликом; goats / maenads — приносят ли его беглые козы / вакханки; gone — resourceGone(k).
   * Устаревшие здания, чудеса прошлых эпох, знания и переходы прошлых эпох не в счёт: их уже не построить и не изучить.
   */
  resourceUses(k) {
    const ep = this.state.epoch, from = [], to = [];
    for (const [type, B] of Object.entries(BUILDINGS)) {
      const old = !B.special && this.obsoleteType(type);
      const P = old || B.special ? {} : this.refProd(type), cost = this.liveCost(B.cost);
      if (P[k] > 0) from.push({ type, via: 'prod' });
      if (P[k] < 0) to.push({ kind: 'building', type, via: 'input' });
      if (B.trade && !old && B.trade.in[k]) to.push({ kind: 'building', type, via: 'trade', tech: B.trade.tech });
      if (B.trade && !old && B.trade.out[k]) from.push({ type, via: 'trade', tech: B.trade.tech });
      if (cost[k] && !old && !(B.special && B.epoch < ep)) to.push({ kind: 'building', type, via: 'cost' });
    }
    for (const t of TECHS) if (this.liveCost(t.cost)[k] && t.epoch >= ep) to.push({ kind: 'tech', id: t.id });
    EPOCHS.forEach((E, i) => { if (E.advance && i >= ep && this.liveCost(E.advance.res)[k]) to.push({ kind: 'epoch', epoch: i }); });
    const gone = this.resourceGone(k);
    return {
      from, to, gone,
      gather: Object.keys(TERRAIN).filter(t => TERRAIN[t].gather === k),
      goats: ['food', 'wood', 'stone', 'cheese', 'goods'].includes(k) && !this.retiredRes(k),
      maenads: k === 'amphora',
    };
  },

  /**
   * Таблица уровней здания без бонусов, до самого высокого уровня открытых эпох.
   * kind — что растёт: 'prod' (выпуск ресурса res), 'cap' (места), 'storage' (склад), 'logos' (бонус писцов, в процентах).
   * rows: [{ level, value, step, workers, cost, logos }]; step — множитель к прошлому уровню (у 'logos' — прибавка в процентных пунктах),
   * workers — null, если зданию работники не нужны; на 1-м уровне cost — цена постройки, step — null.
   */
  levelTable(type) {
    const B = BUILDINGS[type];
    const P = Object.values(this.refProd(type)).some(v => v > 0) ? this.refProd(type) : (B.prod || {});   // устаревшее — по старому выпуску
    let kind, res = null, value, step = L => this.levelStep(L);
    if (B.prod) { kind = 'prod'; res = Object.keys(P).find(r => P[r] > 0); value = L => P[res] * this.levelMult(L); }
    else if (B.cap) { kind = 'cap'; value = L => Math.round(B.cap * this.levelMult(L)); }
    else if (B.storage) { kind = 'storage'; value = L => Math.round(B.storage * this.storeMult(L)); step = L => this.storeMult(L) / this.storeMult(L - 1); }
    else if (B.logosBonus) { kind = 'logos'; value = L => Math.round((B.logosBonus + B.logosBonusPerLevel * (L - 1)) * 100); step = () => Math.round(B.logosBonusPerLevel * 100); }
    const rows = [];
    for (let L = 1; L <= this.topLevel(); L++) {
      const up = L > 1 ? this.upgradeCost(type, L) : { cost: this.liveCost(B.cost), logos: 0 };
      rows.push({ level: L, value: value ? value(L) : null, step: L > 1 ? step(L) : null,
        workers: B.workers ? B.workers + Math.floor((L - 1) / 2) : null, cost: up.cost, logos: up.logos });
    }
    return { kind, res, prod: B.prod ? P : null, rows };
  },

  /** λ-цены знаний ('techs') или чудес ('wonders') до текущей эпохи включительно — для разброса в справке. */
  logosPrices(kind) {
    const ep = this.state.epoch;
    return kind === 'techs' ? TECHS.filter(t => t.epoch <= ep).map(t => t.logos)
      : Object.values(BUILDINGS).filter(B => B.special && B.logos && B.epoch <= ep).map(B => B.logos);
  },
  /** Благословения за λ до текущей эпохи: { logos: [цены в λ «сейчас»], minutes: [длительности] }. */
  blessingRanges() {
    const list = RITUALS.filter(R => R.buff && R.logos && R.epoch <= this.state.epoch);
    return { logos: list.map(R => this.ritualLogos(R)), minutes: list.map(R => R.dur / 60) };
  },
  /** «Золотые часы» святилищ, которые сейчас в ходу (сменённые новыми не в счёт). */
  goldenRites() { return RITUALS.filter(R => R.buff && R.buff.logos && R.epoch <= this.state.epoch && !this.ritualStatus(R).hidden); },
  /** Обряд уходит со временем: { wonder } — когда святилище улучшат до этого чуда, { tech } — после знания; иначе null. */
  riteLeaves(R) { return R.until ? { wonder: R.until } : R.untilTech ? { tech: R.untilTech } : null; },

  /** Что даёт знание: { opens: [здания и чудеса с этим tech], leadsTo: [знания, которые его требуют] }. */
  techLinks(id) {
    return {
      opens: Object.keys(BUILDINGS).filter(t => BUILDINGS[t].tech === id),
      leadsTo: TECHS.filter(t => (t.req || []).includes(id)).map(t => t.id),
    };
  },
  /** Чудеса, нужные для переходов эпох: [типы] по порядку эпох. */
  advanceWonders() { return EPOCHS.filter(E => E.advance).flatMap(E => E.advance.specials); },
});
