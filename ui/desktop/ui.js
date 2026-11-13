'use strict';
// ============================================================
//  Интерфейс для ПК: верхняя панель, карта, вкладки, окна.
//  Правила игры — в core/, тексты — в content/ru/, рисунки — в assets/ и ui/common/looks.js.
// ============================================================

const UI = {
  tab: 'build',
  placing: null,
  dev: /[?&]dev\b/.test(location.search),

  init() {
    document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => this.setTab(b.dataset.tab)));
    // телефон: та же вкладка ещё раз — убрать панель, другая — переключить и показать
    document.querySelectorAll('#rail button').forEach(b => b.addEventListener('click', () => {
      const same = this.tab === b.dataset.tab && this.drawerOpen();
      this.setTab(b.dataset.tab);
      this.drawer(!same);
    }));
    $('#mapWrap').addEventListener('click', e => { if (this.compact() && this.drawerOpen() && !e.target.closest('#map')) this.drawer(false); });
    $('#placeHint').addEventListener('click', e => { if (e.target.closest('[data-cancel-place]')) this.cancelPlacing(); });
    const measure = () => document.documentElement.style.setProperty('--top-h', $('#topbar').offsetHeight + 'px');
    measure(); window.addEventListener('resize', measure);
    $('#map').addEventListener('click', e => this.onMapClick(e));
    $('#map').addEventListener('contextmenu', e => { if (this.placing) { e.preventDefault(); this.cancelPlacing(); } });
    // в новой игре сначала спрашиваем, что учить (если игрок ещё не ответил)
    $('#studyBtn').addEventListener('click', () => Game.state.planPending ? this.showLearnPlan(true) : Study.start());
    $('#pediaBtn').addEventListener('click', () => Pedia.open());
    $('#schoolBtn').addEventListener('click', () => School.open());
    $('#logosMedal').addEventListener('click', () => Pedia.open('a:logos'));
    $('#resources').addEventListener('click', () => Pedia.open('a:top'));
    $('#popbox').addEventListener('click', () => Pedia.open('a:pop'));
    $('#panel').addEventListener('click', e => this.onPanelClick(e));
    this.folds = {};
    $('#panel').addEventListener('toggle', e => {
      const d = e.target.closest && e.target.closest('details[data-fold]');
      if (d) { this.folds[d.dataset.fold] = d.open; this.lastPanel = null; }
    }, true);
    $('#modal').addEventListener('click', e => {
      if (e.target.id === 'modal') return this.closeModal();
      const a = e.target.closest('[data-action], [data-pedia]');
      if (a && a.dataset.pedia) { this.closeModal(); return Pedia.open(a.dataset.pedia); }
      if (a) this.onModalAction(a);
    });
    document.addEventListener('keydown', e => {
      if (!$('#study').classList.contains('hidden')) return;
      if (e.key === 'Escape') {
        if (!$('#modal').classList.contains('hidden')) this.closeModal();
        else if (!$('#pedia').classList.contains('hidden')) Pedia.close();
        else if (School.isOpen()) School.close();
        else this.cancelPlacing();
      }
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'F1' || e.key === '?') { e.preventDefault(); Pedia.open(); }
    });
    // события ядра
    Bus.on('log', () => this.renderLog());
    Bus.on('raid', r => this.toast(r.shielded ? '🧱 Циклопические стены отразили набег «народов моря»!'
      : r.tribute ? Msg.tributeLine(r) + '.'
      : `⚔️ Набег «народов моря»! Унесли ${Math.round(r.pct * 100)}% всех запасов. Защитят только Циклопические стены.`));
    this.renderMap();
    this.renderAll();
  },

  setTab(tab) {
    this.tab = tab;
    document.querySelectorAll('.tabs button, #rail button').forEach(x => x.classList.toggle('active', x.dataset.tab === tab));
    this.lastPanel = null;
    this.renderPanel();
  },
  /** Телефон в альбомной ориентации: карта на весь экран, панель — выдвижная. */
  compact() { return matchMedia('(orientation: landscape) and (max-height: 520px)').matches; },
  drawerOpen() { return document.body.classList.contains('drawer-open'); },
  drawer(open) { document.body.classList.toggle('drawer-open', !!open); },

  renderAll() {
    this.renderTop();
    this.renderPanel();
    this.renderLog();
  },

  // ---------------- верхняя панель ----------------
  renderTop() {
    const s = Game.state, E = Cat.epochs[s.epoch];
    document.body.dataset.epoch = s.epoch;
    $('#epochName').textContent = E.name;
    $('#epochSub').textContent = E.sub;

    // λ — на почётном месте, сразу после названия эпохи
    const lm = Math.round((Game.logosMult() - 1) * 100);
    $('#logosMedal').innerHTML = `<span class="lm-sign">λ</span><span class="lm-v"><b>${fmt(s.logos)}</b><small>${lm ? `Логос · +${lm}%` : 'Логос'}</small></span>`;

    // ресурсы: светлая плашка, фиксированные ячейки, полоска заполнения склада
    const buffed = Game.buffedRes();
    let html = '';
    for (const k of RES_KEYS) {
      if (!Game.resVisible(k)) continue;
      const r = Game.rates[k] || 0, v = s.res[k], fill = Math.min(100, 100 * v / Game.storage);
      const full = v >= Game.storage - 0.5, falling = r < -0.05;
      html += `<div class="rs ${full ? 'full' : ''} ${falling ? 'falling' : ''} ${buffed.has(k) ? 'buffed' : ''}" title="${Cat.res[k].name}: ${Math.floor(v)} из ${Game.storage} (вместимость складов)${Math.abs(r) > 0.05 ? `, ${fmtRate(r)} в секунду` : ''}${full ? ' — склад полон!' : ''}${falling ? ` — запас тает${r < 0 && v > 0 ? `, хватит примерно на ${fmtDur(v / -r * 1000)}` : ''}` : ''}${buffed.has(k) ? ' · под благословением' : ''}">
        <span class="rs-ic">${Art.res(k)}</span><span class="rs-v"><b>${fmt(v)}</b><small class="${falling ? 'neg' : ''}">${Math.abs(r) > 0.05 ? (falling ? '▼ ' : '') + fmtRate(r) : '&nbsp;'}</small></span>
        <i class="rs-bar"><i style="width:${fill.toFixed(0)}%"></i></i></div>`;
    }
    $('#resources').innerHTML = html;

    // жители и работники — отдельным блоком
    const { short, hands } = Game.labor();
    $('#popbox').innerHTML = `<div title="Жители: ${s.pop}, мест в домах: ${Game.cap}. Жители прибывают, пока есть места и зерно."><span>👥</span><b>${s.pop}</b><small>/ ${Game.cap} мест</small></div>
      <div class="${short ? 'short' : ''}" title="${short ? `Не хватает работников! Зданиям нужно ${Game.need}, а рук ${hands}. Сначала руки идут на поля и загоны: зерно — ${Math.round(Game.effFood * 100)}%. Остальные здания работают на ${Math.round(Game.effOther * 100)}%. Нужны жилища и зерно — или «Всей семьёй».` : `Зданиям нужно ${Game.need} работников — рук хватает (${hands}).`}"><span>${short ? '⚠' : '⚒'}</span>${short
        ? `<b>${hands} / ${Game.need}</b><small>мало рук · ${Game.effFood < 0.999 ? `даже зерно ${Math.round(Game.effFood * 100)}%` : `прочее ${Math.round(Game.effOther * 100)}%`}</small>`
        : `<b>${Game.need}</b><small>${plural(Game.need, 'работник', 'работника', 'работников')}</small>`}</div>`;

    // благословения — полоса над картой: место под неё есть всегда, и она никогда не переносится на вторую строку
    const buffs = Object.entries(s.buffs || {}).filter(([id]) => Cat.rite[id]);
    const bar = $('#buffbar');
    const pills = buffs.map(([id, left]) => {
      const R = Cat.rite[id];
      return `<span class="bf" title="${esc(R.name)}: ${esc(R.desc)}">${this.riteIcon(R).replace('class="ico', 'class="ico inl')}<b>${esc(R.name)}</b><small>${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}</small></span>`;
    }).join('');
    const free = Math.max(0, BALANCE.maxBuffs - buffs.length);
    const slots = Array.from({ length: free }, () => `<span class="bf-slot" title="Свободное место для благословения (одновременно — до ${BALANCE.maxBuffs})"></span>`).join('');
    // набег «народов моря» (бронзовый век) или дань империи (железный): срок известен заранее — обратный отсчёт справа
    const raidIn = Game.raidIn();
    let raid = '';
    if (raidIn != null) {
      const shield = (Game.fx || Game.effects()).raidShield, mm = `${Math.floor(raidIn / 60)}:${String(Math.floor(raidIn % 60)).padStart(2, '0')}`;
      const [a, b] = BALANCE.raidLoot;
      const lord = Game.overlord(), due = Game.tributeDue();
      if (lord && due != null) {   // Египет и Персия: дань серебром — сумма видна заранее
        const L = Cat.lords[lord], have = Math.floor(Game.state.res.silver), cut = (Game.fx || Game.effects()).tributeCut;
        const how = lord === 'egypt' ? `как средний ассирийский грабёж, но серебром: ${(BALANCE.raidLoot[0] + BALANCE.raidLoot[1]) / 2 * 100 / (shield ? 2 : 1)}% остальных запасов по ценнику — сумма растёт вместе с запасами` : 'твёрдая подать: сумма посчитана при присяге и не растёт вместе с городом';
        const miss = lord === 'egypt' ? `недостающее доберут грабежом${shield ? ' (Циклопические стены — вдвое)' : ''}` : 'недоимку возьмут другими запасами ровно по ценнику';
        raid = `<span class="bf raid ${have >= due ? 'safe' : raidIn < 60 ? 'soon' : ''}" title="Дань ${L.to} через ${mm}: ${due} серебра (${how}${cut ? `; «Флот царей» −${Math.round(cut * 100)}%` : ''}).
          ${have >= due ? 'Серебра хватает.' : `Серебра пока ${have} — не хватит: ${miss}.`}">
          <i class="bf-ic">${L.icon}</i><b>Дань ${L.to}</b><small>${Art.res('silver', 'inl')} ${due} · ${mm}</small></span>`;
      } else if (lord) {
        raid = `<span class="bf raid ${raidIn < 60 ? 'soon' : ''}" title="Сборщики дани Ассирии придут через ${mm}: заберут от ${a * 100}% до ${b * 100}% всех запасов${shield
          ? ' — Циклопические стены уменьшат дань вдвое' : '. Циклопические стены уменьшили бы дань вдвое'}. Успейте потратить! Знание «Дань фараону» сменит грабёж данью серебром.">
          <i class="bf-ic">🏹</i><b>Дань Ассирии</b><small>${mm}</small></span>`;
      } else {
        raid = `<span class="bf raid ${shield ? 'safe' : raidIn < 60 ? 'soon' : ''}" title="${shield
          ? `Набег «народов моря» через ${mm}. Циклопические стены его отразят.`
          : `Набег «народов моря» через ${mm}: унесут от ${a * 100}% до ${b * 100}% всех запасов. Успейте потратить! Защитят только Циклопические стены.`}">
          <i class="bf-ic">${shield ? '🧱' : '⚔️'}</i><b>Народы моря</b><small>${mm}</small></span>`;
      }
    }
    const bhtml = pills + slots + (buffs.length ? '' : `<span class="bf-empty">благословения — во вкладке «Обряды»</span>`) + raid;
    if (bhtml !== this.lastBuffs) {
      this.lastBuffs = bhtml;
      bar.classList.remove('hidden', 'compact');
      bar.innerHTML = bhtml;
      if (bar.scrollWidth > bar.clientWidth + 1) bar.classList.add('compact');   // тесно — только значки и таймеры
    }

    // кнопка «Учиться»: понятными словами, что ждёт в раунде
    const p = Decks.roundPreview(Learn.state), newNow = p.newNow;
    const sub = [p.due ? `повторить ${p.due}` : '', newNow ? `новых ${newNow}` : ''].filter(Boolean).join(' · ') || 'всё повторено';
    if (sub !== this.lastStudySub) {
      this.lastStudySub = sub;
      $('#studySub').textContent = sub;
      $('#studyBtn').title = `Раунд карточек — единственный источник λ.\n${p.due ? `Пора повторить: ${p.due} ${plural(p.due, 'слово', 'слова', 'слов')}.` : 'Сейчас повторять нечего — можно повторить досрочно (λ меньше).'}\n${newNow ? `Новых слов в раунде: до ${newNow}.` : 'Новых слов нет: все уже в работе или колоды выключены.'}`;
      $('#studyBtn').classList.toggle('quiet', !p.due && !newNow);
    }
  },

  // ---------------- карта ----------------
  renderMap() {
    const map = $('#map');
    map.style.gridTemplateColumns = `repeat(${MAP_W}, 1fr)`;
    let html = '';
    for (const t of Game.map) {
      const b = Game.buildingAt(t.x, t.y);
      const cls = ['tile', 't-' + t.t];
      if (t.coast) cls.push('coast');
      if ((t.x + t.y) % 2) cls.push('alt');
      let inner = '', title = Cat.terrain[t.t].name;
      if (b) {
        const B = Cat.bld[b.type], F = Cat.form(b.type), ic = Looks.icons(b.type, b.level);
        cls.push('has-b');
        if (B.special) cls.push('special');
        if (b.idle) cls.push('idle');
        if (!B.special && Game.obsoleteType(b.type)) cls.push('obsolete');   // устарело: перестроить или продать
        if (B.special) inner = `<span class="b">${Art.svg(b.type)}</span>`;
        else {
          cls.push('stage-' + Looks.stage(b.level), 'n' + ic.length, 'bt-' + b.type);
          inner = `<span class="bw">${ic[2] ? `<span class="b b3">${Art.svg(ic[2])}</span>` : ''}${ic[1] ? `<span class="b b2">${Art.svg(ic[1])}</span>` : ''}<span class="b b1">${Art.svg(ic[0])}</span></span><span class="lvl">${b.level}</span>`;
        }
        const nm = B.special ? F.name : Looks.name(b.type, b.level);
        title = B.special ? nm : Game.obsoleteType(b.type) ? `${nm} · ур. ${b.level} — устарело: перестройте или продайте` : `${nm} · ур. ${b.level} (Shift+клик — улучшить)`;
      } else if (t.t === 'forest') inner = `<span class="deco">${Art.svg('tree')}</span>`;
      else if (t.t === 'hill') inner = `<span class="deco">${Art.svg('hill')}</span>`;
      if (Game.goat && Game.goat.x === t.x && Game.goat.y === t.y) {
        cls.push('goat');
        inner = `<span class="goat-ic">${Art.svg(Game.goat.kind === 'maenad' ? 'maenad' : 'goat')}</span>`;
        title = 'Беглая коза! Поймайте её';
      }
      if (this.placing && t.t !== 'sea') cls.push(Game.canPlaceOn(this.placing, t) ? 'valid' : 'invalid');
      html += `<div class="${cls.join(' ')}" data-x="${t.x}" data-y="${t.y}" title="${esc(title)}">${inner}</div>`;
    }
    map.innerHTML = html;
  },

  onMapClick(e) {
    const el = e.target.closest('.tile');
    if (!el) return;
    if (this.compact() && this.drawerOpen()) return this.drawer(false);
    const tile = Game.tile(+el.dataset.x, +el.dataset.y);
    if (Game.goat && Game.goat.x === tile.x && Game.goat.y === tile.y) {
      const g = Game.catchGoat(), m = g.kind === 'maenad';
      this.floatText(el, m ? '🍇!' : '🐐!', 'gold');
      this.toast(`${m ? '🍇' : '🐐'} ${esc(m ? Msg.maenadLine(g.roll) : Msg.goatLine(g.roll))} <b>${Msg.resList(g.gains) || 'склады полны'}</b>`);
      this.renderMap(); this.renderTop();
      return;
    }
    if (this.placing) {
      if (Game.build(this.placing, tile.x, tile.y, this.placingMode)) {
        const keep = e.shiftKey && Game.buildStatus(this.placing, this.placingMode).ok;
        if (!keep) this.cancelPlacing(); else this.renderMap();
        this.renderAll();
      } else {
        const st = Game.buildStatus(this.placing, this.placingMode);
        this.toast(!st.ok ? esc(Msg.reason(st.reason)) : this.placeHintText(this.placing, tile));
      }
      return;
    }
    const b = Game.buildingAt(tile.x, tile.y);
    if (b) {
      if (e.shiftKey && !Cat.bld[b.type].special) {
        const up = Game.upgradeInfo(b);
        const newLook = up && !up.capped && Looks.newLook(b.type, up.target);
        if (Game.upgrade(b)) { this.floatText(el, newLook ? `✨ ур. ${b.level}` : `ур. ${b.level}`, 'gold'); this.renderMap(); this.renderAll(); }
        else this.toast(up && up.reason ? esc(Msg.reason(up.reason)) : 'Нельзя улучшить');
        return;
      }
      return this.showBuilding(b);
    }
    const g = Game.gather(tile);
    if (g) {
      this.floatText(el, `+${g.amt} ${Cat.res[g.res].icon}`);
      el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse');
      this.renderTop();
    }
  },

  placeHintText(type, tile) {
    const B = Cat.bld[type];
    if (Game.buildingAt(tile.x, tile.y)) return 'Клетка уже занята';
    if (tile.t === 'sea') return 'Это море';
    const where = B.terrain.map(t => Cat.terrain[t].name.toLowerCase()).join(' или ');
    if (!B.terrain.includes(tile.t)) return `Здесь ${Cat.terrain[tile.t].name.toLowerCase()}, а нужна ${where}`;
    if (B.coast && !tile.coast) return 'Нужна клетка у самого моря';
    return 'Сюда нельзя';
  },

  startPlacing(type, mode = 'logos') {
    this.placing = type;
    this.placingMode = mode;
    const B = Cat.bld[type];
    const where = B.terrain.map(t => Cat.terrain[t].name.toLowerCase()).join(' или ') + (B.coast ? ' у моря' : '');
    $('#placeHint').innerHTML = `<span>Куда поставить «${esc(Looks.name(type, 1))}»? Подходит: ${where}.<span class="desk-only"> <b>Esc</b> или правый клик — отмена, <b>Shift</b> — строить ещё.</span></span>
      <button class="btn small mob-only" data-cancel-place>Отмена</button>`;
    $('#placeHint').classList.remove('hidden');
    if (this.compact()) this.drawer(false);   // на телефоне панель уезжает — видна вся карта
    document.body.classList.add('placing');
    this.renderMap();
  },
  cancelPlacing() {
    if (!this.placing) return;
    this.placing = null;
    this.placingMode = 'logos';
    $('#placeHint').classList.add('hidden');
    document.body.classList.remove('placing');
    this.renderMap();
    this.renderPanel();
  },

  floatText(anchor, text, cls = '') {
    const r = anchor.getBoundingClientRect();
    const f = document.createElement('div');
    f.className = 'float ' + cls;
    f.textContent = text;
    f.style.left = (r.left + r.width / 2) + 'px';
    f.style.top = (r.top) + 'px';
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 1000);
  },

  toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = msg;
    let box = document.getElementById('toasts');
    if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
    box.appendChild(t);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => t.classList.add('out'), 3200);
    setTimeout(() => t.remove(), 3700);
  },

  // ---------------- общие фрагменты ----------------
  costHtml(cost, logos = 0) {
    const s = Game.state;
    let h = '';
    for (const [k, v] of Object.entries(cost || {})) {
      const have = Math.floor(s.res[k] || 0), lack = have < v;
      h += `<span class="chip cost ${lack ? 'lack' : ''}" title="${Cat.res[k].name}: нужно ${v}, есть ${have}${lack ? ` — не хватает ${Math.ceil(v - have)}` : ''}"><i>${Art.res(k)}</i>${fmt(v)}</span>`;
    }
    if (logos) {
      const lack = s.logos < logos;
      h += `<span class="chip cost logos ${lack ? 'lack' : ''}" title="Логос: нужно ${logos}, есть ${Math.floor(s.logos)}${lack ? ` — не хватает ${Math.ceil(logos - s.logos)}. Логос дают карточки.` : ''}"><i>λ</i>${fmt(logos)}</span>`;
    }
    return h;
  },
  prodChips(p) {
    let h = '';
    for (const [k, v] of Object.entries(p)) h += `<span class="chip ${v < 0 ? 'bad' : 'good'}" title="${Cat.res[k].name}: ${v < 0 ? 'расход' : 'производство'} ${num(Math.abs(v))} в секунду"><i>${Art.res(k)}</i>${v > 0 ? '+' : ''}${num(v)}/с</span>`;
    return h;
  },
  /** Что изменится при улучшении: «было → станет» по каждому выпуску, местам, складу, работникам. */
  upgradeDeltaHtml(b, target) {
    const B = Cat.bld[b.type], fx = Game.fx || Game.effects();
    const now = Game.prodOf(b, fx), next = Game.prodOf(b, fx, target);
    const chip = (cls, ic, a, z, unit = '') => `<span class="chip ${cls}"><i>${ic}</i>${a} → <b>${z}</b>${unit}</span>`;
    let h = '';
    for (const k of Object.keys(next)) h += chip(next[k] < 0 ? 'bad' : 'good', Art.res(k), num(now[k] || 0), num(next[k]), '/с');
    if (B.cap) h += chip('good', '👥', Game.houseCapOf(b, fx), Game.houseCapOf(b, fx, target), ' мест');
    if (B.storage) h += chip('good', Art.svg('store0'), '+' + Game.storageOf(b), '+' + Game.storageOf(b, target), ' склад');
    if (B.logosBonus) { const lb = L => Math.round((B.logosBonus + (B.logosBonusPerLevel || 0) * (L - 1)) * 100); h += chip('good', 'λ', '+' + lb(b.level) + '%', '+' + lb(target) + '%', ' за карточки'); }
    const w0 = Game.workersOf(b), w1 = Game.workersOf({ type: b.type, level: target });
    if (w1 !== w0) h += chip('muted', '⚒', w0, w1, ' ' + plural(w1, 'работник', 'работника', 'работников'));
    return h;
  },
  /** Что даёт здание на уровне L (с учётом бонусов). */
  outputHtml(b, level = b.level) {
    const B = Cat.bld[b.type];
    const fx = Game.fx || Game.effects();
    let h = this.prodChips(Game.prodOf(b, fx, level));
    const tr = Game.tradeOf(b, fx, level);
    if (tr) h += `<span class="chip trade" title="${esc(Cat.bld[b.type].tradeNote || '')}">⇄ ${Object.entries(tr).map(([k, v]) => `<i>${Art.res(k)}</i>${v > 0 ? '+' : ''}${num(v)}`).join(' ')}/с</span>`;
    if (B.cap) h += `<span class="chip good" title="Места для жителей"><i>👥</i>${Game.houseCapOf(b, fx, level)} мест</span>`;
    if (B.storage) h += `<span class="chip good" title="Прибавка к вместимости складов"><i>${Art.svg('store0')}</i>+${Game.storageOf(b, level)}</span>`;
    if (B.logosBonus) h += `<span class="chip good" title="Бонус к Логосу за карточки"><i>λ</i>+${Math.round((B.logosBonus + (B.logosBonusPerLevel || 0) * (level - 1)) * 100)}% за карточки</span>`;
    if (B.workers && Game.workersOf({ type: b.type, level })) { const w = Game.workersOf({ type: b.type, level }); h += `<span class="chip muted" title="Сколько жителей нужно, чтобы здание работало в полную силу"><i>⚒</i>${w} ${plural(w, 'работник', 'работника', 'работников')}</span>`; }
    return h;
  },
  riteIcon(R) { return Looks.riteIcon(R); },
  techIcon(T) { return Looks.techIcon(T); },
  reasonHtml(st) { return st && st.reason && !st.ok ? `<div class="item-lock">${esc(Msg.reason(st.reason))}</div>` : ''; },
  pediaBtn(id) { return `<button class="q" data-pedia="${id}" title="Кипропедия">?</button>`; },
  /** Какое изученное знание сделало здание этого типа устаревшим. */
  retiringTechName(type) {
    const T = TECHS.find(t => Game.hasTech(t.id) && t.retire && t.retire.buildings && t.retire.buildings[type]);
    return T ? Cat.tech[T.id].name : '';
  },

  // ---------------- боковая панель ----------------
  renderPanel() {
    const p = $('#panel');
    const html = this['panel_' + this.tab]();
    if (html === this.lastPanel) return;   // без лишних перерисовок — клики не теряются
    this.lastPanel = html;
    const scroll = p.scrollTop;
    p.innerHTML = html;
    p.scrollTop = scroll;
  },

  panel_build() {
    let normal = '', specials = '';
    for (const [type, B] of Object.entries(Cat.bld)) {
      const st = Game.buildStatus(type);
      if (st.hidden) continue;
      const icon = Looks.icons(type, 1)[0], name = Looks.name(type, 1);
      const n = Game.count(type);
      const head = `<div class="item-ic">${Art.svg(icon)}</div><div class="item-body">
          <div class="item-title">${esc(name)}${!B.special && n ? ` <small>×${n}</small>` : ''} ${this.pediaBtn('b:' + type)}</div>`;
      if (B.special) {
        let body;
        if (st.locked) body = `<div class="item-lock">🔒 ${esc(Msg.reason(st.reason))}</div>`;
        else if (st.done) body = `<div class="item-done">✓ Построено</div>`;
        else if (st.stashed && st.into) body = `<div class="item-stash">📦 На складе. Эпоха чуда прошла — поставить можно бесплатно, но уже как «${esc(Cat.form(st.into).name)}» ${st.level}-го уровня.</div>`;
        else if (st.stashed) body = `<div class="item-stash">📦 На складе — бонус не действует, пока чудо не стоит в городе. Поставить можно бесплатно.</div>`;
        else if (st.upgrade) {
          body = `<div class="item-effect">${esc(B.desc)}</div>
            <div class="chips">${this.costHtml(st.cost, st.logos)}${st.logos ? '' : '<span class="chip muted">без λ</span>'}</div>
            ${this.reasonHtml(st)}`;
        }
        else {
          // эффект чуда иконками не передать — здесь текст нужен
          body = `<div class="item-effect">${esc(B.desc)}</div>
            <div class="chips">${this.costHtml(st.cost, st.logos)}${st.logos ? '' : '<span class="chip muted">без λ</span>'}</div>
            ${this.reasonHtml(st)}`;
        }
        if (B.retire && !st.locked && !st.into) body += `<div class="item-retire">⏳ ${esc(Msg.retireNote(B.retire))}</div>`;
        specials += `<div class="item sp ${st.ok || st.done ? '' : 'disabled'} ${this.placing === type ? 'selected' : ''}">${head}${body}</div>
          ${st.locked || st.done ? '' : `<button class="btn small gold ${st.ok ? '' : 'off'}" data-build="${type}">${st.stashed ? 'Поставить' : st.upgrade ? 'Улучшить' : 'Строить'}</button>`}</div>`;
      } else {
        normal += `<div class="item ${st.ok ? '' : 'disabled'} ${this.placing === type ? 'selected' : ''}">${head}
          ${B.note ? `<div class="item-note">${esc(B.note)}</div>` : ''}
          ${st.locked ? `<div class="item-lock">🔒 ${esc(Msg.reason(st.reason))}</div>` :
            `<div class="chips">${this.costHtml(st.cost)}</div><div class="chips">${this.outputHtml({ type, level: 1 })}</div>${this.reasonHtml(st)}`}
          </div>
          ${st.locked ? '' : `<button class="btn small ${st.ok ? '' : 'off'}" data-build="${type}">Строить</button>`}
        </div>`;
      }
    }
    return `${normal}<h3>Чудеса древнего Кипра <small>по одному каждого</small></h3>${specials}`;
  },

  /** Раскрывающийся блок, который помнит, открыт ли он. */
  fold(id, title, inner, defOpen = false) {
    const open = id in this.folds ? this.folds[id] : defOpen;
    return `<details class="fold" data-fold="${id}" ${open ? 'open' : ''}><summary>${title}</summary>${inner}</details>`;
  },

  techCard(T) {
    const s = Game.state, st = Game.techStatus(T);
    let body;
    if (st.learned) {
      const how = (s.techPath || {})[T.id];
      body = `<div class="item-done">✓ ${how && T.paths ? esc(T.paths[how][0]) : 'Изучено'}</div>`;
    } else if (st.locked) body = `<div class="item-lock">🔒 ${esc(Msg.reason(st.reason))}</div>`;
    else {
      const lab = Game.techStatus(T, 'labor');
      const P = T.paths || { logos: ['За λ', ''], labor: ['Трудом', ''] };
      const opt = (mode, tag, cls, stt, btn) => `<div class="fork-opt ${cls} ${stt.ok ? '' : 'poor'}">
          <div class="fork-h"><span class="fork-tag">${tag}</span><b>${esc(P[mode][0])}</b></div>
          ${P[mode][1] ? `<div class="fork-d">${esc(P[mode][1])}</div>` : ''}
          <div class="fork-row"><div class="chips">${this.costHtml(stt.cost, stt.logos)}</div>
            <button class="btn small ${mode === 'logos' ? 'gold' : ''} ${stt.ok ? '' : 'off'}" data-tech="${T.id}" data-mode="${mode}">${btn}</button></div>
        </div>`;
      body = `<div class="fork">${opt('logos', '🧠 С умом', 'wise', st, 'Изучить')}<div class="fork-or">или</div>${opt('labor', '💪 Через силу', 'force', lab, 'Осилить')}</div>`;
    }
    return `<div class="item tech ${st.learned ? 'learned' : ''}">
      <div class="item-ic">${this.techIcon(T)}</div>
      <div class="item-body"><div class="item-title">${esc(T.name)} ${this.pediaBtn('t:' + T.id)}</div>${st.learned ? '' : `<div class="item-desc">${esc(T.desc)}</div>`}${body}</div>
    </div>`;
  },

  panel_tech() {
    const s = Game.state;
    // сверху — текущая эпоха: что можно изучить, потом закрытое; изученное и прошлые эпохи — внизу, под катом
    const cur = Cat.techs.filter(t => t.epoch === s.epoch);
    const rank = T => { const st = Game.techStatus(T); return st.learned ? 2 : st.locked ? 1 : 0; };
    const open = cur.filter(T => rank(T) < 2).sort((a, b) => rank(a) - rank(b));
    const done = cur.filter(T => rank(T) === 2);
    let h = `<h3>${esc(Cat.epochs[s.epoch].name)} <small>${done.length}/${cur.length}</small> ${this.pediaBtn('a:techs')}</h3>`;
    h += open.map(T => this.techCard(T)).join('') || '<div class="item-done">✓ Все знания эпохи изучены</div>';
    if (done.length) h += this.fold('done' + s.epoch, `Изучено в эту эпоху · ${done.length}`, done.map(T => this.techCard(T)).join(''));
    for (let e = s.epoch - 1; e >= 0; e--) {
      const list = Cat.techs.filter(t => t.epoch === e);
      if (list.length) h += this.fold('past' + e, `${esc(Cat.epochs[e].name)} · ${list.filter(t => Game.hasTech(t.id)).length}/${list.length}`, list.map(T => this.techCard(T)).join(''));
    }
    return h;
  },

  riteCard(R) {
    const s = Game.state, st = Game.ritualStatus(R), left = s.buffs[R.id];
    const btn = st.cd ? `<button class="btn small off" data-rite="${R.id}" title="Можно снова через ${fmtWait(st.cd)}">⏳ ${fmtWait(st.cd)}</button>`
      : R.buff && left ? `<button class="btn small extend ${st.ok ? '' : 'off'}" data-rite="${R.id}">＋${Math.round(R.dur / 60)} мин</button>`
      : `<button class="btn small gold ${st.ok ? '' : 'off'}" data-rite="${R.id}">${R.instant ? 'Собрать' : 'Начать'}</button>`;
    const mm = left ? `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}` : '';
    return `<div class="item rite ${left ? 'active' : ''} ${st.ok || left ? '' : 'disabled'}">
      <div class="item-ic">${this.riteIcon(R)}</div>
      <div class="item-body"><div class="item-title">${esc(R.name)}${left ? ` <span class="rite-live">идёт · ${mm}</span>` : ''}</div>
        <div class="item-desc">${esc(R.desc)}</div>
        ${st.locked ? `<div class="item-lock">🔒 ${esc(Msg.reason(st.reason))}</div>` : `<div class="chips">${this.costHtml(st.cost, st.logos)}${!st.logos ? '<span class="chip muted">без λ</span>' : ''}</div>
        ${st.cd ? '' : this.reasonHtml(st)}`}</div>
      ${st.locked ? '' : btn}
    </div>`;
  },

  panel_rites() {
    const s = Game.state;
    // «Сбор припасов» — не благословение, а мгновенная выдача: отдельно и сверху
    let h = `<div class="supply">${this.riteCard(Cat.rite.elders)}</div>`;
    h += `<h3>Обряды <small>благословения на время</small> ${this.pediaBtn('a:religion')}</h3>`;
    for (let e = s.epoch; e >= 0; e--) {
      // обряды, которые сменились новыми (стада → сбор винограда, звёзды → Утренняя звезда), прячем — если только они не идут прямо сейчас
      const list = Cat.rites.filter(r => r.epoch === e && !r.instant && (!Game.ritualStatus(r).hidden || s.buffs[r.id]));
      if (!list.length) continue;
      if (s.epoch > 0) h += `<div class="sub-h">${esc(Cat.epochs[e].name)}</div>`;
      h += list.map(R => this.riteCard(R)).join('');
    }
    return h;
  },

  panel_epoch() {
    const s = Game.state, E = Cat.epochs[s.epoch];
    let h = `<div class="epoch-card"><div class="epoch-title">${esc(E.name)}</div><div class="epoch-years">${esc(E.sub)}</div>
      <p>${E.intro}</p>${E.maxLevel ? `<div class="dim">Предел улучшения зданий в эту эпоху: ${E.maxLevel}-й уровень.</div>` : ''}</div>`;
    const reqs = Game.epochReqs();
    if (!reqs && !E.locked) h += `<div class="item-retire">⏳ Вторая половина эпохи и переход дальше — в следующей версии. Пока растите город до ${E.maxLevel}-го уровня и осваивайте новые знания.</div>`;
    if (reqs) {
      const next = Cat.epochs[s.epoch + 1];
      const done = reqs.filter(r => r.ok).length;
      h += `<h3>Переход: ${esc(next.name)} <small>${done}/${reqs.length}</small></h3><ul class="reqs">`;
      for (const r of reqs) { const t = Msg.req(r); h += `<li class="${r.ok ? 'ok' : ''}"><span>${r.ok ? '✓' : '○'} ${esc(t.label)}</span><small>${esc(t.have)}</small></li>`; }
      h += `</ul>`;
      const retiring = Game.retiringNext();
      if (retiring.length) h += `<div class="item-retire">⏳ При переходе чудеса этой эпохи станут обычными зданиями: ${retiring.map(([t, into, level, stashed]) =>
        `«${esc(Cat.bld[t].name)}» → ${esc(Msg.formName(into, s.epoch + 1).toLowerCase())} ${level}-го уровня${stashed ? ' (со склада — когда поставите)' : ''}`).join('; ')}. Бонусы чудес пропадут.</div>`;
      h += `<button class="btn wide gold" data-advance ${reqs.every(r => r.ok) ? '' : 'disabled'}>${next.locked ? 'Завершить эпоху' : 'Перейти в новую эпоху'}</button>
        <div class="hint dim">Ресурсы и λ за переход списываются. Цены выше вместимости складов требуют больших складов.</div>`;
    }
    h += `<h3>Хронология</h3><ol class="timeline">`;
    Cat.epochs.forEach((ep, i) => {
      h += `<li class="${i < s.epoch ? 'past' : i === s.epoch ? 'now' : ''} ${ep.locked ? 'future' : ''}"><b>${esc(ep.name)}${ep.locked ? ' · скоро' : ''}</b><small>${esc(ep.sub)}</small></li>`;
    });
    h += `<li class="future"><b>Эллинизм, Рим, Византия…</b><small>дальше по истории Кипра</small></li></ol>`;
    const st = s.stats;
    h += `<h3>Летопись</h3><div class="statline">Логоса заработано в этой игре: <b>${Math.floor(s.logosEarned)}</b> · поймано коз и вакханок: <b>${st.goats || 0}</b> · слов выучено: <b>${Decks.learnedCount(Learn.state)}</b>
      <button class="link" data-school="ov">📚 подробнее об учёбе</button></div>
      <h3>Игра</h3><button class="btn small ghost" data-school="reset">🏛️ Новая игра…</button>
      <div class="hint dim">Город начнётся заново, а колоды и выученные слова сохранятся.</div>`;
    if (this.dev) h += `<div class="dev"><b>dev:</b> <button class="btn small" data-dev="logos">+500 λ</button> <button class="btn small" data-dev="res">+1000 ресурсов</button> <button class="btn small" data-dev="goat">коза</button> <button class="btn small" data-dev="raid">набег</button></div>`;
    return h;
  },

  onPanelClick(e) {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.pedia) return Pedia.open(t.dataset.pedia);
    if (t.dataset.build) {
      const type = t.dataset.build, mode = t.dataset.mode || 'logos';
      const st = Game.buildStatus(type, mode);
      if (!st.ok) return this.toast(esc(Msg.reason(st.reason) || 'Нельзя построить'));
      if (st.upgrade) {   // улучшение чуда встаёт на место старого — клетку выбирать не нужно
        if (Game.upgradeWonder(type)) { this.toast(`✨ ${esc(Cat.bld[type].name)}!`); this.renderMap(); this.renderAll(); }
        return;
      }
      if (this.placing === type && this.placingMode === mode) this.cancelPlacing(); else this.startPlacing(type, mode);
      return this.renderPanel();
    }
    if (t.dataset.rite) {
      const st = Game.ritualStatus(Cat.rite[t.dataset.rite]);
      if (!st.ok) return this.toast(esc(Msg.reason(st.reason) || 'Сейчас нельзя'));
      const r = Game.perform(t.dataset.rite);
      if (r != null) { const R = Cat.rite[t.dataset.rite]; this.toast(`${R.icon} ${esc(R.name)}: <b>${esc(Msg.riteResult(r))}</b>`); this.renderMap(); this.renderAll(); }
      return;
    }
    if (t.dataset.tech) {
      const mode = t.dataset.mode || 'logos';
      const st = Game.techStatus(Cat.tech[t.dataset.tech], mode);
      if (!st.ok) return this.toast(esc(Msg.reason(st.reason) || 'Нельзя изучить'));
      if (Game.research(t.dataset.tech, mode)) { this.toast(`📜 Изучено: ${esc(Cat.tech[t.dataset.tech].name)}`); this.renderMap(); this.renderAll(); }
      return;
    }
    if (t.hasAttribute('data-advance')) {
      if (Game.advanceEpoch()) { this.renderMap(); this.renderAll(); this.showEpoch(); }
      return;
    }
    if (t.dataset.school) return School.open(t.dataset.school);
    if (t.dataset.dev === 'logos') Game.addLogos(500);
    if (t.dataset.dev === 'res') for (const k of RES_KEYS) Game.state.res[k] += 1000;
    if (t.dataset.dev === 'goat') Game.state.timers.goat = 0;
    if (t.dataset.dev === 'raid') Game.raid();
    if (t.dataset.dev) this.renderAll();
  },

  renderLog() {
    const el = $('#log');
    if (!el) return;
    el.innerHTML = Game.state.log.slice(0, 4).map(l => `<span>${esc(this.logText(l))}</span>`).join('');
  },
  /** Текст записи летописи. */
  logText(e) {
    return Msg.log(e, { newLook: (type, level, epoch) => Looks.newLook(type, level, epoch), name: (type, level, epoch) => Looks.name(type, level, epoch) });
  },

  // ---------------- окна ----------------
  showModal(html) {
    $('#modalBox').innerHTML = html;
    $('#modal').classList.remove('hidden');
  },
  closeModal() {
    $('#modal').classList.add('hidden'); this.modalBuilding = null;
    const next = this.afterModal; this.afterModal = null;
    if (next) next();
  },

  showBuilding(b) {
    this.modalBuilding = b;
    const B = Cat.bld[b.type];
    const icon = Looks.icons(b.type, b.level)[0];
    let h = `<div class="mb-head"><div class="mb-ic">${Art.svg(icon)}</div><div><h2>${esc(Looks.name(b.type, b.level))} ${this.pediaBtn('b:' + b.type)}</h2>
      <div class="dim">${B.special ? 'Чудо древнего Кипра' : `Уровень ${b.level} из ${Game.maxLevel()} возможных в эту эпоху`}</div></div></div>`;
    if (B.special) {
      const upT = Object.keys(BUILDINGS).find(t => BUILDINGS[t].upgradeOf === b.type), upSt = upT && Game.buildStatus(upT);
      h += `<p>${esc(B.desc)}</p>${B.retire ? `<p class="item-retire">⏳ ${esc(Msg.retireNote(B.retire))}</p>` : ''}`;
      if (upSt && !upSt.hidden) h += `<div class="upgrade lv-logos"><div class="up-head"><b>✨ Улучшить до «${esc(Cat.bld[upT].name)}»</b></div>
          <div class="small">${esc(Cat.bld[upT].desc)}</div>
          ${upSt.locked ? `<div class="item-lock">🔒 ${esc(Msg.reason(upSt.reason))}</div>` : `<div class="up-cost"><span class="dim">Цена</span> <span class="chips">${this.costHtml(upSt.cost, upSt.logos)}</span></div>
          ${upSt.reason ? `<div class="item-lock">${esc(Msg.reason(upSt.reason))}</div>` : ''}
          <button class="btn gold" data-action="wonder-up" data-type="${upT}" ${upSt.ok ? '' : 'disabled'}>Улучшить</button>`}</div>`;
      h += `<p class="lore">${B.lore}</p>
        <p class="dim small">Чудо можно убрать на склад и поставить в другое место бесплатно. Пока оно на складе, его бонус не действует.</p>`;
    } else {
      const rb = Game.rebuildInfo(b), sl = Game.sellInfo(b);
      if (rb) {
        h += `<div class="upgrade obsolete"><div class="up-head"><b>🔄 Устарело</b></div>
          <p class="small">После знания «${esc(this.retiringTechName(b.type))}» это здание больше не работает. Перестройте его — уровень сохранится — или продайте.
          <a href="#" data-pedia="a:changes">Как устроены перемены</a></p>
          <div class="up-cost"><span class="dim">Перестроить в «${esc(Msg.formName(rb.into, Game.state.epoch))}» ${b.level}-го уровня</span> <span class="chips">${this.costHtml(rb.cost, 0)}</span></div>
          ${rb.reason ? `<div class="item-lock">${esc(Msg.reason(rb.reason))}</div>` : ''}
          <div class="mb-actions"><button class="btn gold" data-action="rebuild" ${rb.ok ? '' : 'disabled'}>Перестроить</button>
          <button class="btn ghost" data-action="sell">Продать: <span class="chips">${this.costHtml(sl.res, sl.logos)}</span></button></div></div>`;
      }
      h += `<div class="sect">Сейчас</div><div class="chips">${this.outputHtml(b)}</div>`;
      if (b.idle) h += `<p class="warn">Простаивает: не хватает сырья.</p>`;
      if (b.rest === 'full') h += `<p class="rest">Отдыхает: всё, что здание даёт, уже не помещается в склады — сырьё не тратится.</p>`;
      if (b.rest === 'part') h += `<p class="rest">Часть того, что здание даёт, уже не помещается в склады — сырья уходит меньше.</p>`;
      const up = rb ? null : Game.upgradeInfo(b);
      if (up) {
        h += `<div class="upgrade ${up.logos ? 'lv-logos' : ''}">`;
        if (up.capped) h += `<div class="dim">${esc(Msg.reason(up.reason))}</div>`;
        else {
          h += `<div class="up-head"><b>Улучшение до ${up.target}-го уровня</b> <span class="up-x" title="Во сколько раз вырастет выпуск">×${num(Game.levelStep(up.target))}</span></div>
            <div class="chips">${this.upgradeDeltaHtml(b, up.target)}</div>
            <div class="up-cost"><span class="dim">Цена</span> <span class="chips">${this.costHtml(up.cost, up.logos)}</span></div>
            ${up.reason ? `<div class="item-lock">${esc(Msg.reason(up.reason))}</div>` : ''}
            <button class="btn ${up.logos ? 'gold' : ''}" data-action="upgrade" ${up.ok ? '' : 'disabled'}>Улучшить <kbd>U</kbd></button>`;
        }
        h += `</div>`;
      }
    }
    h += `<div class="mb-actions">${B.special ? '<button class="btn ghost small" data-action="stash">📦 Убрать на склад</button>' : '<button class="btn ghost danger small" data-action="demolish">Снести</button>'}
      <button class="btn ghost small" data-action="close">Закрыть</button></div>`;
    this.showModal(h);
  },

  showMobileWarning(next) {
    // нажатие «Всё равно играть» — подходящий момент попросить полный экран и альбомную ориентацию
    this.afterModal = () => { BrowserIO.preferLandscape(); next(); };
    this.showModal(`<div class="epoch-modal"><h2>📱 Похоже, вы с телефона</h2>
      <p>Простите: пока «Λόγος» сделан под компьютер — большой экран, мышь и клавиатура. На телефоне карта и панели
      будут тесными, а набирать слова неудобно.</p>
      <p>Играть можно, но на свой страх и риск — мы пока не советуем. Удобная мобильная версия — в планах.</p>
      <p><b>Держите телефон горизонтально</b> — в альбомной ориентации помещается вся игра.</p>
      <div class="em-actions"><button class="btn gold" data-action="close">Всё равно играть</button></div></div>`);
  },

  showAway(a) {
    const mins = Math.round(a.seconds / 60);
    const dur = mins >= 60 ? `${Math.floor(mins / 60)} ч ${mins % 60} мин` : `${Math.max(1, mins)} мин`;
    const list = Object.entries(a.gained).map(([k, v]) => `<span class="chip good"><i>${Art.res(k)}</i>+${fmt(v)}</span>`).join(' ');
    this.showModal(`<div class="epoch-modal"><h2>С возвращением!</h2>
      <p>Вас не было ${dur}. Поселение продолжало работать${a.halved ? ': первые 5 минут — в полную силу, потом — вполовину' : ''}.</p>
      ${list ? `<div class="chips away">${list}</div>` : '<p class="dim">Ничего не прибавилось: склады полны или производить пока нечему.</p>'}
      ${a.pop > 0 ? `<p>👥 Пришло жителей: ${a.pop}</p>` : ''}
      ${a.ended && a.ended.length ? `<p class="dim">✨ Закончились благословения: ${a.ended.map(id => esc(Cat.rite[id] ? Cat.rite[id].name : id)).join(', ')}.</p>` : ''}
      ${a.raid ? (a.raid.shielded ? '<p class="how">🧱 Пока вас не было, налетели «народы моря», но Циклопические стены их отбили.</p>'
        : `<p class="how">${a.raid.tribute ? `Под конец: ${Msg.tributeLine(a.raid, false)}${a.raid.lost.length ? ':' : '.'}`
          : `⚔️ Под конец налетели «народы моря» и унесли ${Math.round(a.raid.pct * 100)}% запасов:`}</p>
          <div class="chips away">${a.raid.lost.map(([k, v]) => `<span class="chip bad"><i>${Art.res(k)}</i>−${fmt(v)}</span>`).join(' ')}</div>`) : ''}
      <div class="em-actions"><button class="btn gold" data-action="close">Продолжить</button></div></div>`);
  },

  showEpoch(first = false) {
    const s = Game.state, E = Cat.epochs[s.epoch];
    let h = `<div class="epoch-modal"><div class="meander"></div>
      <div class="dim">${first ? 'Начало пути' : 'Новая эпоха'}</div>
      <h2>${esc(E.name)}</h2><div class="epoch-years">${esc(E.sub)}</div><p>${E.intro}</p>`;
    if (first) h += `<p class="how"><b>Как играть.</b> Кликайте по лесу, холмам и полям, чтобы собирать ресурсы, стройте и улучшайте
      жилища, поля и козьи загоны — город растёт сам. Но всё важное — знания, чудеса, высокие уровни зданий и переход
      в новую эпоху — требует <b>λ Логоса</b>. Его не добыть ни киркой, ни торговлей: только решая карточки в «📜 Учиться».
      Логос можно тратить с первых минут: во вкладке «Обряды» <b>Сбор припасов</b> за ${RITUAL_BY_ID.elders.logos} λ сразу даёт ресурсы,
      а благословения удваивают производство. Можно и не спешить — поиграть без карточек, пока не упрётесь в λ.
      Подробности — в <b>📖 Кипропедии</b>.</p>`;
    const retired = first ? [] : (s.log || []).filter(e => e.k === 'retired' && e.p.epoch === s.epoch);
    if (retired.length) h += `<p class="how">🏛️ ${retired.map(e => esc(Msg.retiredLine(e.p.from, e.p.into, e.p.level, e.p.epoch))).join('; ')}. Бонусы этих чудес больше не действуют.</p>`;
    if (!first && !E.locked && s.epoch === 1) h += `<p class="how">Здания с 5-го уровня сменили облик на бронзовый, предел улучшения поднят до ${E.maxLevel}-го уровня, открыты новые знания и спецстроения.
      Берегитесь набегов «народов моря» — от них спасут только Циклопические стены.</p>`;
    if (!first && !E.locked && s.epoch >= 2) h += `<p class="how">Предел улучшения поднят до ${E.maxLevel}-го уровня; 10-й уровень просит железо, а на 9-м и 11-м у зданий железный облик.
      Земли больше не прибавится — город растёт вверх, а старое уходит по ходу эпохи: знания меняют ресурсы и здания (${'<a href="#" data-pedia="a:changes">как это устроено</a>'}).
      «Народы моря» осели на берегах — теперь срок приходит для <b>дани Ассирии</b>, и Циклопические стены уменьшают её только вдвое.</p>`;
    if (E.locked) h += `<p class="how"><b>Это конец прототипа.</b> Вы провели Кипр от медно-каменного века до заката бронзового. Спасибо!</p>`;
    h += `<div class="em-actions">${first ? `<button class="btn ghost" data-pedia="a:basics">📖 Кипропедия</button>` : ''}
      <button class="btn gold" data-action="${first ? 'plan' : 'close'}">${first ? 'Дальше →' : 'Дальше'}</button></div></div>`;
    this.showModal(h);
  },

  /** «Что будем учить?» — в начале каждой новой игры и из «Обучения». thenStudy — после выбора сразу начать раунд. */
  showLearnPlan(thenStudy = false) {
    const s = Learn.state, cur = Decks.planOf(s);
    const started = Object.keys(s.progress).length > 0;
    this.planThenStudy = thenStudy;
    let h = `<div class="plan-modal"><div class="dim">Учёба</div><h2>Что будем учить?</h2>
      <p>Логос дают за карточки. Выберите, какие слова пойдут в раунды, — поменять можно в любой момент в «📚 Обучении».
      ${started ? 'Прогресс по всем словам сохранится, что бы вы ни выбрали.' : ''}</p>
      <div class="plans">`;
    for (const id of Decks.plans(s)) {
      const P = Cat.plans[id], st = Decks.planStats(s, id);
      const mark = started && id === cur;
      h += `<button class="plan ${mark ? 'cur' : ''}" data-action="plan-pick" data-plan="${id}">
        <span class="plan-ico">${P.icon}</span>
        <span class="plan-txt"><span class="plan-title"><b>${esc(P.name)}</b>${mark ? '<span class="badge">сейчас</span>' : ''}</span>
          <span class="plan-desc">${esc(P.desc)}</span>
          <span class="plan-meta">${st.words} ${plural(st.words, 'слово', 'слова', 'слов')}${st.learned ? ` · выучено ${st.learned}` : ''}</span></span>
      </button>`;
    }
    h += `</div><div class="em-actions">
      <button class="btn ghost small" data-action="plan-manual">Выбрать колоды вручную</button>
      ${started ? `<button class="btn small" data-action="plan-keep">Оставить как сейчас${cur ? '' : ' (свой набор)'}</button>` : ''}
      </div></div>`;
    this.showModal(h);
  },
  pickPlan(id) {
    const s = Learn.state;
    delete Game.state.planPending;
    if (id !== 'keep') {
      Decks.applyPlan(s, id); Learn.save();
      const st = Decks.planStats(s, id);
      this.toast(`🎯 Учим: ${esc(Cat.plans[id].name)} — ${st.words} ${plural(st.words, 'слово', 'слова', 'слов')}`);
    }
    const study = this.planThenStudy; this.planThenStudy = false;
    this.closeModal(); this.renderTop();
    if (School.isOpen()) School.render(true);
    if (study) Study.start();
  },

  /** Подтверждение внутри игры (без window.confirm — он может быть заблокирован). */
  confirmModal(text, yesLabel, onYes) {
    this.pendingConfirm = onYes;
    this.modalBuilding = null;
    this.showModal(`<h2>Вы уверены?</h2><p>${text}</p>
      <div class="mb-actions"><button class="btn ghost small" data-action="close">Отмена</button>
      <button class="btn danger-fill" data-action="confirm-yes">${esc(yesLabel)}</button></div>`);
  },

  onModalAction(a) {
    const act = a.dataset.action;
    if (act === 'confirm-yes') { const f = this.pendingConfirm; this.pendingConfirm = null; this.closeModal(); if (f) f(); return; }
    if (act === 'close') return this.closeModal();
    if (act === 'plan') return this.showLearnPlan();
    if (act === 'plan-pick') return this.pickPlan(a.dataset.plan);
    if (act === 'plan-keep') return this.pickPlan('keep');
    if (act === 'plan-manual') { delete Game.state.planPending; this.planThenStudy = false; this.closeModal(); return School.open('decks'); }
    const b = this.modalBuilding;
    if (act === 'upgrade' && b) { if (Game.upgrade(b)) { this.renderMap(); this.renderAll(); this.showBuilding(b); } }
    if (act === 'wonder-up') { if (Game.upgradeWonder(a.dataset.type)) { this.closeModal(); this.renderMap(); this.renderAll(); this.toast(`✨ ${esc(Cat.bld[a.dataset.type].name)}!`); } return; }
    if (act === 'rebuild' && b) { if (Game.rebuild(b)) { this.renderMap(); this.renderAll(); this.showBuilding(b); } return; }
    if (act === 'sell' && b) { if (Game.sell(b)) { this.closeModal(); this.renderMap(); this.renderAll(); } return; }
    if (act === 'demolish' && b) { if (Game.demolish(b)) { this.closeModal(); this.renderMap(); this.renderAll(); } }
    if (act === 'stash' && b) {
      if (Game.stashWonder(b)) { this.closeModal(); this.renderMap(); this.renderAll(); this.toast(`📦 ${esc(Cat.bld[b.type].name)} — на складе. Поставить снова: вкладка «Строить» → «Чудеса».`); }
    }
  },
};

// U в окне здания — улучшить
document.addEventListener('keydown', e => {
  if ((e.key === 'u' || e.key === 'U' || e.key === 'г' || e.key === 'Г') && UI.modalBuilding && !$('#modal').classList.contains('hidden')) {
    e.stopImmediatePropagation();
    const b = UI.modalBuilding;
    if (Game.upgrade(b)) { UI.renderMap(); UI.renderAll(); UI.showBuilding(b); }
  }
}, true);
