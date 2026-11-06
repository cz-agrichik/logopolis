'use strict';
// ============================================================
//  Колоды карточек: стартовый набор, импорт, интервальное повторение
// ============================================================

const SAMPLE_DECK = {
  id: 'cyprus-starter', name: 'Стартовый набор: Кипр', builtin: true, active: true,
  cards: [
    ['σπίτι', 'дом', 'spíti'],
    ['νερό', 'вода', 'neró'],
    ['ψωμί', 'хлеб', 'psomí'],
    ['θάλασσα', 'море', 'thálassa'],
    ['ήλιος', 'солнце', 'ílios'],
    ['βουνό', 'гора', 'vounó'],
    ['δέντρο', 'дерево', 'déntro'],
    ['πέτρα', 'камень', 'pétra'],
    ['χαλκός', 'медь', 'chalkós'],
    ['ελιά', 'олива', 'eliá'],
    ['κρασί', 'вино', 'krasí'],
    ['φωτιά', 'огонь', 'fotiá'],
    ['πόλη', 'город', 'póli'],
    ['ναός', 'храм', 'naós'],
    ['βασιλιάς', 'царь', 'vasiliás'],
    ['καράβι', 'корабль', 'karávi'],
    ['φίλος', 'друг', 'fílos'],
    ['ουρανός', 'небо', 'ouranós'],
    ['καλημέρα', 'доброе утро', 'kaliméra'],
    ['ευχαριστώ', 'спасибо', 'efcharistó'],
  ],
};

// ------------------------------------------------------------
//  Повторение: сначала «заучивание» (N верных ответов подряд в ближайших раундах),
//  затем слово считается выученным и возвращается всё реже, по выбранному «аппетиту».
// ------------------------------------------------------------
const MIN = 60e3, HOUR = 3600e3, DAY = 24 * HOUR;
const LEARN_DELAY = 30e3;          // в фазе заучивания карточка снова готова через 30 секунд
const APPETITES = {
  rare:   { name: 'Редко',    desc: 'выучил — и почти забыл про слово',   intervals: [DAY, 30 * DAY, 180 * DAY] },
  normal: { name: 'Умеренно', desc: 'пара коротких повторов, потом надолго', intervals: [HOUR, DAY, 14 * DAY, 90 * DAY] },
  often:  { name: 'Часто',    desc: 'больше повторов для надёжности',     intervals: [10 * MIN, HOUR, DAY, 4 * DAY, 14 * DAY, 60 * DAY] },
};
const DEFAULT_SETTINGS = { learnSteps: 3, appetite: 'normal', newPerRound: 5, roundSize: 8 };

const GREEK_RE = /[Ͱ-Ͽἀ-῿]/;

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
  /** Слово готово стать выученным, но ещё ни разу не было набрано — нужен набор. */
  needsBuild(state, card) {
    const p = this.prog(state, card.id);
    return !!p && p.rev < 0 && !p.built && p.step >= this.settings(state).learnSteps - 1 && this.canType(card);
  },
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

  /** Возвращает 'learned', если карточка только что стала выученной. */
  grade(state, card, correct, kind, typed = false) {
    const now = Date.now(), set = this.settings(state), iv = this.intervals(state);
    const p = this.prog(state, card.id) || { step: 0, rev: -1, due: 0, right: 0, wrong: 0 };
    let event = null;
    if (correct) {
      p.right++;
      if (typed) p.built = true;
      if (p.rev < 0) {
        p.step++;
        if (p.step >= set.learnSteps && !p.built && this.canType(card)) {
          // без единого набора слово не выучено: ждём задания «Соберите слово»
          p.step = set.learnSteps - 1; p.due = now + LEARN_DELAY; event = 'needtype';
        } else if (p.step >= set.learnSteps) { p.rev = Math.min(p.back || 0, iv.length - 1); delete p.back; p.due = now + iv[p.rev]; event = 'learned'; }
        else p.due = now + LEARN_DELAY;
      } else if (kind !== 'early') {
        p.rev = Math.min(p.rev + 1, iv.length - 1);
        p.due = now + iv[p.rev];
      }
    } else {
      p.wrong++;
      if (p.rev >= 0) { p.back = Math.max(0, p.rev - 1); p.rev = -1; p.step = Math.max(0, set.learnSteps - 1); }
      else p.step = Math.max(0, p.step - 1);
      p.due = now + LEARN_DELAY;
    }
    p.last = now;
    state.progress[card.id] = p;
    return event;
  },

  /** Короткое описание прогресса карточки для таблиц. */
  progressText(state, id) {
    const p = this.prog(state, id);
    if (!p) return '<span class="dim">новая</span>';
    if (this.isLearned(p)) {
      const left = p.due - Date.now();
      return `<span class="learned-mark">✓ выучено</span> <span class="dim">${left > 0 ? 'повтор через ' + fmtDur(left) : 'пора повторить'}</span>`;
    }
    const L = this.settings(state).learnSteps;
    return `<span class="steps">${'●'.repeat(p.step)}${'○'.repeat(Math.max(0, L - p.step))}</span>${p.built ? ' <span class="dim" title="Слово уже набирали">✍</span>' : ''}`;
  },
};

function fmtDur(ms) {
  const m = Math.round(ms / 60000);
  if (m < 60) return `${Math.max(1, m)} мин`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} ч`;
  return `${Math.round(h / 24)} дн`;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
