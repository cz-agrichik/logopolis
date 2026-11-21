'use strict';
// ============================================================
//  Обряды
// ============================================================

Object.assign(Game, {
  // ---------- обряды ----------
  /** Цена в λ: perMinute — по курсу обрядов (BALANCE.riteRate медных λ за минуту выпуска × инфляция λ эпохи × минуты «Сбора»);
   *  logosAt — своя цена эпохи; иначе обряд прошлой эпохи в новой ×1.5 за каждую эпоху (кроме fixedPrice). */
  ritualLogos(R) {
    const e = this.state.epoch, infl = BALANCE.logosInflation[e];
    if (R.perMinute && infl != null) return Math.round(this.riteRate() * this.suppliesSec() / 60);
    if (R.logosAt && R.logosAt[e] != null) return R.logosAt[e];
    return R.fixedPrice ? R.logos : Math.ceil(R.logos * Math.pow(1.5, Math.max(0, this.state.epoch - R.epoch)));
  },
  /** Сколько секунд длится благословение: у durPerEpoch — дольше с каждой эпохой. */
  /** Сколько секунд длится благословение: своё dur, с эпохами — durPerEpoch, и чудеса, которые его продлевают (effect.riteDur). */
  ritualDur(R) {
    const extra = ((this.fx || this.effects()).riteDur || {})[R.id] || 0;
    return (R.dur || 0) + (R.durPerEpoch || 0) * Math.max(0, this.state.epoch - R.epoch) + (R.dur ? extra : 0);
  },
  /** «Учение Зенона»: сколько λ даёт задание, в котором была ошибка (без бонусов; без знания — 0). */
  mistakeLogos() { return (this.fx || this.effects()).mistakeLogos || 0; },
  /** Курс обрядов эпохи: сколько номинальных λ стоит минута выпуска (медные λ эпохи × инфляция λ); null — курс не задан. */
  riteRate() {
    const e = this.state.epoch, infl = BALANCE.logosInflation[e], rr = BALANCE.riteRate;
    return infl == null ? null : (rr[e] != null ? rr[e] : rr[rr.length - 1]) * infl;
  },
  /** «Сбор припасов»: сколько секунд выпуска зданий даёт сейчас (BALANCE.suppliesMin по эпохам). */
  suppliesSec() { const m = BALANCE.suppliesMin; return 60 * (m[this.state.epoch] != null ? m[this.state.epoch] : m[m.length - 1]); },
  /** Сколько секунд ждать до следующего раза. realTime — по настоящим часам (переживает уход из игры), иначе — игровое время. */
  ritualWait(R) {
    const s = this.state;
    if (R.realTime) return Math.max(0, ((s.readyAt || {})[R.id] || 0) - Date.now()) / 1000;
    return (s.cooldowns || {})[R.id] || 0;
  },
  ritualStatus(R) {
    const s = this.state;
    if (R.epoch > s.epoch) return { hidden: true };
    if (R.tech && !this.hasTech(R.tech)) return { hidden: true };            // обряд нового знания (праздник лозы и оливы)
    if (R.untilTech && this.hasTech(R.untilTech)) return { hidden: true };   // уступил место новому
    if (R.until && this.hasWonder(R.until)) return { hidden: true };         // святилище улучшено — обряд сменился
    const req = R.req && !(R.reqUntil != null && s.epoch >= R.reqUntil) ? R.req : null;   // reqUntil: с этой эпохи чудо не нужно
    if (req && this.retired(req)) return { hidden: true };               // чудо прошлой эпохи стало обычным зданием
    if (req && !this.hasWonder(req)) return { locked: true, reason: { code: 'needBuilding', type: req } };
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
      // выпуск зданий без благословений и без вычета расхода (grossRates): продажа амфор или прожорливые кузницы выдачу не обнуляют
      const gains = [], sup = this.suppliesNow();
      for (const k of RES_KEYS) {
        if (!this.resVisible(k)) continue;
        const g = Math.floor(Math.min(sup[k], cap - s.res[k]));
        if (g > 0) { s.res[k] += g; gains.push([k, g]); }
      }
      result = { gains };
    } else if (R.instant === 'settlers') {
      const n = Math.min(3 + 2 * s.epoch, this.popCap(fx) - s.pop);
      s.pop += n; result = { pop: n };
    }
    if (R.buff) {
      s.buffs[id] = Math.min(Math.max(BALANCE.maxBuffMinutes * 60, this.ritualDur(R)), (s.buffs[id] || 0) + this.ritualDur(R));
      result = { minutes: Math.round(s.buffs[id] / 60) };
    }
    if (R.goat && !this.goat) s.timers.goat = 0;
    // Меркуралии: в гавань сразу приходит корабль (стоявший у причала уходит — новый приходит со всеми сделками)
    if (R.ship && this.shipsOpen()) { this.shipArrive(); result.ship = true; }
    if (R.cooldown && R.realTime) (s.readyAt = s.readyAt || {})[id] = Date.now() + R.cooldown * 1000;
    else if (R.cooldown) s.cooldowns[id] = R.cooldown;
    this.log('rite', { id, result });
    this.save();
    return result;
  },
});
