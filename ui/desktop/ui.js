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
    $('#studyBtn').addEventListener('click', () => Study.start());
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
    Bus.on('raid', r => this.toast(r.shielded ? '🧱 Стены отразили набег «народов моря»!'
      : `⚔️ Набег «народов моря»! Разграблено 15% запасов. Защитят только Циклопические стены.`));
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
    const bhtml = pills + slots + (buffs.length ? '' : `<span class="bf-empty">благословения — во вкладке «Обряды»</span>`);
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
        if (B.special) inner = `<span class="b">${Art.svg(b.type)}</span>`;
        else {
          cls.push('stage-' + Looks.stage(b.level), 'n' + ic.length, 'bt-' + b.type);
          inner = `<span class="bw">${ic[2] ? `<span class="b b3">${Art.svg(ic[2])}</span>` : ''}${ic[1] ? `<span class="b b2">${Art.svg(ic[1])}</span>` : ''}<span class="b b1">${Art.svg(ic[0])}</span></span><span class="lvl">${b.level}</span>`;
        }
        title = B.special ? F.name : `${F.name} · ур. ${b.level} (Shift+клик — улучшить)`;
      } else if (t.t === 'forest') inner = `<span class="deco">${Art.svg('tree')}</span>`;
      else if (t.t === 'hill') inner = `<span class="deco">${Art.svg('hill')}</span>`;
      if (Game.goat && Game.goat.x === t.x && Game.goat.y === t.y) {
        cls.push('goat');
        inner = `<span class="goat-ic">${Art.svg('goat')}</span>`;
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
      const g = Game.catchGoat();
      this.floatText(el, '🐐!', 'gold');
      this.toast(`🐐 ${esc(Msg.goatLine(g.roll))} <b>${Msg.resList(g.gains) || 'склады полны'}</b>`);
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
    $('#placeHint').innerHTML = `<span>Куда поставить «${esc(Cat.form(type).name)}»? Подходит: ${where}.<span class="desk-only"> <b>Esc</b> или правый клик — отмена, <b>Shift</b> — строить ещё.</span></span>
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
  /** Что даёт здание на уровне L (с учётом бонусов). */
  outputHtml(b, level = b.level) {
    const B = Cat.bld[b.type];
    const fx = Game.fx || Game.effects();
    let h = this.prodChips(Game.prodOf(b, fx, level));
    if (B.cap) h += `<span class="chip good" title="Места для жителей"><i>👥</i>${Game.houseCapOf(b, fx, level)} мест</span>`;
    if (B.storage) h += `<span class="chip good" title="Прибавка к вместимости складов"><i>${Art.svg('store0')}</i>+${Game.storageOf(b, level)}</span>`;
    if (B.logosBonus) h += `<span class="chip good" title="Бонус к Логосу за карточки"><i>λ</i>+${Math.round((B.logosBonus + (B.logosBonusPerLevel || 0) * (level - 1)) * 100)}% за карточки</span>`;
    if (B.workers) { const w = Game.workersOf({ type: b.type, level }); h += `<span class="chip muted" title="Сколько жителей нужно, чтобы здание работало в полную силу"><i>⚒</i>${w} ${plural(w, 'работник', 'работника', 'работников')}</span>`; }
    return h;
  },
  riteIcon(R) { return Looks.riteIcon(R); },
  techIcon(T) { return Looks.techIcon(T); },
  reasonHtml(st) { return st && st.reason && !st.ok ? `<div class="item-lock">${esc(Msg.reason(st.reason))}</div>` : ''; },
  pediaBtn(id) { return `<button class="q" data-pedia="${id}" title="Кипропедия">?</button>`; },

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
      const F = Cat.form(type), icon = Looks.icons(type, 1)[0];
      const n = Game.count(type);
      const head = `<div class="item-ic">${Art.svg(icon)}</div><div class="item-body">
          <div class="item-title">${esc(F.name)}${!B.special && n ? ` <small>×${n}</small>` : ''} ${this.pediaBtn('b:' + type)}</div>`;
      if (B.special) {
        let body;
        if (st.locked) body = `<div class="item-lock">🔒 ${esc(Msg.reason(st.reason))}</div>`;
        else if (st.done) body = `<div class="item-done">✓ Построено</div>`;
        else if (st.stashed && st.into) body = `<div class="item-stash">📦 На складе. Эпоха чуда прошла — поставить можно бесплатно, но уже как «${esc(Cat.form(st.into).name)}» ${st.level}-го уровня.</div>`;
        else if (st.stashed) body = `<div class="item-stash">📦 На складе — бонус не действует, пока чудо не стоит в городе. Поставить можно бесплатно.</div>`;
        else {
          // эффект чуда иконками не передать — здесь текст нужен
          body = `<div class="item-effect">${esc(B.desc)}</div>
            <div class="chips">${this.costHtml(st.cost, st.logos)}${st.logos ? '' : '<span class="chip muted">без λ</span>'}</div>
            ${this.reasonHtml(st)}`;
        }
        if (B.retire && !st.locked && !st.into) body += `<div class="item-retire">⏳ ${esc(Msg.retireNote(B.retire))}</div>`;
        specials += `<div class="item sp ${st.ok || st.done ? '' : 'disabled'} ${this.placing === type ? 'selected' : ''}">${head}${body}</div>
          ${st.locked || st.done ? '' : `<button class="btn small gold ${st.ok ? '' : 'off'}" data-build="${type}">${st.stashed ? 'Поставить' : 'Строить'}</button>`}</div>`;
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
    const btn = st.cd ? `<button class="btn small off" data-rite="${R.id}">⏳ ${Math.ceil(st.cd)} с</button>`
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
      const list = Cat.rites.filter(r => r.epoch === e && !r.instant);
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
    h += `<li class="future"><b>Классика, эллинизм, Рим, Византия…</b><small>дальше по истории Кипра</small></li></ol>`;
    const st = s.stats;
    h += `<h3>Летопись</h3><div class="statline">Логоса заработано в этой игре: <b>${Math.floor(s.logosEarned)}</b> · поймано коз: <b>${st.goats || 0}</b> · слов выучено: <b>${Decks.learnedCount(Learn.state)}</b>
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
    return Msg.log(e, { newLook: (type, level, epoch) => Looks.newLook(type, level, epoch) });
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
    const B = Cat.bld[b.type], F = Cat.form(b.type);
    const icon = Looks.icons(b.type, b.level)[0];
    let h = `<div class="mb-head"><div class="mb-ic">${Art.svg(icon)}</div><div><h2>${esc(F.name)} ${this.pediaBtn('b:' + b.type)}</h2>
      <div class="dim">${B.special ? 'Чудо древнего Кипра' : `Уровень ${b.level} из ${Game.maxLevel()} возможных в эту эпоху`}</div></div></div>`;
    if (B.special) {
      h += `<p>${esc(B.desc)}</p>${B.retire ? `<p class="item-retire">⏳ ${esc(Msg.retireNote(B.retire))}</p>` : ''}<p class="lore">${B.lore}</p>
        <p class="dim small">Чудо можно убрать на склад и поставить в другое место бесплатно. Пока оно на складе, его бонус не действует.</p>`;
    } else {
      h += `<div class="sect">Сейчас</div><div class="chips">${this.outputHtml(b)}</div>`;
      if (b.idle) h += `<p class="warn">Простаивает: не хватает сырья.</p>`;
      if (b.rest === 'full') h += `<p class="rest">Отдыхает: всё, что здание даёт, уже не помещается в склады — сырьё не тратится.</p>`;
      if (b.rest === 'part') h += `<p class="rest">Часть того, что здание даёт, уже не помещается в склады — сырья уходит меньше.</p>`;
      const up = Game.upgradeInfo(b);
      if (up) {
        h += `<div class="upgrade ${up.logos ? 'lv-logos' : ''}">`;
        if (up.capped) h += `<div class="dim">${esc(Msg.reason(up.reason))}</div>`;
        else {
          const nextIc = Looks.icons(b.type, up.target);
          h += `<div><b>Улучшение до ${up.target}-го уровня</b>${Looks.newLook(b.type, up.target) ? ` <span class="newlook">наряднее ${nextIc.map(k => Art.svg(k, 'inl')).join('')}</span>` : ''}</div>
            <div class="dim small">${up.logos ? `Уровень мудрости: оплачивается только Логосом, выпуск ×${Game.levelStep(up.target)}.` : `Уровень труда: выпуск ×${Game.levelStep(up.target)}, цена ресурсами растёт ×${BALANCE.upCostGrowth} за уровень. Бонусы знаний и чудес умножают уже весь выпуск здания.`}</div>
            <div class="chips">${this.outputHtml(b, up.target)}</div>
            <div class="chips">${this.costHtml(up.cost, up.logos)}</div>
            ${up.reason ? `<div class="item-lock">${esc(Msg.reason(up.reason))}</div>` : ''}
            <button class="btn ${up.logos ? 'gold' : ''}" data-action="upgrade" ${up.ok ? '' : 'disabled'}>Улучшить <kbd>U</kbd></button>`;
        }
        h += `</div><div class="dim small">Уровни мудрости 3, 5, 7 и 9 — только за λ (3-й и 7-й — символически), остальные — за ресурсы. Облик меняется с эпохой и на каждом уровне мудрости.</div>`;
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
      <div class="em-actions"><button class="btn gold" data-action="close">Продолжить</button></div></div>`);
  },

  showEpoch(first = false) {
    const s = Game.state, E = Cat.epochs[s.epoch];
    let h = `<div class="epoch-modal"><div class="meander"></div>
      <div class="dim">${first ? 'Начало пути' : 'Новая эпоха'}</div>
      <h2>${esc(E.name)}</h2><div class="epoch-years">${esc(E.sub)}</div><p>${E.intro}</p>`;
    if (first) h += `<p class="how"><b>Как играть.</b> Кликайте по лесу, холмам и полям, чтобы собирать ресурсы, стройте и улучшайте
      жилища, поля и козьи загоны — город растёт сам. Но всё важное — знания, чудесоения, высокие уровни зданий и переход
      в новую эпоху — требует <b>λ Логоса</b>. Его не добыть ни киркой, ни торговлей: только решая карточки в «📜 Учиться».
      Логос можно тратить с первых минут: во вкладке «Обряды» <b>Сбор припасов</b> за 5 λ сразу даёт ресурсы,
      а благословения удваивают производство. Можно и не спешить — поиграть без карточек, пока не упрётесь в λ.
      Подробности — в <b>📖 Кипропедии</b>.</p>`;
    const retired = first ? [] : (s.log || []).filter(e => e.k === 'retired' && e.p.epoch === s.epoch);
    if (retired.length) h += `<p class="how">🏛️ ${retired.map(e => esc(Msg.retiredLine(e.p.from, e.p.into, e.p.level, e.p.epoch))).join('; ')}. Бонусы этих чудес больше не действуют.</p>`;
    if (!first && !E.locked) h += `<p class="how">Все здания сменили облик, предел улучшения поднят до ${E.maxLevel}-го уровня, открыты новые знания и спецстроения.
      ${s.epoch === 1 ? 'Берегитесь набегов «народов моря» — от них спасут только Циклопические стены.' : ''}</p>`;
    if (E.locked) h += `<p class="how"><b>Это конец прототипа.</b> Вы провели Кипр от медно-каменного века до заката бронзового. Спасибо!</p>`;
    h += `<div class="em-actions">${first ? `<button class="btn ghost" data-pedia="a:basics">📖 Кипропедия</button>` : ''}
      <button class="btn gold" data-action="close">${first ? 'Начать' : 'Дальше'}</button></div></div>`;
    this.showModal(h);
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
    const b = this.modalBuilding;
    if (act === 'upgrade' && b) { if (Game.upgrade(b)) { this.renderMap(); this.renderAll(); this.showBuilding(b); } }
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
