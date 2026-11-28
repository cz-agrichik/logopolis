'use strict';
// ============================================================
//  Вход в интерфейсе: шаг «Где хранить прогресс?» на старте нового игрока, повторное предложение в финале обучения
//  (для тех, кто выбрал «без входа»), всегда — кнопка 👤 в шапке (на телефоне — «Вход» в полосе справа) с окном «Вход и прогресс».
//  Сам вход — platform/account.js; способ, который ещё не настроен (platform/account-config.js), показан бледным «скоро».
// ============================================================

const AccountUI = {
  busy: false,
  NAMES: { google: 'Google', telegram: 'Telegram' },

  init() {
    $('#accountBtn').addEventListener('click', () => this.showPanel());
    // «Имя в игре»: Enter или «Сохранить» в окне «Вход и прогресс»
    $('#modal').addEventListener('submit', e => {
      const f = e.target.closest('[data-acc-name]');
      if (f) { e.preventDefault(); this.saveName(f); }
    });
    this.renderBtn();
    // вошли раньше: этот браузер главный — дописать незаписанное; под аккаунтом зашли в другом браузере — этот устарел
    Account.onStale = () => this.showStale();
    Account.onBusy = on => { if (on) this.showSyncing(); };   // сверка при входе: ждём (следующий экран сменит это окно)
    Account.onChange = () => this.renderBtn();
    this.startSync = Account.signedIn() ? Account.sync().then(r => { this.startSyncDone = true; this.synced(r, 'start'); }) : null;
    // обучение уходит в аккаунт раз в несколько секунд; вкладку прячут или закрывают, появилась сеть — дописать сразу
    document.addEventListener('visibilitychange', () => { if (document.hidden) { Account.libraryCheck(); Account.flush(); } });
    // читалка пишет свои тексты и карточки сама (и на своей странице, и в соседней вкладке) — смотрим раз в 5 секунд
    setInterval(() => Account.libraryCheck(), 5000);
    window.addEventListener('storage', () => Account.libraryCheck());
    window.addEventListener('pagehide', () => Account.flush());
    window.addEventListener('online', () => Account.flush());
  },
  /** Окно «Сверяемся с аккаунтом…» — пока идёт обмен с аккаунтом; закрыть нельзя. */
  showSyncing() {
    this.syncing = true;
    UI.showModal(`<div class="epoch-modal acc-sync"><h2>☁️ Сверяемся с аккаунтом…</h2><p class="dim">Это несколько секунд.</p></div>`, { small: true, noX: true, sticky: true });
  },
  /** Раунд карточек — только после первой сверки с аккаунтом при запуске (этот браузер мог устареть, учёба могла поменяться).
   *  true — подождём (не дольше 10 секунд: без сети играем как есть) и запустим сами. */
  waitBeforeStudy(go) {
    if (!this.startSync || this.startSyncDone) return false;
    this.showSyncing();
    Promise.race([this.startSync, new Promise(r => setTimeout(r, 10000))]).then(() => {
      this.syncing = false;
      if (Account.stale || Account.reloadNeeded) return;   // своё окно уже на экране
      this.startSyncDone = true;
      UI.closeModal();   // спросить «Что оставить?», если нужно, — тут же (synced ждёт, пока закроют окно)
      if (!Account.held) go();
    });
    return true;
  },
  /** В браузер легло обучение из аккаунта — перезагрузить страницу (окно на мгновение, чтобы было понятно, что происходит). */
  reloadIfNeeded(text = 'Загружаем ваш прогресс из аккаунта…') {
    if (!Account.reloadNeeded) return false;
    UI.lockWith(`<div class="epoch-modal"><h2>☁️ ${esc(text)}</h2></div>`);
    setTimeout(() => BrowserIO.restart(), 600);
    return true;
  },

  /** Кнопка 👤: вошёл — зелёная точка и имя в подсказке. */
  renderBtn() {
    const s = Account.state, on = Account.signedIn();
    const b = $('#accountBtn');
    b.classList.toggle('on', on);
    b.classList.toggle('pending', on && !!s.profilePending);   // жёлтая точка: есть изменения, ещё не записанные в аккаунт
    b.title = on ? `Вход: ${this.NAMES[s.provider]} — ${s.name || s.username || s.email}.${s.profilePending ? ' Есть изменения, ещё не записанные в аккаунт.' : ''} Нажмите, чтобы посмотреть или выйти`
      : `Вход и прогресс: ${s.name ? s.name + ', в' : 'с'}ейчас вы играете без входа — всё хранится в этом браузере`;
    const rail = $('#rail [data-open="account"] span');
    if (rail) rail.textContent = on ? 'Профиль' : 'Вход';
  },

  errorText(code, p) {
    const n = this.NAMES[p] || '';
    return {
      notConfigured: `Вход через ${n} скоро появится. Пока можно войти другим способом или играть без входа — всё сохранится в этом браузере.`,
      fileProtocol: 'Вход работает только на сайте grecheskiy.com, а не в игре, открытой с диска.',
      offline: `Не удалось связаться с ${n} — проверьте интернет и попробуйте ещё раз.`,
      cancelled: 'Вход отменён.',
      popupBlocked: 'Браузер не дал открыть окно входа — разрешите всплывающие окна для этого сайта и попробуйте ещё раз.',
      domain: `${n} пока не принимает вход с этого адреса — сайт ещё настраивается.`,
    }[code] || `Не получилось войти через ${n}. Попробуйте ещё раз чуть позже.`;
  },

  /** Кнопки входа (настроенные — первыми). ctx — откуда (welcome | panel | finish): после входа туда и возвращаемся.
   *  guest — подпись кнопки «без входа» или null (без неё). */
  buttonsHtml(ctx, guest = null) {
    const list = Account.PROVIDERS.slice().sort((a, b) => Account.configured(b) - Account.configured(a));
    for (const p of list) Account.preload(p);   // библиотеки входа — заранее: окно входа откроется прямо по нажатию
    return `<div class="acc-btns">${list.map(p => {
      const ok = Account.configured(p);
      return `<button class="btn acc-${p} ${ok ? '' : 'acc-off'}" data-action="auth" data-provider="${p}" data-ctx="${ctx}">Войти через ${this.NAMES[p]}${ok ? '' : '<small>скоро</small>'}</button>`;
    }).join('')}${guest ? `<button class="btn acc-guest" data-action="auth-guest" data-ctx="${ctx}">${guest}<small>💾 всё хранится только в этом браузере</small></button>` : ''}</div>`;
  },
  /** Где кнопка входа на потом. */
  whereLater() { return 'кнопка 👤 вверху справа'; },
  /** Что даёт вход и что значит «без входа» — честно: слова уже в аккаунте, город — пока нет. */
  whyHtml() {
    return `<div class="acc-two">
      <div><b>👤 Со входом</b> Выученные слова, колоды, настройки учёбы и тексты в читалке хранятся в аккаунте и едут за вами
        на телефон и другой компьютер. Город пока остаётся в этом браузере — его перенос в работе.</div>
      <div><b>💾 Без входа</b> Всё хранится только <b>в этом браузере</b> на этом устройстве. В другом браузере или на телефоне начнёте
        с нуля, а очистка данных сайта сотрёт прогресс.</div></div>
      <p class="dim">Передумаете — войти можно в любой момент: ${this.whereLater()}. Что и где хранится —
        <a href="privacy.html" target="_blank" rel="noopener">политика конфиденциальности</a>.</p>`;
  },

  // ---------- шаг на старте нового игрока: после выбора обучения, перед «Что будем учить?» ----------
  /** Следующий экран старта нового игрока: вход (если ещё не решали), потом «Что будем учить?», потом игра. */
  startNext() {
    if (!Account.decided()) return this.showStep();
    if (Game.state.planPending) return UI.showLearnPlan();
    UI.closeModal();
  },
  showStep() {
    UI.showModal(`<div class="acc-modal"><div class="dim">Прогресс</div><h2>Где хранить ваш прогресс?</h2>
      ${this.whyHtml()}${this.buttonsHtml('welcome', 'Играть без входа →')}</div>`,
      { noX: true, sticky: true });
  },

  // ---------- окно «Вход и прогресс» (кнопка 👤) ----------
  /** Окно «Вход и прогресс». editName — сразу открыть поле «Имя в игре». */
  showPanel(editName = false) {
    const s = Account.state, on = Account.signedIn();
    const via = on ? `${esc(this.NAMES[s.provider])}${s.email ? ' · ' + esc(s.email) : s.username ? ' · @' + esc(s.username) : ''}` : 'без входа · только в этом браузере';
    const nameRow = editName
      ? `<form class="acc-name" data-acc-name><input name="n" maxlength="40" value="${esc(s.name || '')}" placeholder="Как вас называть в игре" autocomplete="nickname">
          <button class="btn small gold" type="submit">Сохранить</button><button class="btn small ghost" type="button" data-action="acc-name-cancel">Отмена</button></form>`
      : s.name ? `<b>${esc(s.name)}</b> <button class="link" data-action="acc-name-edit">✎ изменить имя</button>`
      : `<b class="dim">Имя не задано</b> <button class="link" data-action="acc-name-edit">✎ задать имя</button>`;
    const who = `<div class="acc-who">${on && s.photo ? `<img src="${esc(s.photo)}" alt="" referrerpolicy="no-referrer">` : '<span class="acc-av">👤</span>'}
        <div class="acc-who-t">${nameRow}<small>${via}</small></div></div>`;
    UI.showModal(`<div class="acc-modal"><div class="dim">Прогресс</div><h2>${on ? 'Вы вошли' : 'Вход'}</h2>
      ${on ? `${who}<p>Учёба — слова, колоды, настройки — хранится в аккаунте${s.profilePending ? ' (последние изменения запишем, как только будет связь)' : ''}:
        войдите на другом устройстве — и продолжите с того же места. Город пока остаётся в этом браузере.</p>
        <div class="em-actions"><button class="btn ghost small" data-action="auth-out">Выйти</button><button class="btn gold" data-action="close">Готово</button></div>`
      : `${who}<p><b>Сейчас вы играете без входа</b> — прогресс хранится только в этом браузере.</p>${this.whyHtml()}${this.buttonsHtml('panel')}
        <div class="em-actions"><button class="btn ghost small" data-action="close">Пока без входа</button></div>`}
      <div class="acc-id dim">Номер этого браузера в игре: ${esc(s.id)}</div></div>`, { small: true });
  },

  // ---------- после обучения (для тех, кто играет без входа) ----------
  /** Блок «Сохраните прогресс» для окна финала обучения или пустая строка. */
  finishOfferHtml() {
    if (Account.signedIn()) return '';
    Account.markAsked('AfterTutorial');
    return `<div class="acc-offer"><b>💾 Сохраните прогресс.</b> Сейчас вы играете без входа: город и слова хранятся только в этом браузере.
      Войдите — выученные слова будут храниться в аккаунте и поедут за вами на другие устройства.${this.buttonsHtml('finish')}
      <div class="dim">Можно и дальше без входа — войти можно в любой момент: ${this.whereLater()}.</div></div>`;
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
    const wasSyncing = this.syncing;
    this.syncing = false;
    this.renderBtn();
    if (!r.ok) {
      if (wasSyncing) this.after(ctx);   // окно «Сверяемся…» — вернуть туда, откуда входили
      else if (btn) { btn.disabled = false; btn.innerHTML = btn.dataset.label; }
      if (r.error !== 'cancelled') UI.toast(esc(this.errorText(r.error, p)));
      return;
    }
    if (r.result === 'ask') return this.showChoice(ctx);
    if (this.reloadIfNeeded()) return;   // в этом браузере учёбы не было — взяли её из аккаунта
    const s = Account.state;
    UI.toast(`👤 Вы вошли через ${this.NAMES[p]}${s.name ? ': <b>' + esc(s.name) + '</b>' : ''}`
      + (r.result === 'pending' ? '. С аккаунтом сверимся, как только будет связь' : ''));
    this.after(ctx);
  },
  guest(ctx) { Account.chooseGuest(); this.after(ctx); },
  /** Сохранить имя в игре (форма в окне «Вход и прогресс»). */
  async saveName(form) {
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true; btn.textContent = 'Сохраняем…';
    const r = await Account.setName(form.elements.n.value);
    if (!r.ok) { btn.disabled = false; btn.textContent = 'Сохранить'; return UI.toast('Имя не может быть пустым'); }
    this.renderBtn();
    if (r.result === 'ask') return this.showChoice('panel');
    if (r.result === 'stale') return;   // окно «Этот браузер устарел» уже на экране
    if (this.reloadIfNeeded()) return;
    UI.toast(r.result === 'pending' ? '👤 Имя сохранено здесь — в аккаунт запишем, как только будет связь' : `👤 Теперь вы — <b>${esc(Account.state.name)}</b>`);
    this.showPanel();
  },

  // ---------- «Что оставить?» — в браузере и в аккаунте разное ----------
  // 🚨 Только при входе. Здесь одна версия затирается навсегда (имя, учёба; потом город). Поэтому: под каждой кнопкой красным —
  // что пропадёт; второй экран «Точно заменить?» с тем же списком; кнопка «Да, заменить» оживает через 3 секунды.
  // Без второго экрана Account.choose ничего не заменит (confirmed).
  /** Учёба одной строкой: «выучено 120 слов · в работе 35 · своих колод 2». */
  learnText(L) {
    const n = Learn.summary(L), bits = [`выучено ${n.learned} ${plural(n.learned, 'слово', 'слова', 'слов')}`];
    if (n.learning) bits.push(`в работе ${n.learning}`);
    if (n.own) bits.push(`${n.own} ${plural(n.own, 'своя колода', 'свои колоды', 'своих колод')}`);
    return bits.join(' · ');
  },
  /** Читалка одной строкой: «3 своих текста · 120 карточек слов». */
  libraryText(v) {
    const n = Account.librarySummary(v), bits = [];
    if (n.texts) bits.push(`${n.texts} ${plural(n.texts, 'свой текст', 'своих текста', 'своих текстов')}`);
    if (n.cards) bits.push(`${n.cards} ${plural(n.cards, 'карточка', 'карточки', 'карточек')} слов`);
    return bits.join(' · ') || 'пусто';
  },
  /** Как показать версию (части Account.parts): имя, учёба, читалка; город добавится сюда же. */
  partsHtml(v) {
    const L = v.learn, n = L ? Learn.summary(L) : null;
    const learn = L == null ? '—' : Learn.isEmptySnap(L) ? 'ещё не начинали' : esc(this.learnText(L));
    return `<div class="acc-ver-l">Имя в игре: <b>${v.name ? esc(v.name) : '—'}</b></div>
      <div class="acc-ver-l">Учёба: <b>${learn}</b></div>${n && n.last ? `<small>${this.when(n.last, 'последнее занятие')}</small>` : ''}
      <div class="acc-ver-l">Читалка: <b>${v.library == null ? '—' : esc(this.libraryText(v.library))}</b></div>`;
  },
  /** Что пропадёт у victim, если взять winner (Account.losses), списком. */
  lossList(victim, winner) {
    const items = Account.losses(victim, winner).map(k => k === 'name' ? `имя в игре «${esc(victim.name)}»`
      : k === 'learn' ? `учёба: ${esc(this.learnText(victim.learn))}`
      : k === 'library' ? `читалка: ${esc(this.libraryText(victim.library))}` : esc(k));
    return items.length ? `<ul>${items.map(x => `<li>${x}</li>`).join('')}</ul>` : '<ul><li>ничего</li></ul>';
  },
  when(ms, verb) {
    return ms ? `${verb} ${esc(new Date(ms).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }))}` : '';
  },
  /** Окно выбора версии. ctx — откуда пришли (welcome / panel / finish / start): туда и вернёмся. */
  showChoice(ctx = this.choiceCtx) {
    const c = Account.choice();
    if (!c) return this.after(ctx);
    this.choiceCtx = ctx;
    const prov = esc(this.NAMES[c.provider]);
    UI.showModal(`<div class="acc-modal"><div class="dim">Прогресс</div><h2>Что оставить?</h2>
      <p>В этом браузере и в аккаунте ${prov} сохранено разное. Выберите одно — им заменим другое.
        Смешивать по частям не будем: так ничего не перепутается.</p>
      <div class="acc-two acc-vers">
        <div><b>💻 Этот браузер</b>${this.partsHtml(c.local)}
          <button class="btn gold" data-action="acc-pick" data-pick="local">Оставить это</button>
          <small>в аккаунте станет так же</small><div class="acc-lost">⚠️ Пропадёт из аккаунта: ${this.lossList(c.remote, c.local)}</div></div>
        <div><b>☁️ Аккаунт ${prov}</b>${this.partsHtml(c.remote)}
          <button class="btn gold" data-action="acc-pick" data-pick="remote">Взять из аккаунта</button>
          <small>в этом браузере станет так же</small><div class="acc-lost">⚠️ Пропадёт из этого браузера: ${this.lossList(c.local, c.remote)}</div></div>
      </div>
      <div class="em-actions"><button class="btn ghost small" data-action="acc-pick" data-pick="">${c.login ? 'Не входить — ничего не менять' : 'Решить потом'}</button></div></div>`,
      { noX: true, sticky: true });
  },
  /** Первый выбор: «не входить» — сразу; заменить — только через второй экран. */
  async pick(which) {
    if (this.busy) return;
    if (which) return this.showConfirmChoice(which);
    this.busy = true;
    const c = Account.choice(), ctx = this.choiceCtx;
    await Account.choose(null);
    this.busy = false;
    this.renderBtn();
    UI.toast(c && c.login ? '👤 Вход отменён — всё осталось как было' : '👤 Хорошо, спросим в следующий раз');
    return ctx === 'start' ? UI.closeModal() : this.after(ctx);
  },
  /** Второй экран: «Точно заменить?» — что пропадёт навсегда и что останется. */
  showConfirmChoice(which) {
    const c = Account.choice();
    if (!c) return this.after(this.choiceCtx);
    const prov = esc(this.NAMES[c.provider]);
    const keepLocal = which === 'local';
    const lostWhere = keepLocal ? `в аккаунте ${prov}` : 'в этом браузере';
    this.confirming = { which };
    UI.showModal(`<div class="acc-modal"><div class="dim">Прогресс</div><h2>⚠️ Точно заменить?</h2>
      <div class="acc-loss"><b>Пропадёт навсегда</b> — ${lostWhere}:${keepLocal ? this.lossList(c.remote, c.local) : this.lossList(c.local, c.remote)}</div>
      <p>Останется версия ${keepLocal ? 'этого браузера' : `из аккаунта ${prov}`}:</p>${this.partsHtml(keepLocal ? c.local : c.remote)}
      <p>Её получат и этот браузер, и аккаунт. <b>Отменить это будет нельзя.</b></p>
      ${this.confirmButtons('Да, заменить')}</div>`, { noX: true, sticky: true });
    this.armConfirm();
  },
  /** «← Назад» и «Да, …»: опасная кнопка справа, другого цвета и оживает не сразу. */
  confirmButtons(yes) {
    return `<div class="em-actions acc-confirm"><button class="btn gold" data-action="acc-back">← Назад</button>
      <button class="btn danger-fill" data-action="acc-confirm" data-label="${esc(yes)}" disabled>${esc(yes)}</button></div>`;
  },
  /** Кнопка «Да, …» оживает через 3 секунды — чтобы не проскочить её двойным щелчком или по привычке. */
  armConfirm(sec = 3) {
    clearInterval(this.armTimer);
    let left = sec;
    const tick = () => {
      const b = $('#modalBox [data-action="acc-confirm"]');
      if (!b) return clearInterval(this.armTimer);
      if (left <= 0) { clearInterval(this.armTimer); b.disabled = false; b.textContent = b.dataset.label; return; }
      b.disabled = true; b.textContent = `${b.dataset.label} (${left})`; left--;
    };
    tick();
    this.armTimer = setInterval(tick, 1000);
  },
  back() {
    clearInterval(this.armTimer);
    this.confirming = null;
    return this.showChoice();
  },
  async confirm() {
    const f = this.confirming;
    if (!f || this.busy) return;
    const b = $('#modalBox [data-action="acc-confirm"]');
    if (!b || b.disabled) return;
    b.disabled = true; b.textContent = 'Заменяем…';
    this.busy = true;
    const c = Account.choice(), ctx = this.choiceCtx;
    const r = await Account.choose(f.which, true);
    this.busy = false;
    this.confirming = null;
    this.renderBtn();
    if (!r.ok) { UI.toast('Не получилось — попробуйте ещё раз'); return this.showChoice(); }
    if (this.reloadIfNeeded()) return;   // взяли учёбу из аккаунта
    const s = Account.state;
    UI.toast((c && c.login ? `👤 Вы вошли через ${this.NAMES[s.provider]}: <b>${esc(s.name)}</b>. ` : '👤 ')
      + (f.which === 'local' ? 'В аккаунте теперь — как в этом браузере' : 'В этом браузере теперь — как в аккаунте')
      + (r.pending ? ' (в аккаунт запишем, как только будет связь)' : ''));
    if (ctx === 'start') return UI.closeModal();
    this.after(ctx);
  },
  /** Запуск: сверка при входе не прошла (не было связи), а в браузере и в аккаунте разное — спросить, когда освободится экран. */
  synced(r, ctx) {
    this.renderBtn();
    if (this.reloadIfNeeded()) return;   // сверка при входе прошла только сейчас и взяла учёбу из аккаунта
    if (r.result !== 'ask') return;
    if ($('#modal').classList.contains('hidden')) return this.showChoice(ctx);
    const prev = UI.afterModal;
    UI.afterModal = () => { if (prev) prev(); this.synced(r, ctx); };
  },

  // ---------- «Этот браузер устарел» — под аккаунтом играют в другом браузере ----------
  /** Под аккаунтом вошли в другом браузере: этот устарел. Без выбора — только загрузить версию из аккаунта. */
  showStale() {
    UI.lockWith(`<div class="epoch-modal"><h2>🔄 Этот браузер устарел</h2>
      <p>Под вашим аккаунтом зашли в игру в другом браузере или на другом устройстве. Главная версия — в аккаунте,
        а здесь — устаревшая.</p>
      <p>Загрузите версию из аккаунта — и продолжайте здесь: главным снова станет этот браузер.</p>
      <div class="em-actions"><button class="btn gold" data-action="acc-adopt">Загрузить из аккаунта</button></div></div>`);
  },
  async adopt() {
    const btn = $('#modalBox [data-action="acc-adopt"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Загружаем…'; }
    await Account.adopt();   // не вышло (нет связи) — после перезагрузки попробуем снова
    BrowserIO.restart();
  },
  async signOut() { await Account.signOut(); this.renderBtn(); UI.toast('👤 Вы вышли. Город и слова остались в этом браузере.'); this.showPanel(); },
  /** Куда дальше после входа или «без входа». */
  after(ctx) {
    if (ctx === 'welcome') return this.startNext();
    if (ctx === 'panel') return this.showPanel();
    UI.closeModal();   // финал обучения
  },
};
