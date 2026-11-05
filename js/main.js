'use strict';
// Запуск игры
(function () {
  Game.genMap();
  // index.html?reset — аварийный сброс сохранения
  if (/[?&]reset\b/.test(location.search)) {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    history.replaceState(null, '', location.pathname);
  }
  const saved = Game.load();
  Game.state = saved || Game.newState();
  Game.tick(0);

  const away = saved ? Game.catchUp() : null;
  Speech.init();
  UI.init();

  if (!saved) {
    Game.log('Кликайте по лесу, холмам и равнине, чтобы собирать ресурсы.');
    Game.log('λ Логос даётся только за карточки — кнопка «📜 Учиться».');
    UI.showEpoch(true);
  } else if (away && Object.keys(away.gained).length) {
    const list = Object.entries(away.gained).map(([k, v]) => `${RES[k].icon} +${v}`).join(' ');
    UI.toast(`Пока вас не было (${away.minutes} мин): ${list}`);
  }

  let last = performance.now(), sinceRender = 0, sinceSave = 0;
  setInterval(() => {
    const now = performance.now();
    const dt = Math.min(1, (now - last) / 1000);
    last = now;
    const popBefore = Game.state.pop;
    const idleBefore = Game.state.buildings.map(b => b.idle).join();
    Game.tick(dt);
    const mapChanged = Game.events(dt);
    UI.renderTop();
    if (mapChanged || Game.state.buildings.map(b => b.idle).join() !== idleBefore) UI.renderMap();
    sinceRender += dt; sinceSave += dt;
    if (sinceRender >= 1 || Game.state.pop !== popBefore) {
      sinceRender = 0;
      if (UI.tab !== 'decks') UI.renderPanel();
    }
    if (sinceSave >= 5) { sinceSave = 0; Game.save(); }
  }, 250);

  window.addEventListener('beforeunload', () => Game.save());
  document.addEventListener('visibilitychange', () => { if (document.hidden) Game.save(); });
})();
