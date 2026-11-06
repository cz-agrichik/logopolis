'use strict';
// ============================================================
//  Интерфейс города: верхняя панель, карта, вкладки, окна
// ============================================================

const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => n >= 10000 ? (n / 1000).toFixed(1) + 'k' : Math.floor(n).toString();
const fmtRate = n => (n >= 0 ? '+' : '−') + Math.abs(n).toFixed(1);
const num = (n, d = 2) => (+n.toFixed(d)).toString();

const UI = {
  tab: 'build',
  placing: null,
  dev: /[?&]dev\b/.test(location.search),

  init() {
    document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => {
      this.tab = b.dataset.tab;
      document.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('active', x === b));
      this.lastPanel = null;
      this.renderPanel();
    }));
    $('#map').addEventListener('click', e => this.onMapClick(e));
    $('#map').addEventListener('contextmenu', e => { if (this.placing) { e.preventDefault(); this.cancelPlacing(); } });
    $('#studyBtn').addEventListener('click', () => Study.start());
    $('#pediaBtn').addEventListener('click', () => Pedia.open());
    $('#panel').addEventListener('click', e => this.onPanelClick(e));
    $('#panel').addEventListener('change', e => this.onPanelChange(e));
    $('#modal').addEventListener('click', e => {
      if (e.target.id === 'modal') return this.closeModal();
      const a = e.target.closest('[data-action], [data-pedia]');
      if (a && a.dataset.pedia) { this.closeModal(); return Pedia.open(a.dataset.pedia); }
      if (a) this.onModalAction(a);
    });
    document.addEventListener('keydown', e => {
      if (!$('#study').classList.contains('hidden')) return;
      if (e.key === 'Escape') {
        if (!$('#pedia').classList.contains('hidden')) Pedia.close();
        else if (!$('#modal').classList.contains('hidden')) this.closeModal();
        else this.cancelPlacing();
      }
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'F1' || e.key === '?') { e.preventDefault(); Pedia.open(); }
    });
    this.renderMap();
    this.renderAll();
  },

  renderAll() {
    this.renderTop();
    this.renderPanel();
    this.renderLog();
  },

  // ---------------- верхняя панель ----------------
  resVisible(k) {
    const s = Game.state, R = RES[k];
    if (s.res[k] >= 1) return true;
    if (R.epoch > s.epoch) return false;
    return !R.tech || Game.hasTech(R.tech);
  },

  renderTop() {
    const s = Game.state, E = EPOCHS[s.epoch];
    document.body.dataset.epoch = s.epoch;
    $('#epochName').textContent = E.name;
    $('#epochSub').textContent = E.sub;
    const short = Game.eff < 0.999;
    let html = `<div class="res pop" title="Жители: ${s.pop}. Мест в домах: ${Game.cap}. Чтобы прибавлялись жители, нужны свободные места и зерно.">
        <span class="ic">👥</span><b>${s.pop}</b><small class="lbl">из ${Game.cap} мест</small></div>
      <div class="res work ${short ? 'short' : ''}" title="${short
        ? `Зданиям нужно ${Game.need} работников, а жителей ${s.pop}. Все здания работают на ${Math.round(Game.eff * 100)}% — постройте или улучшите жилища.`
        : `Зданиям нужно ${Game.need} работников — жителей хватает.`}">
        <span class="ic">⚒</span><b>${Game.need}</b><small class="lbl">${short ? `нужно · ${Math.round(Game.eff * 100)}%` : 'работают'}</small></div>`;
    for (const k of RES_KEYS) {
      if (!this.resVisible(k)) continue;
      const r = Game.rates[k] || 0;
      const full = s.res[k] >= Game.storage - 0.5;
      html += `<div class="res ${full ? 'full' : ''}" title="${RES[k].name}: ${Math.floor(s.res[k])} из ${Game.storage}${full ? ' — склад полон!' : ''}">
        <span class="ic">${Art.res(k)}</span><b>${fmt(s.res[k])}</b>
        <small class="${r < 0 ? 'neg' : ''}">${Math.abs(r) > 0.05 ? fmtRate(r) : ''}</small></div>`;
    }
    html += `<div class="res store" title="Вместимость складов (для каждого ресурса)"><span class="ic">${Art.svg('store0')}</span><small>${fmt(Game.storage)}</small></div>`;
    for (const [id, left] of Object.entries(s.buffs || {})) {
      const R = RITUAL_BY_ID[id]; if (!R) continue;
      const m = Math.floor(left / 60), sec = Math.floor(left % 60);
      html += `<div class="res buff" title="${esc(R.name)}: ${esc(R.desc)}"><span class="ic">${R.icon}</span><small>${m}:${String(sec).padStart(2, '0')}</small></div>`;
    }
    html += `<div class="res logos" title="Логос — добывается только знаниями (карточками)"><span class="ic">λ</span><b>${fmt(s.logos)}</b></div>`;
    $('#resources').innerHTML = html;
    const p = Decks.pending(s);
    const n = p.due + Math.min(p.fresh, Decks.settings(s).newPerRound);
    $('#dueCount').textContent = n ? n : '';
    $('#dueCount').classList.toggle('hidden', !n);
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
      let inner = '', title = TERRAIN[t.t].name;
      if (b) {
        const B = BUILDINGS[b.type], F = Game.form(b.type), ic = Game.icons(b.type, b.level);
        cls.push('has-b');
        if (B.special) cls.push('special');
        if (b.idle) cls.push('idle');
        if (B.special) inner = `<span class="b">${Art.svg(b.type)}</span>`;
        else {
          cls.push('stage-' + Game.stage(b.level), 'n' + ic.length);
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
    const tile = Game.tile(+el.dataset.x, +el.dataset.y);
    if (Game.goat && Game.goat.x === tile.x && Game.goat.y === tile.y) {
      const g = Game.catchGoat();
      this.floatText(el, '🐐!', 'gold');
      this.toast(`🐐 ${esc(g.line)} <b>${g.gained}</b>`);
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
        this.toast(!st.ok ? esc(st.reason) : this.placeHintText(this.placing, tile));
      }
      return;
    }
    const b = Game.buildingAt(tile.x, tile.y);
    if (b) {
      if (e.shiftKey && !BUILDINGS[b.type].special) {
        const up = Game.upgradeInfo(b);
        if (Game.upgrade(b)) { this.floatText(el, up.newLook ? `✨ ур. ${b.level}` : `ур. ${b.level}`, 'gold'); this.renderMap(); this.renderAll(); }
        else this.toast(up && up.reason ? esc(up.reason) : 'Нельзя улучшить');
        return;
      }
      return this.showBuilding(b);
    }
    const g = Game.gather(tile);
    if (g) {
      this.floatText(el, `+${g.amt} ${RES[g.res].icon}`);
      el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse');
      this.renderTop();
    }
  },

  placeHintText(type, tile) {
    const B = BUILDINGS[type];
    if (Game.buildingAt(tile.x, tile.y)) return 'Клетка уже занята';
    if (tile.t === 'sea') return 'Это море';
    const where = B.terrain.map(t => TERRAIN[t].name.toLowerCase()).join(' или ');
    if (!B.terrain.includes(tile.t)) return `Здесь ${TERRAIN[tile.t].name.toLowerCase()}, а нужна ${where}`;
    if (B.coast && !tile.coast) return 'Нужна клетка у самого моря';
    return 'Сюда нельзя';
  },

  startPlacing(type, mode = 'logos') {
    this.placing = type;
    this.placingMode = mode;
    const B = BUILDINGS[type];
    const where = B.terrain.map(t => TERRAIN[t].name.toLowerCase()).join(' или ') + (B.coast ? ' у моря' : '');
    $('#placeHint').innerHTML = `Куда поставить «${esc(Game.form(type).name)}»? Подходит: ${where}. <b>Esc</b> или правый клик — отмена, <b>Shift</b> — строить ещё.`;
    $('#placeHint').classList.remove('hidden');
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
      h += `<span class="chip cost ${lack ? 'lack' : ''}" title="${RES[k].name}: нужно ${v}, есть ${have}${lack ? ` — не хватает ${Math.ceil(v - have)}` : ''}"><i>${Art.res(k)}</i>${fmt(v)}</span>`;
    }
    if (logos) {
      const lack = s.logos < logos;
      h += `<span class="chip cost logos ${lack ? 'lack' : ''}" title="Логос: нужно ${logos}, есть ${Math.floor(s.logos)}${lack ? ` — не хватает ${Math.ceil(logos - s.logos)}. Логос дают карточки.` : ''}"><i>λ</i>${fmt(logos)}</span>`;
    }
    return h;
  },
  prodChips(p) {
    let h = '';
    for (const [k, v] of Object.entries(p)) h += `<span class="chip ${v < 0 ? 'bad' : 'good'}" title="${RES[k].name}: ${v < 0 ? 'расход' : 'производство'} ${num(Math.abs(v))} в секунду"><i>${Art.res(k)}</i>${v > 0 ? '+' : ''}${num(v)}/с</span>`;
    return h;
  },
  /** Что даёт здание на уровне L (с учётом бонусов). */
  outputHtml(b, level = b.level) {
    const B = BUILDINGS[b.type];
    const fx = Game.fx || Game.effects();
    let h = this.prodChips(Game.prodOf(b, fx, level));
    if (B.cap) h += `<span class="chip good" title="Места для жителей"><i>👥</i>${Game.houseCapOf(b, fx, level)} мест</span>`;
    if (B.storage) h += `<span class="chip good" title="Прибавка к вместимости складов"><i>${Art.svg('store0')}</i>+${Game.storageOf(b, level)}</span>`;
    if (B.logosBonus) h += `<span class="chip good" title="Бонус к Логосу за карточки"><i>λ</i>+${Math.round((B.logosBonus + (B.logosBonusPerLevel || 0) * (level - 1)) * 100)}% за карточки</span>`;
    if (B.workers) h += `<span class="chip muted" title="Сколько жителей нужно, чтобы здание работало в полную силу"><i>⚒</i>${Game.workersOf({ type: b.type, level })} работн.</span>`;
    return h;
  },
  techIcon(T) {
    if (!T.art) return T.icon;
    return T.art.startsWith('res:') ? Art.res(T.art.slice(4)) : Art.svg(T.art);
  },
  reasonHtml(st) { return st && st.reason && !st.ok ? `<div class="item-lock">${esc(st.reason)}</div>` : ''; },
  pediaBtn(id) { return `<button class="q" data-pedia="${id}" title="Кипропедия">?</button>`; },

  // ---------------- боковая панель ----------------
  renderPanel() {
    const p = $('#panel');
    if (this.tab === 'decks' && p.contains(document.activeElement) && /TEXTAREA|INPUT/.test(document.activeElement.tagName)) return;
    const html = this['panel_' + this.tab]();
    if (html === this.lastPanel) return;   // без лишних перерисовок — клики не теряются
    this.lastPanel = html;
    const scroll = p.scrollTop;
    p.innerHTML = html;
    p.scrollTop = scroll;
  },

  panel_build() {
    let normal = '', specials = '';
    for (const [type, B] of Object.entries(BUILDINGS)) {
      const st = Game.buildStatus(type);
      if (st.hidden) continue;
      const F = Game.form(type), icon = Game.icons(type, 1)[0];
      const n = Game.count(type);
      const head = `<div class="item-ic">${Art.svg(icon)}</div><div class="item-body">
          <div class="item-title">${esc(F.name)}${!B.special && n ? ` <small>×${n}</small>` : ''} ${this.pediaBtn('b:' + type)}</div>`;
      if (B.special) {
        let body;
        if (st.locked) body = `<div class="item-lock">🔒 ${esc(st.reason)}</div>`;
        else if (st.done) body = `<div class="item-done">✓ Построено</div>`;
        else {
          body = `<div class="item-effect">${esc(B.desc)}</div>
            <div class="chips">${this.costHtml(st.cost, st.logos)}${st.logos ? '' : '<span class="chip muted">без λ</span>'}</div>
            ${this.reasonHtml(st)}`;
        }
        specials += `<div class="item sp ${st.ok || st.done ? '' : 'disabled'} ${this.placing === type ? 'selected' : ''}">${head}${body}</div>
          ${st.locked || st.done ? '' : `<button class="btn small gold ${st.ok ? '' : 'off'}" data-build="${type}">Строить</button>`}</div>`;
      } else {
        normal += `<div class="item ${st.ok ? '' : 'disabled'} ${this.placing === type ? 'selected' : ''}">${head}
          <div class="item-desc">${esc(B.desc)}</div>
          ${st.locked ? `<div class="item-lock">🔒 ${esc(st.reason)}</div>` :
            `<div class="chips">${this.costHtml(st.cost)}</div><div class="chips">${this.outputHtml({ type, level: 1 })}</div>${this.reasonHtml(st)}`}
          </div>
          ${st.locked ? '' : `<button class="btn small ${st.ok ? '' : 'off'}" data-build="${type}">Строить</button>`}
        </div>`;
      }
    }
    return `<div class="hint">Клик по лесу, холмам или равнине — собрать ресурс. Клик по зданию — сведения и улучшение, <b>Shift+клик</b> — улучшить сразу.</div>
      ${normal}<h3>Чудеса древнего Кипра <small>по одному каждого</small></h3>${specials}`;
  },

  panel_tech() {
    const s = Game.state;
    let h = `<div class="hint">Знание можно получить двумя путями: <b>за λ</b> (быстро, немного ресурсов) или <b>трудом</b> — без λ, но ресурсов втрое больше. ${this.pediaBtn('a:techs')}</div>`;
    for (let e = 0; e <= s.epoch && e < EPOCHS.length; e++) {
      const list = TECHS.filter(t => t.epoch === e);
      if (!list.length) continue;
      const have = list.filter(t => Game.hasTech(t.id)).length;
      h += `<h3>${esc(EPOCHS[e].name)} <small>${have}/${list.length}</small></h3>`;
      for (const T of list) {
        const st = Game.techStatus(T);
        let body;
        if (st.learned) body = '<div class="item-done">✓ Изучено</div>';
        else if (st.locked) body = `<div class="item-lock">🔒 ${esc(st.reason)}</div>`;
        else {
          const lab = Game.techStatus(T, 'labor');
          body = `<div class="path"><span class="path-l">λ путь</span><div class="chips">${this.costHtml(st.cost, st.logos)}</div>
              <button class="btn small gold ${st.ok ? '' : 'off'}" data-tech="${T.id}" data-mode="logos">Изучить</button></div>
            <div class="path"><span class="path-l">Трудом</span><div class="chips">${this.costHtml(lab.cost)}</div>
              <button class="btn small ${lab.ok ? '' : 'off'}" data-tech="${T.id}" data-mode="labor">Трудом</button></div>`;
        }
        h += `<div class="item ${st.learned ? 'learned' : (st.ok || (!st.locked && Game.techStatus(T, 'labor').ok)) ? '' : 'disabled'}">
          <div class="item-ic">${this.techIcon(T)}</div>
          <div class="item-body"><div class="item-title">${esc(T.name)} ${this.pediaBtn('t:' + T.id)}</div><div class="item-desc">${esc(T.desc)}</div>${body}</div>
        </div>`;
      }
    }
    const next = EPOCHS[s.epoch + 1];
    if (next && !next.locked) h += `<div class="hint dim">Новые знания появятся в эпоху «${esc(next.name)}».</div>`;
    return h;
  },

  panel_rites() {
    const s = Game.state;
    let h = `<div class="hint">${s.epoch === 0
      ? 'Религия медного века — культ плодородия: фигурки с раскинутыми руками, подношения земле и стадам.'
      : 'Бронзовый век: святилища Рогатого и Слиткового богов, бычьи маски, жертвы меди.'}
      Обряды тратят <b>λ</b> (иногда подношения) и дают мгновенную помощь или благословение на время. ${this.pediaBtn('a:religion')}</div>`;
    const active = Object.entries(s.buffs || {});
    if (active.length) h += `<div class="buffs-list">${active.map(([id, left]) => `<span class="chip good">${RITUAL_BY_ID[id].icon} ${esc(RITUAL_BY_ID[id].name)} · ${Math.ceil(left / 60)} мин</span>`).join(' ')}</div>`;
    for (let e = s.epoch; e >= 0; e--) {
      const list = RITUALS.filter(r => r.epoch === e);
      if (!list.length) continue;
      h += `<h3>${esc(EPOCHS[e].name)}</h3>`;
      for (const R of list) {
        const st = Game.ritualStatus(R);
        const left = s.buffs[R.id];
        h += `<div class="item ${st.ok ? '' : 'disabled'}">
          <div class="item-ic">${R.icon}</div>
          <div class="item-body"><div class="item-title">${esc(R.name)}${left ? ` <small>· ещё ${Math.ceil(left / 60)} мин</small>` : ''}</div>
            <div class="item-desc">${esc(R.desc)}</div>
            ${st.locked ? `<div class="item-lock">🔒 ${esc(st.reason)}</div>` : `<div class="chips">${this.costHtml(st.cost, st.logos)}${!st.logos ? '<span class="chip muted">без λ</span>' : ''}</div>
            ${st.cd ? `<div class="item-lock">⏳ ${esc(st.reason)}</div>` : this.reasonHtml(st)}`}</div>
          ${st.locked ? '' : `<button class="btn small gold ${st.ok ? '' : 'off'}" data-rite="${R.id}">${st.cd ? `${Math.ceil(st.cd)} с` : R.buff && left ? 'Продлить' : 'Провести'}</button>`}
        </div>`;
      }
    }
    h += `<div class="hint dim">Благословения складываются по времени (до ${BALANCE.maxBuffMinutes} минут), но не по силе.</div>`;
    return h;
  },

  panel_epoch() {
    const s = Game.state, E = EPOCHS[s.epoch];
    let h = `<div class="epoch-card"><div class="epoch-title">${esc(E.name)}</div><div class="epoch-years">${esc(E.sub)}</div>
      <p>${E.intro}</p>${E.maxLevel ? `<div class="dim">Предел улучшения зданий в эту эпоху: ${E.maxLevel}-й уровень.</div>` : ''}</div>`;
    const reqs = Game.epochReqs();
    if (reqs) {
      const next = EPOCHS[s.epoch + 1];
      const done = reqs.filter(r => r.ok).length;
      h += `<h3>Переход: ${esc(next.name)} <small>${done}/${reqs.length}</small></h3><ul class="reqs">`;
      for (const r of reqs) h += `<li class="${r.ok ? 'ok' : ''}"><span>${r.ok ? '✓' : '○'} ${esc(r.label)}</span><small>${esc(r.have)}</small></li>`;
      h += `</ul><button class="btn wide gold" data-advance ${reqs.every(r => r.ok) ? '' : 'disabled'}>${next.locked ? 'Завершить эпоху' : 'Перейти в новую эпоху'}</button>
        <div class="hint dim">Ресурсы и λ за переход списываются. Цены выше вместимости складов требуют больших складов.</div>`;
    }
    h += `<h3>Хронология</h3><ol class="timeline">`;
    EPOCHS.forEach((ep, i) => {
      h += `<li class="${i < s.epoch ? 'past' : i === s.epoch ? 'now' : ''} ${ep.locked ? 'future' : ''}"><b>${esc(ep.name)}${ep.locked ? ' · скоро' : ''}</b><small>${esc(ep.sub)}</small></li>`;
    });
    h += `<li class="future"><b>Классика, эллинизм, Рим, Византия…</b><small>дальше по истории Кипра</small></li></ol>`;
    const st = s.stats;
    h += `<h3>Летопись</h3><div class="statline">Раундов: <b>${st.rounds}</b> · верно: <b>${st.right}</b> · ошибок: <b>${st.wrong}</b> · лучшая серия: <b>${st.bestStreak}</b> · всего λ: <b>${Math.floor(s.logosEarned)}</b> · поймано коз: <b>${st.goats || 0}</b></div>`;
    if (this.dev) h += `<div class="dev"><b>dev:</b> <button class="btn small" data-dev="logos">+500 λ</button> <button class="btn small" data-dev="res">+1000 ресурсов</button> <button class="btn small" data-dev="goat">коза</button> <button class="btn small" data-dev="raid">набег</button></div>`;
    return h;
  },

  panel_decks() {
    const s = Game.state;
    let h = `<div class="hint">Колоды участвуют в раундах, если включены. Полный Логос — за новые карточки и те, что пора повторить; досрочное повторение даёт меньше. ${this.pediaBtn('a:import')}</div>`;
    for (const d of s.decks) {
      const st = Decks.stats(s, d);
      h += `<div class="deck ${d.active ? '' : 'off'}">
        <label class="deck-head"><input type="checkbox" data-deck-toggle="${d.id}" ${d.active ? 'checked' : ''}> <b>${esc(d.name)}</b></label>
        <div class="deck-bar" title="выучены / учатся / новые">
          <i class="learned" style="flex:${st.learned}"></i><i class="learning" style="flex:${st.learning}"></i><i class="fresh" style="flex:${st.fresh}"></i>
        </div>
        <div class="deck-stats">${st.total} карт · новых ${st.fresh} · учатся ${st.learning} · выучено ${st.learned} · к повторению ${st.due}</div>
        <div class="deck-actions"><button class="link" data-deck-view="${d.id}">Посмотреть</button>
          <button class="link danger" data-deck-del="${d.id}">Удалить</button></div>
      </div>`;
    }
    const set = Decks.settings(s);
    const opt = (name, cur, vals) => `<select data-setting="${name}">${vals.map(([v, l]) => `<option value="${v}" ${String(cur) === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    h += `<h3>Скорость обучения ${this.pediaBtn('a:cards')}</h3>
      <div class="settings">
        <label><span>Верных ответов, чтобы слово считалось выученным</span>${opt('learnSteps', set.learnSteps, [[2, '2 — быстро'], [3, '3 — обычно'], [4, '4'], [5, '5 — основательно']])}</label>
        <label><span>Повторять выученное</span>${opt('appetite', set.appetite, Object.entries(APPETITES).map(([k, a]) => [k, `${a.name} — ${a.desc}`]))}</label>
        <label><span>Новых слов за раунд</span>${opt('newPerRound', set.newPerRound, [[3, '3'], [5, '5'], [8, '8'], [12, '12']])}</label>
        <label><span>Карточек в раунде</span>${opt('roundSize', set.roundSize, [[6, '6'], [8, '8'], [12, '12'], [16, '16']])}</label>
        <div class="dim small">Сейчас выученное повторяется через: ${(APPETITES[set.appetite] || APPETITES.normal).intervals.map(fmtDur).join(' → ')}, дальше — с последним интервалом.</div>
      </div>`;
    h += `<h3>Импорт колоды</h3>
      <div class="import">
        <input type="text" id="deckName" placeholder="Название колоды">
        <textarea id="deckText" rows="7" placeholder="По одной карточке в строке:\nσπίτι\tдом\tspíti\nνερό; вода\nψωμί — хлеб\n\nили JSON: [{&quot;front&quot;:&quot;σπίτι&quot;,&quot;back&quot;:&quot;дом&quot;}]"></textarea>
        <div class="import-row">
          <label class="btn small ghost">📂 Файл…<input type="file" id="deckFile" accept=".txt,.tsv,.csv,.json" hidden></label>
          <button class="btn small" data-import>Импортировать</button>
        </div>
        <div class="hint dim">TSV (экспорт Anki «Notes in Plain Text»), CSV, «слово ; перевод ; подсказка», «слово — перевод», JSON. Греческая сторона определяется сама.</div>
      </div>
      <h3>Игра</h3><button class="btn small ghost danger" data-reset>Начать заново (сбросить всё)</button>`;
    return h;
  },

  onPanelClick(e) {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.pedia) return Pedia.open(t.dataset.pedia);
    if (t.dataset.build) {
      const type = t.dataset.build, mode = t.dataset.mode || 'logos';
      const st = Game.buildStatus(type, mode);
      if (!st.ok) return this.toast(esc(st.reason || 'Нельзя построить'));
      if (this.placing === type && this.placingMode === mode) this.cancelPlacing(); else this.startPlacing(type, mode);
      return this.renderPanel();
    }
    if (t.dataset.rite) {
      const st = Game.ritualStatus(RITUAL_BY_ID[t.dataset.rite]);
      if (!st.ok) return this.toast(esc(st.reason || 'Сейчас нельзя'));
      const r = Game.perform(t.dataset.rite);
      if (r != null) { const R = RITUAL_BY_ID[t.dataset.rite]; this.toast(`${R.icon} ${esc(R.name)}: <b>${esc(r)}</b>`); this.renderMap(); this.renderAll(); }
      return;
    }
    if (t.dataset.tech) {
      const mode = t.dataset.mode || 'logos';
      const st = Game.techStatus(TECH_BY_ID[t.dataset.tech], mode);
      if (!st.ok) return this.toast(esc(st.reason || 'Нельзя изучить'));
      if (Game.research(t.dataset.tech, mode)) { this.toast(`📜 Изучено: ${esc(TECH_BY_ID[t.dataset.tech].name)}`); this.renderMap(); this.renderAll(); }
      return;
    }
    if (t.hasAttribute('data-advance')) {
      if (Game.advanceEpoch()) { this.renderMap(); this.renderAll(); this.showEpoch(); }
      return;
    }
    if (t.hasAttribute('data-import')) return this.doImport();
    if (t.dataset.deckDel) {
      const d = Game.state.decks.find(x => x.id === t.dataset.deckDel);
      if (d) this.confirmModal(`Удалить колоду «${esc(d.name)}» и её прогресс?`, 'Удалить', () => {
        for (const c of d.cards) delete Game.state.progress[c.id];
        Game.state.decks = Game.state.decks.filter(x => x !== d);
        Game.save(); this.lastPanel = null; this.renderAll();
      });
      return;
    }
    if (t.dataset.deckView) return this.showDeck(t.dataset.deckView);
    if (t.hasAttribute('data-reset')) {
      this.confirmModal('Начать игру заново? Город, знания, Логос и прогресс карточек будут удалены. Импортированные колоды тоже.', 'Начать заново', () => Game.reset());
      return;
    }
    if (t.dataset.dev === 'logos') Game.addLogos(500);
    if (t.dataset.dev === 'res') for (const k of RES_KEYS) Game.state.res[k] += 1000;
    if (t.dataset.dev === 'goat') Game.state.timers.goat = 0;
    if (t.dataset.dev === 'raid') Game.raid();
    if (t.dataset.dev) this.renderAll();
  },

  onPanelChange(e) {
    const t = e.target;
    if (t.dataset.setting) {
      const v = t.value;
      Game.state.settings[t.dataset.setting] = /^\d+$/.test(v) ? +v : v;
      Game.save(); this.lastPanel = null; this.renderAll();
      return;
    }
    if (t.dataset.deckToggle) {
      const d = Game.state.decks.find(x => x.id === t.dataset.deckToggle);
      if (d) { d.active = t.checked; Game.save(); this.renderAll(); }
    }
    if (t.id === 'deckFile' && t.files[0]) {
      const f = t.files[0];
      const r = new FileReader();
      r.onload = () => {
        $('#deckText').value = r.result;
        if (!$('#deckName').value) $('#deckName').value = f.name.replace(/\.[^.]+$/, '');
      };
      r.readAsText(f, 'utf-8');
    }
  },

  doImport() {
    let parsed;
    try { parsed = Decks.parse($('#deckText').value); }
    catch (err) { return this.toast('Не удалось разобрать: ' + esc(err.message)); }
    if (!parsed.cards.length) return this.toast('Карточек не найдено');
    const name = $('#deckName').value.trim() || parsed.name || `Колода ${Game.state.decks.length + 1}`;
    const deck = Decks.makeDeck(name, parsed.cards);
    Game.state.decks.push(deck);
    Game.save();
    this.toast(`Импортировано: ${deck.cards.length} карт${parsed.skipped ? ` (пропущено строк: ${parsed.skipped})` : ''}`);
    Game.log(`Новая колода: «${name}» (${deck.cards.length})`);
    $('#deckText').value = ''; $('#deckName').value = '';
    this.lastPanel = null;
    this.renderAll();
  },

  renderLog() {
    const el = $('#log');
    if (!el) return;
    el.innerHTML = Game.state.log.slice(0, 4).map(l => `<span>${esc(l.msg)}</span>`).join('');
  },

  // ---------------- окна ----------------
  showModal(html) {
    $('#modalBox').innerHTML = html;
    $('#modal').classList.remove('hidden');
  },
  closeModal() { $('#modal').classList.add('hidden'); this.modalBuilding = null; },

  showBuilding(b) {
    this.modalBuilding = b;
    const B = BUILDINGS[b.type], F = Game.form(b.type);
    const icon = Game.icons(b.type, b.level)[0];
    let h = `<div class="mb-head"><div class="mb-ic">${Art.svg(icon)}</div><div><h2>${esc(F.name)} ${this.pediaBtn('b:' + b.type)}</h2>
      <div class="dim">${B.special ? 'Чудо древнего Кипра' : `Уровень ${b.level} из ${Game.maxLevel()} возможных в эту эпоху`}</div></div></div>`;
    if (B.special) {
      h += `<p>${esc(B.desc)}</p><p class="lore">${B.lore}</p>`;
    } else {
      h += `<div class="sect">Сейчас</div><div class="chips">${this.outputHtml(b)}</div>`;
      if (b.idle) h += `<p class="warn">Простаивает: не хватает сырья.</p>`;
      const up = Game.upgradeInfo(b);
      if (up) {
        h += `<div class="upgrade ${up.logos ? 'lv-logos' : ''}">`;
        if (up.capped) h += `<div class="dim">${esc(up.reason)}</div>`;
        else {
          const nextIc = Game.icons(b.type, up.target);
          h += `<div><b>Улучшение до ${up.target}-го уровня</b>${up.newLook ? ` <span class="newlook">новый облик ${nextIc.map(k => Art.svg(k, 'inl')).join('')}</span>` : ''}</div>
            <div class="dim small">${up.logos ? 'Уровень мудрости: оплачивается только Логосом и меняет облик здания.' : `Выпуск ×${BALANCE.upProdGrowth} за уровень, цена ресурсами ×${BALANCE.upCostGrowth}. Бонусы знаний и спецстроений умножают уже весь выпуск здания.`}</div>
            <div class="chips">${this.outputHtml(b, up.target)}</div>
            <div class="chips">${this.costHtml(up.cost, up.logos)}</div>
            ${up.reason ? `<div class="item-lock">${esc(up.reason)}</div>` : ''}
            <button class="btn ${up.logos ? 'gold' : ''}" data-action="upgrade" ${up.ok ? '' : 'disabled'}>Улучшить <kbd>U</kbd></button>`;
        }
        h += `</div><div class="dim small">Уровни 4, 6, 8 и 10 — только за λ и с новым обликом; остальные — за ресурсы.</div>`;
      }
    }
    h += `<div class="mb-actions">${B.special ? '<span></span>' : '<button class="btn ghost danger small" data-action="demolish">Снести</button>'}
      <button class="btn ghost small" data-action="close">Закрыть</button></div>`;
    this.showModal(h);
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
    const s = Game.state, E = EPOCHS[s.epoch];
    let h = `<div class="epoch-modal"><div class="meander"></div>
      <div class="dim">${first ? 'Начало пути' : 'Новая эпоха'}</div>
      <h2>${esc(E.name)}</h2><div class="epoch-years">${esc(E.sub)}</div><p>${E.intro}</p>`;
    if (first) h += `<p class="how"><b>Как играть.</b> Кликайте по лесу, холмам и полям, чтобы собирать ресурсы, стройте и улучшайте
      жилища, поля и козьи загоны — город растёт сам. Но всё важное — знания, чудесоения, высокие уровни зданий и переход
      в новую эпоху — требует <b>λ Логоса</b>. Его не добыть ни киркой, ни торговлей: только решая карточки в «📜 Учиться».
      Логос можно тратить с первых минут: во вкладке «Обряды» <b>Совет старейшин</b> за 5 λ сразу даёт ресурсы,
      а благословения удваивают производство. Можно и не спешить — поиграть без карточек, пока не упрётесь в λ.
      Подробности — в <b>📖 Кипропедии</b>.</p>`;
    else if (!E.locked) h += `<p class="how">Все здания сменили облик, предел улучшения поднят до ${E.maxLevel}-го уровня, открыты новые знания и спецстроения.
      ${s.epoch === 1 ? 'Берегитесь набегов «народов моря» — от них спасут только Циклопические стены.' : ''}</p>`;
    if (E.locked) h += `<p class="how"><b>Это конец прототипа.</b> Вы провели Кипр от медного века до заката бронзового. Спасибо!</p>`;
    h += `<div class="em-actions">${first ? `<button class="btn ghost" data-pedia="a:basics">📖 Кипропедия</button>` : ''}
      <button class="btn gold" data-action="close">${first ? 'Начать' : 'Дальше'}</button></div></div>`;
    this.showModal(h);
  },

  showDeck(id) {
    const d = Game.state.decks.find(x => x.id === id);
    if (!d) return;
    const rows = d.cards.map(c => {
      return `<tr><td class="greek">${esc(c.front)}</td><td>${esc(c.back)}</td><td class="dim">${esc(c.hint)}</td><td class="box">${Decks.progressText(Game.state, c.id)}</td></tr>`;
    }).join('');
    this.showModal(`<h2>${esc(d.name)}</h2><div class="deck-table"><table>${rows}</table></div>
      <div class="mb-actions"><span></span><button class="btn ghost small" data-action="close">Закрыть</button></div>`);
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
