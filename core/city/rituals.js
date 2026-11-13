'use strict';
// ============================================================
//  Обряды
// ============================================================

Object.assign(Game, {
  // ---------- обряды ----------
  ritualLogos(R) { return Math.ceil(R.logos * Math.pow(1.5, Math.max(0, this.state.epoch - R.epoch))); },
  /** Сколько секунд ждать до следующего раза. realTime — по настоящим часам (переживает уход из игры), иначе — игровое время. */
  ritualWait(R) {
    const s = this.state;
    if (R.realTime) return Math.max(0, ((s.readyAt || {})[R.id] || 0) - Date.now()) / 1000;
    return (s.cooldowns || {})[R.id] || 0;
  },
  ritualStatus(R) {
    const s = this.state;
    if (R.epoch > s.epoch) return { hidden: true };
    if (R.tech && !this.hasTech(R.tech)) return { hidden: true };            // обряд нового знания (праздник сбора винограда)
    if (R.untilTech && this.hasTech(R.untilTech)) return { hidden: true };   // уступил место новому
    if (R.until && this.hasWonder(R.until)) return { hidden: true };         // святилище улучшено — обряд сменился
    if (R.req && this.retired(R.req)) return { hidden: true };               // чудо прошлой эпохи стало обычным зданием
    if (R.req && !this.hasWonder(R.req)) return { locked: true, reason: { code: 'needBuilding', type: R.req } };
    const cost = this.liveCost(R.cost), logos = this.ritualLogos(R);
    const cd = this.ritualWait(R);
    if (cd > 0) return { cost, logos, cd, reason: { code: 'cooldown', sec: Math.ceil(cd) } };
    const active = Object.keys(s.buffs).filter(id => RITUAL_BY_ID[id]).length;
    if (R.buff && !s.buffs[R.id] && active >= BALANCE.maxBuffs) return { cost, logos, ok: false, full: true, reason: { code: 'buffsFull', max: BALANCE.maxBuffs } };
    if (R.goat && this.goat) return { cost, logos, ok: this.canAfford(cost, logos) };
    const reason = this.lackReason(cost, logos);
    return { cost, logos, ok: !reason, reason };
  },
  perform(id) {
    const R = RITUAL_BY_ID[id], st = R && this.ritualStatus(R);
    if (!st || !st.ok) return null;
    this.pay(st.cost, st.logos);
    const s = this.state, fx = this.fx || this.effects(), cap = this.storageCap(fx);
    // результат: { gains: [[ресурс, сколько]] } | { pop } | { minutes } — как показать, решает интерфейс
    let result = {};
    if (R.instant === 'elders') {
      // выпуск без благословений: «Сбор припасов» не умножает их — он сам по себе
      const gains = [], plain = this.plainRates();
      for (const k of RES_KEYS) {
        let g = Math.max(0, (plain[k] || 0) * BALANCE.suppliesSec);
        if (['food', 'wood', 'stone'].includes(k)) g = Math.max(g, 30 * (1 + s.epoch));
        g = Math.floor(Math.min(g, cap - s.res[k]));
        if (g > 0) { s.res[k] += g; gains.push([k, g]); }
      }
      result = { gains };
    } else if (R.instant === 'settlers') {
      const n = Math.min(3 + 2 * s.epoch, this.popCap(fx) - s.pop);
      s.pop += n; result = { pop: n };
    }
    if (R.buff) {
      s.buffs[id] = Math.min(BALANCE.maxBuffMinutes * 60, (s.buffs[id] || 0) + R.dur);
      result = { minutes: Math.round(s.buffs[id] / 60) };
    }
    if (R.goat && !this.goat) s.timers.goat = 0;
    if (R.cooldown && R.realTime) (s.readyAt = s.readyAt || {})[id] = Date.now() + R.cooldown * 1000;
    else if (R.cooldown) s.cooldowns[id] = R.cooldown;
    this.log('rite', { id, result });
    this.save();
    return result;
  },
});
