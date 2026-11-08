'use strict';
// Запуск игры
(function () {
  Game.genMap();
  // index.html?reset — аварийный сброс сохранения
  if (/[?&]reset\b/.test(location.search)) {
    Session.clear(BrowserIO);
    history.replaceState(null, '', location.pathname);
  }
  // город и обучение хранятся отдельно; старое общее сохранение переносится само
  const boot = Session.start(BrowserIO);
  const saved = boot.cityLoaded;
  if (saved && boot.decksAdded) Game.state.log.unshift({ t: Date.now(), k: 'decksAdded', p: { n: boot.decksAdded } });
  Game.tick(0);

  const away = saved ? Game.catchUp() : null;
  Speech.init();
  UI.init();

  const firstScreen = () => {
    if (!saved || Game.state.introPending) {
      delete Game.state.introPending;
      Game.log('hintGather');
      Game.log('hintLogos');
      if (saved) Game.log('newGameKept');
      UI.showEpoch(true);
    } else if (away) UI.showAway(away);
  };
  // Телефоны и планшеты: честно предупреждаем, что игра сделана под компьютер (раз за сеанс)
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    (window.matchMedia && matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 900);
  const warned = BrowserIO.sessionGet('greekgame.mobileWarned') === '1';
  if (isMobile && !warned) {
    BrowserIO.sessionSet('greekgame.mobileWarned', '1');
    UI.showMobileWarning(firstScreen);
  } else firstScreen();

  let last = performance.now(), sinceRender = 0, sinceSave = 0;
  setInterval(() => {
    if (Game.paused) { last = performance.now(); return; }
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
      UI.renderPanel();
    }
    if (sinceSave >= 5) { sinceSave = 0; Session.saveAll(); }
  }, 250);

  window.addEventListener('beforeunload', () => Session.saveAll());
  // во фоне игра «спит», а при возвращении досчитывает офлайн-прогресс по общим правилам
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { Session.saveAll(); Game.paused = true; return; }
    const a = Game.catchUp();
    Game.paused = false; last = performance.now();
    if (a) { UI.renderMap(); UI.renderAll(); UI.showAway(a); }
  });
})();
