'use strict';
// ============================================================
//  Журнал занятий, сбросы, экспорт и копия обучения
// ============================================================

const LEARN_LOG_DAYS = 90;         // сколько дней хранить журнал занятий

Object.assign(Decks, {
  /** Сколько слов сейчас в статусе «выучено» (во всех колодах). */
  learnedCount(state) {
    let n = 0;
    for (const k of Object.keys(state.progress)) if (this.isLearned(this.progAt(state, k))) n++;
    return n;
  },

  // ---------- журнал занятий по дням ----------
  logDay(state, add) {
    const log = state.learnLog || (state.learnLog = {});
    const k = dayKey();
    const d = log[k] || (log[k] = { a: 0, r: 0, l: 0, x: 0, n: 0, rounds: 0 });
    for (const [f, v] of Object.entries(add)) d[f] = (d[f] || 0) + v;
    const keys = Object.keys(log).sort();
    while (keys.length > LEARN_LOG_DAYS) delete log[keys.shift()];
  },

  /** Сколько карточек станет «пора повторить» в ближайшие ms. */
  dueWithin(state, ms) {
    const now = Date.now();
    let n = 0;
    for (const c of this.activeCards(state)) {
      const p = this.prog(state, c);
      if (p && p.due > now && p.due <= now + ms) n++;
    }
    return n;
  },
  nextDue(state) {
    let t = Infinity;
    for (const c of this.activeCards(state)) { const p = this.prog(state, c); if (p && p.due < t) t = p.due; }
    return t;
  },

  // ---------- сбросы ----------
  /** Сбросить прогресс всех слов, журнал и статистику обучения. Колоды и настройки остаются. */
  resetLearning(state) {
    state.progress = {};
    state.learnLog = {};
    Object.assign(state.stats, { right: 0, wrong: 0, rounds: 0, learned: 0, bestStreak: 0 });
  },
  /** Сбросить прогресс слов колоды (у слова прогресс общий — оно станет новым и в других колодах). */
  resetDeck(state, deck) {
    for (const c of deck.cards) delete state.progress[this.pkey(c)];
  },
  /** Удалить колоду. Прогресс её слов, которые есть в других колодах, остаётся. */
  removeDeck(state, deck) {
    state.decks = state.decks.filter(d => d !== deck);
    const keep = this.wordSet(state.decks);
    for (const c of deck.cards) if (!keep.has(this.pkey(c))) delete state.progress[this.pkey(c)];
  },

  // ---------- прогресс по слову ----------
  /** Сохранения до v2: прогресс был у карточки («колода:хэш»), теперь — у слова (pkey).
   *  Одно слово в нескольких колодах — берём самый продвинутый прогресс, ответы складываем; прогресс карточек,
   *  которых уже нет ни в одной колоде, уходит. */
  progressByWord(state) {
    const out = {};
    for (const d of state.decks || []) for (const c of d.cards || []) {
      const p = this.progAt(state, c.id);
      if (!p) continue;
      const k = this.pkey(c), q = out[k];
      if (!q) { out[k] = p; continue; }
      if (q === p) continue;
      const better = this.level(p) - this.level(q) || (p.last || 0) - (q.last || 0);
      const [a, b] = better > 0 ? [p, q] : [q, p];
      a.right = (a.right || 0) + (b.right || 0); a.wrong = (a.wrong || 0) + (b.wrong || 0);
      if (b.built) a.built = true;
      out[k] = a;
    }
    state.progress = out;
  },

  // ---------- экспорт ----------
  deckTsv(deck) {
    const f = v => String(v || '').replace(/[\t\r\n]+/g, ' ');
    return `# ${f(deck.name)}\n` + deck.cards.map(c => [c.front, c.back, c.hint].map(f).join('\t')).join('\n') + '\n';
  },
  /** Строки таблицы слов с прогрессом (заголовки и слова статусов добавляет интерфейс). */
  progressRows(state, cards) {
    return cards.map(c => {
      const { st, p } = this.status(state, c), d = this.deckOfCard(state, c.id);
      return { card: c, deck: d ? d.name : '', status: st, right: p ? p.right : 0, wrong: p ? p.wrong : 0, due: p ? p.due : null };
    });
  },
  /** Полная копия обучения: колоды, прогресс, настройки, журнал. */
  backup(state) {
    return {
      type: 'logos-learning', v: 2, exported: new Date().toISOString(),
      decks: state.decks, progress: state.progress, settings: state.settings,
      learnLog: state.learnLog || {}, spread: state.spread || 0,
      stats: { right: state.stats.right, wrong: state.stats.wrong, rounds: state.stats.rounds, learned: state.stats.learned || 0 },
    };
  },
  /** Восстановить обучение из копии (заменяет текущее). Возвращает число колод. */
  restore(state, data) {
    if (!data || data.type !== 'logos-learning' || !Array.isArray(data.decks) || typeof data.progress !== 'object')
      throw Object.assign(new Error('notBackup'), { code: 'notBackup' });
    state.decks = data.decks;
    state.progress = data.progress || {};
    state.settings = Object.assign({}, DEFAULT_SETTINGS, data.settings || {});
    state.learnLog = data.learnLog || {};
    if (!(data.v >= 2)) this.progressByWord(state);   // копия до v2 — прогресс по карточкам
    state.v = 2;
    Object.assign(state.stats, { right: 0, wrong: 0, rounds: 0, learned: 0 }, data.stats || {});
    if (!data.spread) this.respread(state);   // копия из времён без разброса сроков — разбросать, как при загрузке
    state.spread = 1;
    this.ensureBuiltins(state);
    return state.decks.length;
  },
});
