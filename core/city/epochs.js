'use strict';
// ============================================================
//  Переход эпох
// ============================================================

Object.assign(Game, {
  // ---------- переход эпох ----------
  epochReqs() {
    const s = this.state, a = EPOCHS[s.epoch].advance;
    if (!a) return null;
    const list = [];
    // kind: pop | special (have: built / stashed / none) | techs | res | logos
    list.push({ kind: 'pop', need: a.pop, have: s.pop, ok: s.pop >= a.pop });
    for (const sp of a.specials) list.push({ kind: 'special', type: sp, have: this.built(sp) ? 'built' : this.stashed(sp) ? 'stashed' : 'none', ok: this.owned(sp) });
    if (a.allTechs) {
      const all = TECHS.filter(t => t.epoch === s.epoch), have = all.filter(t => this.hasTech(t.id)).length;
      list.push({ kind: 'techs', need: all.length, have, ok: have === all.length });
    }
    for (const [k, v] of Object.entries(a.res)) list.push({ kind: 'res', res: k, need: v, have: Math.floor(s.res[k]), ok: s.res[k] >= v });
    list.push({ kind: 'logos', need: a.logos, have: Math.floor(s.logos), ok: s.logos >= a.logos });
    return list;
  },

  advanceEpoch() {
    const reqs = this.epochReqs();
    if (!reqs || !reqs.every(r => r.ok)) return false;
    const a = EPOCHS[this.state.epoch].advance;
    this.pay(a.res, a.logos);
    this.state.epoch++;
    this.log('epoch', { epoch: this.state.epoch });
    if (EPOCHS[this.state.epoch].locked) this.state.finished = true;
    this.save();
    return true;
  },
});
