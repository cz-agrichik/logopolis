'use strict';
// ============================================================
//  Стройка: цены, постройка, улучшение, склад чудес, снос
// ============================================================

Object.assign(Game, {
  // ---------- стоимость ----------
  buildCost(type) {
    const B = BUILDINGS[type];
    const own = this.state.buildings.filter(b => b.type === type && !b.from).length;   // бывшие чудеса — подарок, цену не поднимают
    const mult = B.special ? 1 : Math.pow(BALANCE.buildCostGrowth, own);
    const cost = {};
    for (const [k, v] of Object.entries(B.cost || {})) cost[k] = Math.ceil(v * mult);
    return this.liveCost(cost);
  },
  canAfford(cost, logos = 0) {
    for (const [k, v] of Object.entries(cost)) if ((this.state.res[k] || 0) < v) return false;
    return this.state.logos >= logos;
  },
  overStorage(cost) {
    const cap = this.storageCap();
    return Object.values(cost).some(v => v > cap);
  },
  pay(cost, logos = 0) {
    for (const [k, v] of Object.entries(cost)) this.state.res[k] -= v;
    this.state.logos -= logos;
  },

  /** Цена «трудом» — без λ, но с горой обычных ресурсов. */
  laborCost(cost, logos, epoch, mult) {
    const out = {};
    for (const [k, v] of Object.entries(cost || {})) out[k] = v * mult;
    const extra = logos * BALANCE.laborPerLogos;
    // без меди: путь трудом должен быть доступен и до первого рудника
    const split = epoch >= 1 ? { stone: 0.4, wood: 0.4, goods: 0.2 } : { wood: 0.5, stone: 0.5 };
    for (const [k, f] of Object.entries(split)) out[k] = (out[k] || 0) + extra * f;
    for (const k of Object.keys(out)) out[k] = Math.ceil(out[k] / 10) * 10;
    return out;
  },
  /** Цена постройки: mode 'logos' (обычный путь) или 'labor' (больше не используется). */
  priceOf(type, mode = 'logos') {
    const B = BUILDINGS[type];
    return { cost: this.buildCost(type), logos: B.logos || 0 };
  },

  /** Можно ли сейчас строить этот тип (без учёта клетки). */
  buildStatus(type, mode = 'logos') {
    const B = BUILDINGS[type], s = this.state;
    if (s.epoch < B.epoch) return { ok: false, hidden: true };
    if (this.obsoleteType(type)) return { ok: false, hidden: true };   // устарело: новые такие не строят
    if (B.tech && !this.hasTech(B.tech)) return { ok: false, locked: true, reason: { code: 'needTech', tech: B.tech } };
    if (B.special && this.retired(type)) {   // чудо прошлой эпохи: строить нельзя; со склада ставится уже обычным зданием
      return this.stashed(type) ? { ok: true, stashed: true, into: B.retire.into, level: B.retire.level, cost: {}, logos: 0 } : { ok: false, hidden: true };
    }
    if (B.special && this.stashed(type)) return { ok: true, stashed: true, cost: {}, logos: 0 };
    if (B.special && this.built(type)) return { ok: false, done: true, reason: { code: 'builtAlready' } };
    const { cost, logos } = this.priceOf(type, mode);
    if (B.max && this.count(type) >= B.max) return { ok: false, cost, logos, reason: { code: 'maxCount', max: B.max } };
    const reason = this.lackReason(cost, logos);
    if (reason) return { ok: false, cost, logos, poor: true, reason };
    return { ok: true, cost, logos };
  },

  canPlaceOn(type, tile) {
    const B = BUILDINGS[type];
    if (!tile || tile.t === 'sea') return false;
    if (this.buildingAt(tile.x, tile.y)) return false;
    if (!B.terrain.includes(tile.t)) return false;
    if (B.coast && !tile.coast) return false;
    if (this.goat && this.goat.x === tile.x && this.goat.y === tile.y) return false;
    return true;
  },

  build(type, x, y, mode = 'logos') {
    const st = this.buildStatus(type, mode);
    const tile = this.tile(x, y);
    if (!st.ok || !this.canPlaceOn(type, tile)) return false;
    const s = this.state;
    if (st.stashed) {   // чудо со склада — бесплатно (чудо прошлой эпохи встаёт уже обычным зданием)
      s.stash = s.stash.filter(t => t !== type);
      s.buildings.push(st.into ? { id: s.nextId++, type: st.into, level: st.level, x, y, from: type } : { id: s.nextId++, type, level: 1, x, y });
      this.log('stashBack', { type });
      this.save();
      return true;
    }
    this.pay(st.cost, st.logos);
    s.buildings.push({ id: s.nextId++, type, level: 1, x, y });
    this.log(BUILDINGS[type].special ? 'wonderBuilt' : 'built', { type, epoch: s.epoch });
    this.save();
    return true;
  },

  /** Цена улучшения ДО уровня target (без проверок). */
  upgradeCost(type, target) {
    const B = BUILDINGS[type];
    if (this.needsLogos(target)) return { cost: {}, logos: this.upgradeLogos(type, target) };   // λ-уровень: только λ
    const k = BALANCE.upCostBase * Math.pow(BALANCE.upCostGrowth, target - 2);   // ×1.5 за каждый уровень
    const cost = {};
    for (const [r, v] of Object.entries(B.cost)) cost[r] = Math.ceil(v * k);
    if (target >= BALANCE.copperFromLevel) cost.copper = (cost.copper || 0) + Math.ceil(15 * Math.pow(BALANCE.upCostGrowth, target - BALANCE.copperFromLevel));
    if (target >= BALANCE.bronzeFromLevel && target < BALANCE.ironFromLevel) cost.bronze = (cost.bronze || 0) + Math.ceil(8 * Math.pow(BALANCE.upCostGrowth, target - BALANCE.bronzeFromLevel));
    if (target >= BALANCE.ironFromLevel) cost.iron = (cost.iron || 0) + Math.ceil(30 * Math.pow(BALANCE.upCostGrowth, target - BALANCE.ironFromLevel));
    return { cost: this.liveCost(cost), logos: this.upgradeLogos(type, target) };
  },
  /** λ нужен только на «уровнях за Логос»: 3, 5, 7, 9, 11. */
  needsLogos(target) { return !!BALANCE.wisdomLevels[target]; },
  /** Символический уровень мудрости (3-й, 7-й) — одна маленькая цена для всех. */
  symbolicLevel(target) { const w = BALANCE.wisdomLevels[target]; return !!(w && w.logos); },
  upgradeLogos(type, target) {
    const w = BALANCE.wisdomLevels[target];
    if (!w) return 0;
    return w.logos || Math.ceil((BUILDINGS[type].lp || 12) * w.lp);
  },

  /** Сведения об улучшении до следующего уровня: цена, хватает ли, причина «нельзя» (кодом). */
  upgradeInfo(b) {
    const B = BUILDINGS[b.type];
    if (B.special) return null;
    const target = b.level + 1, maxL = this.maxLevel();
    if (target > maxL) {
      const nextE = EPOCHS.findIndex(e => e.maxLevel > maxL);
      return { capped: true, target, reason: { code: 'levelCap', max: maxL, next: nextE > 0 ? nextE : null, nextMax: nextE > 0 ? EPOCHS[nextE].maxLevel : null } };
    }
    const { cost, logos } = this.upgradeCost(b.type, target);
    const reason = this.lackReason(cost, logos);
    return { target, cost, logos, ok: !reason, reason };
  },

  upgrade(b) {
    const up = this.upgradeInfo(b);
    if (!up || !up.ok) return false;
    this.pay(up.cost, up.logos);
    b.level++;
    this.log('upgraded', { type: b.type, epoch: this.state.epoch, level: b.level });
    this.save();
    return true;
  },

  /** Убрать чудо на склад (например, чтобы переставить). */
  stashWonder(b) {
    if (!BUILDINGS[b.type].special) return false;
    const s = this.state;
    s.buildings = s.buildings.filter(x => x !== b);
    s.stash.push(b.type);
    this.log('stashed', { type: b.type });
    this.save();
    return true;
  },

  demolish(b) {
    if (BUILDINGS[b.type].special) return false;
    this.state.buildings = this.state.buildings.filter(x => x !== b);
    this.log('demolished', { type: b.type, epoch: this.state.epoch });
    this.save();
    return true;
  },
});
