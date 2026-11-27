'use strict';
// ============================================================
//  Вход в интерфейсе: шаг «Где хранить прогресс?» на старте нового игрока, кнопка 👤 в шапке (на телефоне — в полосе справа)
//  с окном «Вход и прогресс», повторное предложение войти в финале обучения. Сам вход — platform/account.js.
//  Пока ни один способ входа не настроен (platform/account-config.js), на старте и после обучения не спрашиваем —
//  чтобы игроки не видели нерабочих кнопок; посмотреть, как это будет, можно с ?auth в адресе.
// ============================================================

const AccountUI = {
  preview: /[?&]auth\b/.test(location.search),   // показать шаги входа, даже если вход ещё не настроен
  busy: false,
  NAMES: { google: 'Google', telegram: 'Telegram' },

  init() {
    $('#accountBtn').addEventListener('click', () => this.showPanel());
    this.renderBtn();
  },
  /** Спрашивать ли о входе на старте и после обучения: есть хоть один настроенный способ (или ?auth). */
  available() { return this.preview || Account.PROVIDERS.some(p => Account.configured(p)); },

  /** Кнопка 👤: вошёл — зелёная точка и имя в подсказке. */
  renderBtn() {
    const s = Account.state, on = Account.signedIn();
    const b = $('#accountBtn');
    b.classList.toggle('on', on);
    b.title = on ? `Вход: ${this.NAMES[s.provider]} — ${s.name || s.username || s.email}. Нажмите, чтобы посмотреть или выйти` : 'Вход и прогресс: сейчас вы играете без входа — всё хранится в этом браузере';
    const rail = $('#rail [data-open="account"] span');
    if (rail) rail.textContent = on ? 'Профиль' : 'Вход';
  },

  errorText(code, p) {
    const n = this.NAMES[p] || '';
    return {
      notConfigured: `Вход через ${n} пока не настроен — он скоро появится. Играйте без входа: всё сохранится в этом браузере.`,
      fileProtocol: 'Вход работает только на сайте grecheskiy.com, а не в игре, открытой с диска.',
      offline: `Не удалось связаться с ${n} — проверьте интернет и попробуйте ещё раз.`,
      cancelled: 'Вход отменён.',
      popupBlocked: 'Браузер не дал открыть окно входа — разрешите всплывающие окна для этого сайта и попробуйте ещё раз.',
      domain: `${n} пока не принимает вход с этого адреса — сайт ещё настраивается.`,
    }[code] || `Не получилось войти через ${n}. Попробуйте ещё раз чуть позже.`;
  },

  /** Кнопки входа. ctx — откуда (welcome | panel | finish): после входа туда и возвращаемся. */
  buttonsHtml(ctx) {
    return `<div class="acc-btns">${Account.PROVIDERS.map(p => {
      const ok = Account.configured(p);
      return `<button class="btn acc-${p} ${ok ? '' : 'acc-off'}" data-action="auth" data-provider="${p}" data-ctx="${ctx}">Войти через ${this.NAMES[p]}${ok ? '' : '<small>пока не настроен</small>'}</button>`;
    }).join('')}</div>`;
  },
  /** Что сейчас даёт вход — честно: синхронизации ещё нет. */
  whyHtml() {
    return `<p>Войдите через Google или Telegram — игра запомнит вас. Когда появится синхронизация (она в работе), город, выученные слова
      и настройки учёбы поедут за вами на телефон и другой компьютер.</p>
      <p class="dim">Можно и без входа: тогда всё хранится только в этом браузере — очистите данные сайта, и прогресс пропадёт.
      Войти можно в любой момент — ${UI.compact() ? 'кнопка 👤 «Вход» в полосе справа' : 'кнопка 👤 вверху справа'}.</p>`;
  },

  // ---------- шаг на старте нового игрока: после выбора обучения, перед «Что будем учить?» ----------
  /** Следующий экран старта нового игрока: вход (если ещё не решали и вход есть), потом «Что будем учить?», потом игра. */
  startNext() {
    if (!Account.decided() && this.available()) return this.showStep();
    if (Game.state.planPending) return UI.showLearnPlan();
    UI.closeModal();
  },
  showStep() {
    UI.showModal(`<div class="acc-modal"><div class="dim">Прогресс</div><h2>Где хранить ваш прогресс?</h2>
      ${this.whyHtml()}${this.buttonsHtml('welcome')}
      <div class="em-actions"><button class="btn ghost" data-action="auth-guest" data-ctx="welcome">Играть без входа →</button></div></div>`,
      { noX: true, sticky: true });
  },

  // ---------- окно «Вход и прогресс» (кнопка 👤) ----------
  showPanel() {
    const s = Account.state, on = Account.signedIn();
    const who = on ? `<div class="acc-who">${s.photo ? `<img src="${esc(s.photo)}" alt="" referrerpolicy="no-referrer">` : '<span class="acc-av">👤</span>'}
        <div><b>${esc(s.name || s.username || s.email || 'Без имени')}</b><small>${esc(this.NAMES[s.provider])}${s.email ? ' · ' + esc(s.email) : s.username ? ' · @' + esc(s.username) : ''}</small></div></div>` : '';
    UI.showModal(`<div class="acc-modal"><div class="dim">Прогресс</div><h2>${on ? 'Вы вошли' : 'Вход'}</h2>
      ${on ? `${who}<p>Пока вход только запоминает вас: прогресс хранится в этом браузере. Синхронизация между устройствами — в работе;
        когда она появится, город и слова поедут за вами.</p>
        <div class="em-actions"><button class="btn ghost small" data-action="auth-out">Выйти</button><button class="btn gold" data-action="close">Готово</button></div>`
      : `<p><b>Сейчас вы играете без входа.</b></p>${this.whyHtml()}${this.buttonsHtml('panel')}
        <div class="em-actions"><button class="btn ghost small" data-action="close">Пока без входа</button></div>`}
      <div class="acc-id dim">Номер этого браузера в игре: ${esc(s.id)}</div></div>`, { small: true });
  },

  // ---------- после обучения (для тех, кто играет без входа) ----------
  /** Блок «Сохраните прогресс» для окна финала обучения или пустая строка. */
  finishOfferHtml() {
    if (Account.signedIn() || !this.available()) return '';
    Account.markAsked('AfterTutorial');
    return `<div class="acc-offer"><b>Сохраните прогресс.</b> Сейчас город и слова хранятся только в этом браузере. Войдите — игра запомнит вас,
      а когда появится синхронизация, прогресс поедет за вами на другие устройства.${this.buttonsHtml('finish')}</div>`;
  },

  // ---------- действия ----------
  async signIn(p, ctx) {
    if (this.busy) return;
    if (!Account.configured(p)) return UI.toast(esc(this.errorText('notConfigured', p)));
    this.busy = true;
    const btn = $(`#modalBox [data-action="auth"][data-provider="${p}"]`);
    if (btn) { btn.disabled = true; btn.dataset.label = btn.innerHTML; btn.textContent = 'Входим…'; }
    const r = await Account.signIn(p);
    this.busy = false;
    this.renderBtn();
    if (!r.ok) {
      if (btn) { btn.disabled = false; btn.innerHTML = btn.dataset.label; }
      if (r.error !== 'cancelled') UI.toast(esc(this.errorText(r.error, p)));
      return;
    }
    const s = Account.state;
    UI.toast(`👤 Вы вошли через ${this.NAMES[p]}${s.name ? ': <b>' + esc(s.name) + '</b>' : ''}`);
    this.after(ctx);
  },
  guest(ctx) { Account.chooseGuest(); this.after(ctx); },
  async signOut() { await Account.signOut(); this.renderBtn(); UI.toast('👤 Вы вышли. Город и слова остались в этом браузере.'); this.showPanel(); },
  /** Куда дальше после входа или «без входа». */
  after(ctx) {
    if (ctx === 'welcome') return this.startNext();
    if (ctx === 'panel') return this.showPanel();
    UI.closeModal();   // финал обучения
  },
};
