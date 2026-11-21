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
// roundSize — заданий в раунде (знакомство с новым словом — тоже задание); learnPool — сколько слов заучивается одновременно:
// новые слова приходят, пока в заучивании меньше learnPool, — раунды ровные, а не «8 новых и 8 проверок» за один раз.
const DEFAULT_SETTINGS = { learnSteps: 3, appetite: 'normal', learnPool: 8, roundSize: 8 };
// Срок повтора выученного — не ровно ступень лестницы, а ступень × случайный множитель от 10% до 190% (в среднем — ровно ступень).
// Слова, выученные в один день, возвращаются не одной волной через месяц, а вразбивку — «долг» отрабатывается с первых дней.
const DUE_SPREAD = [0.1, 1.9];

Object.assign(Decks, {
  // ---------- настройки и состояние карточки ----------
  settings(state) { return Object.assign({}, DEFAULT_SETTINGS, state.settings || {}); },
  /** Настройки из старого сохранения или копии: «новых за раунд» (newPerRound) → «заучивается одновременно» (learnPool). */
  fixSettings(settings) {
    const s = Object.assign({}, settings || {});
    if (s.newPerRound != null && s.learnPool == null) s.learnPool = s.newPerRound;
    delete s.newPerRound;
    return Object.assign({}, DEFAULT_SETTINGS, s);
  },
  intervals(state) { return (APPETITES[this.settings(state).appetite] || APPETITES.normal).intervals; },
  /** Интервал со случайным разбросом (DUE_SPREAD). */
  spread(ms) { return Math.round(ms * (DUE_SPREAD[0] + Math.random() * (DUE_SPREAD[1] - DUE_SPREAD[0]))); },
  /** Разбросать сроки уже выученных слов (сохранения до разброса): срок = последний ответ + интервал × случайный множитель.
   *  Что выпало в прошлое — пора повторить уже сейчас. */
  respread(state) {
    const iv = this.intervals(state);
    for (const p of Object.values(state.progress)) {
      if (!p || !(p.rev >= 0) || p.step == null) continue;
      const step = iv[Math.min(p.rev, iv.length - 1)], base = p.last || (p.due - step);
      p.due = base + this.spread(step);
    }
  },

  /** Прогресс карточки — то есть её слова (pkey): у одного слова во всех колодах прогресс общий. */
  prog(state, card) { return card ? this.progAt(state, this.pkey(card)) : null; },
  /** Прогресс по ключу в актуальном формате (старые «коробки» переводятся на лету). */
  progAt(state, key) {
    const p = state.progress[key];
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
    const p = this.prog(state, card);
    return !!p && p.rev < 0 && !p.built && p.step >= this.settings(state).learnSteps - 1 && this.canType(card);
  },
  /** Есть ли в слове трудное место для «Какая буква?». */
  hasSpellSpot(card) { return this.canType(card) && spellSpots(card.front).length > 0; },
  /** Сложность задания: 0 — новая, 1–2 — заучивается, 3+ — выучена. */
  level(p) { return !p ? 0 : p.rev >= 0 ? 3 + p.rev : Math.min(2, p.step); },

  /** Карточки включённых колод, каждое слово — один раз (слово из двух колод — карточка первой из них). */
  activeCards(state) {
    const out = [], seen = new Set();
    for (const d of state.decks) if (d.active) for (const c of d.cards) {
      const k = this.pkey(c);
      if (!seen.has(k)) { seen.add(k); out.push(c); }
    }
    return out;
  },

  stats(state, deck) {
    const now = Date.now();
    const s = { total: deck.cards.length, fresh: 0, learning: 0, learned: 0, due: 0 };
    for (const c of deck.cards) {
      const p = this.prog(state, c);
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
      const p = this.prog(state, c);
      if (!p) fresh++;
      else if (p.due <= now) due++;
    }
    return { due, fresh };
  },

  /** Что будет в следующем раунде: сколько пора повторить, сколько новых добавится и сколько слов уже заучивается. */
  roundPreview(state) {
    const p = this.pending(state), plan = this.roundPlan(state);
    return { due: p.due, fresh: p.fresh, newNow: plan.newCount, inRotation: plan.inRotation, pool: plan.pool };
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

  /** Состав раунда без случайности (его же показывает подсказка «Учиться»).
   *  Раунд — roundSize заданий; новое слово стоит двух (знакомство и проверка в конце раунда).
   *  1) заучиваемые слова, у которых подошёл срок; 2) новые — пока в заучивании меньше learnPool слов, не больше половины
   *  оставшихся заданий, и половина остатка (сколько нужно) — повторению выученного; 3) выученные, которым пора;
   *  4) досрочные — если место ещё есть. */
  roundPlan(state, now = Date.now(), size = null) {
    const set = this.settings(state), n = size || set.roundSize;
    const learning = [], due = [], fresh = [], early = [];
    let inRotation = 0;
    for (const c of this.activeCards(state)) {
      const p = this.prog(state, c);
      if (!p) { fresh.push(c); continue; }
      if (!this.isLearned(p)) inRotation++;
      if (p.due <= now) (this.isLearned(p) ? due : learning).push(c);
      else early.push(c);
    }
    const byDue = (a, b) => this.prog(state, a).due - this.prog(state, b).due;
    learning.sort(byDue); due.sort(byDue); early.sort(byDue);
    const learnNow = learning.slice(0, n), left = n - learnNow.length;
    const reserve = Math.min(due.length, Math.ceil(left / 2));
    const newCount = Math.max(0, Math.min(set.learnPool - inRotation, fresh.length, Math.floor((left - reserve) / 2)));
    const dueNow = due.slice(0, left - 2 * newCount);
    const earlyNow = early.slice(0, Math.max(0, left - 2 * newCount - dueNow.length));
    return { learning: learnNow, due: dueNow, fresh, newCount, early: earlyNow, inRotation, pool: set.learnPool };
  },

  /** Карточки на раунд (roundPlan): заучиваемые, новые (какие — случайно), пора повторить, досрочные. */
  selectRound(state, size = null) {
    const plan = this.roundPlan(state, Date.now(), size), picks = [];
    const add = (c, kind) => picks.push({ card: c, kind, lvl: this.level(this.prog(state, c)) });
    for (const c of plan.learning) add(c, 'due');
    for (const c of plan.newCount ? shuffle(plan.fresh).slice(0, plan.newCount) : []) add(c, 'new');
    for (const c of plan.due) add(c, 'due');
    for (const c of plan.early) add(c, 'early');
    return picks;
  },

  /** Оценка ответа. Шагов до «выучено» ровно столько, сколько выбрано в настройках; последний — набор слова.
   *  «Какая буква?» может попасться на любом шаге и тоже считается шагом.
   *  Ошибка в написании (spell, build) не откатывает перевод: слово остаётся на своём шаге и снова пойдёт на набор.
   *  Возвращает 'learned' (стало выученным), 'needtype' (осталось набрать) или null. */
  grade(state, card, correct, kind, task = 'gr2ru') {
    const now = Date.now(), set = this.settings(state), iv = this.intervals(state), L = set.learnSteps;
    const p = this.prog(state, card) || { step: 0, rev: -1, due: 0, right: 0, wrong: 0 };
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
        } else if (p.step >= L) { p.rev = Math.min(p.back || 0, iv.length - 1); delete p.back; p.due = now + this.spread(iv[p.rev]); event = 'learned'; }
        else p.due = now + LEARN_DELAY;
      } else if (kind !== 'early') {
        p.rev = Math.min(p.rev + 1, iv.length - 1);
        p.due = now + this.spread(iv[p.rev]);
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
    state.progress[this.pkey(card)] = p;
    return event;
  },

  /** Состояние карточки одним словом: new / learning / learned (+ due — пора повторить). */
  status(state, card, now = Date.now()) {
    const p = this.prog(state, card);
    if (!p) return { st: 'new', due: false, p };
    return { st: this.isLearned(p) ? 'learned' : 'learning', due: p.due <= now, p };
  },
});
