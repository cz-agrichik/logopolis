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
      if (s.timers.raid == null) s.timers.raid = this.nextRaidIn();
      s.timers.raid -= dt;
      if (s.timers.raid <= 0) { this.raid(); s.timers.raid = this.nextRaidIn(); }
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

  /** Через сколько секунд следующий набег (случайно, BALANCE.raidEvery). */
  nextRaidIn() { const [a, b] = BALANCE.raidEvery; return rand(a, b); },
  /** Сколько секунд до набега — его видно заранее; null — набегов нет (не бронзовый век или игра окончена). */
  raidIn() {
    const s = this.state;
    return s.epoch >= 1 && !s.finished && s.timers.raid != null ? Math.max(0, s.timers.raid) : null;
  },
  /** Набег: без Циклопических стен уносят случайную долю (BALANCE.raidLoot) всех запасов.
   *  quiet — набег случился, пока игрока не было: о нём расскажет окно «С возвращением!», а не всплывашка. */
  raid(quiet = false) {
    const s = this.state, fx = this.fx || this.effects();
    if (fx.raidShield) {
      this.log('raidShield');
      if (!quiet) Bus.emit('raid', { shielded: true });
      return { shielded: true };
    }
    const [a, b] = BALANCE.raidLoot, pct = Math.round(rand(a, b) * 100) / 100;
    const lost = [];
    for (const k of RES_KEYS) {
      const d = Math.floor(s.res[k] * pct);
      if (d > 0) { s.res[k] -= d; lost.push([k, d]); }
    }
    this.log('raid', { lost, pct });
    if (!quiet) Bus.emit('raid', { shielded: false, lost, pct });
    return { shielded: false, lost, pct };
  },

  /**
   * Прогресс за время отсутствия (не дольше BALANCE.offlineMaxHours).
   * Время идёт по-настоящему: благословения и перерывы обрядов истекают, как при игроке.
   * Выпуск и рост — первые BALANCE.offlineFullSec в полную силу, дальше вполовину; всё упирается в склады.
   * Набег: если его срок наступил, пока игрока не было, он случается ровно один раз — в конце, по накопленному;
   * после возвращения отсчёт до следующего набега начинается заново.
   */
  catchUp() {
    const s = this.state;
    const away = (Date.now() - (s.lastSave || Date.now())) / 1000;
    if (away < 20) return null;
    const real = Math.min(BALANCE.offlineMaxHours * 3600, away);
    const before = { ...s.res }, popBefore = s.pop, buffsBefore = Object.keys(s.buffs);
    // такт — 5 секунд выпуска: в первые минуты это 5 секунд настоящего времени, потом 10
    for (let t = 0, dt; t < real; t += dt) {
      dt = Math.min(t < BALANCE.offlineFullSec ? 5 : 10, real - t);
      const fullPart = Math.max(0, Math.min(dt, BALANCE.offlineFullSec - t));   // сколько из этих секунд — в полную силу
      const work = fullPart + (dt - fullPart) * 0.5;
      this.tick(work);               // выпуск, рост, и часть времени благословений
      this.passTime(dt - work);      // остальное время благословений и перерывов
    }
    const gained = {};
    for (const k of RES_KEYS) { const d = Math.floor(s.res[k] - before[k]); if (d > 0) gained[k] = d; }
    let raid = null;
    if (s.epoch >= 1 && !s.finished) {
      const left = s.timers.raid ?? this.nextRaidIn();
      if (left <= away) { raid = this.raid(true); s.timers.raid = this.nextRaidIn(); }
      else s.timers.raid = left - away;
    }
    s.lastSave = Date.now();
    return {
      seconds: away, gained, pop: s.pop - popBefore, halved: away > BALANCE.offlineFullSec,
      ended: buffsBefore.filter(id => !s.buffs[id]), raid,
    };
  },
});
