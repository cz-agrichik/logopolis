'use strict';
// ============================================================
//  Обучение как отдельный мир: своё состояние и своё сохранение.
//  Город может начаться заново — обучение остаётся. Вошедшие хранят обучение и в аккаунте (snapshot / fromSnapshot).
// ============================================================

const Learn = {
  state: null,
  io: null,          // хранилище подставляет платформа (как Game.io)
  KEY: 'greekgame.learn.v1',

  newState() {
    return {
      v: 2, spread: 1,
      decks: Decks.builtinDecks(), progress: {}, settings: { ...DEFAULT_SETTINGS }, learnLog: {},
      stats: { right: 0, wrong: 0, rounds: 0, learned: 0 },
    };
  },

  /** Привести сохранение к текущему виду. Возвращает, сколько встроенных колод добавилось. */
  migrate(s) {
    s.decks = s.decks || [];
    s.progress = s.progress || {};
    if (!(s.v >= 2)) Decks.progressByWord(s);   // v2: прогресс у слова, а не у карточки
    s.v = 2;
    s.settings = Decks.fixSettings(s.settings);
    s.learnLog = s.learnLog || {};
    s.stats = Object.assign({ right: 0, wrong: 0, rounds: 0, learned: 0 }, s.stats || {});
    if (!s.spread) { Decks.respread(s); s.spread = 1; }   // сроки, назначенные ещё без разброса, — вразбивку (один раз)
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

  // ---------- обучение в аккаунте (platform/account.js) ----------
  // В аккаунт идёт всё обучение целиком: прогресс по словам, свои колоды, какие колоды включены, настройки, журнал, счётчики.
  // Кроме слов встроенных колод: они есть в самой игре (у встроенной колоды в снимке — только id и «включена ли»).
  /** Снимок обучения для аккаунта. */
  snapshot(s = this.state) {
    return {
      v: s.v, spread: s.spread,
      decks: s.decks.map(d => d.builtin ? { id: d.id, builtin: true, active: !!d.active } : d),
      progress: s.progress, settings: s.settings, learnLog: s.learnLog, stats: s.stats,
    };
  },
  /** Состояние обучения из снимка: слова встроенных колод — из игры, дальше — обычная миграция. */
  fromSnapshot(snap) {
    const s = JSON.parse(JSON.stringify(snap));
    const fresh = new Map(Decks.builtinDecks().map(d => [d.id, d]));
    s.decks = (s.decks || []).map(d => {
      if (!d.builtin) return d;
      const nd = fresh.get(d.id);
      return nd ? Object.assign(nd, { active: !!d.active }) : { ...d, cards: [] };   // колоды больше нет в игре — migrate уберёт
    });
    this.migrate(s);
    return s;
  },
  /** В снимке ничего нет: ни одного слова в работе и ни одной своей колоды со словами. */
  isEmptySnap(snap) {
    return !snap || (!Object.keys(snap.progress || {}).length && !(snap.decks || []).some(d => !d.builtin && d.cards && d.cards.length));
  },
  /** Сводка снимка: сколько слов выучено и в работе, своих колод, когда занимались последний раз (мс или null). */
  summary(snap) {
    let learned = 0, learning = 0, last = 0;
    for (const p of Object.values((snap && snap.progress) || {})) {
      if (Decks.isLearned(p)) learned++; else learning++;
      if (p && p.last > last) last = p.last;
    }
    const own = ((snap && snap.decks) || []).filter(d => !d.builtin && d.cards && d.cards.length).length;
    return { learned, learning, own, last: last || null };
  },
};
