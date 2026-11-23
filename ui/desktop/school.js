'use strict';
// ============================================================
//  📚 Обучение: прогресс, колоды, слова, темп, импорт/экспорт, сброс.
//  Отдельный экран поверх города — сюда заходят нечасто, когда хочется
//  настроить учёбу под себя или посмотреть, что уже выучено.
// ============================================================

const SCHOOL_SECTIONS = [
  { id: 'ov', icon: '📊', title: 'Обзор' },
  { id: 'decks', icon: '🗂️', title: 'Колоды' },
  { id: 'words', icon: '🔤', title: 'Слова' },
  { id: 'pace', icon: '⏱️', title: 'Темп и награды' },
  { id: 'io', icon: '📦', title: 'Импорт и экспорт' },
  { id: 'reset', icon: '♻️', title: 'Сброс' },
];
const ST_NAMES = { new: 'новое', learning: 'учится', learned: 'выучено' };

// ---------- слова из чтения: карточки читалки библиотеки → колода «📖 Слова из чтения» ----------
// Читалка (library/) хранит свои карточки в localStorage (READER_DECK_KEY), игра их только читает — у каждого
// ключа один писатель, вкладки не затирают друг друга. Берутся карточки, которые в читалке ещё учатся, уровня
// ученика и ниже (READER_LEVEL_KEY — выбирается в читалке; по умолчанию — по включённым колодам игры).
const READER_DECK_KEY = 'greek-reader:deck:v2', READER_LEVEL_KEY = 'greek-reader:my-level';
const READING_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const readingLevel = () => {
  const own = BrowserIO.load(READER_LEVEL_KEY);
  return READING_LEVELS.includes(own) ? own : Decks.planLevel(Learn.state);
};
const Reading = {
  /** Карточки читалки → колода игры. Возвращает, изменилась ли колода. */
  sync() {
    if (!Learn.state) return false;
    let deck = null;
    try { deck = JSON.parse(BrowserIO.load(READER_DECK_KEY) || 'null'); } catch (e) { deck = null; }
    const all = deck && deck.cards && typeof deck.cards === 'object' ? Object.values(deck.cards) : [];
    const top = l => { const p = String(l || '').split('–').filter(x => READING_LEVELS.includes(x)); return p.length ? READING_LEVELS.indexOf(p[p.length - 1]) : -1; };
    const mine = READING_LEVELS.indexOf(readingLevel());
    const bare = h => String(h || '').replace(/^(ο|η|το|οι|τα)\s+/, '');
    const cards = [];
    for (const c of all) {
      const t = c && c.saved || {};
      // без перевода карточка в игре бесполезна: у формы его нет, пока книгу не пересоберут (перевод-инфинитив отброшен)
      if (!c || c.status === 'learned' || top(t.level) < 0 || top(t.level) > mine || !(t.meaning || t.gloss)) continue;
      const key = String(c.key);
      if (key.startsWith('form:')) {
        cards.push({ key, front: t.head || c.form, back: t.meaning || '', hint: [t.formGram, t.lemmaHead && 'от ' + bare(t.lemmaHead)].filter(Boolean).join(', ') });
      } else if (key.startsWith('phrase:')) {
        cards.push({ key, front: t.head, back: t.meaning || '', hint: 'оборот' });
      } else {
        cards.push({ key, front: bare(t.head || key), back: t.meaning || t.gloss || '', hint: t.head && t.head !== bare(t.head) ? t.head : '' });
      }
    }
    return Decks.setReadingDeck(Learn.state, cards, '📖 Слова из чтения');
  },
};
const WORDS_LIMIT = 400;

const School = {
  sec: 'ov',
  filter: { deck: 'all', st: 'all', q: '' },

  open(sec) {
    if (sec) this.sec = sec;
    UI.cancelPlacing();
    $('#school').classList.remove('hidden');
    if (!this.bound) this.bind();
    this.render();
  },
  close(silent) {
    if ($('#school').classList.contains('hidden')) return;
    $('#school').classList.add('hidden');
    if (!silent) { Learn.save(); UI.renderAll(); }
  },
  isOpen() { return !$('#school').classList.contains('hidden'); },

  bind() {
    this.bound = true;
    const root = $('#school');
    root.addEventListener('click', e => this.onClick(e));
    root.addEventListener('change', e => this.onChange(e));
    root.addEventListener('input', e => {
      if (e.target.id === 'swSearch') {
        this.filter.q = e.target.value;
        clearTimeout(this.qTimer);
        this.qTimer = setTimeout(() => this.renderWords(true), 150);
      }
    });
  },

  render(keepScroll) {
    const top = $('#schoolBody').scrollTop;
    $('#schoolNav').innerHTML = `<div class="pn-group">${SCHOOL_SECTIONS.map(s =>
      `<a href="#" class="pn-item ${s.id === this.sec ? 'active' : ''}" data-sec="${s.id}"><span>${s.icon}</span>${esc(s.title)}</a>`).join('')}</div>
      <div class="pn-foot"><button class="link" data-pedia="a:study">? Как устроена учёба</button>
        <a class="link lib-link" href="library/index.html" target="_blank" rel="noopener" title="Греческие тексты с переводом слов и оборотов — в новой вкладке">📖 Библиотека: читать тексты ↗</a></div>`;
    $('#schoolBody').innerHTML = this['s_' + this.sec]();
    if (this.sec === 'words') this.renderWords();
    $('#schoolBody').scrollTop = keepScroll ? top : 0;
  },

  // ---------------- общие кусочки ----------------
  totals() { return Decks.totals(Learn.state); },

  /** Тонкая полоса «выучено / учатся / новые» с подписью-легендой. */
  bar(st, legend = false) {
    const part = (cls, n, name) => n ? `<i class="${cls}" style="flex:${n}" title="${name}: ${n}"></i>` : '';
    return `<div class="deck-bar" role="img" aria-label="выучено ${st.learned}, учатся ${st.learning}, новые ${st.fresh}">
      ${part('learned', st.learned, 'выучено')}${part('learning', st.learning, 'учатся')}${part('fresh', st.fresh, 'новые')}</div>
      ${legend ? `<div class="bar-legend"><span><i class="learned"></i>выучено</span><span><i class="learning"></i>учатся</span><span><i class="fresh"></i>новые</span></div>` : ''}`;
  },

  tile(v, label, title = '') {
    return `<div class="kpi" ${title ? `title="${esc(title)}"` : ''}><b>${v}</b><small>${label}</small></div>`;
  },

  pct(r, a) { return a ? Math.round(100 * r / a) + '%' : '—'; },

  // ---------------- разделы ----------------
  s_ov() {
    const s = Learn.state, t = this.totals(), p = Decks.roundPreview(s), newNow = p.newNow;
    const log = s.learnLog || {}, today = log[dayKey()] || {};
    const days = Object.keys(log).filter(k => log[k].a > 0);
    const allA = s.stats.right + s.stats.wrong;
    let h = `<h2>Обзор</h2>
      <p class="lead">Активные колоды: <b>${s.decks.filter(d => d.active).length}</b> из ${s.decks.length}, слов в раундах — <b>${t.total}</b>${(n => n ? `, из них ${n} — начатые из выключенных колод` : '')(Decks.offDeckCount(s))}.</p>
      <div class="plan-now">🎯 Учим: <b>${(() => { const id = Decks.planOf(s); return id ? esc(Cat.plans[id].name) : 'свой набор колод'; })()}</b>
        <button class="link" data-plan-open>Сменить</button></div>
      ${this.bar(t, true)}
      <div class="kpis">
        ${this.tile(t.learned, 'выучено', 'Слово выучено: верно отвечено нужное число раз и хотя бы раз набрано')}
        ${this.tile(t.learning, 'учатся', 'Уже знакомые слова, которые ещё заучиваются')}
        ${this.tile(t.fresh, 'новых', 'Слова, которых вы ещё не видели')}
        ${this.tile(t.due, 'пора повторить', 'Слова, у которых подошёл срок повторения')}
      </div>`;
    const next = Decks.nextDue(s), soon = Decks.dueWithin(s, DAY);
    h += `<div class="ov-go">
      <button class="btn gold" data-study>📜 Учиться: ${this.roundText(p, newNow)}</button>
      <div class="dim small">${p.due ? '' : next < Infinity ? `Следующее повторение — через ${fmtDur(next - Date.now())}. ` : ''}${soon ? `За сутки подойдёт срок ещё у ${soon} ${plural(soon, 'слова', 'слов', 'слов')}.` : ''}</div>
    </div>`;
    h += `<h4>Сегодня</h4>
      <div class="kpis small">
        ${this.tile(today.a || 0, 'ответов')}${this.tile(this.pct(today.r || 0, today.a || 0), 'верно')}
        ${this.tile(today.n || 0, 'новых слов')}${this.tile(today.l || 0, 'выучено')}${this.tile('λ ' + (today.x || 0), 'заработано')}
      </div>`;
    // последние 7 дней — таблицей
    h += `<h4>Последние 7 дней</h4><table class="pt days"><tr><th>День</th><th>Раундов</th><th>Ответов</th><th>Верно</th><th>Новых</th><th>Выучено</th><th>λ</th></tr>`;
    for (let i = 0; i < 7; i++) {
      const k = dayKey(Date.now() - i * DAY), d = log[k];
      const label = i === 0 ? 'сегодня' : i === 1 ? 'вчера' : new Date(Date.now() - i * DAY).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' });
      h += d && d.a ? `<tr><td>${label}</td><td>${d.rounds || 0}</td><td>${d.a}</td><td>${this.pct(d.r, d.a)}</td><td>${d.n || 0}</td><td>${d.l || 0}</td><td>${d.x || 0}</td></tr>`
        : `<tr class="dim"><td>${label}</td><td colspan="6">—</td></tr>`;
    }
    h += `</table>
      <h4>За всё время</h4>
      <div class="statline">Ответов: <b>${allA}</b> · верно: <b>${this.pct(s.stats.right, allA)}</b> · раундов: <b>${s.stats.rounds}</b> ·
        слов выучено сейчас: <b>${Decks.learnedCount(s)}</b> · дней с занятиями: <b>${days.length}</b></div>
      <p class="dim small">Прогресс обучения не зависит от города: «Новая игра» начинает город заново, а выученные слова остаются.</p>`;
    return h;
  },

  roundText(p, newNow) {
    const parts = [];
    if (p.due) parts.push(`повторить ${p.due}`);
    if (newNow) parts.push(`новых ${newNow}`);
    return parts.length ? parts.join(' · ') : 'досрочное повторение';
  },

  /** Группы колод для списка: стартовая, A1, A2, B1, свои. */
  deckGroups() {
    const s = Learn.state, groups = [];
    const put = (key, d) => { let g = groups.find(x => x.key === key); if (!g) groups.push(g = { key, decks: [] }); g.decks.push(d); };
    for (const d of s.decks) put(Decks.groupOf(d), d);
    const order = ['start', 'A1', 'A2', 'B1', 'reading', 'own'];
    return groups.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  },
  groupTitle: { start: 'Стартовый набор', A1: 'A1 · начальный уровень', A2: 'A2 · базовый уровень', B1: 'B1 · средний уровень', reading: '📖 Слова из чтения', own: 'Свои колоды' },

  deckHtml(d) {
    const s = Learn.state, st = Decks.stats(s, d);
    return `<div class="deck ${d.active ? '' : 'off'}">
        <label class="deck-head"><input type="checkbox" data-deck-toggle="${d.id}" ${d.active ? 'checked' : ''}> <b>${esc(d.name)}</b>${d.reading ? ' <span class="badge">из библиотеки</span>' : d.builtin ? '' : ' <span class="badge">своя</span>'}</label>
        ${d.reading ? `<div class="deck-stats">Слова, которые вы запомнили в <a href="library/index.html" target="_blank" rel="noopener">библиотеке</a>, — вашего уровня (${esc(readingLevel())}) и ниже. Колода обновляется сама. Прогресс у слова общий: выучили его в другой колоде — здесь оно тоже выучено, и наоборот; в раунд слово попадает один раз.</div>` : ''}
        ${this.bar(st)}
        <div class="deck-stats">${st.total} ${plural(st.total, 'слово', 'слова', 'слов')} · выучено ${st.learned} · учатся ${st.learning} · новых ${st.fresh}${st.due ? ` · пора повторить ${st.due}` : ''}</div>
        <div class="deck-actions"><button class="link" data-deck-words="${d.id}">Слова</button>
          <button class="link" data-export-deck="${d.id}">Экспорт .tsv</button>
          <button class="link danger" data-deck-reset="${d.id}">Сбросить прогресс</button>
          ${d.builtin || d.reading ? '' : `<button class="link danger" data-deck-del="${d.id}">Удалить</button>`}</div>
      </div>`;
  },

  s_decks() {
    const s = Learn.state;
    this.groupOpen = this.groupOpen || {};
    const set = Decks.settings(s), off = Decks.offDeckCount(s);
    let h = `<h2>Колоды</h2><p class="dim">Включённые колоды дают новые слова и повторение. Выключенная колода сохраняет свой прогресс.
      Колоды A2 и B1 сначала выключены — включайте их, когда A1 станет лёгким.</p>
      <div class="settings"><label><span>Выключенные колоды</span><select data-setting="offDecks">${[
        ['pause', 'на паузе — ни новых слов, ни повторения'], ['review', 'без новых слов — начатые из них учатся и повторяются']]
        .map(([v, l]) => `<option value="${v}" ${set.offDecks === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <div class="dim small">${set.offDecks === 'review'
          ? `Галочка у колоды — откуда брать новые слова. Слово, которое вы уже начали, доучивается и повторяется, даже если его колода выключена${off ? ` (сейчас таких ${off} ${plural(off, 'слово', 'слова', 'слов')})` : ''}.`
          : 'Выключили колоду — её слова не попадают в раунды совсем, пока не включите снова.'}</div></div>
      <div class="bar-legend"><span><i class="learned"></i>выучено</span><span><i class="learning"></i>учатся</span><span><i class="fresh"></i>новые</span></div>`;
    for (const g of this.deckGroups()) {
      const on = g.decks.filter(d => d.active).length, { words, learned } = Decks.wordStats(s, g.decks);
      const open = this.groupOpen[g.key] ?? (on > 0 || g.key === 'own');
      const many = g.decks.length > 1;
      h += `<details class="dgroup" data-dgroup="${g.key}" ${open ? 'open' : ''}>
        <summary><b>${esc(this.groupTitle[g.key])}</b>
          <span class="dim small">${many ? `${g.decks.length} ${plural(g.decks.length, 'колода', 'колоды', 'колод')} · ` : ''}${words} ${plural(words, 'слово', 'слова', 'слов')} · выучено ${learned}${words ? ` (${Math.round(learned / words * 100)}%)` : ''} · ${many ? (on === g.decks.length ? 'включены все' : on ? `включено ${on} из ${g.decks.length}` : 'все выключены') : on ? 'включена' : 'выключена'}</span></summary>
        ${many ? `<div class="dgroup-actions">${on < g.decks.length ? `<button class="link" data-group-on="${g.key}">Включить все</button>` : ''}${on ? `<button class="link" data-group-off="${g.key}">Выключить все</button>` : ''}</div>` : ''}
        ${g.decks.map(d => this.deckHtml(d)).join('')}
      </details>`;
    }
    h += `<p class="dim small">Встроенные колоды нельзя удалить — только выключить. Свою колоду можно добавить в разделе
      <a href="#" data-sec="io">«Импорт и экспорт»</a>.</p>`;
    return h;
  },

  s_words() {
    const s = Learn.state, f = this.filter;
    const opt = (v, l, cur) => `<option value="${esc(v)}" ${cur === v ? 'selected' : ''}>${esc(l)}</option>`;
    return `<h2>Слова</h2>
      <div class="sw-filters">
        <select data-wf="deck">${opt('all', 'Все колоды', f.deck)}${opt('active', 'Только те, что в раундах', f.deck)}${this.deckGroups().map(g => `<optgroup label="${esc(this.groupTitle[g.key])}">${g.decks.map(d => opt(d.id, d.name, f.deck)).join('')}</optgroup>`).join('')}</select>
        <select data-wf="st">${[['all', 'Любой статус'], ['due', 'Пора повторить'], ['learning', 'Учатся'], ['spelling', 'Осталось набрать ✍'], ['learned', 'Выучены'], ['new', 'Новые'], ['hard', 'Трудные (есть ошибки)']].map(([v, l]) => opt(v, l, f.st)).join('')}</select>
        <input type="search" id="swSearch" placeholder="Поиск по слову или переводу" value="${esc(f.q)}">
        <button class="btn small ghost" data-export-words>Экспорт таблицы</button>
      </div>
      <div id="swTable"></div>`;
  },

  /** Отфильтрованные карточки для таблицы слов. */
  filtered() {
    const s = Learn.state, f = this.filter, now = Date.now();
    // «в раундах» — включённые колоды и (при offDecks: 'review') начатые слова выключенных, каждое слово — один раз
    const cards = f.deck === 'all' ? s.decks.flatMap(d => d.cards) : f.deck === 'active' ? Decks.activeCards(s) : s.decks.filter(d => d.id === f.deck).flatMap(d => d.cards);
    const q = stripAccents((f.q || '').trim().toLowerCase());
    const out = [];
    for (const c of cards) {
      const { st, due, p } = Decks.status(s, c, now);
      if (f.st === 'due' && !(st !== 'new' && due)) continue;
      if (f.st === 'hard' && !(p && p.wrong > 0)) continue;
      if (f.st === 'spelling' && !Decks.needsBuild(s, c)) continue;
      if (['new', 'learning', 'learned'].includes(f.st) && st !== f.st) continue;
      if (q && !stripAccents((c.front + ' ' + c.back + ' ' + c.hint).toLowerCase()).includes(q)) continue;
      out.push(c);
    }
    const hard = c => { const p = Decks.prog(s, c); return p.wrong - p.right * 0.2; };
    if (f.st === 'hard') out.sort((a, b) => hard(b) - hard(a));
    return out;
  },

  renderWords(keepFocus) {
    const el = $('#swTable');
    if (!el) return;
    const s = Learn.state, list = this.filtered();
    const rows = list.slice(0, WORDS_LIMIT).map(c => {
      const p = Decks.prog(s, c);
      return `<tr><td class="greek">${esc(c.front)}</td><td>${esc(c.back)}</td><td class="dim">${esc(c.hint)}</td>
        <td class="box">${progressHtml(s, c)}</td><td class="num">${p ? `<span title="верно">${p.right}</span> / <span class="${p.wrong ? 'bad-n' : ''}" title="ошибок">${p.wrong}</span>` : ''}</td></tr>`;
    }).join('');
    el.innerHTML = `<div class="dim small">${list.length > WORDS_LIMIT ? `Показаны первые ${WORDS_LIMIT} из ${list.length} — уточните фильтр.` : `${list.length} ${plural(list.length, 'слово', 'слова', 'слов')}`}</div>
      ${list.length ? `<div class="deck-table"><table><tr><th>Греческий</th><th>Перевод</th><th>Подсказка</th><th>Прогресс</th><th title="верно / ошибок">✓ / ✗</th></tr>${rows}</table></div>` : '<p class="dim">Ничего не найдено.</p>'}`;
    if (keepFocus) { const i = $('#swSearch'); if (i && document.activeElement !== i) i.focus(); }
  },

  s_pace() {
    const set = Decks.settings(Learn.state);
    const opt = (name, cur, vals) => `<select data-setting="${name}">${vals.map(([v, l]) => `<option value="${v}" ${String(cur) === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    const mult = Game.logosMult(), bonus = Math.round((mult - 1) * 100);
    let h = `<h2>Темп и награды</h2>
      <h4>Темп</h4>
      <div class="settings">
        <label><span>Верных ответов, чтобы слово считалось выученным</span>${opt('learnSteps', set.learnSteps, [[2, '2 — быстро'], [3, '3 — обычно'], [4, '4'], [5, '5 — основательно']])}</label>
        <label><span>Повторять выученное</span>${opt('appetite', set.appetite, Object.entries(Cat.appetites).map(([k, a]) => [k, `${a.name} — ${a.desc}`]))}</label>
        <label><span>Заданий в раунде</span>${opt('roundSize', set.roundSize, [[6, '6'], [8, '8'], [12, '12'], [16, '16']])}</label>
        <label><span>Слов в заучивании одновременно</span>${opt('learnPool', set.learnPool, [[0, '0 — только повторение'], [3, '3'], [5, '5'], [8, '8'], [12, '12'], [16, '16']])}</label>
        <div class="dim small">Раунд — ровно столько заданий, сколько выбрано; знакомство с новым словом — тоже задание, а в конце раунда
          его проверят. Новые слова приходят, пока заучивается меньше слов, чем выбрано выше, — не больше половины раунда
          и не вытесняя повторение. Так раунды ровные: не «восемь новых и восемь проверок», а несколько новых вперемешку с повторением.</div>
        <div class="dim small">Выученное сейчас повторяется через: ${(Cat.appetites[set.appetite] || Cat.appetites.normal).intervals.map(fmtDur).join(' → ')}, дальше — с последним интервалом.
          Это в среднем: каждый срок — случайно от ${Math.round(DUE_SPREAD[0] * 100)}% до ${Math.round(DUE_SPREAD[1] * 100)}% интервала, чтобы повторения шли ровно, без волн.
          Слово выучено после стольких верных ответов, сколько выбрано выше; последний из них — набор слова.
          «Какая буква?» может попасться на любом шаге и тоже считается. Ошибка в написании не откатывает слово назад —
          оно просто ещё раз пойдёт на набор.</div>
      </div>
      <h4>Сколько λ даёт задание</h4>
      <p>Награда зависит только от типа задания: чем сложнее, тем больше. Серии верных ответов не поощряются — ошибка ничего не «сжигает».</p>
      <table class="pt"><tr><th>Задание</th><th>λ за верный ответ</th>${bonus ? `<th>с бонусом +${bonus}%</th>` : ''}</tr>`;
    const order = ['build', 'ru2gr', 'spell', 'gr2ru', 'match', 'flip'];
    for (const k of order) {
      const R = Cat.tasks[k];
      h += `<tr><td><b>${esc(R.name)}</b><br><span class="dim small">${esc(R.desc)}</span></td><td><b>${R.lambda}</b>${k === 'match' ? ' за пару' : ''}</td>${bonus ? `<td>${Math.round(R.lambda * mult)}</td>` : ''}</tr>`;
    }
    h += `<tr><td>Знакомство с новым словом</td><td>0 — λ за него дадут в проверке в конце раунда</td>${bonus ? '<td></td>' : ''}</tr>
      <tr><td>Досрочное повторение</td><td>×${EARLY_FACTOR} — слово ещё не пора повторять</td>${bonus ? '<td></td>' : ''}</tr>
      </table>
      <p class="dim small">Обычный раунд из 8 карточек приносит около ${ROUND_LAMBDA} λ. Бонус дают святилища, писцы и «Наблюдение за звёздами» — он виден под медальоном λ.</p>`;
    return h;
  },

  s_io() {
    const s = Learn.state;
    return `<h2>Импорт и экспорт</h2>
      <h4>Добавить свою колоду</h4>
      <div class="import">
        <input type="text" id="deckName" placeholder="Название колоды">
        <textarea id="deckText" rows="7" placeholder="По одной карточке в строке:\nσπίτι\tдом\tspíti\nνερό; вода\nψωμί — хлеб\n\nили JSON: [{&quot;front&quot;:&quot;σπίτι&quot;,&quot;back&quot;:&quot;дом&quot;}]"></textarea>
        <div class="import-row">
          <label class="btn small ghost">📂 Файл…<input type="file" id="deckFile" accept=".txt,.tsv,.csv,.json" hidden></label>
          <button class="btn small" data-import>Импортировать</button>
        </div>
        <div class="hint dim">TSV (экспорт Anki «Notes in Plain Text»), CSV, «слово ; перевод ; подсказка», «слово — перевод», JSON. Греческая сторона определяется сама.
          <button class="link" data-pedia="a:import">Подробнее</button></div>
      </div>
      <h4>Экспорт</h4>
      <div class="io-list">
        <div><button class="btn small" data-export-backup>💾 Копия обучения (.json)</button>
          <span class="dim small">колоды, прогресс каждого слова, настройки и журнал — чтобы перенести в другой браузер или подстраховаться</span></div>
        <div><select id="ioDeck">${s.decks.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join('')}</select>
          <button class="btn small ghost" data-export-deck-sel>Колода (.tsv)</button>
          <span class="dim small">слова без прогресса — открывается в Anki и Excel</span></div>
        <div><button class="btn small ghost" data-export-all-words>Все слова с прогрессом (.tsv)</button>
          <span class="dim small">таблица для Excel или Google Таблиц</span></div>
      </div>
      <h4>Восстановить из копии</h4>
      <div class="io-list"><div><label class="btn small ghost">📂 Выбрать копию .json…<input type="file" id="backupFile" accept=".json" hidden></label>
        <span class="dim small">заменит текущие колоды и прогресс; город не трогается</span></div></div>`;
  },

  s_reset() {
    return `<h2>Сброс</h2>
      <div class="reset-card">
        <b>Начать город заново</b>
        <p class="dim">Город, знания, обряды и Логос начнутся с медно-каменного века. Колоды, выученные слова, настройки и журнал занятий останутся.</p>
        <button class="btn small ghost" data-newgame>🏛️ Новая игра</button>
      </div>
      <div class="reset-card">
        <b>Сбросить обучение</b>
        <p class="dim">Все слова снова станут новыми, журнал и статистика обнулятся. Колоды и настройки останутся, город — тоже.
          Прогресс одной колоды можно сбросить в разделе <a href="#" data-sec="decks">«Колоды»</a>.</p>
        <button class="btn small ghost danger" data-reset-learning>Сбросить обучение</button>
      </div>
      <div class="reset-card">
        <b>Стереть всё</b>
        <p class="dim">Город, обучение и импортированные колоды — как при первом запуске. Перед этим можно сохранить
          <a href="#" data-sec="io">копию обучения</a>.</p>
        <button class="btn small danger-fill" data-wipe>Стереть всё</button>
      </div>`;
  },

  // ---------------- действия ----------------
  /** Таблица слов с прогрессом (для Excel/Google Таблиц). */
  progressTsv(cards) {
    const f = v => String(v ?? '').replace(/[\t\r\n]+/g, ' ');
    const rows = [Msg.tsvHead].concat(Decks.progressRows(Learn.state, cards).map(r =>
      [r.card.front, r.card.back, r.card.hint, r.deck, Msg.status[r.status], r.right, r.wrong, r.due != null ? new Date(r.due).toLocaleString('ru-RU') : '']));
    return rows.map(r => r.map(f).join('\t')).join('\n') + '\n';
  },

  download(name, text, type = 'text/plain') {
    const blob = new Blob([text], { type: type + ';charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name.replace(/[\\/:*?"<>|]+/g, '_');
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  },

  doImport() {
    let parsed;
    try { parsed = Decks.parse($('#deckText').value); }
    catch (err) { return UI.toast('Не удалось разобрать: ' + esc(err.message)); }
    if (!parsed.cards.length) return UI.toast('Карточек не найдено');
    const name = $('#deckName').value.trim() || parsed.name || `Колода ${Learn.state.decks.length + 1}`;
    const deck = Decks.makeDeck(name, parsed.cards);
    Learn.state.decks.push(deck);
    Learn.save();
    UI.toast(`Импортировано: ${deck.cards.length} карт${parsed.skipped ? ` (пропущено строк: ${parsed.skipped})` : ''}`);
    Game.log('deckImported', { name, n: deck.cards.length });
    this.sec = 'decks'; this.render();
  },

  confirm(text, yes, fn) {
    UI.confirmModal(text, yes, fn);
  },

  onClick(e) {
    if (e.target.id === 'school' || e.target.closest('[data-school-close]')) return this.close();
    const a = e.target.closest('[data-sec], [data-pedia]');
    if (a) {
      e.preventDefault();
      if (a.dataset.pedia) return Pedia.open(a.dataset.pedia);
      this.sec = a.dataset.sec; this.render();
      return;
    }
    const sum = e.target.closest('.dgroup > summary');
    if (sum) { const g = sum.parentElement; this.groupOpen[g.dataset.dgroup] = !g.open; return; }
    const t = e.target.closest('button');
    if (!t) return;
    const s = Learn.state, d = t.dataset;
    const deckBy = id => s.decks.find(x => x.id === id);
    if ('study' in d) { this.close(true); return Study.start(); }
    if ('planOpen' in d) return UI.showLearnPlan();
    if ('import' in d) return this.doImport();
    if (d.groupOn || d.groupOff) {
      const g = this.deckGroups().find(x => x.key === (d.groupOn || d.groupOff));
      if (g) { for (const x of g.decks) x.active = !!d.groupOn; this.groupOpen[g.key] = true; Learn.save(); this.render(true); UI.renderTop(); }
      return;
    }
    if (d.deckWords) { this.filter = { deck: d.deckWords, st: 'all', q: '' }; this.sec = 'words'; return this.render(); }
    if (d.exportDeck || 'exportDeckSel' in d) {
      const deck = deckBy(d.exportDeck || $('#ioDeck').value);
      if (deck) this.download(deck.name + '.tsv', Decks.deckTsv(deck), 'text/tab-separated-values');
      return;
    }
    if ('exportWords' in d) return this.download('слова.tsv', this.progressTsv(this.filtered()), 'text/tab-separated-values');
    if ('exportAllWords' in d) return this.download('слова-прогресс.tsv', this.progressTsv(s.decks.flatMap(x => x.cards)), 'text/tab-separated-values');
    if ('exportBackup' in d) return this.download(`logos-обучение-${dayKey()}.json`, JSON.stringify(Decks.backup(s)), 'application/json');
    if (d.deckReset) {
      const deck = deckBy(d.deckReset);
      if (deck) this.confirm(`Сбросить прогресс колоды «${esc(deck.name)}»? Все её слова снова станут новыми — и в других колодах, где они есть.`, 'Сбросить', () => {
        Decks.resetDeck(s, deck); Learn.save(); this.render(true); UI.renderTop(); UI.toast(`Прогресс колоды «${esc(deck.name)}» сброшен`);
      });
      return;
    }
    if (d.deckDel) {
      const deck = deckBy(d.deckDel);
      if (deck) this.confirm(`Удалить колоду «${esc(deck.name)}»? Прогресс её слов останется только у тех, что есть в других колодах.`, 'Удалить', () => {
        Decks.removeDeck(s, deck);
        Learn.save(); this.render(true); UI.renderTop();
      });
      return;
    }
    if ('newgame' in d) return this.confirm('Начать город заново? Город, знания и Логос начнутся с медно-каменного века. <b>Колоды и выученные слова сохранятся.</b>', 'Новая игра', () => { Learn.save(); Game.newGame(); });
    if ('resetLearning' in d) return this.confirm('Сбросить обучение? Все слова снова станут новыми, журнал и статистика обнулятся. Город и Логос не тронутся.', 'Сбросить обучение', () => {
      Decks.resetLearning(s); Learn.save(); this.render(); UI.renderAll(); UI.toast('Обучение сброшено');
    });
    if ('wipe' in d) return this.confirm('Стереть всё? Город, Логос, прогресс слов и импортированные колоды будут удалены.', 'Стереть всё', () => Session.wipe());
  },

  onChange(e) {
    const t = e.target, s = Learn.state;
    if (t.dataset.setting) {
      s.settings[t.dataset.setting] = /^\d+$/.test(t.value) ? +t.value : t.value;
      Learn.save(); this.render(true); UI.renderTop();
      return;
    }
    if (t.dataset.deckToggle) {
      const d = s.decks.find(x => x.id === t.dataset.deckToggle);
      if (d) { d.active = t.checked; Learn.save(); this.render(true); UI.renderTop(); }
      return;
    }
    if (t.dataset.wf) { this.filter[t.dataset.wf] = t.value; return this.renderWords(); }
    if (t.id === 'deckFile' && t.files[0]) {
      const f = t.files[0], r = new FileReader();
      r.onload = () => {
        $('#deckText').value = r.result;
        if (!$('#deckName').value) $('#deckName').value = f.name.replace(/\.[^.]+$/, '');
      };
      r.readAsText(f, 'utf-8');
      return;
    }
    if (t.id === 'backupFile' && t.files[0]) {
      const r = new FileReader();
      r.onload = () => {
        let data;
        try { data = JSON.parse(r.result); if (data.type !== 'logos-learning') throw Object.assign(new Error('notBackup'), { code: 'notBackup' }); }
        catch (err) { return UI.toast('Не удалось прочитать копию: ' + esc(Msg.error(err))); }
        const words = Object.keys(data.progress || {}).length;
        this.confirm(`Восстановить обучение из копии от ${esc(new Date(data.exported).toLocaleString('ru-RU'))}? Колод: ${data.decks.length}, слов с прогрессом: ${words}. Текущие колоды и прогресс будут заменены, город не тронется.`,
          'Восстановить', () => {
            try { Decks.restore(s, data); } catch (err) { return UI.toast(esc(Msg.error(err))); }
            Learn.save(); this.sec = 'ov'; this.render(); UI.renderAll(); UI.toast('Обучение восстановлено из копии');
          });
      };
      r.readAsText(t.files[0], 'utf-8');
      t.value = '';
    }
  },
};
