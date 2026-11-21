// Читалка библиотеки: строит текст книги (library/books/<id>.js) или своего текста (owntext.js),
// показывает карточку слова и оборота, ведёт колоду запомненных слов и экспортирует её
// в Anki / Quizlet / Brainscape / CSV. Запуск — GreekReader.start(данные); самодостаточный файл
// (bookconverter.py --html) запускается сам: данные лежат в window.GREEK_BOOK_DATA.
(() => {
  "use strict";

  const $ = selector => document.querySelector(selector);
  const book = $("#book");

  // ───────────────────── Справочники грамматики ─────────────────────

  const UPOS = {
    NOUN: "сущ.", PROPN: "имя собств.", VERB: "гл.", AUX: "вспом. гл.", ADJ: "прил.",
    ADV: "нареч.", PRON: "мест.", DET: "арт.", ADP: "предл.", CCONJ: "союз",
    SCONJ: "союз", PART: "част.", NUM: "числ.", INTJ: "межд.", X: "",
  };

  // null — признак известен, но в подсказке не нужен.
  const FEATURES = {
    Case: { Nom: "им. падеж", Gen: "род. падеж", Acc: "вин. падеж", Dat: "дат. падеж", Voc: "зват. падеж" },
    Gender: { Masc: "муж. род", Fem: "жен. род", Neut: "ср. род" },
    Number: { Sing: "ед. число", Plur: "мн. число", Dual: "двойств. число" },
    Person: { 1: "1-е лицо", 2: "2-е лицо", 3: "3-е лицо" },
    Tense: { Pres: "наст. время", Past: "прош. время", Fut: "буд. время" },
    Aspect: { Imp: "несоверш. вид", Perf: "соверш. вид" },
    Mood: { Ind: "изъявит.", Imp: "повелит.", Sub: "сослагат." },
    Voice: { Act: "действ. залог", Pass: "страд. залог" },
    VerbForm: { Fin: null, Inf: "инфинитив", Part: "причастие", Conv: "деепричастие", Ger: "герундий" },
    Degree: { Pos: null, Cmp: "сравнит. степень", Sup: "превосх. степень" },
    Definite: { Def: "определённый", Ind: "неопределённый" },
    PronType: {
      Art: "артикль", Prs: "личное", Dem: "указательное", Rel: "относительное", Int: "вопросительное",
      Ind: "неопределённое", Tot: "обобщающее", Neg: "отрицательное", Emp: "усилительное",
    },
    Poss: { Yes: "притяжательное" },
    Reflex: { Yes: "возвратное" },
    NumType: { Card: "количественное", Ord: "порядковое", Mult: "кратное" },
    Polarity: { Neg: "отрицание" },
    Foreign: { Yes: "иностранное слово" },
    Abbr: { Yes: "сокращение" },
  };

  function parseFeats(rawFeats) {
    const labels = [];
    const unknown = [];
    for (const part of String(rawFeats || "").split("|")) {
      const feature = part.trim();
      if (!feature) continue;
      const [name, value] = feature.split("=");
      const table = Object.prototype.hasOwnProperty.call(FEATURES, name) ? FEATURES[name] : null;
      if (table && Object.prototype.hasOwnProperty.call(table, value)) {
        if (table[value]) labels.push(table[value]);
      } else {
        unknown.push(feature);
      }
    }
    return { labels, unknown };
  }

  function uposLabel(upos) {
    return String(upos || "").split("+").map(tag => UPOS[tag] || "").filter(Boolean).join(" + ");
  }

  // ───────────────────── Данные книги (v1 и v2) ─────────────────────

  const legacyKey = value => String(value || "").trim().normalize("NFC").toLocaleLowerCase("el");
  // Оборот — своя лексическая единица: ключ карточки «phrase:<словарная форма>» (NFC, строчные, ς → σ).
  const phraseKey = head => "phrase:" + String(head || "").normalize("NFC").toLowerCase().replace(/ς/g, "σ").replace(/\s+/g, " ").trim();
  const isPhraseKey = key => String(key).startsWith("phrase:");
  const squash = value => String(value || "").replace(/\s+/g, " ").trim();

  function normalizeData(input) {
    if (!input || typeof input.text !== "string" || !input.text || !Array.isArray(input.words)) {
      return null;
    }
    const chars = Array.from(input.text);
    const slice = (start, end) => chars.slice(start, end).join("");
    const v2 = input.version >= 2;
    const sentences = v2 && Array.isArray(input.sentences)
      ? input.sentences.map(([start, end, ru]) => ({ start, end, ru: ru || "" }))
      : [];

    let cursor = 0;
    const words = [];
    for (const item of input.words) {
      if (!Number.isInteger(item.start) || !Number.isInteger(item.end) ||
          item.start < cursor || item.end <= item.start || item.end > chars.length) {
        throw new Error("неверные позиции слов");
      }
      cursor = item.end;
      const form = slice(item.start, item.end);
      words.push({
        start: item.start,
        end: item.end,
        s: Number.isInteger(item.s) && sentences[item.s] ? item.s : -1,
        form,
        lemma: item.lemma || form,
        key: item.key || legacyKey(item.lemma || form),
        upos: item.upos || "",
        feats: item.feats || "",
        ru: item.ru || "",
        en: item.en || "",
        seen: item.seen || "",          // свой текст: как форму переводили в книгах
        unknown: Boolean(item.unknown), // свой текст: слова нет в словаре сайта
        guess: Boolean(item.guess),     // свой текст: нашлось без учёта ударений
      });
    }

    // Обороты (версия 3): [[номера слов], словарная форма, перевод]
    const phrases = [];
    const phrasesOfWord = new Map();
    for (const item of Array.isArray(input.phrases) ? input.phrases : []) {
      if (!Array.isArray(item) || !Array.isArray(item[0])) continue;
      const w = item[0].filter(i => Number.isInteger(i) && i >= 0 && i < words.length);
      if (w.length < 2) continue;
      const head = String(item[1] || "");
      const index = phrases.push({ w, head, ru: String(item[2] || ""), level: item[3] || "", key: phraseKey(head) }) - 1;
      for (const i of w) {
        if (!phrasesOfWord.has(i)) phrasesOfWord.set(i, []);
        phrasesOfWord.get(i).push(index);
      }
    }

    // Старый формат без названия: берём первую строку текста, которая не ссылка.
    const firstLine = input.text.split("\n").map(line => line.trim())
      .find(line => /\p{L}/u.test(line) && !/^https?:\/\//.test(line)) || "";

    // Главы. Старые данные — одна глава на весь текст.
    const chapters = (v2 && Array.isArray(input.chapters) ? input.chapters : [])
      .filter(ch => ch && Number.isInteger(ch.start) && Number.isInteger(ch.end) && ch.end >= ch.start)
      .map(ch => ({ title: String(ch.title || ""), start: ch.start, end: Math.min(ch.end, chars.length) }));
    if (!chapters.length) chapters.push({ title: input.title || firstLine, start: 0, end: chars.length });

    return {
      version: v2 ? 2 : 1,
      chapters,
      title: input.title || firstLine.slice(0, 120),
      chars,
      slice,
      sentences,
      words,
      lemmas: (v2 && input.lemmas) || {},
      phrases,
      phrasesOfWord,
      meta: input.meta || {},
    };
  }

  // ───────────────────── Колода (localStorage) ─────────────────────

  const STORE_KEY = "greek-reader:deck:v2";
  const LEGACY_STORE_KEY = "greek-reader:remembered-lemmas:v1";
  let cards = {};
  let storageError = "";

  function loadDeck() {
    try {
      const saved = localStorage.getItem(STORE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!parsed || typeof parsed.cards !== "object") throw new Error("формат");
        cards = parsed.cards;
        return;
      }
      // Переезд со старой версии: там хранился только список лемм.
      const legacy = JSON.parse(localStorage.getItem(LEGACY_STORE_KEY) || "[]");
      if (Array.isArray(legacy) && legacy.length) {
        const now = new Date().toISOString();
        for (const key of legacy) {
          if (typeof key === "string" && key) {
            cards[key] = { key, head: key, status: "learning", addedAt: now, needsDetails: true };
          }
        }
        persist(cards);
      }
    } catch (error) {
      storageError = "Браузер не дал прочитать сохранённые карточки. Проверь настройки хранилища.";
    }
  }

  function persist(next) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ version: 2, cards: next }));
    } catch (error) {
      storageError = "Не удалось сохранить: браузер запретил запись. Сделай резервную копию колоды.";
      return false;
    }
    cards = next;
    storageError = "";
    return true;
  }

  function updateCards(mutator) {
    const next = JSON.parse(JSON.stringify(cards));
    mutator(next);
    const ok = persist(next);
    refreshAll();
    return ok;
  }

  // ───────────────────── Построение текста ─────────────────────

  let data = null;
  const elementsByKey = new Map();
  const wordElements = [];                 // номер слова → его элемент
  const phrasesByKey = new Map();          // ключ оборота → номера его вхождений в data.phrases
  const phraseWords = i => data.phrases[i].w.map(w => wordElements[w]).filter(Boolean);
  // слово как часть оборота: самый длинный оборот, куда оно входит (или null)
  const phraseOfWord = index => (data.phrasesOfWord.get(index) || [])
    .map(i => data.phrases[i]).sort((a, b) => b.w.length - a.w.length)[0] || null;
  const phraseIndex = phrase => data.phrases.indexOf(phrase);
  // текст вхождения оборота: от первого его слова до последнего («έριξε μια γρήγορη ματιά»)
  const phraseText = phrase => squash(data.slice(data.words[phrase.w[0]].start, data.words[phrase.w[phrase.w.length - 1]].end));
  const sentenceElements = [];

  function makeWordElement(word, index) {
    const element = document.createElement("span");
    element.className = "word";
    element.tabIndex = 0;
    element.setAttribute("role", "button");
    element.dataset.i = String(index);
    element.textContent = word.form;
    if (data.phrasesOfWord.has(index)) element.classList.add("word--phrase");
    if (word.unknown) element.classList.add("word--unknown");
    if (!elementsByKey.has(word.key)) elementsByKey.set(word.key, []);
    elementsByKey.get(word.key).push(element);
    wordElements[index] = element;
    return element;
  }

  const chapterSections = [];

  function indexPhrases() {
    data.phrases.forEach((phrase, i) => {
      if (!phrasesByKey.has(phrase.key)) phrasesByKey.set(phrase.key, []);
      phrasesByKey.get(phrase.key).push(i);
    });
  }

  function renderBook() {
    const fragment = document.createDocumentFragment();
    let target = fragment;
    let cursor = 0;
    let nextChapter = 0;
    const text = (start, end) => {
      if (end > start) target.appendChild(document.createTextNode(data.slice(start, end)));
    };
    // Каждая глава — свой <section>. Открываем новую, как только дошли до её начала;
    // разделитель между главами (пустые строки) не выводим — отступ даёт CSS.
    const advance = position => {
      while (nextChapter < data.chapters.length && data.chapters[nextChapter].start <= position) {
        const chapter = data.chapters[nextChapter];
        if (nextChapter > 0) text(cursor, Math.min(data.chapters[nextChapter - 1].end, chapter.start));
        const section = document.createElement("section");
        section.className = "chapter";
        section.id = `chapter-${nextChapter + 1}`;
        section.dataset.chapter = String(nextChapter);
        fragment.appendChild(section);
        chapterSections.push(section);
        target = section;
        cursor = Math.max(cursor, chapter.start);
        nextChapter += 1;
      }
    };

    // Сначала проверяем, что каждое слово лежит внутри своего предложения.
    const nested = data.sentences.length > 0 && data.words.every(word => {
      const sentence = data.sentences[word.s];
      return sentence && word.start >= sentence.start && word.end <= sentence.end;
    }) && data.sentences.every((sentence, i) =>
      sentence.start < sentence.end && (i === 0 || sentence.start >= data.sentences[i - 1].end));

    advance(0);
    if (nested) {
      let w = 0;
      data.sentences.forEach((sentence, s) => {
        advance(sentence.start);
        text(cursor, sentence.start);
        const span = document.createElement("span");
        span.className = "sentence";
        let inner = sentence.start;
        while (w < data.words.length && data.words[w].s === s) {
          const word = data.words[w];
          if (word.start > inner) span.appendChild(document.createTextNode(data.slice(inner, word.start)));
          span.appendChild(makeWordElement(word, w));
          inner = word.end;
          w += 1;
        }
        if (sentence.end > inner) span.appendChild(document.createTextNode(data.slice(inner, sentence.end)));
        target.appendChild(span);
        sentenceElements[s] = span;
        cursor = sentence.end;
      });
    } else {
      data.words.forEach((word, w) => {
        advance(word.start);
        text(cursor, word.start);
        target.appendChild(makeWordElement(word, w));
        cursor = word.end;
      });
    }
    advance(data.chars.length);
    text(cursor, data.chapters[data.chapters.length - 1].end);
    book.replaceChildren(fragment);
  }

  // ── Оглавление: выпадающий список глав в шапке ──
  const chapterSelect = $("#chapter-select");
  let currentChapter = -1;

  function setupChapters() {
    if (!chapterSelect) return;
    if (data.chapters.length < 2) {
      chapterSelect.hidden = true;
      return;
    }
    chapterSelect.replaceChildren(...data.chapters.map((chapter, i) => {
      const option = document.createElement("option");
      option.value = String(i);
      option.textContent = chapter.title || `Глава ${i + 1}`;
      return option;
    }));
    chapterSelect.hidden = false;
    chapterSelect.addEventListener("change", () => {
      const section = chapterSections[Number(chapterSelect.value)];
      if (section) {
        hidePopover();
        const top = section.getBoundingClientRect().top + window.scrollY - 70;
        window.scrollTo({ top, behavior: reduceMotion() ? "auto" : "smooth" });
      }
    });
  }

  function updateCurrentChapter() {
    if (!chapterSelect || chapterSections.length < 2) return;
    let index = 0;
    chapterSections.forEach((section, i) => {
      if (section.getBoundingClientRect().top < window.innerHeight * 0.35) index = i;
    });
    if (index !== currentChapter) {
      currentChapter = index;
      chapterSelect.value = String(index);
    }
  }


  function sentenceOf(word) {
    if (word.s >= 0) {
      const sentence = data.sentences[word.s];
      return { text: squash(data.slice(sentence.start, sentence.end)), ru: sentence.ru };
    }
    // Старый формат: ищем границы предложения по знакам препинания.
    const stops = new Set([".", "!", "?", ";", "…", "\n"]);
    let start = word.start;
    while (start > 0 && !stops.has(data.chars[start - 1])) start -= 1;
    let end = word.end;
    while (end < data.chars.length && !stops.has(data.chars[end])) end += 1;
    if (end < data.chars.length && data.chars[end] !== "\n") end += 1;
    return { text: squash(data.slice(start, end)), ru: "" };
  }

  function wordInfo(word) {
    const lemma = data.lemmas[word.key] || {};
    return {
      head: lemma.head || word.lemma || word.form,
      pos: lemma.pos || uposLabel(word.upos),
      meaning: lemma.ru || "",
      meaningEn: lemma.en || word.en || "",
      gloss: word.ru || "",
      seen: word.seen || "",
      level: lemma.level || "",
    };
  }

  // Уровень (CEFR; в греческой сертификации Α1–Γ2): "B1", "A2–B1" — на границе, "?" — не ясен, "" — нет данных.
  const LEVEL_TIP = "Уровень по шкале CEFR (в Греции — Α1…Γ2). «A2–B1» — на границе двух уровней, «?» — уровень не ясен. "
    + "Слова из колод игры — уровень учебника, остальные — оценка языковой модели.";
  function showLevel(chip, level) {
    chip.hidden = !level;
    chip.textContent = level === "?" ? "уровень ?" : level;
    chip.title = LEVEL_TIP;
  }

  const wiktionary = value => `https://en.wiktionary.org/wiki/${encodeURIComponent(String(value).toLocaleLowerCase("el"))}#Greek`;

  // ── Модель карточки ──
  // В колоде хранится только своё: греческое слово (ключ леммы + форма), предложение
  // из книги, название книги, статус и даты. Переводы — производные данные книги:
  // они берутся из book_content.js в момент показа и экспорта (см. cardView).
  // Поле saved — копия последнего известного перевода, только на случай, когда
  // слово открыто в другой книге и взять перевод больше неоткуда.
  const TRANSLATION_FIELDS = ["head", "pos", "meaning", "meaningEn", "gloss", "exampleRu", "level"];

  function cardFromPhrase(phrase) {
    const first = data.words[phrase.w[0]];
    const card = {
      key: phrase.key,
      kind: "phrase",
      form: phraseText(phrase),
      example: sentenceOf(first).text,
      book: data.title,
      addedAt: new Date().toISOString(),
      status: "learning",
    };
    card.saved = translationsFor(card) || {};
    return card;
  }

  function cardFromWord(word) {
    const sentence = sentenceOf(word);
    const card = {
      key: word.key,
      form: word.form,
      example: sentence.text,
      book: data.title,
      addedAt: new Date().toISOString(),
      status: "learning",
    };
    card.saved = translationsFor(card) || {};
    return card;
  }

  // Индекс предложений книги по тексту — чтобы найти сохранённое предложение карточки.
  let sentenceIndex = null;
  function findSentence(textValue) {
    if (!sentenceIndex) {
      sentenceIndex = new Map();
      data.sentences.forEach((sentence, i) => {
        const key = squash(data.slice(sentence.start, sentence.end));
        if (!sentenceIndex.has(key)) sentenceIndex.set(key, i);
      });
    }
    return sentenceIndex.has(squash(textValue)) ? sentenceIndex.get(squash(textValue)) : -1;
  }

  // Переводы для карточки из текущей книги или null, если слова в книге нет.
  function translationsFor(card) {
    if (isPhraseKey(card.key)) {
      const list = (phrasesByKey.get(card.key) || []).map(i => data.phrases[i]);
      if (!list.length) return null;
      const s = card.example ? findSentence(card.example) : -1;
      const same = list.find(p => data.words[p.w[0]].s === s);
      const phrase = same || list[0];
      const sentence = data.sentences[data.words[phrase.w[0]].s];
      return {
        head: phrase.head, pos: "оборот", meaning: phrase.ru, meaningEn: "", gloss: "",
        exampleRu: (same || !card.example) && sentence ? sentence.ru : "", level: phrase.level,
      };
    }
    const elements = elementsByKey.get(card.key);
    if (!elements) return null;
    // Предпочитаем то самое вхождение, из предложения карточки.
    const s = card.example ? findSentence(card.example) : -1;
    let word = null;
    if (s >= 0) {
      word = elements.map(e => data.words[Number(e.dataset.i)])
        .find(w => w.s === s && (!card.form || w.form === card.form)) || null;
    }
    const sameSentence = Boolean(word);
    word = word || data.words[Number(elements[0].dataset.i)];
    const info = wordInfo(word);
    return {
      head: info.head,
      pos: info.pos,
      meaning: info.meaning || info.gloss,
      meaningEn: info.meaningEn,
      gloss: sameSentence ? info.gloss : "",
      exampleRu: sameSentence ? data.sentences[s].ru : (card.example ? "" : sentenceOf(word).ru),
      level: info.level,
    };
  }

  // То, что видит пользователь и что уходит в экспорт: своё + переводы из книги.
  function cardView(card) {
    const fresh = translationsFor(card);
    const saved = card.saved || {};
    const view = { ...card };
    for (const field of TRANSLATION_FIELDS) {
      view[field] = (fresh && fresh[field]) || saved[field] || "";
    }
    if (!view.head) view.head = card.key;
    view.fromOtherBook = !fresh;
    return view;
  }

  // При открытии книги: приводим старые карточки к новой модели и обновляем
  // запасную копию переводов для слов, которые есть в этой книге.
  function refreshCardsFromBook() {
    const next = JSON.parse(JSON.stringify(cards));
    let changed = false;
    // Если после перегенерации книги у слова сменилась лемма (например, Stanza дала
    // «απλά», а модель — «απλώς»), находим слово по сохранённому предложению и форме
    // и переносим карточку на новый ключ.
    for (const card of Object.values(next)) {
      if (isPhraseKey(card.key) || elementsByKey.has(card.key) || !card.example || !card.form) continue;
      const s = findSentence(card.example);
      if (s < 0) continue;
      const word = data.words.find(w => w.s === s && w.form === card.form);
      if (!word || word.key === card.key || next[word.key]) continue;
      delete next[card.key];
      next[word.key] = { ...card, key: word.key };
      changed = true;
    }
    for (const card of Object.values(next)) {
      // Старые карточки хранили переводы прямо в себе — переносим их в saved.
      if (!card.saved) {
        card.saved = {};
        for (const field of TRANSLATION_FIELDS) {
          if (card[field]) card.saved[field] = card[field];
        }
        changed = true;
      }
      for (const field of TRANSLATION_FIELDS) {
        if (field in card) { delete card[field]; changed = true; }
      }
      if (isPhraseKey(card.key)) {
        const fresh = translationsFor(card);
        if (fresh && JSON.stringify(fresh) !== JSON.stringify(card.saved)) { card.saved = fresh; changed = true; }
        continue;
      }
      const elements = elementsByKey.get(card.key);
      if (!elements) continue;
      if (card.needsDetails || !card.example) {
        const word = data.words[Number(elements[0].dataset.i)];
        card.form = word.form;
        card.example = sentenceOf(word).text;
        card.book = data.title;
        delete card.needsDetails;
        changed = true;
      }
      const fresh = translationsFor(card);
      if (fresh && JSON.stringify(fresh) !== JSON.stringify(card.saved)) {
        card.saved = fresh;
        changed = true;
      }
    }
    if (changed) persist(next);
  }

  // ───────────────────── Подсветка и счётчики ─────────────────────

  const deckButton = $("#deck-button");
  const deckCount = $("#deck-count");

  const learningCard = key => cards[key] && cards[key].status !== "learned";

  function refreshHighlights() {
    const lit = new Set();
    for (const [key, elements] of elementsByKey) if (learningCard(key)) for (const element of elements) lit.add(element);
    for (const [key, list] of phrasesByKey) if (learningCard(key)) for (const i of list) for (const element of phraseWords(i)) lit.add(element);
    for (const element of wordElements) if (element) element.classList.toggle("word--learning", lit.has(element));
  }

  function refreshCounts() {
    const all = Object.values(cards);
    const learning = all.filter(card => card.status !== "learned").length;
    deckCount.textContent = String(learning);
    deckButton.setAttribute("aria-label", `Карточки: ${learning} учу, ${all.length - learning} выучил`);
    $("#tab-learning-count").textContent = String(learning);
    $("#tab-learned-count").textContent = String(all.length - learning);
  }

  function refreshMeta() {
    if (!data) return;
    const known = [...elementsByKey.keys(), ...phrasesByKey.keys()].filter(key => cards[key]).length;
    const parts = [];
    const n = data.chapters.length;
    if (n > 1) {
      const word = n % 10 === 1 && n % 100 !== 11 ? "глава"
        : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? "главы" : "глав";
      parts.push(`${n} ${word}`);
    }
    parts.push(`${data.words.length.toLocaleString("ru")} слов`, `${elementsByKey.size.toLocaleString("ru")} лемм`);
    if (phrasesByKey.size) {
      const n = phrasesByKey.size, a = n % 100, b = n % 10;
      parts.push(`${n.toLocaleString("ru")} ${a > 10 && a < 20 ? "оборотов" : b === 1 ? "оборот" : b >= 2 && b <= 4 ? "оборота" : "оборотов"}`);
    }
    if (known) parts.push(`в колоде ${known}`);
    $("#book-meta").textContent = parts.join(" · ");
  }

  function refreshAll() {
    refreshHighlights();
    refreshCounts();
    refreshMeta();
    if (!popover.hidden && currentWord) renderPopoverActions();
    if (!deckPanel.hidden) renderDeckList();
    renderMarginNotes();
  }

  // ───────────────────── Заметки на полях ─────────────────────
  // Для каждого слова из колоды («Учу») на правом поле пишется «форма — перевод»
  // на уровне строки, где слово стоит. В одном абзаце слово подписывается один раз.

  const page = $("#page");
  const margin = $("#margin");
  const marginToggle = $("#margin-toggle");
  const MARGIN_PREF_KEY = "greek-reader:margin-notes";
  let marginEnabled = true;
  try { marginEnabled = localStorage.getItem(MARGIN_PREF_KEY) !== "off"; } catch (error) { /* не страшно */ }
  let paragraphOfWord = [];

  function computeParagraphs() {
    let paragraph = 0;
    let cursor = 0;
    paragraphOfWord = data.words.map(word => {
      let newlines = 0;
      for (let i = cursor; i < word.start; i += 1) if (data.chars[i] === "\n") newlines += 1;
      if (newlines >= 2) paragraph += 1;
      cursor = word.end;
      return paragraph;
    });
  }

  function renderMarginNotes() {
    if (!data || !margin) return;
    page.classList.toggle("page--no-margin", !marginEnabled);
    marginToggle.setAttribute("aria-pressed", String(marginEnabled));
    for (const element of book.querySelectorAll(".word--noted")) element.classList.remove("word--noted");
    margin.replaceChildren();
    if (!marginEnabled || margin.offsetParent === null) return; // выключено или узкий экран

    // Заметка — лексическая единица: слово или оборот. Запомненный оборот подписывается целиком;
    // запомненное слово внутри оборота — тоже оборотом (в этом месте текста оно значит то, что весь оборот).
    // В одном абзаце одна и та же единица подписывается один раз.
    const originTop = margin.getBoundingClientRect().top;
    const items = [];
    const seen = new Set();
    const add = (index, unit) => {
      const id = unit ? `p${phraseIndex(unit)}` : `w${index}`;
      const once = `${unit ? unit.key : data.words[index].key}|${paragraphOfWord[index]}`;
      if (seen.has(id) || seen.has(once)) return;
      seen.add(id);
      seen.add(once);
      const element = wordElements[index];
      items.push({ element, index, unit, top: element.getBoundingClientRect().top - originTop });
    };
    for (const [key, elements] of elementsByKey) {
      if (!learningCard(key)) continue;
      for (const element of elements) {
        const index = Number(element.dataset.i);
        const unit = phraseOfWord(index);
        add(unit ? unit.w[0] : index, unit);
      }
    }
    for (const [key, list] of phrasesByKey) {
      if (!learningCard(key)) continue;
      for (const i of list) add(data.phrases[i].w[0], data.phrases[i]);
    }
    items.sort((a, b) => a.top - b.top);

    let bottom = -Infinity;
    for (const item of items) {
      const word = data.words[item.index];
      let label = word.form;
      let gloss;
      if (item.unit) {
        label = phraseText(item.unit);
        gloss = item.unit.ru;
      } else {
        const info = wordInfo(word);
        gloss = info.gloss || info.meaning;
      }
      // Служебные слова («(артикль)», «(частица)») на полях — только шум.
      if (!gloss || gloss.startsWith("(")) continue;
      const note = document.createElement("button");
      note.type = "button";
      note.className = item.unit ? "margin-note margin-note--phrase" : "margin-note";
      note.dataset.i = String(item.index);
      const greek = el("span", "margin-note__gr", note);
      greek.lang = "el";
      greek.textContent = label;
      note.append(` — ${gloss}`);
      margin.appendChild(note);
      // Заметки не наезжают друг на друга: следующая сдвигается ниже.
      const top = Math.max(item.top, bottom + 6);
      note.style.top = `${top}px`;
      bottom = top + note.offsetHeight;
      for (const element of item.unit ? phraseWords(phraseIndex(item.unit)) : [item.element]) element.classList.add("word--noted");
    }
  }

  let marginTimer = 0;
  function scheduleMarginNotes() {
    clearTimeout(marginTimer);
    marginTimer = setTimeout(renderMarginNotes, 120);
  }

  // ───────────────────── Карточка слова ─────────────────────

  const popover = document.createElement("div");
  popover.className = "popover";
  popover.hidden = true;
  popover.setAttribute("role", "dialog");
  popover.setAttribute("aria-label", "Слово");

  const el = (tag, className, parent) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (parent) parent.appendChild(node);
    return node;
  };

  // Слово внутри оборота: главная единица — оборот (сверху, крупно), ниже — само слово, мельче.
  const pPhrase = el("div", "popover__phrase", popover);
  const pPhraseTop = el("div", "popover__top", pPhrase);
  const pPhraseHead = el("span", "popover__form", pPhraseTop);
  pPhraseHead.lang = "el";
  const pPhraseChip = el("span", "chip popover__pos popover__phrase-chip", pPhraseTop);
  pPhraseChip.textContent = "оборот";
  const pPhraseLevel = el("span", "chip chip--level", pPhraseTop);
  const pPhraseRu = el("div", "popover__gloss", pPhrase);
  const pWordLabel = el("div", "popover__label", popover);
  pWordLabel.textContent = "Слово в обороте";
  const pTop = el("div", "popover__top", popover);
  const pForm = el("span", "popover__form", pTop);
  const pPos = el("span", "chip popover__pos", pTop);
  const pLevel = el("span", "chip chip--level", pTop);
  const pGloss = el("div", "popover__gloss", popover);
  const pEn = el("div", "popover__en", popover);
  const pLemma = el("div", "popover__lemma", popover);
  const pSeen = el("div", "popover__seen", popover);
  const pGrammar = el("div", "popover__grammar", popover);
  const pRaw = el("div", "popover__raw", popover);
  const pSentence = el("div", "popover__sentence", popover);
  const pSentenceToggle = el("button", "disclosure", pSentence);
  pSentenceToggle.type = "button";
  pSentenceToggle.textContent = "Перевод предложения";
  const pSentenceText = el("div", "popover__sentence-text", pSentence);
  const pActions = el("div", "popover__actions", popover);
  const pError = el("div", "popover__error", popover);
  document.body.appendChild(popover);
  // Клики внутри карточки не должны закрывать её (кнопки перерисовываются на лету).
  popover.addEventListener("click", event => event.stopPropagation());

  let currentWord = null;
  let currentPhrase = null;   // оборот, в который входит выбранное слово (лексическая единица — он)
  let currentElement = null;
  let showSentence = false;
  let phraseElements = [];

  function markPhrase(elements) {
    for (const node of phraseElements) node.classList.remove("word--phrase-active");
    phraseElements = elements;
    for (const node of phraseElements) node.classList.add("word--phrase-active");
  }

  pSentenceToggle.addEventListener("click", () => {
    showSentence = !showSentence;
    pSentenceToggle.setAttribute("aria-expanded", String(showSentence));
    pSentenceText.hidden = !showSentence;
    if (currentElement) positionPopover(currentElement);
  });

  // changesDeck: кнопка меняет колоду — её блокируем, если хранилище недоступно.
  function button(label, className, onClick, changesDeck = true) {
    const node = document.createElement("button");
    node.type = "button";
    node.className = className;
    node.textContent = label;
    node.disabled = changesDeck && Boolean(storageError);
    node.addEventListener("click", onClick);
    return node;
  }

  function renderPopoverActions() {
    // Запоминается лексическая единица: оборот, если слово в него входит, иначе слово.
    const unitKey = currentPhrase ? currentPhrase.key : currentWord.key;
    const card = cards[unitKey];
    const what = currentPhrase ? "Оборот" : "Слово";
    pActions.replaceChildren();
    if (!card) {
      pActions.append(button(currentPhrase ? "Запомнить оборот" : "Запомнить", "button", () => {
        const rect = currentElement.getBoundingClientRect();
        const fresh = currentPhrase ? cardFromPhrase(currentPhrase) : cardFromWord(currentWord);
        if (updateCards(next => { next[fresh.key] = fresh; })) {
          flyToDeck(rect, cardView(fresh));
          lastAddedKey = fresh.key;
        }
      }));
    } else if (card.status !== "learned") {
      const status = el("span", "popover__status");
      status.textContent = `✓ ${what} в карточках`;
      pActions.append(
        status,
        button("Выучил", "button button--quiet", () => {
          updateCards(next => { next[card.key].status = "learned"; next[card.key].learnedAt = new Date().toISOString(); });
          toast("Отлично! Карточка перенесена в «Выучил».");
        }),
      );
    } else {
      const status = el("span", "popover__status");
      status.textContent = `✓ ${what} выучен${currentPhrase ? "" : "о"}`;
      pActions.append(
        status,
        button("Снова учить", "button button--quiet", () => {
          updateCards(next => { next[card.key].status = "learning"; delete next[card.key].learnedAt; });
        }),
      );
    }
    // внутри оборота можно запомнить и само слово — отдельной карточкой
    if (currentPhrase) {
      const wordCard = cards[currentWord.key];
      const extra = el("div", "popover__word-action", pActions);
      if (wordCard) extra.textContent = `слово «${cardView(wordCard).head}» тоже в карточках`;
      else extra.append(button(`или только слово «${wordInfo(currentWord).head}»`, "link-button", () => {
        const fresh = cardFromWord(currentWord);
        if (updateCards(next => { next[fresh.key] = fresh; })) lastAddedKey = fresh.key;
      }));
    }
    pError.textContent = storageError;
    pError.hidden = !storageError;
  }

  function showPopover(element) {
    const word = data.words[Number(element.dataset.i)];
    if (!word) return;
    const info = wordInfo(word);

    if (currentElement) currentElement.classList.remove("word--selected");
    setActiveSentence(word.s);
    currentWord = word;
    currentElement = element;
    element.classList.add("word--selected");

    // оборот: самый длинный из тех, куда входит слово, — главная единица карточки, все его слова подсвечены
    const index = Number(element.dataset.i);
    const phrase = phraseOfWord(index);
    currentPhrase = phrase;
    popover.classList.toggle("popover--phrase", Boolean(phrase));
    pPhrase.hidden = !phrase;
    pWordLabel.hidden = !phrase;
    markPhrase(phrase ? phraseWords(phraseIndex(phrase)) : []);
    if (phrase) {
      pPhraseHead.textContent = phrase.head;
      pPhraseRu.textContent = phrase.ru;
      showLevel(pPhraseLevel, phrase.level);
    }

    pForm.textContent = word.form;
    pPos.textContent = info.pos;
    pPos.hidden = !info.pos;
    showLevel(pLevel, info.level);

    // в книге главное — перевод формы в этом предложении; в своём тексте — словарное значение леммы
    const main = info.gloss || info.meaning;
    pGloss.textContent = main || (word.unknown ? "нет в словаре сайта" : "нет перевода");
    pGloss.classList.toggle("popover__gloss--empty", !main);
    pEn.textContent = info.meaningEn ? `en: ${info.meaningEn}` : "";
    pEn.hidden = !pEn.textContent;

    pLemma.replaceChildren();
    pLemma.hidden = word.unknown;
    const head = el("b", "", pLemma);
    head.textContent = info.head;
    head.lang = "el";
    if (info.meaning && info.gloss) pLemma.append(` — ${info.meaning}`);
    pSeen.replaceChildren();
    if (info.seen && !info.seen.startsWith("(")) pSeen.append(`в книгах переводили: ${info.seen}`);
    if (word.unknown || data.meta.source === "own") {
      if (pSeen.childNodes.length) pSeen.append(" · ");
      const link = el("a", "", pSeen);
      link.href = wiktionary(word.unknown ? word.form.replace(/['’]$/, "") : info.head.replace(/^(?:ο|η|το|οι|τα)\s+/, ""));
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = "Викисловарь ↗";
    }
    pSeen.hidden = !pSeen.childNodes.length;

    const { labels, unknown } = parseFeats(word.feats);
    pGrammar.replaceChildren(...labels.map(label => {
      const chip = el("span", "chip");
      chip.textContent = label;
      return chip;
    }));
    pGrammar.hidden = labels.length === 0;
    pRaw.textContent = [...unknown, ...(word.guess ? ["найдено без учёта ударений"] : [])].join(" · ");
    pRaw.hidden = !pRaw.textContent;

    const sentence = word.s >= 0 ? data.sentences[word.s] : null;
    pSentence.hidden = !(sentence && sentence.ru);
    pSentenceText.textContent = sentence ? sentence.ru : "";
    pSentenceText.hidden = !showSentence;
    pSentenceToggle.setAttribute("aria-expanded", String(showSentence));

    renderPopoverActions();
    popover.hidden = false;
    positionPopover(element);
  }

  const isPhone = () => window.matchMedia("(max-width: 600px)").matches;

  function positionPopover(element) {
    if (isPhone()) return; // на телефоне карточка — нижняя шторка (CSS)
    const rect = element.getBoundingClientRect();
    const margin = 12;
    const width = popover.offsetWidth;
    const height = popover.offsetHeight;
    const left = Math.max(margin, Math.min(rect.left - 16, window.innerWidth - width - margin));
    const below = rect.bottom + 10;
    const above = rect.top - height - 10;
    const top = below + height <= window.innerHeight - margin ? below
      : above >= margin ? above
        : Math.max(margin, window.innerHeight - height - margin);
    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
  }

  function hidePopover() {
    popover.hidden = true;
    markPhrase([]);
    currentPhrase = null;
    if (currentElement) currentElement.classList.remove("word--selected");
    setActiveSentence(-1);
    currentElement = null;
    currentWord = null;
  }

  let activeSentence = -1;
  function setActiveSentence(index) {
    if (sentenceElements[activeSentence]) sentenceElements[activeSentence].classList.remove("sentence--active");
    activeSentence = index;
    if (sentenceElements[index]) sentenceElements[index].classList.add("sentence--active");
  }

  // ───────────────────── Анимация «в колоду» ─────────────────────

  const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function bumpDeckButton() {
    deckButton.classList.remove("deck-button--bump");
    void deckButton.offsetWidth;
    deckButton.classList.add("deck-button--bump");
  }

  function flyToDeck(fromRect, card) {
    if (reduceMotion() || !document.body.animate) {
      bumpDeckButton();
      return;
    }
    const ghost = el("div", "fly-card", document.body);
    const title = el("b", "", ghost);
    title.textContent = card.head;
    const meaning = el("span", "", ghost);
    meaning.textContent = card.meaning || card.gloss || "";

    const target = deckButton.getBoundingClientRect();
    const w = ghost.offsetWidth;
    const h = ghost.offsetHeight;
    const sx = fromRect.left + fromRect.width / 2 - w / 2;
    const sy = fromRect.top + fromRect.height / 2 - h / 2;
    const ex = target.left + target.width / 2 - w / 2;
    const ey = target.top + target.height / 2 - h / 2;
    const mx = (sx + ex) / 2;
    const my = Math.min(sy, ey) - 50;

    ghost.animate([
      { transform: `translate(${sx}px, ${sy}px) scale(0.6)`, opacity: 0 },
      { transform: `translate(${sx}px, ${sy - 24}px) scale(1) rotate(0deg)`, opacity: 1, offset: 0.22 },
      { transform: `translate(${mx}px, ${my}px) scale(0.75) rotate(-6deg)`, opacity: 1, offset: 0.6 },
      { transform: `translate(${ex}px, ${ey}px) scale(0.18) rotate(-12deg)`, opacity: 0.3 },
    ], { duration: 820, easing: "cubic-bezier(0.45, 0, 0.25, 1)" }).onfinish = () => {
      ghost.remove();
      bumpDeckButton();
    };
  }

  // ───────────────────── Панель «Мои карточки» ─────────────────────

  const deckPanel = $("#deck");
  const scrim = $("#scrim");
  const deckList = $("#deck-list");
  const deckSearch = $("#deck-search");
  let activeTab = "learning";
  let lastAddedKey = "";

  function openDeck() {
    hidePopover();
    deckPanel.hidden = false;
    scrim.hidden = false;
    renderDeckList();
    $("#deck-close").focus();
  }

  function closeDeck() {
    deckPanel.hidden = true;
    scrim.hidden = true;
    $("#export-hint").hidden = true;
    lastAddedKey = "";
    deckButton.focus();
  }

  function highlightExample(example, form) {
    const container = el("div", "card__example");
    container.lang = "el";
    const index = form ? example.indexOf(form) : -1;
    if (index < 0) {
      container.textContent = example;
      return container;
    }
    const mark = document.createElement("mark");
    mark.textContent = form;
    container.append(example.slice(0, index), mark, example.slice(index + form.length));
    return container;
  }

  function cardMatches(card, query) {
    if (!query) return true;
    const haystack = [card.head, card.key, card.form, card.meaning, card.gloss, card.meaningEn]
      .join(" ").toLocaleLowerCase("ru");
    return haystack.includes(query);
  }

  function renderDeckList() {
    const query = deckSearch.value.trim().toLocaleLowerCase("ru");
    const list = Object.values(cards).map(cardView)
      .filter(card => (activeTab === "learned") === (card.status === "learned"))
      .filter(card => cardMatches(card, query))
      .sort((a, b) => String(b.learnedAt || b.addedAt).localeCompare(String(a.learnedAt || a.addedAt)));

    for (const tab of document.querySelectorAll(".tab")) {
      tab.setAttribute("aria-selected", String(tab.dataset.tab === activeTab));
    }

    if (!list.length) {
      const empty = el("div", "deck-empty");
      if (query) {
        empty.textContent = "Ничего не найдено.";
      } else if (activeTab === "learning") {
        empty.innerHTML = "Пока пусто. Нажми на любое слово в тексте и выбери <b>«Запомнить»</b> — карточка появится здесь.";
      } else {
        empty.innerHTML = "Здесь будут слова, которые ты отметил как <b>выученные</b>.";
      }
      deckList.replaceChildren(empty);
      return;
    }

    deckList.replaceChildren(...list.map(card => {
      const item = el("article", `card${card.status === "learned" ? " card--learned" : ""}`);
      if (card.key === lastAddedKey) item.classList.add("card--fresh");

      const top = el("div", "card__top", item);
      const head = el("span", "card__head", top);
      head.lang = "el";
      head.textContent = card.head || card.key;
      if (card.pos) {
        const pos = el("span", "chip card__pos", top);
        pos.textContent = card.pos;
      }
      if (card.level) {
        const level = el("span", "chip chip--level", top);
        showLevel(level, card.level);
      }
      const meaning = el("div", "card__meaning", item);
      meaning.textContent = card.meaning || card.gloss || card.meaningEn || "—";

      if (card.example) {
        item.appendChild(highlightExample(card.example, card.form));
        if (card.exampleRu) {
          const ru = el("div", "card__example-ru", item);
          ru.textContent = card.exampleRu;
        }
      }

      const actions = el("div", "card__actions", item);
      if (card.status === "learned") {
        actions.append(button("Снова учить", "link-button", () =>
          updateCards(next => { next[card.key].status = "learning"; delete next[card.key].learnedAt; })));
      } else {
        actions.append(button("Выучил ✓", "link-button", () =>
          updateCards(next => { next[card.key].status = "learned"; next[card.key].learnedAt = new Date().toISOString(); })));
      }
      if (elementsByKey.has(card.key) || phrasesByKey.has(card.key)) {
        actions.append(button("Найти в тексте", "link-button", () => revealInText(card.key), false));
      }
      actions.append(button("Удалить", "link-button link-button--danger", () => {
        const removed = cards[card.key];
        updateCards(next => { delete next[card.key]; });
        toast(`«${card.head}» удалено`, "Вернуть", () =>
          updateCards(next => { next[removed.key] = removed; }));
      }));
      if (card.fromOtherBook && card.book) {
        const source = el("span", "card__book", actions);
        source.textContent = `из «${card.book}»`;
      }
      return item;
    }));
  }

  function revealInText(key) {
    const element = isPhraseKey(key) ? wordElements[data.phrases[(phrasesByKey.get(key) || [])[0]]?.w[0]] : (elementsByKey.get(key) || [])[0];
    if (!element) return;
    closeDeck();
    element.scrollIntoView({ block: "center", behavior: reduceMotion() ? "auto" : "smooth" });
    setTimeout(() => showPopover(element), reduceMotion() ? 0 : 450);
  }

  // ───────────────────── Экспорт ─────────────────────

  const escapeHtml = value => String(value || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const oneLine = value => String(value || "").replace(/[\t\r\n]+/g, " ").trim();
  const csvCell = value => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csvRow = values => values.map(csvCell).join(",");

  function exportCards() {
    const includeLearned = $("#export-learned").checked;
    return Object.values(cards).map(cardView)
      .filter(card => includeLearned || card.status !== "learned")
      .sort((a, b) => String(a.addedAt).localeCompare(String(b.addedAt)));
  }

  function backText(card) {
    const meaning = card.meaning || card.gloss || card.meaningEn || "";
    return card.pos ? `${meaning} (${card.pos})` : meaning;
  }

  function ankiBack(card) {
    const parts = [`<b>${escapeHtml(card.meaning || card.gloss || card.meaningEn)}</b>`];
    if (card.pos || card.level) parts.push(`<small>${escapeHtml([card.pos, card.level && card.level !== "?" ? card.level : ""].filter(Boolean).join(", "))}</small>`);
    if (card.meaningEn) parts.push(`<small>en: ${escapeHtml(card.meaningEn)}</small>`);
    if (card.example) {
      const example = escapeHtml(card.example);
      const form = escapeHtml(card.form);
      const marked = form && example.includes(form) ? example.replace(form, `<b>${form}</b>`) : example;
      parts.push(`<br><i>${marked}</i>`);
      if (card.exampleRu) parts.push(`<small>${escapeHtml(card.exampleRu)}</small>`);
    }
    return parts.join("<br>");
  }

  const EXPORTERS = {
    anki: {
      filename: "greek-cards-anki.txt",
      build: list => [
        "#separator:tab",
        "#html:true",
        "#deck:Греческий из книг",
        "#tags column:3",
        ...list.map(card => [
          oneLine(escapeHtml(card.head || card.key)),
          oneLine(ankiBack(card)),
          "greek-reader",
        ].join("\t")),
      ].join("\n") + "\n",
      hint: "<b>Anki:</b> Файл → Импорт → выбери скачанный файл. Колода «Греческий из книг» создастся сама; тип записей — «Basic» («Основная»).",
    },
    quizlet: {
      filename: "greek-cards-quizlet.txt",
      copy: true,
      build: list => list.map(card => `${oneLine(card.head || card.key)}\t${oneLine(backText(card))}`).join("\n"),
      hint: "<b>Quizlet:</b> текст уже скопирован (и скачан файлом).<ol><li>Создать → Учебный модуль → «Импорт».</li><li>Вставь текст (Ctrl+V).</li><li>Между термином и определением — <b>Tab</b>, между карточками — <b>новая строка</b>.</li></ol>",
    },
    brainscape: {
      filename: "greek-cards-brainscape.csv",
      build: list => list.map(card => csvRow([card.head || card.key, backText(card)])).join("\r\n") + "\r\n",
      hint: "<b>Brainscape:</b> в колоде (deck) → Add cards → Import → загрузи скачанный CSV. Первый столбец — вопрос, второй — ответ.",
    },
    csv: {
      filename: "greek-cards.csv",
      bom: true,
      build: list => [
        csvRow(["greek", "word_form", "part_of_speech", "level", "russian", "english", "meaning_in_text",
          "example", "example_ru", "book", "added", "status"]),
        ...list.map(card => csvRow([
          card.head || card.key, card.form, card.pos, card.level, card.meaning, card.meaningEn, card.gloss,
          card.example, card.exampleRu, card.book, (card.addedAt || "").slice(0, 10),
          card.status === "learned" ? "learned" : "learning",
        ])),
      ].join("\r\n") + "\r\n",
      hint: "<b>Таблица CSV</b> (UTF-8, разделитель — запятая). Если Excel показывает всё в одной колонке: Данные → Из текста/CSV.",
    },
  };

  function download(filename, content, withBom = false) {
    const blob = new Blob([withBom ? "﻿" : "", content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = el("a", "", document.body);
    link.href = url;
    link.download = filename;
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  async function copyText(textValue) {
    try {
      await navigator.clipboard.writeText(textValue);
      return true;
    } catch (error) {
      const area = el("textarea", "", document.body);
      area.value = textValue;
      area.style.position = "fixed";
      area.style.opacity = "0";
      area.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch (ignored) { ok = false; }
      area.remove();
      return ok;
    }
  }

  async function runExport(kind) {
    const exporter = EXPORTERS[kind];
    const list = exportCards();
    if (!list.length) {
      toast("Нет карточек для экспорта.");
      return;
    }
    const content = exporter.build(list);
    download(exporter.filename, content, exporter.bom);
    if (exporter.copy) await copyText(content);
    const hint = $("#export-hint");
    hint.innerHTML = `${exporter.hint}<br><span style="opacity:.75">Карточек: ${list.length}.</span>`;
    hint.hidden = false;
  }

  function saveBackup() {
    const stamp = new Date().toISOString().slice(0, 10);
    download(`greek-cards-backup-${stamp}.json`,
      JSON.stringify({ version: 2, exported: new Date().toISOString(), cards }, null, 2));
    toast("Резервная копия сохранена в «Загрузки».");
  }

  function loadBackup(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const incoming = parsed && parsed.cards;
        if (!incoming || typeof incoming !== "object") throw new Error("формат");
        let added = 0;
        updateCards(next => {
          for (const [key, card] of Object.entries(incoming)) {
            if (!card || typeof card !== "object" || next[key]) continue;
            next[key] = card;
            added += 1;
          }
        });
        toast(`Добавлено карточек: ${added}.`);
      } catch (error) {
        toast("Это не похоже на резервную копию колоды.");
      }
    };
    reader.readAsText(file);
  }

  // ───────────────────── Уведомления ─────────────────────

  const toastBox = $("#toast");
  let toastTimer = 0;
  function toast(message, actionLabel, action) {
    clearTimeout(toastTimer);
    toastBox.replaceChildren(message);
    if (actionLabel) {
      const undo = button(actionLabel, "link-button", () => { action(); toastBox.hidden = true; });
      undo.style.color = "inherit";
      undo.style.marginLeft = "12px";
      toastBox.append(undo);
    }
    toastBox.hidden = false;
    toastTimer = setTimeout(() => { toastBox.hidden = true; }, 4500);
  }

  // ───────────────────── Прогресс чтения ─────────────────────

  const progressBar = $("#progress-bar");
  function updateProgress() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    progressBar.style.width = `${max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0}%`;
    updateCurrentChapter();
  }

  // ───────────────────── Запуск ─────────────────────

  function fail(message) {
    book.classList.add("book--empty");
    book.textContent = message;
  }

  let started = false;
  // options.notice — своя строка в плашке над текстом (свой текст: сколько слов нашлось в словаре)
  function start(raw, options = {}) {
  if (started) return;
  started = true;
  try {
    data = normalizeData(raw);
  } catch (error) {
    fail(`Ошибка в данных книги: ${error.message}. Пересобери её: python tools/library/bookconverter.py <id>.`);
    return;
  }
  if (!data) {
    fail("Нет данных книги. Собери её: python tools/library/bookconverter.py <id>.");
    return;
  }

  loadDeck();
  renderBook();
  indexPhrases();
  setupChapters();
  computeParagraphs();
  refreshCardsFromBook();
  if (data.title) {
    $("#book-title").textContent = data.title;
    document.title = data.title;
  }
  const notice = $("#notice");
  if (options.notice) {
    notice.textContent = options.notice;
    notice.hidden = false;
  } else if (data.version === 1) {
    notice.textContent = "Книга в старом формате: нет перевода предложений и словарных значений. Пересобери её конвертером (tools/library).";
    notice.hidden = false;
  } else if (data.meta.complete === false) {
    notice.textContent = "Перевод неполный: провайдер упёрся в лимит. Запусти конвертер ещё раз — он продолжит с того же места.";
    notice.hidden = false;
  }
  if (storageError) toast(storageError);
  refreshAll();
  updateProgress();

  book.addEventListener("click", event => {
    const word = event.target.closest(".word");
    if (!word) return;
    event.stopPropagation();
    if (word === currentElement && !popover.hidden) hidePopover();
    else showPopover(word);
  });
  book.addEventListener("keydown", event => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const word = event.target.closest(".word");
    if (!word) return;
    event.preventDefault();
    showPopover(word);
  });
  document.addEventListener("click", event => {
    if (!popover.hidden && !popover.contains(event.target)) hidePopover();
  });
  document.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    if (!deckPanel.hidden) closeDeck();
    else if (!popover.hidden) {
      const element = currentElement;
      hidePopover();
      if (element) element.focus();
    }
  });
  window.addEventListener("scroll", () => {
    updateProgress();
    if (!popover.hidden && !isPhone()) hidePopover();
  }, { passive: true });
  window.addEventListener("resize", () => {
    if (!popover.hidden) hidePopover();
    scheduleMarginNotes();
  });
  // Пока грузятся шрифты, строки переносятся иначе — пересчитываем поля после загрузки.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(renderMarginNotes);
  margin.addEventListener("click", event => {
    const note = event.target.closest(".margin-note");
    if (!note) return;
    event.stopPropagation();
    const element = book.querySelector(`.word[data-i="${note.dataset.i}"]`);
    if (element) showPopover(element);
  });
  marginToggle.addEventListener("click", () => {
    marginEnabled = !marginEnabled;
    try { localStorage.setItem(MARGIN_PREF_KEY, marginEnabled ? "on" : "off"); } catch (error) { /* ок */ }
    renderMarginNotes();
  });

  deckButton.addEventListener("click", event => {
    event.stopPropagation();
    openDeck();
  });
  $("#deck-close").addEventListener("click", closeDeck);
  scrim.addEventListener("click", closeDeck);
  deckPanel.addEventListener("click", event => event.stopPropagation());
  for (const tab of document.querySelectorAll(".tab")) {
    tab.addEventListener("click", () => {
      activeTab = tab.dataset.tab;
      renderDeckList();
    });
  }
  deckSearch.addEventListener("input", renderDeckList);
  for (const exportButton of document.querySelectorAll("[data-export]")) {
    exportButton.addEventListener("click", () => runExport(exportButton.dataset.export));
  }
  $("#backup-save").addEventListener("click", saveBackup);
  $("#backup-load").addEventListener("click", () => $("#backup-file").click());
  $("#backup-file").addEventListener("change", event => {
    const file = event.target.files && event.target.files[0];
    if (file) loadBackup(file);
    event.target.value = "";
  });
  // Синхронизация между вкладками с открытыми книгами.
  window.addEventListener("storage", event => {
    if (event.key !== STORE_KEY) return;
    loadDeck();
    refreshAll();
  });
  }

  window.GreekReader = { start, fail };
  // Самодостаточный файл: данные уже на странице.
  if (window.GREEK_BOOK_DATA) start(window.GREEK_BOOK_DATA);
})();
