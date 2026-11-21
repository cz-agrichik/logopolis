// Библиотека: список книг (index.html) и открытие книги или своего текста в читалке (read.html).
// Каталог — catalog.js (книги сайта); личная полка — local/catalog.js, есть только на своём
// компьютере (library/local/ в .gitignore) и подключается только при запуске с диска.
(() => {
  "use strict";

  const $ = selector => document.querySelector(selector);
  const esc = value => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const num = value => Number(value || 0).toLocaleString("ru");
  const plural = (n, one, few, many) => {
    const a = Math.abs(n) % 100, b = a % 10;
    return a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many;
  };
  const OWN_KEY = "greek-reader:own-text";

  const site = (window.GREEK_LIBRARY && window.GREEK_LIBRARY.books) || [];
  const local = ((window.GREEK_LIBRARY_LOCAL && window.GREEK_LIBRARY_LOCAL.books) || []).map(b => ({ ...b, local: true }));
  const books = [...site, ...local];
  const dictStats = (window.GREEK_LIBRARY && window.GREEK_LIBRARY.dict) || {};

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error(src));
      document.head.appendChild(script);
    });
  }

  // ───────────── index.html: полка ─────────────
  function renderShelf() {
    const shelf = $("#shelf");
    if (!books.length) {
      shelf.innerHTML = `<p class="shelf__empty">Книг пока нет.</p>`;
    } else {
      shelf.innerHTML = books.map(b => {
        const facts = [
          b.level && `<span class="chip">${esc(b.level)}</span>`,
          b.chapters > 1 && `${b.chapters} ${plural(b.chapters, "глава", "главы", "глав")}`,
          `${num(b.words)} ${plural(b.words, "слово", "слова", "слов")}`,
          b.phrases && `${num(b.phrases)} ${plural(b.phrases, "оборот", "оборота", "оборотов")}`,
          !b.complete && "перевод неполный",
          b.local && `<span class="chip chip--local" title="Лежит в library/local/ — на сайт не попадает">только у вас</span>`,
        ].filter(Boolean).join(" · ");
        return `<a class="book-card" href="read.html?book=${encodeURIComponent(b.id)}">
          <span class="book-card__title" lang="el">${esc(b.title)}</span>
          ${b.author ? `<span class="book-card__author">${esc(b.author)}</span>` : ""}
          ${b.about ? `<span class="book-card__about">${esc(b.about)}</span>` : ""}
          <span class="book-card__facts">${facts}</span>
        </a>`;
      }).join("");
    }
    const stats = $("#dict-stats");
    if (stats && dictStats.forms) {
      stats.textContent = `Словарь сайта: ${num(dictStats.forms)} ${plural(dictStats.forms, "форма", "формы", "форм")} слов, `
        + `${num(dictStats.lemmas)} ${plural(dictStats.lemmas, "лемма", "леммы", "лемм")}, `
        + `${num(dictStats.phrases)} ${plural(dictStats.phrases, "оборот", "оборота", "оборотов")}.`;
    }
  }

  // ───────────── read.html: книга ─────────────
  async function openBook(id) {
    const entry = books.find(b => b.id === id);
    if (!entry) {
      window.GreekReader.fail(`Книги «${id}» нет в каталоге. Вернитесь в библиотеку.`);
      return;
    }
    try {
      await loadScript(`${entry.local ? "local/books" : "books"}/${encodeURIComponent(id)}.js?v=${encodeURIComponent(entry.updated || "")}`);
    } catch (error) {
      window.GreekReader.fail("Не удалось загрузить книгу.");
      return;
    }
    const data = window.GREEK_BOOK_DATA;
    if (data && entry.title) data.title = entry.title;
    window.GreekReader.start(data);
  }

  // ───────────── read.html: свой текст ─────────────
  function ownSummary(meta, phrases) {
    const share = meta.total ? Math.round(meta.known / meta.total * 100) : 0;
    return `Свой текст разобран по словарю сайта: знакомо ${num(meta.known)} из ${num(meta.total)} ${plural(meta.total, "слова", "слов", "слов")} (${share}%)`
      + (meta.guessed ? `, из них ${num(meta.guessed)} — без учёта ударений` : "")
      + `; оборотов: ${num(phrases)}. Перевода предложений нет — его делает только конвертер книг.`
      + " Незнакомые слова подчёркнуты пунктиром.";
  }

  async function openOwn() {
    document.body.classList.add("own-mode");
    $("#own").hidden = false;
    $("#book-title").textContent = "Свой текст";
    const area = $("#own-text");
    try { area.value = localStorage.getItem(OWN_KEY) || ""; } catch (error) { /* хранилище недоступно — не страшно */ }
    const go = $("#own-go");
    const status = $("#own-status");
    go.disabled = true;
    status.textContent = "Загружаю словарь…";
    try {
      await loadScript(`dict.js?v=${encodeURIComponent(String(dictStats.forms || ""))}`);
      go.disabled = false;
      status.textContent = "";
    } catch (error) {
      status.textContent = "Не удалось загрузить словарь сайта.";
      return;
    }
    $("#own-file").addEventListener("change", event => {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => { area.value = String(reader.result); area.focus(); };
      reader.readAsText(file, "utf-8");
      event.target.value = "";
    });
    go.addEventListener("click", () => {
      const text = area.value;
      if (!/[Ͱ-Ͽἀ-῿]/.test(text)) {
        status.textContent = "Вставьте текст на греческом.";
        area.focus();
        return;
      }
      try { localStorage.setItem(OWN_KEY, text); } catch (error) { /* не сохранится — не страшно */ }
      const data = window.OwnText.build(text, window.GREEK_DICT);
      $("#own").hidden = true;
      document.body.classList.remove("own-mode");
      $("#own-again").hidden = false;
      window.GreekReader.start(data, { notice: ownSummary(data.meta, data.phrases.length) });
      window.scrollTo(0, 0);
    });
  }

  if ($("#shelf")) renderShelf();
  if ($("#book")) {
    const params = new URLSearchParams(location.search);
    if (params.has("book")) openBook(params.get("book"));
    else if (params.has("own")) openOwn();
    else location.replace("index.html");
  }
})();
