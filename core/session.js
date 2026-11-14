'use strict';
// ============================================================
//  Сеанс: загрузка и сохранение обоих миров (город + обучение),
//  перенос старого общего сохранения, полный сброс, защита от второй вкладки.
//  Это единственное место ядра, которое знает и про город, и про обучение.
// ============================================================

const Session = {
  io: null,
  LEGACY: ['greekgame.save.v2', 'greekgame.save.v1'],   // общее сохранение до разделения

  // Вторая вкладка. У каждого сохранения рядом лежит штамп «какая вкладка записала последней» (KEY + STAMP).
  // Вкладка пишет, только пока штамп в хранилище — её собственный. Если поверх записала другая вкладка
  // (или там начали новую игру, или всё стёрли), эта вкладка «отстаёт»: больше ничего не сохраняет
  // и зовёт onLost — интерфейс предлагает перезагрузиться. Так старая вкладка не затрёт свежую игру.
  STAMP: '.stamp',
  tab: null, seq: 0, stamps: null, lost: false, onLost: null,

  /** Подключить хранилище и загрузить всё. Возвращает { cityLoaded, learnLoaded, decksAdded, migrated }. */
  start(io) {
    this.tab = Math.random().toString(36).slice(2, 10);
    this.stamps = {};
    for (const k of [Game.KEY, Learn.KEY]) this.stamps[k] = io.load(k + this.STAMP);
    this.io = Game.io = Learn.io = this.guard(io);
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

  /** Хранилище для города и обучения: запись — только пока штамп наш; удаление стирает и штамп. */
  guard(io) {
    const self = this, ST = this.STAMP;
    return Object.assign(Object.create(io), {
      load: k => io.load(k),
      restart: () => io.restart(),
      remove(k) { io.remove(k); if (k in self.stamps) io.remove(k + ST); },
      save(k, text) {
        if (!(k in self.stamps)) return io.save(k, text);
        if (self.lost || io.load(k + ST) !== self.stamps[k]) return self.lose();
        io.save(k, text);
        io.save(k + ST, self.tab + '.' + (++self.seq));
        self.stamps[k] = io.load(k + ST);   // без хранилища останется null — и сойдётся в следующий раз
      },
    });
  },
  /** Не записала ли другая вкладка поверх нашей игры. Зовётся при возвращении на вкладку и по событию хранилища. */
  check() {
    if (!this.lost && this.stamps && Object.keys(this.stamps).some(k => this.io.load(k + this.STAMP) !== this.stamps[k])) this.lose();
    return this.lost;
  },
  lose() {
    if (this.lost) return false;
    this.lost = true;
    Game.paused = true;
    if (this.onLost) this.onLost();
    return false;
  },

  /** Стереть всё: город, обучение, импортированные колоды — как при первом запуске. */
  wipe() {
    Game.resetting = Learn.resetting = true;   // больше ничего не сохраняем
    if (!this.io) return;
    for (const k of [Game.KEY, Learn.KEY, ...this.LEGACY, this.LEGACY[0] + '.bak']) this.io.remove(k);
    this.io.restart();
  },
  /** Аварийный сброс (index.html?reset): то же, но без перезагрузки. */
  clear(io) { for (const k of [Game.KEY, Learn.KEY, ...this.LEGACY]) { io.remove(k); io.remove(k + this.STAMP); } },
};
