'use strict';
// ============================================================
//  Телефон и сенсорный экран — то, чего на компьютере нет или что там делает мышь:
//   • подсказка по долгому нажатию (вместо всплывающего title под курсором);
//   • полный экран: заслонка «Играть на весь экран» — как просьба повернуть телефон;
//   • режим улучшения ⏫ — замена Shift+клику: каждое касание здания — +1 уровень;
//   • выдвижная панель, оглавление Кипропедии — по кнопке, а не постоянной колонкой.
//  Раскладка — ui/desktop/phone.css. Правил игры здесь нет: только Game.* из ядра, как и в ui.js.
// ============================================================

const Phone = {
  /** Телефон в альбомной ориентации с сенсорным экраном — то, под что сделана телефонная раскладка. */
  active() { return UI.touch && UI.compact(); },

  init() {
    this.bindTips();
    this.bindFullscreen();
    // полоса справа: режим улучшения, справка, учёба
    $('#rail').addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.hasAttribute('data-up-mode')) return this.upMode(!UI.upMode);
      if (b.dataset.open) { UI.drawer(false); this.upMode(false); return b.dataset.open === 'pedia' ? Pedia.open() : School.open(); }
      if (b.dataset.tab) this.upMode(false);   // открыли вкладку — режим улучшения выключаем
    });
    $('#upHint').addEventListener('click', e => { if (e.target.closest('[data-up-done]')) this.upMode(false); });
    $('#side').addEventListener('click', e => { if (e.target.closest('[data-close-drawer]')) UI.drawer(false); });
    // Кипропедия: оглавление — по ☰; выбрали статью — оглавление убирается
    $('#pedia').addEventListener('click', e => {
      const box = $('#pedia .pedia-box');
      if (e.target.closest('[data-nav-toggle]')) return box.classList.toggle('nav-open');
      if (e.target.closest('.pedia-nav .pn-item')) box.classList.remove('nav-open');
    });
  },

  /** Раз в секунду из игрового цикла. */
  tick() { if (UI.upMode) this.markUps(); },

  // ---------------- подсказка по долгому нажатию ----------------
  bindTips() {
    const tip = document.createElement('div');
    tip.id = 'touchTip'; tip.className = 'ttip hidden'; tip.setAttribute('role', 'tooltip');
    document.body.appendChild(tip);
    let timer = null, x0 = 0, y0 = 0;
    const cancel = () => clearTimeout(timer);
    document.addEventListener('pointerdown', e => {
      this.hideTip(); this.tipAt = 0;
      if (e.pointerType !== 'touch') return;
      const el = e.target.closest('[title], [data-tip]');
      if (!el || e.target.closest('input, textarea, select')) return;
      x0 = e.clientX; y0 = e.clientY;
      cancel();
      timer = setTimeout(() => { this.tipAt = Date.now(); this.showTip(el); }, 450);
    }, true);
    document.addEventListener('pointermove', e => { if (Math.hypot(e.clientX - x0, e.clientY - y0) > 10) cancel(); }, true);
    document.addEventListener('pointerup', cancel, true);
    document.addEventListener('pointercancel', cancel, true);
    document.addEventListener('scroll', () => { cancel(); this.hideTip(); }, true);
    // палец отпустили после подсказки — это не нажатие: не строим, не собираем, не открываем
    document.addEventListener('click', e => {
      if (this.tipAt && Date.now() - this.tipAt < 2000) { this.tipAt = 0; e.preventDefault(); e.stopImmediatePropagation(); }
    }, true);
    // долгое нажатие на значок — наша подсказка, а не меню браузера
    document.addEventListener('contextmenu', e => { if (UI.touch && e.target.closest('[title], [data-tip], #map, #topbar, #rail')) e.preventDefault(); }, true);
  },
  showTip(el) {
    const text = (el.dataset.tip || el.getAttribute('title') || '').trim();
    if (!text) return;
    const tip = $('#touchTip');
    tip.textContent = text;
    tip.classList.remove('hidden');
    const r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight, pad = 6;
    let x = r.left + r.width / 2 - w / 2, y = r.top - h - 8;
    if (y < pad) y = r.bottom + 8;                                   // сверху не помещается — под значком
    if (y + h > innerHeight - pad) y = Math.max(pad, innerHeight - h - pad);
    x = Math.max(pad, Math.min(x, innerWidth - w - pad));
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
    clearTimeout(this.tipTimer);
    this.tipTimer = setTimeout(() => this.hideTip(), Math.min(9000, 2500 + text.length * 40));
    if (navigator.vibrate) try { navigator.vibrate(8); } catch (e) {}
  },
  hideTip() { const t = $('#touchTip'); if (t) t.classList.add('hidden'); },

  // ---------------- полный экран ----------------
  bindFullscreen() {
    this.fsSkip = BrowserIO.sessionGet('greekgame.fsSkip') === '1';
    const check = () => this.fsCheck();
    ['fullscreenchange', 'webkitfullscreenchange'].forEach(ev => document.addEventListener(ev, check));
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    $('#fsGate').addEventListener('click', e => {
      if (e.target.closest('[data-fs-skip]')) { this.fsSkip = true; BrowserIO.sessionSet('greekgame.fsSkip', '1'); return check(); }
      if (e.target.closest('[data-fs-go]')) BrowserIO.requestFullscreen().then(ok => {
        if (!ok) { this.fsSkip = true; UI.toast('Браузер не дал открыть игру на весь экран — играем в окне.'); }
        check();
      });
    });
    check();
  },
  /** Телефон без полного экрана — заслонка с одной кнопкой (браузер разрешает полный экран только по нажатию). */
  fsCheck() {
    const need = this.active() && BrowserIO.canFullscreen() && !BrowserIO.isFullscreen() && !this.fsSkip;
    document.body.classList.toggle('fs-need', need);
    UI.measureTop && UI.measureTop();
  },

  // ---------------- режим улучшения: замена Shift+клику ----------------
  upMode(on) {
    on = !!on;
    if (on === !!UI.upMode) return;
    UI.upMode = on;
    if (on) { UI.cancelPlacing(); UI.drawer(false); }
    document.body.classList.toggle('up-mode', on);
    $('#upHint').classList.toggle('hidden', !on);
    $('#rail [data-up-mode]').classList.toggle('active', on);
    UI.renderMap();
  },
  /** Метки «можно улучшить» обновляются раз в секунду: ресурсы прибывают — метки загораются. */
  markUps() {
    for (const b of Game.state.buildings) {
      const el = document.querySelector(`#map .tile[data-x="${b.x}"][data-y="${b.y}"]`);
      if (!el) continue;
      const k = UI.upClass(b).split(' ');
      for (const c of ['up-ok', 'up-no', 'up-max', 'up-l']) el.classList.toggle(c, k.includes(c));
    }
  },
};
