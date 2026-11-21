// Библиотека: список книг и «Мои тексты» (index.html), открытие книги или своего текста в читалке (read.html).
// Каталог — catalog.js (книги сайта); личная полка — local/catalog.js, есть только на своём
// компьютере (library/local/ в .gitignore) и подключается только при запуске с диска.
// «Мои тексты» хранятся в браузере посетителя (OwnText.Store поверх localStorage) — на сайт не уходят.
(() => {
  "use strict";

  const $ = selector => document.querySelector(selector);
  const esc = value => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const num = value => Number(value || 0).toLocaleString("ru");
  const plural = (n, one, few, many) => {
    const a = Math.abs(n) % 100, b = a % 10;
    return a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many;
  };
  const date = iso => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleDateString("ru", { day: "numeric", month: "short", year: "numeric" }); };
  const store = window.OwnText ? window.OwnText.Store(window.localStorage || { getItem: () => null, setItem() { throw new Error("нет хранилища"); }, removeItem() {} }) : null;
  try { if (store) store.migrate(); } catch (error) { /* хранилище недоступно */ }

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

  // ───────────── index.html: «Мои тексты» ─────────────
  let undoItem = null;
  function renderOwnShelf(message) {
    const shelf = $("#own-shelf");
    let list = [];
    try { list = store ? store.list() : []; } catch (error) { list = []; }
    const card = t => {
      const st = t.stats || {};
      const excerpt = Array.from(t.text.replace(/\s+/g, " ").trim()).slice(0, 140).join("");
      const facts = [
        st.total != null && `${num(st.total)} ${plural(st.total, "слово", "слова", "слов")}`,
        st.total && `знакомо ${Math.round(st.known / st.total * 100)}%`,
        st.phrases && `${num(st.phrases)} ${plural(st.phrases, "оборот", "оборота", "оборотов")}`,
        `изменён ${date(t.updated)}`,
      ].filter(Boolean).join(" · ");
      return `<article class="book-card book-card--mine">
        <a class="book-card__title book-card__open" href="read.html?own=${encodeURIComponent(t.id)}" lang="el">${esc(t.title)}</a>
        <span class="book-card__about" lang="el">${esc(excerpt)}${excerpt.length >= 140 ? "…" : ""}</span>
        <span class="book-card__facts">${facts}</span>
        <span class="book-card__actions">
          <a class="link-button" href="read.html?own=${encodeURIComponent(t.id)}&amp;edit">Править</a>
          <button type="button" class="link-button link-button--danger" data-own-del="${esc(t.id)}">Удалить</button>
        </span>
      </article>`;
    };
    shelf.innerHTML = `<a class="book-card book-card--own" href="read.html?own">
        <span class="book-card__title">＋ Новый текст</span>
        <span class="book-card__about">Вставьте греческий текст или откройте файл .txt — он разберётся по словарю сайта и сохранится здесь.</span>
      </a>` + list.map(card).join("");
    const status = $("#own-tools-status");
    status.replaceChildren();
    if (message) status.append(message);
    if (undoItem) {
      const undo = document.createElement("button");
      undo.type = "button";
      undo.className = "link-button";
      undo.textContent = "Вернуть";
      undo.addEventListener("click", () => {
        try { store.restore(undoItem); } catch (error) { /* не вышло — ничего */ }
        undoItem = null;
        renderOwnShelf();
      });
      status.append(" ", undo);
    }
  }

  function setupOwnShelf() {
    if (!store) return;
    renderOwnShelf();
    $("#own-shelf").addEventListener("click", event => {
      const del = event.target.closest("[data-own-del]");
      if (!del) return;
      try {
        undoItem = store.remove(del.dataset.ownDel);
        renderOwnShelf(undoItem ? `«${undoItem.title}» удалён.` : "");
      } catch (error) {
        renderOwnShelf("Браузер не дал изменить сохранённые тексты.");
      }
    });
    $("#own-export").addEventListener("click", () => {
      let content;
      try { content = store.exportJson(); } catch (error) { renderOwnShelf("Не удалось прочитать сохранённые тексты."); return; }
      const blob = new Blob([content], { type: "application/json;charset=utf-8" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `logos-moi-teksty-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 2000);
      undoItem = null;
      renderOwnShelf("Копия сохранена в «Загрузки».");
    });
    $("#own-import").addEventListener("click", () => $("#own-import-file").click());
    $("#own-import-file").addEventListener("change", async event => {
      const files = [...(event.target.files || [])];
      event.target.value = "";
      const total = { added: 0, updated: 0, skipped: 0 };
      const errors = [];
      for (const file of files) {
        try {
          const r = store.importFile(file.name, await file.text());
          for (const k of Object.keys(total)) total[k] += r[k];
        } catch (error) {
          errors.push(error.message);
        }
      }
      undoItem = null;
      renderOwnShelf([
        total.added && `Добавлено: ${total.added}.`,
        total.updated && `Обновлено: ${total.updated}.`,
        total.skipped && `Уже были: ${total.skipped}.`,
        ...errors,
      ].filter(Boolean).join(" ") || "Ничего не добавлено.");
    });
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

  // ?own — новый текст, ?own=<id> — сохранённый (сразу в читалку), ?own=<id>&edit — править
  async function openOwn(params) {
    const id = params.get("own");
    const saved = id && store ? (() => { try { return store.get(id); } catch (error) { return null; } })() : null;
    const editing = !saved || params.has("edit");
    const area = $("#own-text");
    const name = $("#own-name");
    const go = $("#own-go");
    const status = $("#own-status");
    if (editing) {
      document.body.classList.add("own-mode");
      $("#own").hidden = false;
      $("#book-title").textContent = saved ? "Править текст" : "Новый текст";
      $("#own-heading").textContent = saved ? "Править текст" : "Свой текст";
      if (saved) { area.value = saved.text; name.value = saved.title; go.textContent = "Сохранить и открыть"; }
      if (id && !saved) status.textContent = "Такого текста в этом браузере нет — можно вставить новый.";
    }
    go.disabled = true;
    const ready = loadScript(`dict.js?v=${encodeURIComponent(String(dictStats.forms || ""))}`);
    if (editing) status.textContent = status.textContent || "Загружаю словарь…";
    try {
      await ready;
    } catch (error) {
      if (editing) status.textContent = "Не удалось загрузить словарь сайта.";
      else window.GreekReader.fail("Не удалось загрузить словарь сайта.");
      return;
    }
    go.disabled = false;
    if (status.textContent === "Загружаю словарь…") status.textContent = "";

    const read = (item, note) => {
      const data = window.OwnText.build(item.text, window.GREEK_DICT, item.title);
      $("#own").hidden = true;
      document.body.classList.remove("own-mode");
      const again = $("#own-again");
      if (item.id) { again.href = `read.html?own=${encodeURIComponent(item.id)}&edit`; again.hidden = false; }
      window.GreekReader.start(data, { notice: (note ? note + " " : "") + ownSummary(data.meta, data.phrases.length) });
      window.scrollTo(0, 0);
      return data;
    };
    if (!editing) { read(saved); return; }

    $("#own-file").addEventListener("change", event => {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        area.value = String(reader.result);
        if (!name.value.trim()) name.value = file.name.replace(/\.[^.]+$/, "");
        area.focus();
      };
      reader.readAsText(file, "utf-8");
      event.target.value = "";
    });
    go.addEventListener("click", () => {
      const text = area.value;
      if (!window.OwnText.hasGreek(text)) {
        status.textContent = "Вставьте текст на греческом.";
        area.focus();
        return;
      }
      const draft = { id: saved ? saved.id : null, title: name.value, text };
      const data = window.OwnText.build(text, window.GREEK_DICT, name.value.trim() || undefined);
      const stats = { known: data.meta.known, total: data.meta.total, phrases: data.phrases.length };
      let item = null;
      let note = "";
      try {
        item = store.put({ ...draft, stats });
        history.replaceState(null, "", `read.html?own=${encodeURIComponent(item.id)}`);
        note = "Сохранено в «Мои тексты» (только в этом браузере).";
      } catch (error) {
        note = "Браузер не дал сохранить текст (приватный режим или нет места) — он открыт, но не сохранён.";
      }
      read(item || { title: data.title, text }, note);
    });
  }

  if ($("#shelf")) { renderShelf(); setupOwnShelf(); }
  if ($("#book")) {
    const params = new URLSearchParams(location.search);
    if (params.has("book")) openBook(params.get("book"));
    else if (params.has("own")) openOwn(params);
    else location.replace("index.html");
  }
})();
