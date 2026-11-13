'use strict';
// ============================================================
//  Город: состояние, карта, сохранение, справочные функции.
//  Обучение хранится отдельно — core/learning/learn.js.
// ============================================================

const Game = {
  state: null,
  KEY: 'greekgame.city.v1',
  map: [],
  rates: {}, eff: 1, cap: 0, need: 0, storage: 0, fx: null,
  goat: null,   // { x, y, ttl } — беглая коза на карте

  newState() {
    const res = {};
    for (const k of RES_KEYS) res[k] = 0;
    Object.assign(res, { food: 80, wood: 70, stone: 30 });
    const s = {
      v: 2, epoch: 0, res,
      logos: 0, logosEarned: 0,
      pop: 2, popAcc: 0, starveAcc: 0,
      techs: [], buildings: [], nextId: 1,
      buffs: {}, cooldowns: {}, readyAt: {}, stash: [],
      stats: { goats: 0 },
      timers: { goat: 40, raid: null },
      log: [], lastSave: Date.now(), finished: false,
    };
    const dist = t => Math.hypot(t.x - 10, t.y - 5);
    const home = this.map.filter(t => t.t === 'plain' && !t.coast).sort((a, b) => dist(a) - dist(b))[0];
    s.buildings.push({ id: s.nextId++, type: 'house', level: 1, x: home.x, y: home.y });
    const pen = this.map.filter(t => t.t === 'hill' || t.t === 'forest').sort((a, b) => dist(a) - dist(b))[0];
    s.buildings.push({ id: s.nextId++, type: 'goatpen', level: 1, x: pen.x, y: pen.y });
    return s;
  },

  genMap() {
    const map = [];
    for (let y = 0; y < MAP_H; y++) {
      const row = (MAP_ROWS[y] + '~'.repeat(MAP_W)).slice(0, MAP_W);
      for (let x = 0; x < MAP_W; x++) {
        let ch = row[x];
        if (x === 0 || y === 0 || x === MAP_W - 1 || y === MAP_H - 1) ch = '~';
        const t = ch === '~' ? 'sea' : ch === 'F' ? 'forest' : ch === 'H' ? 'hill' : 'plain';
        map.push({ x, y, t, coast: false });
      }
    }
    this.map = map;
    for (const tile of map) {
      if (tile.t === 'sea') continue;
      tile.coast = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const n = this.tile(tile.x + dx, tile.y + dy);
        return n && n.t === 'sea';
      });
    }
  },

  tile(x, y) {
    if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return null;
    return this.map[y * MAP_W + x];
  },

  // ---------- сохранение ----------
  /**
   * Хранилище подставляет платформа (см. platform/): { load(key), save(key, text), remove(key), restart() }.
   * Без него игра работает, но ничего не сохраняет (так ядро можно гонять в тестах).
   */
  io: null,

  /** Город из старого общего сохранения (до разделения на город и обучение). */
  fromLegacy(old) {
    const s = Object.assign({}, old);
    for (const k of ['decks', 'progress', 'settings', 'learnLog']) delete s[k];
    s.stats = { goats: (old.stats || {}).goats || 0 };
    return s;
  },

  /** Загрузить город или null. legacy — разобранное старое общее сохранение, если своего ещё нет. */
  load(legacy = null) {
    try {
      const raw = this.io && this.io.load(this.KEY);
      const s = raw ? JSON.parse(raw) : legacy && legacy.v === 2 ? this.fromLegacy(legacy) : null;
      if (!s || s.v !== 2) return null;
      for (const k of RES_KEYS) if (typeof s.res[k] !== 'number') s.res[k] = 0;
      s.timers = s.timers || { goat: 40, raid: null };
      s.stats = s.stats || {};
      s.stats.goats = s.stats.goats || 0;
      s.buffs = s.buffs || {};
      s.cooldowns = s.cooldowns || {};
      s.readyAt = s.readyAt || {};
      s.stash = s.stash || [];
      if (s.finished && EPOCHS[s.epoch] && !EPOCHS[s.epoch].locked) s.finished = false;   // эпоха, бывшая концом прототипа, теперь открыта
      s.log = s.log || [];
      s.techs = s.techs.map(t => t === 'picrolite' ? 'carving' : t);   // переименование v2 → v3
      const st = this.state; this.state = s; this.retireWonders(); this.state = st;   // старые сохранения: чудеса прошлой эпохи
      return s;
    } catch (e) { return null; }
  },
  save() {
    if (this.resetting || !this.state) return;   // после сброса не пересохраняем старую игру
    this.state.lastSave = Date.now();
    if (this.io) this.io.save(this.KEY, JSON.stringify(this.state));
  },
  /** Новая игра: город, знания и Логос — с нуля. Обучение хранится отдельно и не трогается. */
  newGame() {
    const s = this.newState();
    s.introPending = true;
    this.state = s;
    this.save();
    this.resetting = true;
    if (this.io) this.io.restart();
  },

  /** Запись в летопись: код события и параметры (текст — в content/ru/messages.js). */
  log(k, p = {}) {
    this.state.log.unshift({ t: Date.now(), k, p });
    this.state.log.length = Math.min(this.state.log.length, 30);
    Bus.emit('log', { entry: this.state.log[0] });
  },

  // ---------- справочные функции ----------
  hasTech(id) { return this.state.techs.includes(id); },
  buildingAt(x, y) { return this.state.buildings.find(b => b.x === x && b.y === y); },
  count(type) { return this.state.buildings.filter(b => b.type === type).length; },
  /** Чудо эпохи, чья эпоха прошла: оно уже стало обычным зданием (BUILDINGS[type].retire). */
  retired(type) { const r = BUILDINGS[type].retire; return !!r && this.state.epoch >= r.epoch; },
  /** Превратить прошедшие чудеса эпохи в обычные здания. Возвращает [[чудо, здание, уровень]]. */
  retireWonders() {
    const out = [];
    for (const b of this.state.buildings) {
      if (!this.retired(b.type)) continue;
      const r = BUILDINGS[b.type].retire;
      out.push([b.type, r.into, r.level]);
      b.from = b.type; b.type = r.into; b.level = r.level;
    }
    return out;
  },
  built(type) { return this.count(type) > 0; },
  /** Чудо убрано на склад: не стоит на карте, бонусы не действуют, но поставить можно бесплатно. */
  stashed(type) { return (this.state.stash || []).includes(type); },
  owned(type) { return this.built(type) || this.stashed(type); },
  maxLevel() {
    for (let e = this.state.epoch; e >= 0; e--) if (EPOCHS[e].maxLevel) return EPOCHS[e].maxLevel;
    return 1;
  },

  /** Облик здания в эпохе (структура: capBonus). Название и значок облика — в словаре. */
  form(type, epoch = this.state.epoch) {
    const B = BUILDINGS[type];
    if (B.special || !B.forms) return {};
    for (let e = Math.min(epoch, B.forms.length - 1); e >= 0; e--) if (B.forms[e]) return B.forms[e];
    return B.forms.find(Boolean);
  },

  addLogos(n) {
    this.state.logos += n;
    this.state.logosEarned += n;
  },
};
