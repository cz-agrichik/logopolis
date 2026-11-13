'use strict';
// ============================================================
//  Перемены эпохи: уходящие ресурсы и устаревшие здания.
//  Знание с retire: { res: { старый: { into, rate, prodToo } }, buildings: { старое: новое | { местность: новое } } }
//  — запасы старого ресурса переходят в новый, цены со старым ресурсом пересчитываются в новый,
//  здания, которые делали старый ресурс, устаревают: их можно перестроить (уровень сохраняется) или продать.
// ============================================================

Object.assign(Game, {
  /** Ушёл ли ресурс k и во что: { into, rate, prodToo } или null. Следует цепочке (бронза → железо → …). */
  retiredRes(k) {
    for (const id of this.state.techs) {
      const r = TECH_BY_ID[id] && TECH_BY_ID[id].retire && TECH_BY_ID[id].retire.res;
      if (r && r[k]) return r[k];
    }
    return null;
  },
  /** Ресурс-преемник: во что превратился k (или сам k). Бонусы к ушедшему ресурсу переходят на преемника. */
  liveKey(k) {
    let r, guard = 0;
    while ((r = this.retiredRes(k)) && guard++ < 5) k = r.into;
    return k;
  },
  /** Цена «по-новому»: уходящие ресурсы заменены преемниками по курсу. */
  liveCost(cost) {
    const out = {};
    for (const [k0, v0] of Object.entries(cost || {})) {
      let k = k0, v = v0, r, guard = 0;
      while ((r = this.retiredRes(k)) && guard++ < 5) { v *= r.rate; k = r.into; }
      out[k] = (out[k] || 0) + Math.ceil(v);
    }
    return out;
  },
  /** Во что превращается устаревшее здание этого типа на этой клетке, или null. */
  successorOf(type, tile) {
    for (const id of this.state.techs) {
      const m = TECH_BY_ID[id] && TECH_BY_ID[id].retire && TECH_BY_ID[id].retire.buildings;
      if (!m || !m[type]) continue;
      const into = m[type];
      return typeof into === 'string' ? into : (tile && into[tile.t]) || Object.values(into)[0];
    }
    return null;
  },
  /** Тип здания устарел: новые такие не строятся. */
  obsoleteType(type) { return !!this.successorOf(type, null); },

  /** Перестроить устаревшее здание в новое того же уровня: цена — постройка нового (без наценки за количество). */
  rebuildInfo(b) {
    const into = this.successorOf(b.type, this.tile(b.x, b.y));
    if (!into) return null;
    const cost = this.liveCost(BUILDINGS[into].cost);
    const reason = this.lackReason(cost, 0);
    return { into, level: b.level, cost, ok: !reason, reason };
  },
  rebuild(b) {
    const r = this.rebuildInfo(b);
    if (!r || !r.ok) return false;
    this.pay(r.cost);
    const from = b.type;
    b.type = r.into; b.idle = false; b.rest = null;
    this.log('rebuilt', { from, into: r.into, level: b.level, epoch: this.state.epoch });
    this.fx = this.effects();
    this.save();
    return true;
  },
  /** Продать устаревшее здание: вернуть весь λ его уровней за Логос и половину цены постройки. */
  sellInfo(b) {
    if (!this.successorOf(b.type, this.tile(b.x, b.y))) return null;
    let logos = 0;
    for (let L = 2; L <= b.level; L++) logos += this.upgradeLogos(b.type, L);
    const cost = {};
    for (const [k, v] of Object.entries(this.liveCost(BUILDINGS[b.type].cost))) cost[k] = Math.floor(v / 2);
    return { logos, res: cost };
  },
  sell(b) {
    const r = this.sellInfo(b);
    if (!r) return false;
    const s = this.state, cap = this.storageCap();
    s.buildings = s.buildings.filter(x => x !== b);
    s.logos += r.logos;
    for (const [k, v] of Object.entries(r.res)) s.res[k] = Math.min(cap, s.res[k] + v);
    this.log('sold', { type: b.type, level: b.level, logos: r.logos, epoch: s.epoch });
    this.save();
    return true;
  },

  /** Знание изучено: запасы уходящих ресурсов переходят в новые по курсу stock (0 — просто пропадают). */
  applyRetire(T) {
    const r = T.retire && T.retire.res;
    if (!r) return;
    const s = this.state, cap = this.storageCap();
    for (const [from, { into, rate, stock = rate }] of Object.entries(r)) {
      const have = Math.floor(s.res[from] || 0), amount = Math.floor(have * stock);
      s.res[into] = Math.min(cap, (s.res[into] || 0) + amount);
      s.res[from] = 0;
      this.log('resRetired', { from, into, have, amount });
    }
  },
});
