'use strict';
// ============================================================
//  Сеанс: загрузка и сохранение обоих миров (город + обучение),
//  перенос старого общего сохранения, полный сброс.
//  Это единственное место ядра, которое знает и про город, и про обучение.
// ============================================================

const Session = {
  io: null,
  LEGACY: ['greekgame.save.v2', 'greekgame.save.v1'],   // общее сохранение до разделения

  /** Подключить хранилище и загрузить всё. Возвращает { cityLoaded, learnLoaded, decksAdded, migrated }. */
  start(io) {
    this.io = Game.io = Learn.io = io;
    let legacy = null;
    const hasNew = io.load(Game.KEY) || io.load(Learn.KEY);
    if (!hasNew) { try { legacy = JSON.parse(io.load(this.LEGACY[0]) || 'null'); } catch (e) { legacy = null; } }
    const city = Game.load(legacy), learn = Learn.load(legacy);
    Game.state = city || Game.newState();
    Learn.state = learn ? learn.state : Learn.newState();
    const migrated = !!(legacy && (city || learn));
    if (migrated) {
      // старое общее сохранение разделено на два — сохраняем оба, а старое оставляем копией
      this.saveAll();
      io.save(this.LEGACY[0] + '.bak', io.load(this.LEGACY[0]));
      io.remove(this.LEGACY[0]);
    }
    return { cityLoaded: !!city, learnLoaded: !!learn, decksAdded: learn ? learn.added : 0, migrated };
  },

  saveAll() { Game.save(); Learn.save(); },

  /** Стереть всё: город, обучение, импортированные колоды — как при первом запуске. */
  wipe() {
    Game.resetting = Learn.resetting = true;   // больше ничего не сохраняем
    if (!this.io) return;
    for (const k of [Game.KEY, Learn.KEY, ...this.LEGACY, this.LEGACY[0] + '.bak']) this.io.remove(k);
    this.io.restart();
  },
  /** Аварийный сброс (index.html?reset): то же, но без перезагрузки. */
  clear(io) { for (const k of [Game.KEY, Learn.KEY, ...this.LEGACY]) io.remove(k); },
};
