'use strict';
// ============================================================
//  Обучение как отдельный мир: своё состояние и своё сохранение.
//  Город может начаться заново — обучение остаётся.
// ============================================================

const Learn = {
  state: null,
  io: null,          // хранилище подставляет платформа (как Game.io)
  KEY: 'greekgame.learn.v1',

  newState() {
    return {
      v: 1,
      decks: Decks.builtinDecks(), progress: {}, settings: { ...DEFAULT_SETTINGS }, learnLog: {},
      stats: { right: 0, wrong: 0, rounds: 0, learned: 0 },
    };
  },

  /** Привести сохранение к текущему виду. Возвращает, сколько встроенных колод добавилось. */
  migrate(s) {
    s.v = 1;
    s.decks = s.decks || [];
    s.progress = s.progress || {};
    s.settings = Object.assign({}, DEFAULT_SETTINGS, s.settings || {});
    s.learnLog = s.learnLog || {};
    s.stats = Object.assign({ right: 0, wrong: 0, rounds: 0, learned: 0 }, s.stats || {});
    return Decks.ensureBuiltins(s);
  },

  /** Обучение из старого общего сохранения (до разделения на город и обучение). */
  fromLegacy(old) {
    const st = old.stats || {};
    return {
      v: 1, decks: old.decks, progress: old.progress, settings: old.settings, learnLog: old.learnLog || {},
      stats: { right: st.right || 0, wrong: st.wrong || 0, rounds: st.rounds || 0, learned: st.learned || 0 },
    };
  },

  /** Загрузить: { state, added } или null. legacy — разобранное старое сохранение, если своего ещё нет. */
  load(legacy = null) {
    try {
      const raw = this.io && this.io.load(this.KEY);
      const s = raw ? JSON.parse(raw) : legacy && legacy.decks ? this.fromLegacy(legacy) : null;
      if (!s) return null;
      const added = this.migrate(s);
      return { state: s, added };
    } catch (e) { return null; }
  },
  save() {
    if (this.resetting || !this.state) return;
    if (this.io) this.io.save(this.KEY, JSON.stringify(this.state));
  },
};
