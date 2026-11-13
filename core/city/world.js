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
      if (this.goat.ttl <= 0) { this.log('goatGone', { kind: this.goat.kind }); this.goat = null; changed = true; }
    } else {
      s.timers.goat -= dt;
      if (s.timers.goat <= 0) {
        const free = this.map.filter(t => t.t !== 'sea' && !this.buildingAt(t.x, t.y));
        const t = free[Math.floor(Math.random() * free.length)];
        // после «Виноградарства» вместо беглой козы по городу проходит шествие вакханок
        if (t) { this.goat = { x: t.x, y: t.y, ttl: 14, kind: this.hasTech('viticulture') ? 'maenad' : 'goat' }; changed = true; }
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
    const maenad = this.goat.kind === 'maenad';
    if (Math.random() < 0.5) {
      const k = maenad && avail.includes('amphora') ? 'amphora' : avail[Math.floor(Math.random() * avail.length)];   // вакханки несут амфоры
      give(k, 240, minBase * 3);
    } else {
      avail.forEach(k => give(k, 60, ['food', 'wood', 'stone'].includes(k) ? minBase : 0));
    }
    s.stats.goats++;
    const pos = this.goat;
    this.goat = null;
    const roll = Math.random();   // какую реплику козы показать — решает интерфейс
    this.log('goat', { roll, gains, kind: maenad ? 'maenad' : 'goat' });
    return { x: pos.x, y: pos.y, gains, roll, kind: maenad ? 'maenad' : 'goat' };
  },

  /** Через сколько секунд следующий набег (случайно, BALANCE.raidEvery). */
  nextRaidIn() { const [a, b] = BALANCE.raidEvery; return rand(a, b); },
  /** Что грозит: 'sea' — набеги «народов моря» (бронзовый век), 'tribute' — дань империям (железный век). */
  raidKind() { return this.state.epoch >= 2 ? 'tribute' : 'sea'; },
  /** Кто берёт дань: 'assyria' — грабит, 'egypt' — серебро с каждого жителя, 'persia' — твёрдая сумма; null — не железный век. */
  overlord() {
    if (this.raidKind() !== 'tribute') return null;
    return this.hasTech('gifts') ? 'persia' : this.hasTech('pharaoh') ? 'egypt' : 'assyria';
  },
  /** Дань серебром без скидок флота.
   *  Египет: столько, сколько в среднем унесли бы ассирийцы — середина BALANCE.raidLoot (стены — вдвое) от ценности
   *  остальных запасов по ценнику, в пересчёте на серебро. Персия: BALANCE.tribute.persia с каждого жителя (считается при присяге). */
  tributeBase(lord, fx = this.fx || this.effects()) {
    const s = this.state;
    if (lord === 'persia') return Math.ceil(s.pop * BALANCE.tribute.persia);
    const W = BALANCE.worth, [a, b] = BALANCE.raidLoot, share = (a + b) / 2 / (fx.raidShield ? 2 : 1);
    const value = RES_KEYS.filter(k => k !== 'silver' && this.resVisible(k)).reduce((t, k) => t + (s.res[k] || 0) * (W[k] || 1), 0);
    return Math.ceil(value * share / W.silver);
  },
  /** Сколько серебра потребуют: Египет — как средний ассирийский грабёж, Персия — сумма с присяги; «Флот царей» −25%. null — Ассирия: она грабит. */
  tributeDue(fx = this.fx || this.effects()) {
    const lord = this.overlord();
    if (lord !== 'egypt' && lord !== 'persia') return null;
    const base = lord === 'persia' ? (this.state.tributeFixed || this.tributeBase('persia', fx)) : this.tributeBase('egypt', fx);
    return Math.ceil(base * (1 - Math.min(0.9, fx.tributeCut || 0)));
  },
  /** Сколько секунд до набега или дани — срок виден заранее; null — угрозы нет (медно-каменный век или игра окончена). */
  raidIn() {
    const s = this.state;
    return s.epoch >= 1 && !s.finished && s.timers.raid != null ? Math.max(0, s.timers.raid) : null;
  },
  /** Набег (бронзовый век) или дань (железный век).
   *  «Народы моря» и Ассирия уносят случайную долю (BALANCE.raidLoot) всех запасов: стены от «народов моря» защищают полностью,
   *  от Ассирии — вдвое. Египет и Персия берут серебро (tributeDue); не хватает — Египет добирает недостающую долю грабежом
   *  (стены — вдвое), Персия — ровно по ценнику (BALANCE.worth) из остальных запасов.
   *  quiet — случилось, пока игрока не было: расскажет окно «С возвращением!», а не всплывашка. */
  raid(quiet = false) {
    const s = this.state, fx = this.fx || this.effects(), tribute = this.raidKind() === 'tribute', lord = this.overlord();
    if (fx.raidShield && !tribute) {
      this.log('raidShield');
      if (!quiet) Bus.emit('raid', { shielded: true });
      return { shielded: true };
    }
    const [a, b] = BALANCE.raidLoot, lost = [];
    const take = (k, d) => { d = Math.floor(Math.min(d, s.res[k])); if (d > 0) { s.res[k] -= d; const x = lost.find(l => l[0] === k); if (x) x[1] += d; else lost.push([k, d]); } };
    const grab = share => {   // случайная доля всех запасов; share — какая часть дани не уплачена
      const p = Math.round(rand(a, b) * 100) / 100 * share / (fx.raidShield ? 2 : 1);
      for (const k of RES_KEYS) take(k, s.res[k] * p);
      return p;
    };
    let out;
    const due = this.tributeDue(fx);
    if (due == null) {   // «народы моря» или Ассирия: грабят
      const halved = !!(tribute && fx.raidShield), pct = grab(1);
      out = { shielded: false, lost, pct, tribute, halved, lord };
    } else {
      const paid = Math.min(due, Math.floor(s.res.silver));
      take('silver', paid);
      const short = due - paid;
      let pct = 0, halved = false;
      if (short > 0 && lord === 'egypt') { halved = !!fx.raidShield; pct = grab(short / due); }
      else if (short > 0) {   // Персия: недоимку — ровно по ценнику, одной и той же долей из всех запасов
        const W = BALANCE.worth, need = short * W.silver, keys = RES_KEYS.filter(k => this.resVisible(k));
        const total = keys.reduce((t, k) => t + (s.res[k] || 0) * (W[k] || 1), 0);
        pct = total > 0 ? Math.min(1, need / total) : 0;
        for (const k of keys) take(k, s.res[k] * pct);
      }
      out = { shielded: false, lost, pct, tribute, halved, lord, due, paid, short };
    }
    this.log(tribute ? 'tribute' : 'raid', { lost, pct: out.pct, halved: out.halved, lord, due: out.due, paid: out.paid, short: out.short });
    if (!quiet) Bus.emit('raid', out);
    return out;
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
