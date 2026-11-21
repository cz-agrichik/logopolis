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
          const [keys, head, ru, level] = dict.phrases[p];
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
          if (!seen.has(id)) { seen.add(id); found.push([w, head, ru, level || ""]); }
        }
      }
    }
    return found;
  }

  /** Название по умолчанию — первая непустая строка (до 60 символов). */
  function titleOf(text) {
    const first = String(text || "").split("\n").map(line => line.trim()).find(Boolean) || "";
    const chars = Array.from(first);
    return (chars.length > 60 ? `${chars.slice(0, 57).join("")}…` : first) || "Свой текст";
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
        const [key, upos, feats, seen, gram, formRu, formLevel] = hit.a;
        const entry = dict.lemmas[key];
        if (entry) lemmas[key] = entry;
        Object.assign(word, { lemma: (entry && entry.head) || key, key, upos, feats, seen, guess: hit.guess,
          gram: gram || "", formRu: formRu || "", formLevel: formLevel || "" });
        known += 1;
        if (hit.guess) guessed += 1;
      } else {
        Object.assign(word, { lemma: form, key: fold(form).replace(/'$/, ""), unknown: true });
      }
      words.push(word);
    }
    const phrases = matchPhrases(words, spans.length, dict);
    return {
      version: 3,
      title: title || titleOf(text),
      text,
      chapters: [{ title: "Свой текст", start: 0, end: chars.length }],
      sentences: spans.map(([a, b]) => [a, b, ""]),
      lemmas,
      words,
      phrases,
      meta: { source: "own", complete: true, known, guessed, total: words.length },
    };
  }

  // ───────────── Уровень текста по словарю ─────────────
  // Ципф: даже в тексте C1 большинство слов — частые A1–A2. Поэтому уровень текста — по покрытию: самый низкий
  // уровень, при котором знаком 95% слов текста (порог понимания с опорой на контекст и словарь), «свободно» — 98%.
  // Уровень слова в тексте — наибольший из уровня леммы и уровня её формы (аорист, род. п. мн. ч.…).
  // Имена, незнакомые словарю слова и слова без уровня (нет ответа, «?») не считаются.
  const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
  const levelTop = level => {
    const parts = String(level || "").split("–").filter(x => LEVELS.includes(x));
    return parts.length ? LEVELS.indexOf(parts[parts.length - 1]) : -1;
  };
  function textLevel(raw) {
    const chars = Array.from(String(raw && raw.text || ""));
    const lemmas = raw.lemmas || {}, forms = raw.forms || {};
    const counts = LEVELS.map(() => 0);
    let total = 0, skipped = 0;
    for (const w of raw.words || []) {
      if (w.unknown || /PROPN/.test(w.upos || "")) continue;
      const lemma = levelTop((lemmas[w.key] || {}).level);
      if (lemma < 0) { skipped += 1; continue; }
      const form = chars.slice(w.start, w.end).join("");
      const formLevel = levelTop(w.formLevel || (forms[`${fold(form).replace(/^'+|'+$/g, "")}|${w.key}`] || [])[2]);
      counts[Math.max(lemma, formLevel)] += 1;
      total += 1;
    }
    if (total < 15) return null;
    let acc = 0, level = "", fluent = "";
    const coverage = {};
    LEVELS.forEach((L, i) => {
      acc += counts[i];
      coverage[L] = acc / total;
      if (!level && acc / total >= 0.95) level = L;
      if (!fluent && acc / total >= 0.98) fluent = L;
    });
    return { level: level || "C2", fluent: fluent || "C2", coverage, total, skipped };
  }

  // ───────────── «Мои тексты»: хранилище в браузере пользователя ─────────────
  // localStorage (на сайте — у каждого посетителя свой, на сервер ничего не уходит). storage — объект
  // с getItem/setItem/removeItem (в браузере — localStorage, в тестах — подделка). Запись может бросить
  // исключение (приватный режим, нет места) — его ловит страница.
  const STORE_KEY = "greek-reader:own-texts:v1";
  const LEGACY_KEY = "greek-reader:own-text";   // прежняя версия: один текст без названия
  const BACKUP_APP = "logos-own-texts";
  const hasGreek = text => /[\u0370-\u03ff\u1f00-\u1fff]/.test(String(text || ""));

  function Store(storage) {
    const read = () => {
      try {
        const db = JSON.parse(storage.getItem(STORE_KEY) || "null");
        if (db && db.texts && typeof db.texts === "object") return db;
      } catch (error) { /* испорчено или недоступно — начинаем с пустого */ }
      return { version: 1, texts: {} };
    };
    const write = db => storage.setItem(STORE_KEY, JSON.stringify(db));
    const newId = () => `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const clean = item => ({
      id: String(item.id), title: String(item.title || titleOf(item.text)), text: String(item.text),
      created: String(item.created || item.updated || new Date().toISOString()),
      updated: String(item.updated || item.created || new Date().toISOString()),
      stats: item.stats && typeof item.stats === "object" ? item.stats : null,
    });

    const api = {
      list: () => Object.values(read().texts).sort((a, b) => String(b.updated).localeCompare(String(a.updated))),
      get: id => read().texts[id] || null,
      /** Сохранить новый (без id) или исправленный текст; stats — сводка разбора для полки. */
      put({ id, title, text, stats }) {
        const db = read();
        const old = id && db.texts[id];
        const now = new Date().toISOString();
        const item = clean({ id: old ? id : newId(), title: String(title || "").trim() || titleOf(text), text,
          created: old ? old.created : now, updated: now, stats: stats || null });
        db.texts[item.id] = item;
        write(db);
        return item;
      },
      remove(id) {
        const db = read();
        const removed = db.texts[id] || null;
        if (removed) { delete db.texts[id]; write(db); }
        return removed;
      },
      restore(item) {
        const db = read();
        db.texts[item.id] = clean(item);
        write(db);
      },
      /** Прежняя версия хранила один текст без названия — переносим его в список (один раз). */
      migrate() {
        let legacy = null;
        try { legacy = storage.getItem(LEGACY_KEY); } catch (error) { return null; }
        if (!legacy) return null;
        const item = hasGreek(legacy) ? api.put({ text: legacy }) : null;
        storage.removeItem(LEGACY_KEY);
        return item;
      },
      /** Копия всех текстов одним файлом JSON. */
      exportJson: () => JSON.stringify({ app: BACKUP_APP, version: 1, exported: new Date().toISOString(), texts: api.list() }, null, 2),
      /** Загрузка файла: копия (.json) — добавляет новые тексты и обновляет те, что в копии свежее;
       *  обычный текст (.txt) — новый текст с названием по имени файла. Возвращает { added, updated, skipped }. */
      importFile(name, content) {
        const out = { added: 0, updated: 0, skipped: 0 };
        if (/\.json$/i.test(name)) {
          let parsed;
          try { parsed = JSON.parse(content); } catch (error) { throw new Error("Это не копия «Моих текстов»: файл не читается как JSON."); }
          if (!parsed || parsed.app !== BACKUP_APP || !Array.isArray(parsed.texts)) throw new Error("Это не копия «Моих текстов».");
          const db = read();
          for (const item of parsed.texts) {
            if (!item || !item.id || !hasGreek(item.text)) { out.skipped += 1; continue; }
            const have = db.texts[item.id];
            if (!have) { db.texts[item.id] = clean(item); out.added += 1; }
            else if (String(item.updated) > String(have.updated)) { db.texts[item.id] = clean(item); out.updated += 1; }
            else out.skipped += 1;
          }
          write(db);
          return out;
        }
        if (!hasGreek(content)) throw new Error(`В файле «${name}» нет греческого текста.`);
        api.put({ title: String(name).replace(/\.[^.]+$/, ""), text: content });
        out.added = 1;
        return out;
      },
    };
    return api;
  }

  const api = { build, fold, splitSentences, titleOf, Store, hasGreek, textLevel, levelTop, LEVELS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.OwnText = api;
})(typeof window !== "undefined" ? window : globalThis);
