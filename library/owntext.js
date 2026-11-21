// «Свой текст»: разбор любого греческого текста прямо в браузере по словарю сайта (dict.js).
// Текст никуда не отправляется. Словарь собирает tools/library/bookconverter.py из всех разобранных
// книг: форма → [лемма, часть речи, грамматика, как форму переводили], лемма → значения, обороты.
// Здесь — только поиск: форма как есть, потом без ударений; обороты — по леммам, с промежутком до 2 слов.
(function (root) {
  "use strict";

  // Ключ формы — так же, как fold() в bookconverter.py: NFC, строчные, ς → σ, ’ → '.
  const fold = value => String(value).normalize("NFC").toLowerCase().replace(/ς/g, "σ").replace(/’/g, "'");
  const bare = value => value.normalize("NFD").replace(/\p{M}/gu, "").normalize("NFC");
  // Слово: греческие буквы (с ударениями), внутренний апостроф (σ'αγαπώ), конечный — элизия (απ', σ').
  const WORD = /[\p{Script=Greek}\p{M}]+(?:['’][\p{Script=Greek}\p{M}]+)*['’]?/gu;
  const END = new Set([".", "!", "?", ";", "…"]);
  const CLOSE = new Set(["»", "\"", "”", "’", ")", "'"]);
  const MAX_GAP = 2;
  // Частые элизии: если самой формы с апострофом нет в словаре, ищем полную.
  const ELISION = { "σ'": "σε", "απ'": "από", "μ'": "με", "γι'": "για", "θ'": "θα", "ν'": "να", "π'": "που", "τ'": "το", "κάτ'": "κάτω", "όπ'": "όπου" };   // сколько чужих слов может стоять внутри оборота («έριξε μια γρήγορη ματιά»)

  /** Индексы словаря (один раз на словарь): форма без ударений → форма (если однозначно), оборот по первой лемме. */
  function indexes(dict) {
    if (dict._loose) return dict;
    const loose = new Map();
    for (const form of Object.keys(dict.forms || {})) {
      const key = bare(form);
      loose.set(key, loose.has(key) && loose.get(key) !== form ? null : form);
    }
    const byFirst = new Map();
    (dict.phrases || []).forEach((phrase, i) => {
      const first = phrase[0][0];
      if (!byFirst.has(first)) byFirst.set(first, []);
      byFirst.get(first).push(i);
    });
    Object.defineProperty(dict, "_loose", { value: loose });
    Object.defineProperty(dict, "_byFirst", { value: byFirst });
    return dict;
  }

  function lookup(dict, form) {
    let key = fold(form);
    let found = dict.forms[key];
    if (!found && ELISION[key]) found = dict.forms[ELISION[key]];
    if (!found && key.endsWith("'")) found = dict.forms[key.slice(0, -1)];
    if (found) return { a: found, guess: false };
    const alt = dict._loose.get(bare(key));
    return alt ? { a: dict.forms[alt], guess: true } : null;
  }

  /** Границы предложений в символах (code points): точка, !, ?, греческий вопрос ;, многоточие или конец строки. */
  function splitSentences(chars) {
    const out = [];
    let start = -1;
    let last = -1;
    for (let i = 0; i < chars.length; i += 1) {
      const ch = chars[i];
      if (ch === "\n") {
        if (start >= 0) out.push([start, last + 1]);
        start = -1;
        continue;
      }
      if (/\s/u.test(ch)) continue;
      if (start < 0) start = i;
      last = i;
      if (END.has(ch)) {
        let j = i + 1;
        while (j < chars.length && (END.has(chars[j]) || CLOSE.has(chars[j]))) j += 1;
        if (j >= chars.length || /\s/u.test(chars[j])) {
          out.push([start, j]);
          start = -1;
          last = j - 1;
          i = j - 1;
        }
      }
    }
    if (start >= 0) out.push([start, last + 1]);
    return out;
  }

  /** Обороты словаря в тексте: леммы оборота по порядку внутри одного предложения, между соседними — до MAX_GAP слов. */
  function matchPhrases(words, sentenceCount, dict) {
    const bySentence = Array.from({ length: sentenceCount }, () => []);
    words.forEach((word, i) => { if (word.s >= 0) bySentence[word.s].push(i); });
    const found = [];
    const seen = new Set();
    for (const list of bySentence) {
      for (let a = 0; a < list.length; a += 1) {
        for (const p of dict._byFirst.get(words[list[a]].key) || []) {
          const [keys, head, ru] = dict.phrases[p];
          const got = [a];
          for (let k = 1; k < keys.length; k += 1) {
            const from = got[got.length - 1];
            let hit = -1;
            for (let b = from + 1; b < list.length && b <= from + 1 + MAX_GAP; b += 1) {
              if (words[list[b]].key === keys[k]) { hit = b; break; }
            }
            if (hit < 0) break;
            got.push(hit);
          }
          if (got.length !== keys.length) continue;
          const w = got.map(b => list[b]);
          const id = `${p}:${w[0]}`;
          if (!seen.has(id)) { seen.add(id); found.push([w, head, ru]); }
        }
      }
    }
    return found;
  }

  /** Данные для GreekReader.start — тот же формат, что у книги (версия 3), плюс сводка в meta. */
  function build(input, dict, title) {
    indexes(dict);
    const text = String(input || "").normalize("NFC").replace(/\r\n?/g, "\n").replace(/^\n+|\s+$/g, "");
    const chars = Array.from(text);
    // позиция в UTF-16 (как у RegExp) → номер символа (как в книгах)
    const cp = new Map();
    let unit = 0;
    chars.forEach((ch, i) => { cp.set(unit, i); unit += ch.length; });
    cp.set(unit, chars.length);

    const spans = splitSentences(chars);
    const words = [];
    const lemmas = {};
    let s = 0;
    let known = 0;
    let guessed = 0;
    for (const match of text.matchAll(WORD)) {
      const start = cp.get(match.index);
      const end = cp.get(match.index + match[0].length);
      while (s < spans.length - 1 && start >= spans[s][1]) s += 1;
      const inside = spans[s] && start >= spans[s][0] && end <= spans[s][1];
      const form = match[0];
      const hit = lookup(dict, form);
      const word = { start, end, s: inside ? s : -1 };
      if (hit) {
        const [key, upos, feats, seen] = hit.a;
        const entry = dict.lemmas[key];
        if (entry) lemmas[key] = entry;
        Object.assign(word, { lemma: (entry && entry.head) || key, key, upos, feats, seen, guess: hit.guess });
        known += 1;
        if (hit.guess) guessed += 1;
      } else {
        Object.assign(word, { lemma: form, key: fold(form).replace(/'$/, ""), unknown: true });
      }
      words.push(word);
    }
    const phrases = matchPhrases(words, spans.length, dict);
    const firstLine = text.split("\n").map(line => line.trim()).find(Boolean) || "";
    return {
      version: 3,
      title: title || (firstLine.length > 60 ? `${Array.from(firstLine).slice(0, 57).join("")}…` : firstLine) || "Свой текст",
      text,
      chapters: [{ title: "Свой текст", start: 0, end: chars.length }],
      sentences: spans.map(([a, b]) => [a, b, ""]),
      lemmas,
      words,
      phrases,
      meta: { source: "own", complete: true, known, guessed, total: words.length },
    };
  }

  const api = { build, fold, splitSentences };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.OwnText = api;
})(typeof window !== "undefined" ? window : globalThis);
