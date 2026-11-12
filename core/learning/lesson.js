'use strict';
// ============================================================
//  Раунд обучения: состав заданий, подготовка каждого задания, проверка ответа, награды.
//  Логика здесь, а интерфейс только рисует и передаёт ввод — так её разделяют все интерфейсы.
// ============================================================

// ------------------------------------------------------------
//  Награды: λ за верный ответ зависит от типа задания (серии не поощряются).
//  Чем сложнее задание, тем больше λ; набор слова — самое дорогое.
//  Обычный раунд из 8 карточек приносит около ROUND_LAMBDA λ до бонусов святилищ и писцов (замерено моделью ученика).
// ------------------------------------------------------------
//  Типы заданий: flip — вспомнить самому, gr2ru — выбрать перевод, match — пары, spell — «Какая буква?»,
//  ru2gr — выбрать греческое слово, build — набрать слово; intro — знакомство (без награды).
const TASK_REWARDS = {
  flip:  { lambda: 1 },
  gr2ru: { lambda: 6 },
  match: { lambda: 3 },
  spell: { lambda: 6 },
  ru2gr: { lambda: 7 },
  build: { lambda: 12 },
};
const ROUND_LAMBDA = 55;          // ориентир: λ за раунд из 8 карточек до бонусов
const EARLY_FACTOR = 0.4;          // досрочное повторение (не пора) — меньше

Object.assign(Decks, {
  /** Сколько λ даёт верный ответ в задании этого типа (без бонусов святилищ и писцов). */
  rewardBase(type, kind) {
    const base = (TASK_REWARDS[type] || TASK_REWARDS.gr2ru).lambda;
    return kind === 'early' ? Math.max(1, Math.round(base * EARLY_FACTOR)) : base;
  },
});

const Lesson = {
  // ---------- состав раунда ----------
  /** Новый раунд: { pool, tasks } или null, если активных карточек нет. */
  plan(state) {
    const picks = Decks.selectRound(state);
    if (!picks.length) return null;
    const pool = Decks.activeCards(state);
    return { pool, tasks: this.buildTasks(state, pool, picks) };
  },

  buildTasks(state, pool, picks) {
    const tasks = [], later = [];
    let rest = picks;
    const seasoned = picks.filter(p => p.kind !== 'new' && p.lvl >= 1 && !Decks.needsBuild(state, p.card));
    if (seasoned.length >= 4 && this.distinct(pool, 'back') >= 4) {
      const m = shuffle(seasoned).slice(0, 4);
      tasks.push({ type: 'match', items: m });
      rest = picks.filter(p => !m.includes(p));
    }
    for (const p of rest) {
      if (p.kind === 'new') { tasks.push({ type: 'intro', p }); later.push({ type: this.distinct(pool, 'back') >= 2 ? 'gr2ru' : 'flip', p }); }
      else tasks.push({ type: this.typeFor(state, pool, p), p });
    }
    let order = shuffle(tasks).concat(shuffle(later));
    if (order[0] && order[0].type === 'match' && order.length > 1) [order[0], order[1]] = [order[1], order[0]];
    return order;
  },

  distinct(pool, field) { return new Set(pool.map(c => c[field])).size; },

  buildable(card) {
    const w = card.front;
    return [...w].length >= 2 && [...w].length <= 18 && !/[\s.,!?;:()'"«»-]/.test(w);
  },

  typeFor(state, pool, p) {
    if (Decks.needsBuild(state, p.card)) return 'build';   // последний шаг к «выучено» — набор слова
    const canChoose = this.distinct(pool, 'back') >= 2 && this.distinct(pool, 'front') >= 2;
    const b = p.lvl, spell = Decks.hasSpellSpot(p.card);
    // «Какая буква?» — не отдельный этап, а шанс на любом шаге: так спросят и про написание, не добавляя заданий
    if (b >= 3) {
      if (this.buildable(p.card) && Math.random() < 0.6) return 'build';
      if (spell && Math.random() < 0.4) return 'spell';
      return canChoose && Math.random() < 0.5 ? 'ru2gr' : 'flip';
    }
    if (spell && b >= 1 && Math.random() < 0.35) return 'spell';
    if (b === 2) {
      if (this.buildable(p.card) && Math.random() < 0.4) return 'build';
      return canChoose ? 'ru2gr' : 'flip';
    }
    if (!canChoose) return 'flip';
    return Math.random() < 0.65 ? 'gr2ru' : 'ru2gr';
  },

  options(state, pool, card, field) {
    const right = card[field];
    // варианты — из той же колоды (тот же язык перевода и часть речи), если их хватает
    const deck = Decks.deckOfCard(state, card.id);
    let src = deck ? deck.cards : pool;
    if (new Set(src.map(c => c[field])).size < 4) src = pool;
    const others = [...new Set(src.map(c => c[field]).filter(v => v !== right))];
    // предпочитаем похожие по длине варианты — так интереснее
    others.sort((a, b) => Math.abs(a.length - right.length) - Math.abs(b.length - right.length) + (Math.random() - 0.5) * 6);
    return shuffle([right, ...others.slice(0, 3)]);
  },

  // ---------- подготовка задания (варианты, плитки, пары) ----------
  /** Вызывается прямо перед показом задания. */
  prepare(state, pool, t) {
    const c = t.p && t.p.card;
    if (t.type === 'gr2ru') t.opts = this.options(state, pool, c, 'back');
    else if (t.type === 'ru2gr') t.opts = this.options(state, pool, c, 'front');
    else if (t.type === 'spell') {
      // «Какая буква?»: слово с пропуском в «коварном» месте и 2–4 варианта написания
      const spots = spellSpots(c.front);
      t.spot = spots[Math.floor(Math.random() * spots.length)];
      t.opts = shuffle(t.spot.opts.slice(0, 4));
      t.before = c.front.slice(0, t.spot.i); t.after = c.front.slice(t.spot.i + t.spot.from.length);
    } else if (t.type === 'build') this.prepareBuild(pool, t);
    else if (t.type === 'match') {
      t.left = shuffle(t.items);
      t.right = shuffle(t.items);
      t.sel = null; t.done = new Set(); t.miss = new Set();
    }
    return t;
  },

  /** Набор слова: куски (буквы или слоги) и 2–3 обманки, похожие на слух. */
  prepareBuild(pool, t) {
    const c = t.p.card;
    t.target = Syl.pieces(c.front);
    t.syl = t.target.length < [...c.front].length;
    const decoys = [];
    const used = new Set(t.target);
    const addDecoy = d => { if (d && !used.has(d) && decoys.length < 3) { decoys.push(d); used.add(d); } };
    if (!t.syl) {
      // буквы: подменяем похожими по звучанию (η→ι, ο→ω, ς→σ…)
      const singles = shuffle(t.target.flatMap(ch => confusions(ch)).filter(v => [...v].length === 1));
      singles.slice(0, 2).forEach(addDecoy);
      const letters = Decks.hasGreek(c.front) ? GREEK_LETTERS : 'abcdefghijklmnopqrstuvwxyz';
      while (decoys.length < 2) addDecoy(letters[Math.floor(Math.random() * letters.length)]);
    } else {
      // слоги: тот же слог, но с «неправильной» гласной или сигмой
      const tricky = shuffle(t.target.flatMap(sy => confusions(sy)));
      tricky.slice(0, 3).forEach(addDecoy);
      if (decoys.length < 2) {
        const others = shuffle(pool.filter(x => x.front !== c.front && Decks.canType(x))).slice(0, 10);
        for (const o of others) {
          const sy = Syl.split(o.front).filter(x => x.length >= 2);
          if (sy.length) addDecoy(sy[Math.floor(Math.random() * sy.length)]);
          if (decoys.length >= 2) break;
        }
      }
    }
    t.tiles = shuffle(t.target.concat(decoys)).map(ch => ({ ch, used: false }));
    t.picked = [];
    t.kb = '';
  },

  // ---------- ответы ----------
  /** Выбор варианта (перевод, греческое слово, «Какая буква?»): { ok, right }. */
  checkChoice(t, i) {
    const right = t.type === 'spell' ? t.spot.from : t.p.card[t.type === 'gr2ru' ? 'back' : 'front'];
    return { ok: t.opts[i] === right, right };
  },

  /** Набор: положить плитку. Если в середине слова убрали кусок — новая встаёт на его место. Возвращает true, когда слово собрано. */
  tapTile(t, i) {
    if (t.tiles[i].used) return false;
    t.tiles[i].used = true;
    const hole = t.picked.indexOf(null);
    if (hole >= 0) t.picked[hole] = i; else t.picked.push(i);
    t.kb = '';
    return t.picked.length === t.target.length && !t.picked.includes(null);
  },
  /** Набор: убрать кусок (по месту или последний). */
  untapTile(t, pos) {
    if (!t.picked.some(k => k != null)) return false;
    if (pos == null || pos >= t.picked.length || t.picked[pos] == null) {
      pos = t.picked.length - 1;
      while (pos > 0 && t.picked[pos] == null) pos--;
    }
    t.tiles[t.picked[pos]].used = false;
    t.picked[pos] = null;
    while (t.picked.length && t.picked[t.picked.length - 1] == null) t.picked.pop();
    return true;
  },
  /** Проверка набора: { ok, marks (ok / acc — не то ударение / bad), targetOk }. */
  checkBuild(t) {
    const typed = t.picked.map(k => t.tiles[k].ch), word = typed.join('');
    const ok = word === t.p.card.front;
    if (ok) return { ok };
    const d = diffPieces(typed, t.target);
    const marks = typed.map((ch, i) => d.tOk[i] ? 'ok' : stripAccents(ch) === stripAccents(t.target[i] || '') ? 'acc' : 'bad');
    return { ok, marks, targetOk: d.gOk };
  },

  // ---------- оценка и награда ----------
  /** λ за верный ответ: цена задания × множитель Логоса (бонусы святилищ и писцов даёт город). */
  reward(type, p, mult = 1) {
    return Math.max(1, Math.round(Decks.rewardBase(type, p.kind) * mult));
  },
  /**
   * Засчитать ответ: прогресс слова, статистика, журнал дня.
   * Возвращает { event: 'learned' | 'needtype' | null, gain } — gain (λ) начисляет тот, кто ведёт игру.
   */
  answer(state, p, correct, type, mult = 1) {
    const ev = Decks.grade(state, p.card, correct, p.kind, type);
    if (ev === 'learned') state.stats.learned = (state.stats.learned || 0) + 1;
    let gain = 0;
    if (correct) { state.stats.right++; gain = this.reward(type, p, mult); }
    else state.stats.wrong++;
    Decks.logDay(state, { a: 1, r: correct ? 1 : 0, x: gain, l: ev === 'learned' ? 1 : 0, n: p.kind === 'new' ? 1 : 0 });
    return { event: ev, gain };
  },
  /** Раунд окончен. */
  finish(state) {
    state.stats.rounds++;
    Decks.logDay(state, { rounds: 1 });
  },
};