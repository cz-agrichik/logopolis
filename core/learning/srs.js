'use strict';
// ============================================================
//  Интервальное повторение: настройки, выбор карточек на раунд, оценка ответа
// ============================================================

// ------------------------------------------------------------
//  Повторение: сначала «заучивание» (N верных ответов подряд в ближайших раундах),
//  затем слово считается выученным и возвращается всё реже, по выбранному «аппетиту».
// ------------------------------------------------------------
const MIN = 60e3, HOUR = 3600e3, DAY = 24 * HOUR;
const LEARN_DELAY = 30e3;          // в фазе заучивания карточка снова готова через 30 секунд
const APPETITES = {
  rare:   { intervals: [DAY, 30 * DAY, 180 * DAY] },
  normal: { intervals: [HOUR, DAY, 14 * DAY, 90 * DAY] },
  often:  { intervals: [10 * MIN, HOUR, DAY, 4 * DAY, 14 * DAY, 60 * DAY] },
};
const DEFAULT_SETTINGS = { learnSteps: 3, appetite: 'normal', newPerRound: 5, roundSize: 8 };

Object.assign(Decks, {
  // ---------- настройки и состояние карточки ----------
  settings(state) { return Object.assign({}, DEFAULT_SETTINGS, state.settings || {}); },
  intervals(state) { return (APPETITES[this.settings(state).appetite] || APPETITES.normal).intervals; },

  /** Прогресс карточки в актуальном формате (старые «коробки» переводятся на лету). */
  prog(state, id) {
    const p = state.progress[id];
    if (!p) return null;
    if (p.step == null) {   // миграция с коробок Лейтнера
      const box = p.box || 0, L = this.settings(state).learnSteps;
      if (box >= 4) { p.rev = Math.min(box - 4, this.intervals(state).length - 1); p.step = L; }
      else { p.rev = -1; p.step = Math.min(box, L - 1); }
      delete p.box;
    }
    return p;
  },
  isLearned(p) { return !!p && p.rev >= 0; },
  /** Слово можно набрать (одно слово, без пробелов и знаков). */
  canType(card) { const n = [...card.front].length; return n >= 2 && n <= 18 && !/[\s.,!?;:()'"«»-]/.test(card.front); },
  /** Слово дошло до последнего шага, но ещё ни разу не набрано — последним шагом будет набор. */
  needsBuild(state, card) {
    const p = this.prog(state, card.id);
    return !!p && p.rev < 0 && !p.built && p.step >= this.settings(state).learnSteps - 1 && this.canType(card);
  },
  /** Есть ли в слове трудное место для «Какая буква?». */
  hasSpellSpot(card) { return this.canType(card) && spellSpots(card.front).length > 0; },
  /** Сложность задания: 0 — новая, 1–2 — заучивается, 3+ — выучена. */
  level(p) { return !p ? 0 : p.rev >= 0 ? 3 + p.rev : Math.min(2, p.step); },

  activeCards(state) {
    const out = [];
    for (const d of state.decks) if (d.active) for (const c of d.cards) out.push(c);
    return out;
  },

  stats(state, deck) {
    const now = Date.now();
    const s = { total: deck.cards.length, fresh: 0, learning: 0, learned: 0, due: 0 };
    for (const c of deck.cards) {
      const p = this.prog(state, c.id);
      if (!p) { s.fresh++; continue; }
      if (this.isLearned(p)) s.learned++; else s.learning++;
      if (p.due <= now) s.due++;
    }
    return s;
  },

  pending(state) {
    const now = Date.now();
    let due = 0, fresh = 0;
    for (const c of this.activeCards(state)) {
      const p = this.prog(state, c.id);
      if (!p) fresh++;
      else if (p.due <= now) due++;
    }
    return { due, fresh };
  },

  /** Что будет в следующем раунде: сколько пора повторить и сколько новых добавится. */
  roundPreview(state) {
    const p = this.pending(state);
    return { due: p.due, fresh: p.fresh, newNow: Math.min(p.fresh, this.settings(state).newPerRound) };
  },
  /** Сводка по включённым колодам: всего, новых, учатся, выучено, пора повторить. */
  totals(state, now = Date.now()) {
    const t = { total: 0, fresh: 0, learning: 0, learned: 0, due: 0 };
    for (const c of this.activeCards(state)) {
      const { st, due } = this.status(state, c, now);
      t.total++;
      if (st === 'new') t.fresh++; else if (st === 'learned') t.learned++; else t.learning++;
      if (st !== 'new' && due) t.due++;
    }
    return t;
  },

  /** Карточки на раунд: сначала заучиваемые, потом пора повторить, потом новые, потом досрочные. */
  selectRound(state) {
    const now = Date.now(), set = this.settings(state);
    const n = set.roundSize, maxNew = set.newPerRound;
    const learning = [], due = [], fresh = [], early = [];
    for (const c of this.activeCards(state)) {
      const p = this.prog(state, c.id);
      if (!p) fresh.push(c);
      else if (p.due <= now) (this.isLearned(p) ? due : learning).push(c);
      else early.push(c);
    }
    const byDue = (a, b) => state.progress[a.id].due - state.progress[b.id].due;
    learning.sort(byDue); due.sort(byDue); early.sort(byDue);
    const picks = [];
    const add = (c, kind) => picks.push({ card: c, kind, lvl: this.level(this.prog(state, c.id)) });
    for (const c of learning) { if (picks.length >= n) break; add(c, 'due'); }
    for (const c of due) { if (picks.length >= n) break; add(c, 'due'); }
    for (const c of shuffle(fresh).slice(0, maxNew)) { if (picks.length >= n) break; add(c, 'new'); }
    for (const c of early) { if (picks.length >= n) break; add(c, 'early'); }
    return picks;
  },

  /** Оценка ответа. Шагов до «выучено» ровно столько, сколько выбрано в настройках; последний — набор слова.
   *  «Какая буква?» может попасться на любом шаге и тоже считается шагом.
   *  Ошибка в написании (spell, build) не откатывает перевод: слово остаётся на своём шаге и снова пойдёт на набор.
   *  Возвращает 'learned' (стало выученным), 'needtype' (осталось набрать) или null. */
  grade(state, card, correct, kind, task = 'gr2ru') {
    const now = Date.now(), set = this.settings(state), iv = this.intervals(state), L = set.learnSteps;
    const p = this.prog(state, card.id) || { step: 0, rev: -1, due: 0, right: 0, wrong: 0 };
    const spelling = task === 'spell' || task === 'build';
    let event = null;
    if (correct) {
      p.right++;
      if (task === 'build') p.built = true;
      if (p.rev < 0) {
        p.step++;
        if (p.step >= L && !p.built && this.canType(card)) {
          // без единого набора слово не выучено: ждём задания «Соберите слово»
          p.step = L - 1; p.due = now + LEARN_DELAY; event = 'needtype';
        } else if (p.step >= L) { p.rev = Math.min(p.back || 0, iv.length - 1); delete p.back; p.due = now + iv[p.rev]; event = 'learned'; }
        else p.due = now + LEARN_DELAY;
      } else if (kind !== 'early') {
        p.rev = Math.min(p.rev + 1, iv.length - 1);
        p.due = now + iv[p.rev];
      }
    } else {
      p.wrong++;
      if (spelling) {
        // перевод знает, написание — нет: шаг не откатываем, но слово снова пойдёт на набор
        p.built = false;
        if (p.rev >= 0) { p.back = Math.max(0, p.rev - 1); p.rev = -1; p.step = Math.max(0, L - 1); }
      } else if (p.rev >= 0) { p.back = Math.max(0, p.rev - 1); p.rev = -1; p.step = Math.max(0, L - 1); }
      else p.step = Math.max(0, p.step - 1);
      p.due = now + LEARN_DELAY;
    }
    p.last = now;
    state.progress[card.id] = p;
    return event;
  },

  /** Состояние карточки одним словом: new / learning / learned (+ due — пора повторить). */
  status(state, card, now = Date.now()) {
    const p = this.prog(state, card.id);
    if (!p) return { st: 'new', due: false, p };
    return { st: this.isLearned(p) ? 'learned' : 'learning', due: p.due <= now, p };
  },
});
