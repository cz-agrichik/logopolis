'use strict';
// ============================================================
//  Знания: два пути — «с умом» и «через силу»
// ============================================================

Object.assign(Game, {
  // ---------- знания ----------
  /** Цена знания: 'logos' — λ + немного ресурсов; 'labor' — без λ, но ресурсов втрое больше (buy — λ-часть серебром: «купить у чужеземцев»). */
  techPrice(T, mode = 'logos') {
    if (mode === 'labor') return { cost: this.liveCost(this.laborCost(T.laborBase || T.cost, T.laborLogos != null ? T.laborLogos : T.logos, T.epoch, BALANCE.laborTechMult, T.buy)), logos: 0 };
    return { cost: this.liveCost(T.cost), logos: T.logos };
  },
  techStatus(T, mode = 'logos') {
    if (this.hasTech(T.id)) return { learned: true };
    if (T.epoch > this.state.epoch) return { hidden: true };
    const miss = (T.req || []).filter(r => !this.hasTech(r));
    if (miss.length) return { locked: true, reason: { code: 'needFirst', techs: miss } };
    if (T.reqWonder && !this.hasWonder(T.reqWonder)) return { locked: true, reason: { code: 'needBuilding', type: T.reqWonder } };
    const { cost, logos } = this.techPrice(T, mode);
    const reason = this.lackReason(cost, logos);
    return { ok: !reason, reason, cost, logos };
  },
  research(id, mode = 'logos') {
    const T = TECH_BY_ID[id];
    const st = T && this.techStatus(T, mode);
    if (!st || !st.ok) return false;
    this.pay(st.cost, st.logos);
    this.state.techs.push(id);
    this.state.techPath = this.state.techPath || {};
    this.state.techPath[id] = mode;
    this.log('tech', { id, mode });
    this.applyRetire(T);   // перемены: уходящие ресурсы переходят в новые
    // чудо, которое уходит с этим знанием (retire.tech), становится обычным зданием: Циклопические стены — складом
    for (const [from, into, level] of this.retireWonders()) this.log('retired', { from, into, level, epoch: this.state.epoch, tech: id });
    if (T.fixTribute) this.state.tributeFixed = this.tributeBase('persia');   // присяга Персии: сумма дани считается один раз
    this.fx = this.effects();   // бонусы знания действуют сразу, а не со следующего такта
    this.save();
    return true;
  },
});
