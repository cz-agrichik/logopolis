'use strict';
// ============================================================
//  Первый экран нового игрока (в чём игра + обучение) и обучение «Первые шаги»: карточка задания над картой и стрелка «жми сюда».
//  Шаги, проверка и награда — в ядре (core/city/tutorial.js), тексты шагов — Cat.tutorial (content/ru/lexicon.js).
//  Стрелка и рамка висят поверх страницы (position: fixed) и не ловят клики; их место пересчитывается
//  каждые 250 мс (main.js), после перерисовки панели и карты, при прокрутке и смене размера окна.
// ============================================================

const Tutorial = {
  folded: false,    // карточка свёрнута до заголовка
  finishPending: false,
  tileFor: null, tileXY: null,   // клетка под стрелкой: держим её, пока годится, — стрелка не прыгает по карте
  lastKey: null, lastCard: null,

  init() {
    const mk = (id, cls, parent) => { const d = document.createElement('div'); d.id = id; d.className = cls + ' hidden'; parent.appendChild(d); return d; };
    this.card = mk('tutCard', 'tut-card', $('#mapWrap'));
    this.ring = mk('tutRing', 'tut-ring', document.body);
    this.arrow = mk('tutArrow', 'tut-arrow', document.body);
    this.arrow.innerHTML = `<span class="tut-say"></span><svg viewBox="0 0 48 60" aria-hidden="true"><path d="M17 2h14v30h13L24 58 4 32h13z"/></svg>`;
    this.card.addEventListener('click', e => this.onCard(e));
    const upd = () => this.place();
    window.addEventListener('resize', upd);
    $('#mapScroll').addEventListener('scroll', upd, { passive: true });
    $('#panel').addEventListener('scroll', upd, { passive: true });
    this.update();
  },

  rounds() { return (Learn.state && Learn.state.stats.rounds) || 0; },
  /** Открыто что-то поверх игры: окно, раунд, Кипропедия, «Обучение». */
  overlay() {
    return !$('#modal').classList.contains('hidden') || !$('#study').classList.contains('hidden')
      || !$('#pedia').classList.contains('hidden') || School.isOpen();
  },

  // ---------- первый экран, старт, пропуск, финал ----------
  /** Первый экран совсем нового игрока: в чём игра — и предложение обучения. Дальше — «Что будем учить?», потом игра.
   *  (Новая игра поверх прежней — другой экран: рассказ об эпохе, UI.showEpoch(true).) Закрыть мимо кнопок нельзя. */
  showWelcome() {
    const T = Cat.tutorial, ic = [Art.svg(Looks.icons('house', 1)[0]), '<b class="wc-l">λ</b>', '<span class="wc-e">📜</span>'];
    UI.showModal(`<div class="welcome"><div class="meander"></div>
      <div class="tut-hello">Χαίρετε!</div><h2>Λόγος · Кипр сквозь эпохи</h2>
      <p class="story">${esc(T.story)}</p>
      <ul class="wc-points">${T.points.map(([b, t], i) => `<li><span class="wc-ic">${ic[i]}</span><span><b>${esc(b)}</b> — ${esc(t)}</span></li>`).join('')}</ul>
      <div class="wc-offer"><b>🎓 ${esc(T.name)}.</b> ${esc(T.offer.replace('{r}', BALANCE.tutorialReward))}</div>
      <div class="em-actions"><button class="btn ghost" data-action="welcome-skip">Пропустить обучение</button>
      <button class="btn gold" data-action="welcome-tut">Начать с обучением →</button></div></div>`, { noX: true, sticky: true });
    this.update();   // карточка «Показать первые шаги?» под окном не нужна
  },
  /** Ответ на первом экране: с обучением или без — и к выбору колод (если его ещё не было). */
  welcome(go) {
    if (go) { Game.tutorialStart(this.rounds()); this.folded = false; } else Game.tutorialSkip();
    if (Game.state.planPending) UI.showLearnPlan(); else UI.closeModal();
    UI.lastPanel = null; UI.renderPanel();
    this.update();
  },
  start() {
    Game.tutorialStart(this.rounds());
    this.folded = false;
    if (!$('#modal').classList.contains('hidden')) UI.closeModal();
    this.tick();
  },
  /** Пропустить. confirm — спросить (из карточки, когда обучение уже идёт). */
  skip(confirm = false) {
    if (confirm) return UI.confirmModal('Обучение закончится, а λ за оставшиеся шаги вы не получите. Вернуть его можно во вкладке «Эпоха».',
      'Пропустить', () => { this.skip(); UI.toast('🎓 Обучение пропущено. Всё об игре — в Кипропедии «?».'); });
    Game.tutorialSkip();
    if (!$('#modal').classList.contains('hidden')) UI.closeModal();
    UI.lastPanel = null; UI.renderPanel();   // во вкладке «Эпоха» появится «Пройти обучение»
    this.update();
  },
  ack(id) {
    const got = Game.tutorialAck(id, this.rounds());
    if (got.length) this.reward(got);
    this.update();
  },
  showFinish() {
    const sum = TUTORIAL_STEPS.reduce((a, S) => a + Game.tutorialReward(S), 0);
    UI.showModal(`<div class="tut-modal"><div class="tut-hello">Εύγε!</div><h2>${esc(Cat.tutorial.name)} пройдены</h2>
      <p>За обучение — <b>λ +${sum}</b>. Дальше — сами: улучшайте здания (клик по зданию покажет, что даст новый уровень),
      ловите беглых коз, копите Логос на знания и чудеса. Что нужно для бронзового века — во вкладке «Эпоха».</p>
      <div class="em-actions"><button class="btn ghost" data-pedia="a:basics">? Кипропедия</button>
      <button class="btn gold" data-action="close">Играть дальше →</button></div></div>`, { small: true });
  },
  /** После закрытия окна (UI.closeModal): финал, если его ещё не показали. */
  afterOverlay() {
    if (this.overlay()) return;
    if (this.finishPending) { this.finishPending = false; this.showFinish(); return; }
    this.update();
  },

  /** Каждые 250 мс: проверить шаги, наградить, обновить карточку и стрелку. */
  tick() {
    if (!Game.state || !this.card) return;
    if (!this.overlay() && this.finishPending) { this.finishPending = false; this.showFinish(); }
    const got = Game.tutorialCheck(this.rounds());
    if (got.length) this.reward(got);
    this.update();
  },
  reward(got) {
    let sum = 0;
    for (const g of got) {
      if (!g.logos) continue;
      sum += g.logos;
      UI.toast(`🎓 ${esc(Cat.tutorial.steps[g.id].done)} · <b>λ +${g.logos}</b>`);
    }
    if (sum) UI.floatText($('#logosMedal'), `λ +${sum}`, 'gold');
    UI.renderTop(); UI.renderPanel();
    if (Game.state.tutorial && Game.state.tutorial.finished) { if (this.overlay()) this.finishPending = true; else this.showFinish(); }
  },

  // ---------- карточка задания ----------
  onCard(e) {
    const b = e.target.closest('[data-tut]');
    if (!b) return;
    const a = b.dataset.tut;
    if (a === 'go') return this.start();
    if (a === 'skip') return this.skip(Game.tutorialOn());
    if (a === 'ack') return this.ack(b.dataset.step);
    if (a === 'fold') { this.folded = !this.folded; this.update(); }
  },
  /** Разметка карточки (без живой строки — её обновляет update, чтобы кнопки не пересоздавались каждую секунду). */
  cardHtml() {
    const t = Game.state.tutorial, T = Cat.tutorial;
    if (t && t.offer && !t.on) {
      if (!$('#modal').classList.contains('hidden')) return '';   // строчка «Показать?» — если на первом экране не ответили (окно закрыли кодом)
      return `<div class="tut-head"><b>🎓 ${esc(T.name)}</b></div><div class="tut-body">
        <div class="tut-text">Показать, с чего начать? За каждый шаг — λ ${BALANCE.tutorialReward}.</div>
        <div class="tut-acts"><button class="btn small gold" data-tut="go">Показать</button><button class="link" data-tut="skip">не нужно</button></div></div>`;
    }
    const S = Game.tutorialCurrent();
    if (!S) return '';
    const L = T.steps[S.id], prize = Game.tutorialReward(S);
    const folded = this.folded || (UI.compact() && !!UI.placing);   // телефон: пока выбирают клетку, карточка — одной строкой
    const dots = TUTORIAL_STEPS.map(x => `<i class="${t.done.includes(x.id) ? 'ok' : x === S ? 'now' : ''}" title="${esc(T.steps[x.id].title)}"></i>`).join('');
    return `<div class="tut-head"><b>🎓 ${esc(T.name)}</b><span class="tut-dots">${dots}</span>
        <button class="tut-btn" data-tut="fold" title="${this.folded ? 'Развернуть' : 'Свернуть'}">${this.folded ? '▸' : '▾'}</button>
        <button class="tut-btn" data-tut="skip" title="Пропустить обучение">✕</button></div>
      <div class="tut-body">
        <div class="tut-title"><span class="tut-ic">${L.icon}</span><span>${esc(L.title)}</span>${prize ? `<span class="tut-prize">λ +${prize}</span>` : ''}</div>
        ${folded ? '' : `<div class="tut-text">${esc(L.text)}</div><div class="tut-extra"></div>
        ${S.info ? `<div class="tut-acts"><button class="btn small gold" data-tut="ack" data-step="${S.id}">Понятно →</button></div>` : ''}`}
      </div>`;
  },
  /** Живая строка под заданием: счётчик, чего не хватает, сколько рук. */
  extra(S) {
    const s = Game.state;
    if (S.each) {   // по ресурсу на каждый вид клеток: 🪵 ✓ · 🪨 ○ · 🌾 ○
      const got = Game.tutorialGathered(S);
      return 'Собрано: ' + S.each.map(k => `${Cat.res[k].icon} ${got.includes(k) ? '<b>✓</b>' : '○'}`).join(' · ');
    }
    if (S.id === 'flow') {
      const r = Game.rates[S.res] || 0;
      return `${Cat.res[S.res].icon} ${Math.floor(s.res[S.res])} — ${r > 0.05 ? `и прибавляется по ${fmtRate(r).slice(1)} в секунду` : 'скоро начнёт прибывать'}.`;
    }
    if (S.build) {
      if (UI.placing === S.build) return 'Теперь — клик по клетке со стрелкой.';
      const st = Game.buildStatus(S.build);
      // хижина: сколько рук не хватает (жители прибывают, пока есть места)
      const hands = S.build !== 'house' || Game.need <= s.pop ? ''
        : s.pop >= Game.cap ? `Все ${Game.cap} мест заняты, а работы — на ${Game.need}. ` : `Работы — на ${Game.need}, жителей — ${s.pop} из ${Game.cap} мест. `;
      return hands + (st.ok ? '' : this.lackText(st.reason));
    }
    if (S.rite) {
      const st = Game.ritualStatus(Cat.rite[S.rite]);
      return st.ok ? `Цена — λ ${st.logos}.` : st.cd ? esc(Msg.reason(st.reason)) + '.' : this.lackText(st.reason);
    }
    if (S.id === 'tech') {
      const p = this.techPick();
      return p ? `Например, «${esc(p.T.name)}». ${p.st.ok ? '' : this.lackText(p.st.reason)}` : '';
    }
    return '';
  },
  lackText(r) {
    if (!r) return '';
    const txt = esc(Msg.reason(r));
    if (r.code !== 'lack') return txt + '.';
    if (r.logos) return `${txt} — λ дают карточки: «📜 Учиться».`;
    return `${txt} — соберите руками или подождите.`;
  },

  update() {
    if (!this.card) return;
    const html = this.cardHtml();
    if (html !== this.lastCard) { this.lastCard = html; this.card.innerHTML = html; this.card.classList.toggle('hidden', !html); }
    const ex = this.card.querySelector('.tut-extra'), S = Game.tutorialCurrent();
    if (ex && S) { const h = this.extra(S); if (ex.innerHTML !== h) ex.innerHTML = h; ex.classList.toggle('hidden', !h); }
    this.place();
  },

  /** Длина раунда карточек, если его начинают из обучения (шаг «Добудьте Логос» — короткий раунд), иначе null. */
  roundSize() {
    const S = Game.state && Game.tutorialCurrent();
    return (S && S.round) || null;
  },
  /** Ячейка ресурса в шапке. */
  resCell(k) { return $('#resources').children[RES_KEYS.filter(x => Game.resVisible(x)).indexOf(k)]; },

  // ---------- куда показывать ----------
  /** Знание для шага «Первое знание»: доступное за λ, иначе — через силу, иначе — первое открытое (покажем, чего не хватает). */
  techPick() {
    const open = Cat.techs.filter(T => T.epoch === Game.state.epoch && !Game.hasTech(T.id)).filter(T => { const st = Game.techStatus(T); return !st.locked && !st.hidden; });
    for (const mode of ['logos', 'labor']) for (const T of open) { const st = Game.techStatus(T, mode); if (st.ok) return { T, mode, st }; }
    return open.length ? { T: open[0], mode: 'logos', st: Game.techStatus(open[0]) } : null;
  },
  /** Клетка карты для стрелки: ближайшая к первой хижине из подходящих (pred), сначала — из видимых. key — для чего ищем. */
  tileEl(key, pred) {
    const s = Game.state, home = s.buildings.find(b => b.type === 'house') || { x: 10, y: 5 };
    const free = t => t && t.t !== 'sea' && !Game.buildingAt(t.x, t.y) && !(Game.goat && Game.goat.x === t.x && Game.goat.y === t.y) && pred(t);
    const el = t => $(`#map .tile[data-x="${t.x}"][data-y="${t.y}"]`);
    const box = $('#mapScroll').getBoundingClientRect();
    const card = this.card.classList.contains('hidden') ? null : this.card.getBoundingClientRect();   // клетки под карточкой задания не годятся
    const seen = t => {
      const e = el(t), r = e && e.getBoundingClientRect();
      if (!r || r.left < box.left - 2 || r.right > box.right + 2 || r.top < box.top - 2 || r.bottom > box.bottom + 2) return false;
      return !card || r.right <= card.left || r.left >= card.right || r.bottom <= card.top || r.top >= card.bottom;
    };
    const was = this.tileFor === key && this.tileXY && Game.tile(this.tileXY.x, this.tileXY.y);
    if (was && free(was) && seen(was)) return el(was);
    const list = Game.map.filter(free).sort((a, b) => Math.hypot(a.x - home.x, a.y - home.y) - Math.hypot(b.x - home.x, b.y - home.y));
    const t = list.find(seen) || list[0];
    this.tileFor = key; this.tileXY = t ? { x: t.x, y: t.y } : null;
    return t ? el(t) : null;
  },
  /** Не хватает: λ — к «Учиться»; немного ресурса — на клетку, где его собирают; много — на число в шапке (оно копится). */
  lackTarget(r) {
    if (!r || r.code !== 'lack') return null;
    if (r.logos) return { el: $('#studyBtn'), say: `Нужно λ ${r.logos}`, key: 'lack:logos' };
    const [k, d] = r.items[0], ter = Object.keys(TERRAIN).find(x => TERRAIN[x].gather === k);
    if (ter && d <= 25) return { el: this.tileEl('gather:' + ter, t => t.t === ter), say: `Собери ${Cat.res[k].icon} ${d}`, key: 'lack:' + k };
    return { el: this.resCell(k), say: `${Cat.res[k].icon} копится…`, key: 'wait:' + k };
  },
  /** Куда показывает стрелка: { el, say, key } или null. */
  target(S) {
    const phone = UI.compact();
    const inTab = (tab, sel, say) => {
      if (UI.tab === tab && !(phone && !UI.drawerOpen())) return { el: $('#panel ' + sel), say, key: 'panel:' + sel };
      const el = $(phone ? `#rail button[data-tab="${tab}"]` : `.tabs button[data-tab="${tab}"]`);
      return { el, say: `Жми «${(el.querySelector('span') || el).textContent.trim()}»`, key: 'tab:' + tab };
    };
    if (S.each) {   // следующий несобранный ресурс — на клетку, где он добывается
      const got = Game.tutorialGathered(S), k = S.each.find(x => !got.includes(x)) || S.each[0];
      const ter = Object.keys(TERRAIN).find(x => TERRAIN[x].gather === k);
      return { el: this.tileEl('gather:' + ter, t => t.t === ter), say: `${Cat.terrain[ter].name} — жми сюда`, key: 'gather:' + ter };
    }
    if (S.id === 'flow') { const r = Game.rates[S.res] || 0; return { el: this.resCell(S.res), say: r > 0.05 ? `${fmtRate(r)} в секунду — само!` : 'Смотри сюда', key: 'flow' }; }
    if (S.info) return { el: $('#resources'), say: 'Ваши запасы', key: 'res' };
    if (S.build) {
      if (UI.placing === S.build) return { el: this.tileEl('place:' + S.build, t => Game.canPlaceOn(S.build, t)), say: 'Ставь сюда', key: 'place' };
      const st = Game.buildStatus(S.build);
      return st.ok ? inTab('build', `[data-build="${S.build}"]`, 'Жми «Строить»') : this.lackTarget(st.reason);
    }
    if (S.id === 'study') return { el: $('#studyBtn'), say: 'Жми сюда', key: 'study' };
    if (S.rite) {
      const st = Game.ritualStatus(Cat.rite[S.rite]);
      return st.ok ? inTab('rites', `[data-rite="${S.rite}"]`, 'Жми «Собрать»') : st.cd ? null : this.lackTarget(st.reason);
    }
    if (S.id === 'tech') {
      const p = this.techPick();
      if (!p) return null;
      return p.st.ok ? inTab('tech', `[data-tech="${p.T.id}"][data-mode="${p.mode}"]`, p.mode === 'logos' ? 'Жми «Изучить»' : 'Жми «Осилить»') : this.lackTarget(p.st.reason);
    }
    return null;
  },

  /** Поставить рамку и стрелку к цели текущего шага (или спрятать). */
  place() {
    if (!this.arrow) return;
    const S = Game.tutorialOn() && !this.overlay() ? Game.tutorialCurrent() : null;
    const tg = S && this.target(S);
    let el = tg && tg.el, r = el && el.getBoundingClientRect();
    // телефон: кнопки «Строить» спрятаны — кнопка там вся карточка здания
    if (r && !r.width && el.closest('.item')) { el = el.closest('.item'); r = el.getBoundingClientRect(); }
    if (!r || !r.width) { this.ring.classList.add('hidden'); this.arrow.classList.add('hidden'); this.lastKey = null; return; }
    // цель в панели прокручена из виду — один раз, когда цель сменилась, докручиваем панель
    if (tg.key !== this.lastKey) {
      this.lastKey = tg.key;
      const box = el.closest('#panel');
      if (box) { const b = box.getBoundingClientRect(); if (r.top < b.top || r.bottom > b.bottom) { el.scrollIntoView({ block: 'nearest' }); r = el.getBoundingClientRect(); } }
    }
    const pad = 4, W = innerWidth, H = innerHeight;
    Object.assign(this.ring.style, { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + 2 * pad + 'px', height: r.height + 2 * pad + 'px' });
    this.ring.classList.toggle('tile-ring', el.classList.contains('tile'));
    this.ring.classList.remove('hidden');
    // стрелка: к панели справа (вкладки, кнопки, полоска вкладок на телефоне) — слева, остриём вправо, чтобы не закрывать
    // соседние кнопки; у верхнего края экрана — снизу, остриём вверх; иначе — сверху, остриём вниз
    const dir = el.closest('#side, #rail') && r.left > 120 ? 'left' : r.top < 110 && r.bottom + 100 < H ? 'up' : 'down';
    const say = this.arrow.firstChild;
    if (say.textContent !== tg.say) say.textContent = tg.say;
    this.arrow.classList.toggle('up', dir === 'up');
    this.arrow.classList.toggle('left', dir === 'left');
    this.arrow.classList.remove('hidden');
    let shift = 0;
    if (dir === 'left') {   // повёрнутая стрелка — 60×48 вокруг того же центра; остриё — в 6 px от цели
      const cy = r.top + r.height / 2;
      this.arrow.style.left = r.left - 6 - 30 - 24 + 'px';
      this.arrow.style.top = cy - 30 + 'px';
    } else {
      const cx = Math.max(26, Math.min(W - 26, r.left + r.width / 2));
      this.arrow.style.left = cx - 24 + 'px';
      this.arrow.style.top = (dir === 'up' ? r.bottom + 6 : r.top - 6 - 60) + 'px';
      const sw = say.offsetWidth;   // подпись не вылезает за край экрана
      shift = Math.min(0, W - 6 - (cx + sw / 2)) + Math.max(0, 6 - (cx - sw / 2));
    }
    say.style.setProperty('--shift', shift + 'px');
  },
};
