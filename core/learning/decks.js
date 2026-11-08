'use strict';
// ============================================================
//  Колоды: стартовые, встроенные, импорт
// ============================================================

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

  /** Все встроенные колоды: стартовая + A1 из words.js. */
  builtinDecks() {
    const list = [this.sampleDeck()];
    if (typeof WORD_DECKS !== 'undefined') {
      for (const d of WORD_DECKS) {
        const deck = this.makeDeck(d.name, d.cards.map(([front, back, hint]) => ({ front, back, hint })), { id: d.id, builtin: true });
        deck.ver = typeof WORD_DECKS_VERSION !== 'undefined' ? WORD_DECKS_VERSION : 1;
        list.push(deck);
      }
    }
    return list;
  },

  /** Добавляет в сохранение встроенные колоды, которых там ещё нет. */
  ensureBuiltins(state) {
    let added = 0;
    for (const fresh of this.builtinDecks()) {
      const old = state.decks.find(d => d.id === fresh.id);
      if (!old) { state.decks.push(fresh); added++; continue; }
      // обновлённая встроенная колода (например, новый перевод): переносим прогресс по греческому слову
      if ((old.ver || 1) < (fresh.ver || 1)) {
        const byFront = new Map(fresh.cards.map(c => [c.front, c]));
        for (const c of old.cards) {
          const n = byFront.get(c.front), p = state.progress[c.id];
          if (n && p && n.id !== c.id) { state.progress[n.id] = p; delete state.progress[c.id]; }
        }
        old.cards = fresh.cards; old.ver = fresh.ver; old.name = fresh.name;
      }
    }
    return added;
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
