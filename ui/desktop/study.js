'use strict';
// ============================================================
//  Раунд карточек (ПК): только отрисовка и ввод.
//  Состав раунда, варианты, плитки, проверка и награды — в core/learning/lesson.js.
// ============================================================

const Study = {
  open: false,

  start() {
    const round = Lesson.plan(Learn.state);
    if (!round) return UI.toast('Нет активных карточек — включите или импортируйте колоду в «📚 Обучении»');
    UI.cancelPlacing();
    if (typeof School !== 'undefined') School.close(true);
    this.pool = round.pool;
    this.tasks = round.tasks;
    this.i = 0; this.earned = 0; this.right = 0; this.wrong = 0; this.learnedNow = 0; this.ended = false;
    this.open = true;
    $('#study').classList.remove('hidden');
    if (!this.bound) this.bind();
    this.render();
  },

  close() {
    this.open = false;
    clearTimeout(this.timer);
    $('#study').classList.add('hidden');
    Session.saveAll();
    UI.renderAll();
  },

  bind() {
    this.bound = true;
    $('#study').addEventListener('click', e => this.onClick(e));
    document.addEventListener('keydown', e => { if (this.open) this.onKey(e); });
  },

  // ---------- награды ----------
  /** λ за верный ответ: цена задания × бонусы святилищ и писцов. */
  reward(type, p) { return Lesson.reward(type, p, Game.logosMult()); },
  /** Значок «сколько λ даёт задание» рядом с вопросом. */
  valueBadge(type, p, perPair = false) {
    return `<span class="badge val" title="Столько λ даст верный ответ${perPair ? ' — за каждую пару без ошибки' : ''}${p && p.kind === 'early' ? ' (досрочно — меньше)' : ''}">λ ${this.reward(type, p || {})}${perPair ? ' за пару' : ''}</span>`;
  },

  grade(p, correct, type = 'gr2ru') {
    const { event: ev, gain } = Lesson.answer(Learn.state, p, correct, type, Game.logosMult());
    if (ev === 'needtype') this.needType = true;
    if (ev === 'learned') { this.learnedNow++; this.justLearned = (this.justLearned || 0) + 1; }
    if (correct) { this.right++; Game.addLogos(gain); this.earned += gain; }
    else this.wrong++;
    this.renderHead();
    if (gain) {
      const el = $('#stEarned');
      UI.floatText(el, `+${gain} λ`, 'gold');
    }
    UI.renderTop();
    return gain;
  },

  // ---------- отрисовка ----------
  renderHead() {
    const total = this.tasks.length;
    $('#stProgress').style.width = (100 * this.i / total) + '%';
    $('#stEarned').textContent = `λ +${this.earned}`;
    $('#stCombo').textContent = total ? `${Math.min(this.i + 1, total)} / ${total}` : '';
    const bonus = Math.round((Game.logosMult() - 1) * 100);
    $('#stBonus').textContent = bonus ? `бонус святилищ и писцов: +${bonus}% λ` : '';
  },

  render() {
    clearTimeout(this.timer);
    this.answered = false;
    this.renderHead();
    const t = this.tasks[this.i];
    const body = $('#stBody');
    if (!t) return this.renderEnd();
    body.className = 'st-body type-' + t.type;
    Lesson.prepare(Learn.state, this.pool, t);
    body.innerHTML = this['r_' + t.type](t);
    if (t.type === 'build') this.renderBuild(t);
    if (t.type === 'intro' && Decks.hasGreek(t.p.card.front)) Speech.say(t.p.card.front, true);
  },

  wordHtml(text, big = true) {
    const g = Decks.hasGreek(text);
    return `<div class="q-word ${g ? 'greek' : ''} ${big ? '' : 'small'}">${esc(text)}${g ? `<button class="say" data-say="${esc(text)}" title="Произнести">🔊</button>` : ''}</div>`;
  },
  badge(p) {
    return p.kind === 'new' ? '<span class="badge new">новое</span>' : p.kind === 'early' ? '<span class="badge" title="Карточку ещё не пора повторять — λ меньше">досрочно</span>' : '';
  },

  r_intro(t) {
    const c = t.p.card;
    return `<div class="q-label">Новая карточка <span class="badge new">новое</span></div>
      <div class="flash">${this.wordHtml(c.front)}${c.hint ? `<div class="q-hint">${esc(c.hint)}</div>` : ''}
      <div class="flash-back">${esc(c.back)}</div></div>
      <div class="feedback"></div>
      <button class="btn gold next" data-next>Запомнил →</button>`;
  },

  r_gr2ru(t) { return this.choiceHtml(t, 'front', 'back', 'Что это значит?'); },
  r_ru2gr(t) { return this.choiceHtml(t, 'back', 'front', 'Как это будет по-гречески?'); },

  choiceHtml(t, from, to, label) {
    const c = t.p.card;
    return `<div class="q-label">${label} ${this.badge(t.p)} ${this.valueBadge(t.type, t.p)}</div>
      ${this.wordHtml(c[from])}
      <div class="q-hint reveal">${esc(c.hint)}</div>
      <div class="options">${t.opts.map((o, i) => `<button class="opt ${Decks.hasGreek(o) ? 'greek' : ''}" data-opt="${i}"><kbd>${i + 1}</kbd><span>${esc(o)}</span></button>`).join('')}</div>
      <div class="feedback"></div>`;
  },

  /** «Какая буква?»: слово с пропуском в «коварном» месте и 2–4 варианта написания. */
  r_spell(t) {
    const c = t.p.card, w = c.front, a = t.before, b = t.after;
    return `<div class="q-label">Какая буква? ${this.valueBadge('spell', t.p)}</div>
      <div class="q-sub">${esc(c.back)}</div>
      <div class="q-word greek spell-word">${esc(a)}<span class="gap" id="spGap">${'_'.repeat(Math.max(1, [...t.spot.from].length))}</span>${esc(b)}<button class="say" data-say="${esc(w)}" title="Произнести — на слух эти буквы не различить">🔊</button></div>
      <div class="options spell-opts">${t.opts.map((o, i) => `<button class="opt greek" data-opt="${i}"><kbd>${i + 1}</kbd><span>${esc(o)}</span></button>`).join('')}</div>
      <div class="feedback"></div>`;
  },

  r_build(t) {
    const c = t.p.card;
    const last = Decks.needsBuild(Learn.state, c);
    return `<div class="q-label">Соберите слово по-гречески${t.syl ? ' из слогов' : ''} ${last ? '<span class="badge new">последний шаг к «выучено»</span>' : this.badge(t.p)} ${this.valueBadge('build', t.p)}</div>
      ${this.wordHtml(c.back)}
      <div class="slots ${t.syl ? 'syl' : ''}" id="slots"></div>
      <div class="tiles ${t.syl ? 'syl' : ''}" id="tiles"></div>
      <div class="build-tools"><button class="btn ghost small" data-erase>⌫ Стереть</button><span class="dim">можно печатать с клавиатуры</span></div>
      <div class="feedback"></div>`;
  },

  r_match(t) {
    return `<div class="q-label">Соедините пары ${this.valueBadge('match', t.items[0], true)}</div>
      <div class="match">
        <div class="col">${t.left.map((p, i) => `<button class="mt greek" data-mt="L${i}">${esc(p.card.front)}</button>`).join('')}</div>
        <div class="col">${t.right.map((p, i) => `<button class="mt" data-mt="R${i}">${esc(p.card.back)}</button>`).join('')}</div>
      </div><div class="feedback"></div>`;
  },

  r_flip(t) {
    const c = t.p.card;
    return `<div class="q-label">Вспомните перевод ${this.badge(t.p)} ${this.valueBadge('flip', t.p)}</div>
      ${this.wordHtml(c.front)}
      <div class="flash-back hidden" id="flipBack">${esc(c.back)}${c.hint ? `<div class="q-hint">${esc(c.hint)}</div>` : ''}</div>
      <div class="flip-actions" id="flipActions"><button class="btn" data-flip>Показать ответ <kbd>Пробел</kbd></button></div>
      <div class="feedback"></div>`;
  },

  renderBuild(t) {
    const hole = t.picked.indexOf(null), nextPos = hole >= 0 ? hole : t.picked.length;
    $('#slots').innerHTML = t.target.map((_, i) => {
      const k = t.picked[i];
      return `<span class="slot ${k != null ? 'filled' : i === nextPos && !t.marks ? 'next' : ''} ${t.marks ? t.marks[i] : ''}" data-slot="${i}">${k != null ? esc(t.tiles[k].ch) : ''}</span>`;
    }).join('');
    $('#tiles').innerHTML = t.tiles.map((x, i) => `<button class="tile-l ${x.used ? 'used' : ''}" data-tile="${i}" ${x.used ? 'disabled' : ''}>${esc(x.ch)}</button>`).join('');
  },

  renderEnd() {
    $('#stProgress').style.width = '100%';
    const total = this.right + this.wrong;
    const p = Decks.pending(Learn.state);
    if (!this.ended) { this.ended = true; Lesson.finish(Learn.state); }
    Session.saveAll();
    $('#stBody').className = 'st-body type-end';
    $('#stBody').innerHTML = `<div class="end">
      <div class="end-l">λ +${this.earned}</div>
      <div class="end-t">Раунд окончен</div>
      <div class="dim">Верно ${this.right} из ${total}${this.learnedNow ? ` · <b class="learned-mark">выучено слов: ${this.learnedNow}</b>` : ''}</div>
      <div class="dim">${p.due ? `Пора повторить ещё: ${p.due}.` : 'Всё, что пора было повторить, — повторено.'} ${p.fresh ? `Новых слов в колодах: ${p.fresh}.` : ''}</div>
      <div class="end-actions"><button class="btn gold" data-again>Ещё раунд</button><button class="btn ghost" data-close>В город</button></div>
      <button class="link" data-school>📚 Обучение: прогресс, колоды, темп</button>
    </div>`;
  },

  feedback(ok, extra = '') {
    const f = $('#stBody .feedback');
    f.className = 'feedback ' + (ok ? 'ok' : 'bad');
    const learned = this.justLearned ? ` <span class="learned-mark">✓ ${this.justLearned > 1 ? this.justLearned + ' слова выучены' : 'выучено'}</span>` : '';
    const spell = this.needType && ok ? ` <span class="dim">· осталось один раз набрать слово ✍</span>` : '';
    f.innerHTML = `<div class="fb-msg">${extra}${learned}${spell}</div>`;
    this.justLearned = 0; this.needType = false;
    this.answered = true;
    if (ok) this.timer = setTimeout(() => this.next(), spell || learned ? 1400 : 900);
    else f.innerHTML += `<button class="btn next" data-next>Дальше <kbd>Enter</kbd></button>`;
  },

  next() {
    clearTimeout(this.timer);
    this.i++;
    this.render();
  },

  // ---------- действия ----------
  pickOption(i) {
    const t = this.tasks[this.i];
    if (this.answered || !t.opts || i >= t.opts.length) return;
    if (t.type === 'spell') return this.pickSpell(i);
    const { ok, right } = Lesson.checkChoice(t, i);
    document.querySelectorAll('#stBody .opt').forEach((b, k) => {
      b.disabled = true;
      if (t.opts[k] === right) b.classList.add('right');
      else if (k === i) b.classList.add('wrong');
    });
    $('#stBody .reveal').classList.add('shown');
    const gain = this.grade(t.p, ok, t.type);
    if (Decks.hasGreek(t.p.card.front)) Speech.say(t.p.card.front, true);
    const c = t.p.card;
    this.feedback(ok, ok ? `Верно! <b>+${gain} λ</b>` : `<span class="greek">${esc(c.front)}</span> — ${esc(c.back)}`);
  },

  pickSpell(i) {
    const t = this.tasks[this.i], { ok, right } = Lesson.checkChoice(t, i);
    document.querySelectorAll('#stBody .opt').forEach((b, k) => {
      b.disabled = true;
      if (t.opts[k] === right) b.classList.add('right');
      else if (k === i) b.classList.add('wrong');
    });
    const gap = $('#spGap');
    gap.textContent = right; gap.classList.add(ok ? 'ok' : 'bad');
    const gain = this.grade(t.p, ok, 'spell');
    Speech.say(t.p.card.front, true);
    this.feedback(ok, ok ? `Верно! <b>+${gain} λ</b>` : `Правильно: <span class="greek">${esc(t.p.card.front)}</span>`);
  },

  buildTap(i) {
    const t = this.tasks[this.i];
    if (this.answered || t.tiles[i].used) return;
    const done = Lesson.tapTile(t, i);
    this.renderBuild(t);
    if (done) this.buildCheck(t);
  },
  buildUndo(pos) {
    const t = this.tasks[this.i];
    if (this.answered) return;
    if (Lesson.untapTile(t, pos)) this.renderBuild(t);
  },
  buildKey(key) {
    const t = this.tasks[this.i];
    if (this.answered) return;
    const free = t.tiles.map((x, i) => ({ x, i })).filter(o => !o.x.used);
    const norm = v => stripAccents(v);
    // точное совпадение буквы с ударением важнее, чем без
    if (!t.syl) {
      const k = key.toLowerCase();
      let o = free.find(o => o.x.ch.toLowerCase() === k) || free.find(o => norm(o.x.ch) === norm(k));
      if (o) this.buildTap(o.i);
      return;
    }
    // слоги: копим набранные буквы, пока они не совпадут со слогом целиком
    let buf = t.kb + key;
    let cands = free.filter(o => norm(o.x.ch).startsWith(norm(buf)));
    if (!cands.length && t.kb) {
      // набранное ранее уже было целым слогом (а длиннее не вышло) — берём его и начинаем новый
      const prev = free.find(o => o.x.ch.toLowerCase() === t.kb.toLowerCase()) || free.find(o => norm(o.x.ch) === norm(t.kb));
      t.kb = '';
      if (prev) { this.buildTap(prev.i); if (this.answered) return; return this.buildKey(key); }
    }
    if (!cands.length) { buf = key; cands = free.filter(o => norm(o.x.ch).startsWith(norm(buf))); }
    if (!cands.length) { t.kb = ''; return; }
    const exact = cands.find(o => o.x.ch.toLowerCase() === buf.toLowerCase()) || cands.find(o => norm(o.x.ch) === norm(buf));
    // если набранное совпало со слогом и других кандидатов длиннее нет — берём его
    if (exact && cands.every(o => norm(o.x.ch) === norm(buf))) { t.kb = ''; return this.buildTap(exact.i); }
    t.kb = buf;
    const el = document.querySelector('.build-tools .dim');
    if (el) el.textContent = `набрано: ${buf}`;
  },
  buildCheck(t) {
    const target = t.p.card.front, r = Lesson.checkBuild(t), ok = r.ok;
    document.querySelectorAll('#tiles button').forEach(b => b.disabled = true);
    $('#slots').classList.add(ok ? 'right' : 'wrong');
    let fixed = '';
    if (!ok) {
      // подсветка: в наборе зелёное — верно, красное — неверно; в правильном слове выделено то, что было не так
      t.marks = r.marks;
      fixed = t.target.map((pc, j) => r.targetOk[j] ? `<span class="ok">${esc(pc)}</span>` : `<b class="miss">${esc(pc)}</b>`).join('');
      this.renderBuild(t);
    }
    const gain = this.grade(t.p, ok, 'build');
    if (Decks.hasGreek(target)) Speech.say(target, true);
    this.feedback(ok, ok ? `Верно! <b>+${gain} λ</b>` : `Правильно: <span class="greek diffword">${fixed}</span>`);
  },

  matchTap(code) {
    const t = this.tasks[this.i];
    if (this.answered) return;
    const side = code[0], idx = +code.slice(1);
    const p = side === 'L' ? t.left[idx] : t.right[idx];
    if (t.done.has(p)) return;
    if (!t.sel || t.sel.side === side) {
      t.sel = { side, idx, p };
      document.querySelectorAll('#stBody .mt').forEach(b => b.classList.toggle('sel', b.dataset.mt === code));
      return;
    }
    const a = t.sel, other = `${a.side}${a.idx}`;
    const bL = $(`[data-mt="${other}"]`), bR = $(`[data-mt="${code}"]`);
    t.sel = null;
    document.querySelectorAll('#stBody .mt').forEach(b => b.classList.remove('sel'));
    if (a.p === p) {
      t.done.add(p);
      bL.classList.add('right'); bR.classList.add('right');
      bL.disabled = bR.disabled = true;
      if (Decks.hasGreek(p.card.front)) Speech.say(p.card.front, true);
      if (t.done.size === t.items.length) {
        let gain = 0;
        for (const it of t.items) gain += this.grade(it, !t.miss.has(it), 'match');
        const errs = t.miss.size;
        this.feedback(errs === 0, errs === 0 ? `Все пары! <b>+${gain} λ</b>` : `Собрано. Ошибок: ${errs}${gain ? ` · +${gain} λ` : ''}`);
      }
    } else {
      const lp = a.side === 'L' ? a.p : p;
      t.miss.add(lp);
      for (const b of [bL, bR]) { b.classList.add('wrong'); setTimeout(() => b.classList.remove('wrong'), 450); }
    }
  },

  flipShow() {
    const back = $('#flipBack');
    if (!back || !back.classList.contains('hidden')) return;
    back.classList.remove('hidden');
    $('#flipActions').innerHTML = `<button class="btn ghost danger" data-self="0">Не вспомнил <kbd>1</kbd></button>
      <button class="btn" data-self="1">Вспомнил <kbd>2</kbd></button>`;
  },
  flipGrade(ok) {
    const t = this.tasks[this.i];
    if (this.answered) return;
    $('#flipActions').innerHTML = '';
    const gain = this.grade(t.p, ok, 'flip');
    this.feedback(ok, ok ? `<b>+${gain} λ</b>` : 'Ничего, вернёмся к ней скоро.');
  },

  onClick(e) {
    const slot = e.target.closest('.slot.filled');
    if (slot) return this.buildUndo(+slot.dataset.slot);
    const b = e.target.closest('button');
    if (!b) return;
    const d = b.dataset;
    if (d.say) return Speech.say(d.say);
    if ('close' in d || b.id === 'stClose') return this.close();
    if ('again' in d) return this.start();
    if ('school' in d) { this.close(); return School.open(); }
    if ('next' in d) return this.next();
    if (d.opt != null) return this.pickOption(+d.opt);
    if (d.tile != null) return this.buildTap(+d.tile);
    if ('erase' in d) return this.buildUndo();
    if (d.mt) return this.matchTap(d.mt);
    if ('flip' in d) return this.flipShow();
    if (d.self != null) return this.flipGrade(d.self === '1');
  },

  onKey(e) {
    const t = this.tasks[this.i];
    if (e.key === 'Escape') return this.close();
    if (!t) { if (e.key === 'Enter') this.start(); return; }
    if (e.key === 'Enter') {
      if (t.type === 'intro' || this.answered) { e.preventDefault(); return this.next(); }
    }
    if (this.answered) return;
    if ((t.type === 'gr2ru' || t.type === 'ru2gr' || t.type === 'spell') && /^[1-4]$/.test(e.key)) return this.pickOption(+e.key - 1);
    if (t.type === 'flip') {
      if (e.key === ' ') { e.preventDefault(); return this.flipShow(); }
      if (!$('#flipBack').classList.contains('hidden') && (e.key === '1' || e.key === '2')) return this.flipGrade(e.key === '2');
    }
    if (t.type === 'build') {
      if (e.key === 'Backspace') { e.preventDefault(); if (t.kb) { t.kb = ''; return; } return this.buildUndo(); }
      if ((e.key === 'Enter' || e.key === ' ') && t.kb) {
        e.preventDefault();
        const o = t.tiles.map((x, i) => ({ x, i })).find(o => !o.x.used && stripAccents(o.x.ch) === stripAccents(t.kb));
        t.kb = '';
        if (o) this.buildTap(o.i);
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) return this.buildKey(e.key);
    }
  },
};
