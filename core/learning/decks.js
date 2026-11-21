'use strict';
// ============================================================
//  Колоды: стартовые, встроенные, импорт
// ============================================================

/** Подборки колод для вопроса «Что будем учить?»: decks — id колод, groups — целые группы ('start', 'A1', 'A2', 'B1', 'own'). */
const LEARN_PLANS = {
  a1start: { decks: ['cyprus-starter', 'a1-people', 'a1-num', 'a1-time', 'a1-food', 'a1-home', 'a1-body', 'a1-city', 'a1-adv', 'a1-conn', 'a1-pron', 'a1-adj', 'a1-omega1', 'a1-omega2'] },
  a1:      { groups: ['start', 'A1'] },
  a2:      { groups: ['A2'] },
  b1:      { groups: ['B1'] },
  verbs:   { decks: ['a1-omega1', 'a1-omega2', 'a1-contr', 'a1-mid', 'a2-verbs', 'a2-verbs2', 'b1-verbs', 'b1-verbs2'] },
  own:     { groups: ['own'] },
};

const CARD_KEYS = new WeakMap();   // карточка → [греческая сторона, ключ прогресса]

const Decks = {
  hasGreek(s) { return GREEK_RE.test(s || ''); },

  hash(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  },

  makeDeck(name, cards, extra = {}) {
    const id = extra.id || ('d' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
    const seen = new Set();
    const list = [];
    for (const c of cards) {
      const cid = id + ':' + this.hash(c.front + '|' + c.back);
      if (seen.has(cid)) continue;
      seen.add(cid);
      list.push({ id: cid, front: c.front, back: c.back, hint: c.hint || '' });
    }
    return { id, name, active: true, builtin: !!extra.builtin, cards: list };
  },

  sampleDeck() {
    return this.makeDeck(SAMPLE_DECK.name,
      SAMPLE_DECK.cards.map(([front, back, hint]) => ({ front, back, hint })),
      { id: SAMPLE_DECK.id, builtin: true });
  },

  /** Все встроенные колоды: стартовая + A1/A2/B1 из words.js. Колоды с off: true приходят выключенными. */
  builtinDecks() {
    const list = [this.sampleDeck()];
    if (typeof WORD_DECKS !== 'undefined') {
      for (const d of WORD_DECKS) {
        const deck = this.makeDeck(d.name, d.cards.map(([front, back, hint]) => ({ front, back, hint })), { id: d.id, builtin: true });
        deck.ver = typeof WORD_DECKS_VERSION !== 'undefined' ? WORD_DECKS_VERSION : 1;
        if (d.off) deck.active = false;
        list.push(deck);
      }
    }
    return list;
  },

  /** Уровень встроенной колоды по её id: 'A1', 'A2', 'B1' или '' (стартовая и свои). */
  levelOf(deck) {
    const m = deck.builtin && /^([ab][12])-/.exec(deck.id);
    return m ? m[1].toUpperCase() : '';
  },
  /** Группа колоды: 'start' (стартовый набор), 'A1', 'A2', 'B1', 'reading' (слова из чтения) или 'own' (свои). */
  groupOf(deck) { return this.levelOf(deck) || (deck.reading ? 'reading' : deck.builtin ? 'start' : 'own'); },

  // ---------- «Что будем учить?»: подборки колод ----------
  /** Входит ли колода в подборку. */
  inPlan(id, deck) {
    const P = LEARN_PLANS[id];
    return P.decks ? P.decks.includes(deck.id) : P.groups.includes(this.groupOf(deck));
  },
  /** Подборки, которые можно выбрать сейчас ('own' — только если есть свои колоды). */
  plans(state) {
    return Object.keys(LEARN_PLANS).filter(id => id !== 'own' || state.decks.some(d => this.groupOf(d) === 'own'));
  },
  /** Включить колоды подборки, остальные выключить. Прогресс не трогается. */
  applyPlan(state, id) {
    if (!LEARN_PLANS[id]) return false;
    for (const d of state.decks) if (!d.reading) d.active = this.inPlan(id, d);   // слова из чтения — сами по себе
    return true;
  },
  /** Какая подборка сейчас включена или null — свой набор колод. */
  planOf(state) {
    return this.plans(state).find(id => state.decks.every(d => d.reading || d.active === this.inPlan(id, d))) || null;
  },
  /** Сколько слов в колодах плана и сколько из них уже выучено. */
  planStats(state, id) {
    const decks = state.decks.filter(d => this.inPlan(id, d));
    return Object.assign({ decks: decks.length }, this.wordStats(state, decks));
  },

  /** Добавляет в сохранение встроенные колоды, которых там ещё нет, и обновляет устаревшие.
   *  Прогресс привязан к слову, а не к колоде: слово переехало (из A1 в A2, в тематическую колоду) — прогресс на месте. */
  ensureBuiltins(state) {
    const fresh = this.builtinDecks();
    for (const nd of fresh) {
      const old = state.decks.find(d => d.id === nd.id);
      if (!old || (old.ver || 1) >= (nd.ver || 1)) continue;
      old.cards = nd.cards; old.ver = nd.ver; old.name = nd.name;
    }
    // встроенная колода, которой больше нет (например, «Фразы для письма»), уходит вместе с прогрессом слов,
    // которых больше нет ни в одной колоде
    const ids = new Set(fresh.map(d => d.id));
    const gone = state.decks.filter(d => d.builtin && !ids.has(d.id));
    state.decks = state.decks.filter(d => !d.builtin || ids.has(d.id));
    if (gone.length) {
      const keep = this.wordSet(state.decks.concat(fresh));
      for (const d of gone) for (const c of d.cards) if (!keep.has(this.pkey(c))) delete state.progress[this.pkey(c)];
    }
    // новая колода уровня приходит в том же состоянии, что и колоды этого уровня у игрока: включил A2 — новые колоды A2 тоже
    // включены (иначе слова, переехавшие в новую тематическую колоду, выпали бы из раундов); выключил A1 — новые A1 тоже выключены
    let added = 0;
    for (const nd of fresh) if (!state.decks.some(d => d.id === nd.id)) {
      const lvl = this.levelOf(nd), same = lvl ? state.decks.filter(d => this.levelOf(d) === lvl) : [];
      if (same.length) nd.active = same.some(d => d.active);
      state.decks.push(nd); added++;
    }
    return added;
  },

  // ---------- слова из чтения (библиотека) ----------
  READING_ID: 'reading',
  /** Уровень ученика по включённым встроенным колодам: самый высокий из A1/A2/B1 (никакие не включены — A1). */
  planLevel(state) {
    const order = ['A1', 'A2', 'B1'];
    let best = 0;
    for (const d of state.decks) if (d.active) best = Math.max(best, order.indexOf(this.levelOf(d)));
    return order[best];
  },
  /** Слово карточки — то, к чему привязан прогресс: одно слово во всех колодах — один прогресс
   *  (выучили в A1 — выучено и в «Словах из чтения», и наоборот). Строчные, без артикля, -άω → -ώ (ξυπνάω = ξυπνώ);
   *  ударение различает слова: πότε ≠ ποτέ, ώμος ≠ ωμός. */
  wordKey(front) {
    return String(front || '').normalize('NFC').toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim()
      .replace(/^(ο|η|το|οι|τα) /, '').replace(/άω$/, 'ώ');
  },
  /** Ключ прогресса карточки (= wordKey её греческой стороны; запоминается, чтобы не считать каждый раз). */
  pkey(card) {
    const e = CARD_KEYS.get(card);
    if (e && e[0] === card.front) return e[1];
    const k = this.wordKey(card.front);
    CARD_KEYS.set(card, [card.front, k]);
    return k;
  },
  /** Колода «слова из чтения»: cards — [{ key, front, back, hint }] от читалки (уже отобранные по уровню).
   *  Слово может быть и в других колодах — прогресс у него один (pkey), а в раунд оно попадает один раз (activeCards).
   *  Возвращает, изменилась ли колода. */
  setReadingDeck(state, cards, name) {
    const list = [], seen = new Set();
    for (const c of cards) {
      const w = this.wordKey(c.front);
      if (!c.front || !c.back || seen.has(w)) continue;
      seen.add(w);
      list.push({ id: this.READING_ID + ':' + this.hash(String(c.key)), front: c.front, back: c.back, hint: c.hint || '' });
    }
    let deck = state.decks.find(d => d.id === this.READING_ID);
    if (!deck && !list.length) return false;
    if (!deck) { deck = { id: this.READING_ID, name, active: true, builtin: false, reading: true, cards: [] }; state.decks.push(deck); }
    if (!list.length && !deck.cards.length) return false;
    const before = JSON.stringify([deck.name, deck.cards]);
    deck.name = name; deck.reading = true; deck.cards = list;
    return JSON.stringify([deck.name, deck.cards]) !== before;
  },

  /** Все слова (ключи прогресса) колод. */
  wordSet(decks) {
    const out = new Set();
    for (const d of decks) for (const c of d.cards) out.add(this.pkey(c));
    return out;
  },
  /** Сколько разных слов в колодах и сколько из них выучено (слово из двух колод — одно). */
  wordStats(state, decks) {
    const words = this.wordSet(decks);
    let learned = 0;
    for (const k of words) if (this.isLearned(this.progAt(state, k))) learned++;
    return { words: words.size, learned };
  },

  deckOfCard(state, cardId) {
    return state.decks.find(d => cardId.startsWith(d.id + ':'));
  },

  // ---------- импорт ----------
  clean(s) {
    if (s == null) return '';
    return String(s)
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
      .replace(/^\s*"(.*)"\s*$/, '$1')
      .replace(/\s+/g, ' ')
      .trim();
  },

  splitLine(line) {
    if (line.includes('\t')) return line.split('\t');
    if (line.includes(';')) return line.split(';');
    for (const sep of [' — ', ' – ', ' - ', ' = ', '=']) {
      const i = line.indexOf(sep);
      if (i > 0) {
        const rest = line.slice(i + sep.length);
        // возможная третья колонка — подсказка в скобках или через ещё один разделитель
        const j = rest.indexOf(sep);
        return j > 0 ? [line.slice(0, i), rest.slice(0, j), rest.slice(j + sep.length)] : [line.slice(0, i), rest];
      }
    }
    if (line.includes(',')) return line.split(',');
    return [line];
  },

  /** Возвращает { name, cards:[{front,back,hint}], skipped } */
  parse(text) {
    text = (text || '').replace(/^﻿/, '');
    const t = text.trim();
    let raw = [], name = null, skipped = 0;
    if (!t) return { name, cards: [], skipped };

    if (t[0] === '[' || t[0] === '{') {
      let data = JSON.parse(t);
      if (!Array.isArray(data)) {
        name = data.name || data.title || null;
        data = data.cards || data.items || data.notes || [];
      }
      for (const it of data) {
        if (Array.isArray(it)) raw.push({ front: it[0], back: it[1], hint: it[2] });
        else if (it && typeof it === 'object') raw.push({
          front: it.front ?? it.greek ?? it.el ?? it.word ?? it.term ?? it.question ?? it.q,
          back: it.back ?? it.translation ?? it.ru ?? it.en ?? it.meaning ?? it.definition ?? it.answer ?? it.a,
          hint: it.hint ?? it.translit ?? it.transliteration ?? it.transcription ?? it.note ?? '',
        });
        else skipped++;
      }
    } else {
      for (const line of t.split(/\r?\n/)) {
        if (!line.trim() || line.trim().startsWith('#')) continue;
        const parts = this.splitLine(line);
        if (parts.length < 2) { skipped++; continue; }
        raw.push({ front: parts[0], back: parts[1], hint: parts[2] || '' });
      }
    }

    const cards = [];
    for (const r of raw) {
      let front = this.clean(r.front), back = this.clean(r.back), hint = this.clean(r.hint);
      if (!front || !back) { skipped++; continue; }
      // греческая сторона — всегда «лицо» карточки
      if (!this.hasGreek(front) && this.hasGreek(back)) [front, back] = [back, front];
      cards.push({ front, back, hint });
    }
    return { name, cards, skipped };
  },
};
