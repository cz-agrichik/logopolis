'use strict';
// ============================================================
//  Мир: сбор руками, козы, набеги, офлайн-прогресс
// ============================================================

Object.assign(Game, {
  gather(tile) {
    const T = TERRAIN[tile.t];
    if (!T || !T.gather) return null;
    const amt = 1 + this.state.epoch;
    const r = T.gather;
    this.state.res[r] = Math.min(this.storageCap(), this.state.res[r] + amt);
    return { res: r, amt };
  },

  // ---------- события ----------
  /** Возвращает true, если на карте что-то поменялось. */
  events(dt) {
    const s = this.state, fx = this.fx || this.effects();
    let changed = false;
    if (this.goat) {
      this.goat.ttl -= dt;
      if (this.goat.ttl <= 0) { this.goat = null; changed = true; this.log('goatGone'); }
    } else {
      s.timers.goat -= dt;
      if (s.timers.goat <= 0) {
        const free = this.map.filter(t => t.t !== 'sea' && !this.buildingAt(t.x, t.y));
        const t = free[Math.floor(Math.random() * free.length)];
        if (t) { this.goat = { x: t.x, y: t.y, ttl: 14 }; changed = true; }
        s.timers.goat = fx.goats ? rand(35, 80) : rand(60, 140);
      }
    }
    if (s.epoch >= 1 && !s.finished) {
      if (s.timers.raid == null) s.timers.raid = rand(900, 1500);
      s.timers.raid -= dt;
      if (s.timers.raid <= 0) { s.timers.raid = rand(900, 1500); this.raid(); }
    }
    return changed;
  },

  /** Коза приносит одно из двух: 4 минуты производства случайного ресурса или 1 минуту всех сразу. */
  catchGoat() {
    if (!this.goat) return null;
    const s = this.state, fx = this.fx || this.effects(), cap = this.storageCap(fx);
    const avail = RES_KEYS.filter(k => (this.rates[k] || 0) > 0 || ['food', 'wood', 'stone'].includes(k));
    const mult = fx.goats ? 1.6 : 1, minBase = 20 * (1 + s.epoch);
    const gains = [];
    const give = (k, sec, min) => {
      const g = Math.floor(Math.min(cap - s.res[k], Math.max(min, Math.max(0, this.rates[k] || 0) * sec) * mult));
      if (g > 0) { s.res[k] += g; gains.push([k, g]); }
    };
    if (Math.random() < 0.5) {
      const k = avail[Math.floor(Math.random() * avail.length)];
      give(k, 240, minBase * 3);
    } else {
      avail.forEach(k => give(k, 60, ['food', 'wood', 'stone'].includes(k) ? minBase : 0));
    }
    s.stats.goats++;
    const pos = this.goat;
    this.goat = null;
    const roll = Math.random();   // какую реплику козы показать — решает интерфейс
    this.log('goat', { roll, gains });
    return { x: pos.x, y: pos.y, gains, roll };
  },

  raid() {
    const s = this.state, fx = this.fx || this.effects();
    if (fx.raidShield) {
      const bonus = 60;
      s.res.copper = Math.min(this.storageCap(fx), s.res.copper + bonus);
      this.log('raidShield', { bonus });
      Bus.emit('raid', { shielded: true, bonus });
      return;
    }
    const lost = [];
    for (const k of RES_KEYS) {
      const d = Math.floor(s.res[k] * 0.15);
      if (d > 0) { s.res[k] -= d; lost.push([k, d]); }
    }
    this.log('raid', { lost });
    Bus.emit('raid', { shielded: false, lost });
  },

  /**
   * Прогресс за время отсутствия: первые 5 минут — в полную силу,
   * дальше — вполовину (до 8 часов). Всё упирается в склады.
   */
  catchUp() {
    const away = (Date.now() - (this.state.lastSave || Date.now())) / 1000;
    if (away < 20) return null;
    const capped = Math.min(BALANCE.offlineMaxHours * 3600, away);
    const full = Math.min(BALANCE.offlineFullSec, capped);
    const half = Math.max(0, capped - full) * 0.5;
    const before = { ...this.state.res }, popBefore = this.state.pop;
    const sim = full + half, step = 5;
    for (let t = 0; t < sim; t += step) this.tick(Math.min(step, sim - t));
    const gained = {};
    for (const k of RES_KEYS) { const d = Math.floor(this.state.res[k] - before[k]); if (d > 0) gained[k] = d; }
    this.state.lastSave = Date.now();
    return { seconds: away, gained, pop: this.state.pop - popBefore, halved: away > BALANCE.offlineFullSec };
  },
});
