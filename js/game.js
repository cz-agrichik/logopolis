'use strict';
// ============================================================
//  Состояние и экономика города
// ============================================================

const rand = (a, b) => a + Math.random() * (b - a);

const Game = {
  state: null,
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
      decks: Decks.builtinDecks(), progress: {}, buffs: {}, cooldowns: {}, settings: { ...DEFAULT_SETTINGS }, stash: [],
      stats: { right: 0, wrong: 0, bestStreak: 0, rounds: 0, goats: 0, learned: 0 }, learnLog: {},
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
  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || s.v !== 2) return null;
      for (const k of RES_KEYS) if (typeof s.res[k] !== 'number') s.res[k] = 0;
      s.timers = s.timers || { goat: 40, raid: null };
      s.stats.goats = s.stats.goats || 0;
      s.buffs = s.buffs || {};
      s.cooldowns = s.cooldowns || {};
      s.stash = s.stash || [];
      s.settings = Object.assign({}, DEFAULT_SETTINGS, s.settings || {});
      s.learnLog = s.learnLog || {};
      s.stats.learned = s.stats.learned || 0;
      s.techs = s.techs.map(t => t === 'picrolite' ? 'carving' : t);   // переименование v2 → v3
      const added = Decks.ensureBuiltins(s);
      if (added) s.log.unshift({ t: Date.now(), msg: `📚 Добавлены встроенные колоды: ${added}` });
      return s;
    } catch (e) { return null; }
  },
  save() {
    if (this.resetting) return;   // после сброса не пересохраняем старую игру
    try {
      this.state.lastSave = Date.now();
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.state));
    } catch (e) { /* хранилище недоступно — играем без сохранения */ }
  },
  /** Новая игра: город, знания и Логос — с нуля; колоды, прогресс слов, настройки и журнал обучения — сохраняются. */
  newGame() {
    const old = this.state, s = this.newState();
    s.decks = old.decks; s.progress = old.progress; s.settings = old.settings; s.learnLog = old.learnLog || {};
    for (const k of ['right', 'wrong', 'rounds', 'learned']) s.stats[k] = old.stats[k] || 0;
    s.introPending = true;
    this.state = s;
    this.save();
    this.resetting = true;
    location.replace(location.pathname + '?fresh=' + Date.now());
  },
  /** Полный сброс: игра, обучение и импортированные колоды. */
  reset() {
    this.resetting = true;   // больше ничего не сохраняем из старой игры
    try {
      localStorage.removeItem(SAVE_KEY);
      localStorage.removeItem('greekgame.save.v1');
    } catch (e) {}
    // перезагрузка без ?параметров; новая игра начнётся с чистого листа
    location.replace(location.pathname + '?fresh=' + Date.now());
  },

  log(msg) {
    this.state.log.unshift({ t: Date.now(), msg });
    this.state.log.length = Math.min(this.state.log.length, 30);
    if (typeof UI !== 'undefined') UI.renderLog();
  },

  // ---------- справочные функции ----------
  hasTech(id) { return this.state.techs.includes(id); },
  buildingAt(x, y) { return this.state.buildings.find(b => b.x === x && b.y === y); },
  count(type) { return this.state.buildings.filter(b => b.type === type).length; },
  built(type) { return this.count(type) > 0; },
  /** Чудо убрано на склад: не стоит на карте, бонусы не действуют, но поставить можно бесплатно. */
  stashed(type) { return (this.state.stash || []).includes(type); },
  owned(type) { return this.built(type) || this.stashed(type); },
  maxLevel() {
    for (let e = this.state.epoch; e >= 0; e--) if (EPOCHS[e].maxLevel) return EPOCHS[e].maxLevel;
    return 1;
  },

  /** Облик здания в текущей эпохе: { name, icon, capBonus } */
  form(type, epoch = this.state.epoch) {
    const B = BUILDINGS[type];
    if (B.special) return { name: B.name, icon: B.icon };
    for (let e = Math.min(epoch, B.forms.length - 1); e >= 0; e--) if (B.forms[e]) return B.forms[e];
    return B.forms.find(Boolean);
  },

  /** Стадия облика: меняется на «λ-уровнях» 4, 6, 8, 10. */
  stage(level) { return level >= 10 ? 4 : level >= 8 ? 3 : level >= 6 ? 2 : level >= 4 ? 1 : 0; },
  /**
   * Ключи рисунков здания. Облик резко меняется с ЭПОХОЙ (хижина → дом из сырцового кирпича),
   * а внутри эпохи уровни делают его лишь чуть наряднее; на 8-м и 10-м уровне рядом вырастают ещё постройки.
   */
  icons(type, level = 1, epoch = this.state.epoch) {
    const B = BUILDINGS[type];
    if (B.special) return [type];
    const p = B.art;
    if (!p) return [];
    let main, minor;
    if (B.epoch === 0 && epoch >= 1) { main = p + (level >= 4 ? '3' : '2'); minor = p + '2'; }   // бронзовый век
    else if (B.epoch === 0) { main = p + (level >= 4 ? '1' : '0'); minor = p + '0'; } // медный век
    else { main = p + (level >= 10 ? '2' : level >= 6 ? '1' : '0'); minor = p + '0'; } // здания бронзового века
    const n = level >= 10 ? 3 : level >= 8 ? 2 : 1;
    return [main, minor, minor].slice(0, n);
  },

  /** «🪵 12, λ 5» — чего не хватает для цены. */
  missing(cost, logos = 0) {
    const out = [];
    for (const [k, v] of Object.entries(cost || {})) {
      const d = Math.ceil(v - (this.state.res[k] || 0));
      if (d > 0) out.push(`${RES[k].icon} ${d}`);
    }
    if (logos > this.state.logos) out.push(`λ ${Math.ceil(logos - this.state.logos)}`);
    return out.join(', ');
  },
  lackReason(cost, logos = 0) {
    const cap = this.storageCap();
    const over = Object.entries(cost || {}).filter(([, v]) => v > cap).map(([k]) => RES[k].icon);
    if (over.length) return `Цена ${over.join('')} больше вместимости складов (${cap}) — постройте или улучшите склад`;
    const m = this.missing(cost, logos);
    return m ? `Не хватает: ${m}` : '';
  },

  /**
   * Сводка бонусов.
   * Постоянные (знания, чудеса) СКЛАДЫВАЮТСЯ: +20% и +30% = +50% — в bonus[ресурс] и bbonus[здание].
   * Благословения обрядов — отдельные множители (×2), в buff и bbuff.
   */
  effects() {
    const fx = { bonus: {}, bbonus: {}, buff: {}, bbuff: {}, logos: 1, cap: 0, houseCap: 0, storage: 0, storagePct: 0, growth: 1, goats: false, raidShield: false };
    for (const k of RES_KEYS) { fx.bonus[k] = 0; fx.buff[k] = 1; }
    const apply = e => {
      if (!e) return;
      if (e.all) for (const k of RES_KEYS) fx.bonus[k] += e.all;
      if (e.mult) for (const [k, v] of Object.entries(e.mult)) fx.bonus[k] += v;
      if (e.bmult) for (const [k, v] of Object.entries(e.bmult)) fx.bbonus[k] = (fx.bbonus[k] || 0) + v;
      for (const k of ['logos', 'cap', 'houseCap', 'storage', 'storagePct', 'growth']) if (e[k]) fx[k] += e[k];
      if (e.goats) fx.goats = true;
      if (e.raidShield) fx.raidShield = true;
    };
    const applyBuff = e => {
      if (!e) return;
      if (e.all) for (const k of RES_KEYS) fx.buff[k] *= 1 + e.all;
      if (e.mult) for (const [k, v] of Object.entries(e.mult)) fx.buff[k] *= 1 + v;
      if (e.bmult) for (const [k, v] of Object.entries(e.bmult)) fx.bbuff[k] = (fx.bbuff[k] || 1) * (1 + v);
      if (e.logos) fx.logos += e.logos;
      if (e.growth) fx.growth += e.growth;
      if (e.workers) fx.workers = (fx.workers || 0) + e.workers;
    };
    for (const id of this.state.techs) apply(TECH_BY_ID[id] && TECH_BY_ID[id].effect);
    for (const b of this.state.buildings) {
      const B = BUILDINGS[b.type];
      if (B.special) apply(B.effect);
      if (B.logosBonus) fx.logos += B.logosBonus + (B.logosBonusPerLevel || 0) * (b.level - 1);
    }
    for (const [id, left] of Object.entries(this.state.buffs || {})) if (left > 0 && RITUAL_BY_ID[id]) applyBuff(RITUAL_BY_ID[id].buff);
    return fx;
  },
  /** Итоговый множитель здания по ресурсу: (1 + сумма постоянных бонусов) × благословения. */
  bonusMult(type, k, fx = this.fx || this.effects()) {
    return (1 + fx.bonus[k] + (fx.bbonus[type] || 0)) * fx.buff[k] * (fx.bbuff[type] || 1);
  },
  logosMult() { return this.effects().logos; },

  /** Выпуск растёт в 1.2 раза за КАЖДЫЙ уровень: 1.2, 1.44, 1.73… */
  levelMult(L) { return Math.pow(BALANCE.upProdGrowth, L - 1); },
  workersOf(b) {
    const B = BUILDINGS[b.type];
    return B.workers ? B.workers + Math.floor((b.level - 1) / 2) : 0;
  },
  /** Производство здания в секунду при полной занятости. */
  prodOf(b, fx = this.fx || this.effects(), level = b.level) {
    const B = BUILDINGS[b.type], out = {};
    if (!B.prod) return out;
    const lm = this.levelMult(level);
    for (const [k, v] of Object.entries(B.prod)) {
      if (B.prodTech && B.prodTech[k] && !this.hasTech(B.prodTech[k])) continue;
      out[k] = v > 0 ? v * lm * this.bonusMult(b.type, k, fx) : v * lm;
    }
    return out;
  },
  houseCapOf(b, fx = this.fx || this.effects(), level = b.level) {
    const B = BUILDINGS[b.type];
    if (!B.cap) return 0;
    return Math.round(B.cap * this.levelMult(level)) + (this.form(b.type).capBonus || 0) + fx.houseCap;
  },
  storageOf(b, level = b.level) { return BUILDINGS[b.type].storage ? Math.round(BUILDINGS[b.type].storage * this.levelMult(level)) : 0; },
  storageCap(fx = this.fx || this.effects()) {
    let cap = BALANCE.baseStorage + fx.storage;
    for (const b of this.state.buildings) cap += this.storageOf(b);
    return Math.floor(cap * (1 + fx.storagePct));
  },
  popCap(fx = this.fx || this.effects()) {
    let cap = BALANCE.baseCap + fx.cap;
    for (const b of this.state.buildings) cap += this.houseCapOf(b, fx);
    return cap;
  },
  workersNeeded() {
    let n = 0;
    for (const b of this.state.buildings) n += this.workersOf(b);
    return n;
  },

  // ---------- стоимость ----------
  buildCost(type) {
    const B = BUILDINGS[type];
    const mult = B.special ? 1 : Math.pow(BALANCE.buildCostGrowth, this.count(type));
    const cost = {};
    for (const [k, v] of Object.entries(B.cost || {})) cost[k] = Math.ceil(v * mult);
    return cost;
  },
  canAfford(cost, logos = 0) {
    for (const [k, v] of Object.entries(cost)) if ((this.state.res[k] || 0) < v) return false;
    return this.state.logos >= logos;
  },
  overStorage(cost) {
    const cap = this.storageCap();
    return Object.values(cost).some(v => v > cap);
  },
  pay(cost, logos = 0) {
    for (const [k, v] of Object.entries(cost)) this.state.res[k] -= v;
    this.state.logos -= logos;
  },

  /** Цена «трудом» — без λ, но с горой обычных ресурсов. */
  laborCost(cost, logos, epoch, mult) {
    const out = {};
    for (const [k, v] of Object.entries(cost || {})) out[k] = v * mult;
    const extra = logos * BALANCE.laborPerLogos;
    // без меди: путь трудом должен быть доступен и до первого рудника
    const split = epoch >= 1 ? { stone: 0.4, wood: 0.4, goods: 0.2 } : { wood: 0.5, stone: 0.5 };
    for (const [k, f] of Object.entries(split)) out[k] = (out[k] || 0) + extra * f;
    for (const k of Object.keys(out)) out[k] = Math.ceil(out[k] / 10) * 10;
    return out;
  },
  /** Цена постройки: mode 'logos' (обычный путь) или 'labor' (больше не используется). */
  priceOf(type, mode = 'logos') {
    const B = BUILDINGS[type];
    return { cost: this.buildCost(type), logos: B.logos || 0 };
  },

  /** Можно ли сейчас строить этот тип (без учёта клетки). */
  buildStatus(type, mode = 'logos') {
    const B = BUILDINGS[type], s = this.state;
    if (s.epoch < B.epoch) return { ok: false, hidden: true };
    if (B.tech && !this.hasTech(B.tech)) return { ok: false, locked: true, reason: `Нужно знание «${TECH_BY_ID[B.tech].name}»` };
    if (B.special && this.stashed(type)) return { ok: true, stashed: true, cost: {}, logos: 0 };
    if (B.special && this.built(type)) return { ok: false, done: true, reason: 'Уже построено' };
    const { cost, logos } = this.priceOf(type, mode);
    if (B.max && this.count(type) >= B.max) return { ok: false, cost, logos, reason: `Не больше ${B.max}` };
    const reason = this.lackReason(cost, logos);
    if (reason) return { ok: false, cost, logos, poor: true, reason };
    return { ok: true, cost, logos };
  },

  canPlaceOn(type, tile) {
    const B = BUILDINGS[type];
    if (!tile || tile.t === 'sea') return false;
    if (this.buildingAt(tile.x, tile.y)) return false;
    if (!B.terrain.includes(tile.t)) return false;
    if (B.coast && !tile.coast) return false;
    if (this.goat && this.goat.x === tile.x && this.goat.y === tile.y) return false;
    return true;
  },

  build(type, x, y, mode = 'logos') {
    const st = this.buildStatus(type, mode);
    const tile = this.tile(x, y);
    if (!st.ok || !this.canPlaceOn(type, tile)) return false;
    const s = this.state;
    if (st.stashed) {   // чудо со склада — бесплатно
      s.stash = s.stash.filter(t => t !== type);
      s.buildings.push({ id: s.nextId++, type, level: 1, x, y });
      this.log(`✨ ${BUILDINGS[type].name}: снова в городе`);
      this.save();
      return true;
    }
    this.pay(st.cost, st.logos);
    s.buildings.push({ id: s.nextId++, type, level: 1, x, y });
    const B = BUILDINGS[type];
    this.log(B.special ? `✨ Возведено чудо Кипра: ${B.name}!` : `Построено: ${this.form(type).name}`);
    this.save();
    return true;
  },

  /** Цена улучшения ДО уровня target (без проверок). */
  upgradeCost(type, target) {
    const B = BUILDINGS[type];
    if (this.needsLogos(target)) return { cost: {}, logos: this.upgradeLogos(type, target) };   // λ-уровень: только λ
    const k = BALANCE.upCostBase * Math.pow(BALANCE.upCostGrowth, target - 2);   // ×1.5 за каждый уровень
    const cost = {};
    for (const [r, v] of Object.entries(B.cost)) cost[r] = Math.ceil(v * k);
    if (target >= BALANCE.copperFromLevel) cost.copper = (cost.copper || 0) + Math.ceil(15 * Math.pow(BALANCE.upCostGrowth, target - BALANCE.copperFromLevel));
    if (target >= BALANCE.bronzeFromLevel) cost.bronze = (cost.bronze || 0) + Math.ceil(8 * Math.pow(BALANCE.upCostGrowth, target - BALANCE.bronzeFromLevel));
    return { cost, logos: this.upgradeLogos(type, target) };
  },
  /** λ нужен только на «λ-уровнях»: 4, 6, 8, 10. */
  needsLogos(target) {
    return target >= BALANCE.logosFromLevel && (target - BALANCE.logosFromLevel) % BALANCE.logosEvery === 0;
  },
  upgradeLogos(type, target) {
    if (!this.needsLogos(target)) return 0;
    const step = (target - BALANCE.logosFromLevel) / BALANCE.logosEvery;
    let logos = (BUILDINGS[type].lp || 15) * Math.pow(BALANCE.logosGrowth, step);
    if (target > BALANCE.logosHighLevel) logos *= BALANCE.logosHighMult;
    return Math.ceil(logos);
  },

  /** Сведения об улучшении: цена растёт ×1.3, производство ×1.1. */
  upgradeInfo(b) {
    const B = BUILDINGS[b.type];
    if (B.special) return null;
    const target = b.level + 1, maxL = this.maxLevel();
    if (target > maxL) {
      const nextE = EPOCHS.findIndex(e => e.maxLevel > maxL);
      return { capped: true, target, reason: nextE > 0 ? `Предел ${maxL}-го уровня в этой эпохе. В эпоху «${EPOCHS[nextE].name}» — до ${EPOCHS[nextE].maxLevel}-го.` : `Максимальный уровень — ${maxL}.` };
    }
    const { cost, logos } = this.upgradeCost(b.type, target);
    const reason = this.lackReason(cost, logos);
    return { target, cost, logos, ok: !reason, reason, newLook: this.icons(b.type, target).join() !== this.icons(b.type, b.level).join() };
  },

  upgrade(b) {
    const up = this.upgradeInfo(b);
    if (!up || !up.ok) return false;
    this.pay(up.cost, up.logos);
    b.level++;
    this.log(`${up.newLook ? '✨ Новый облик! ' : ''}Улучшено: ${this.form(b.type).name} → ур. ${b.level}`);
    this.save();
    return true;
  },

  /** Убрать чудо на склад (например, чтобы переставить). */
  stashWonder(b) {
    if (!BUILDINGS[b.type].special) return false;
    const s = this.state;
    s.buildings = s.buildings.filter(x => x !== b);
    s.stash.push(b.type);
    this.log(`📦 ${BUILDINGS[b.type].name}: убрано на склад`);
    this.save();
    return true;
  },

  demolish(b) {
    if (BUILDINGS[b.type].special) return false;
    this.state.buildings = this.state.buildings.filter(x => x !== b);
    this.log(`Снесено: ${this.form(b.type).name}`);
    this.save();
    return true;
  },

  // ---------- знания ----------
  /** Цена знания: 'logos' — λ + немного ресурсов; 'labor' — без λ, но ресурсов втрое больше. */
  techPrice(T, mode = 'logos') {
    if (mode === 'labor') return { cost: this.laborCost(T.cost, T.logos, T.epoch, BALANCE.laborTechMult), logos: 0 };
    return { cost: T.cost, logos: T.logos };
  },
  techStatus(T, mode = 'logos') {
    if (this.hasTech(T.id)) return { learned: true };
    if (T.epoch > this.state.epoch) return { hidden: true };
    const miss = (T.req || []).filter(r => !this.hasTech(r));
    if (miss.length) return { locked: true, reason: 'Сначала: ' + miss.map(r => `«${TECH_BY_ID[r].name}»`).join(', ') };
    const { cost, logos } = this.techPrice(T, mode);
    const reason = this.lackReason(cost, logos);
    return { ok: !reason, reason, cost, logos };
  },
  research(id, mode = 'logos') {
    const T = TECH_BY_ID[id];
    const st = T && this.techStatus(T, mode);
    if (!st || !st.ok) return false;
    this.pay(st.cost, st.logos);
    this.state.techs.push(id);
    this.state.techPath = this.state.techPath || {};
    this.state.techPath[id] = mode;
    this.log(`📜 Новое знание: ${T.name}${T.paths ? ' — ' + T.paths[mode][0] : ''}`);
    this.save();
    return true;
  },

  gather(tile) {
    const T = TERRAIN[tile.t];
    if (!T || !T.gather) return null;
    const amt = 1 + this.state.epoch;
    const r = T.gather;
    this.state.res[r] = Math.min(this.storageCap(), this.state.res[r] + amt);
    return { res: r, amt };
  },

  addLogos(n) {
    this.state.logos += n;
    this.state.logosEarned += n;
  },

  // ---------- переход эпох ----------
  epochReqs() {
    const s = this.state, a = EPOCHS[s.epoch].advance;
    if (!a) return null;
    const list = [];
    list.push({ label: `👥 Население ${a.pop}`, have: s.pop, ok: s.pop >= a.pop });
    for (const sp of a.specials) list.push({ label: `✨ ${BUILDINGS[sp].name}`, have: this.built(sp) ? 'есть' : this.stashed(sp) ? 'на складе' : 'нет', ok: this.owned(sp) });
    if (a.allTechs) {
      const all = TECHS.filter(t => t.epoch === s.epoch), have = all.filter(t => this.hasTech(t.id)).length;
      list.push({ label: `📜 Все знания эпохи (${all.length})`, have: `${have}/${all.length}`, ok: have === all.length });
    }
    for (const [k, v] of Object.entries(a.res)) list.push({ label: `${RES[k].icon} ${RES[k].name} ${v}`, have: Math.floor(s.res[k]), ok: s.res[k] >= v });
    list.push({ label: `λ Логос ${a.logos}`, have: Math.floor(s.logos), ok: s.logos >= a.logos });
    return list;
  },

  advanceEpoch() {
    const reqs = this.epochReqs();
    if (!reqs || !reqs.every(r => r.ok)) return false;
    const a = EPOCHS[this.state.epoch].advance;
    this.pay(a.res, a.logos);
    this.state.epoch++;
    this.log(`⏳ Наступает новая эпоха: ${EPOCHS[this.state.epoch].name}`);
    if (EPOCHS[this.state.epoch].locked) this.state.finished = true;
    this.save();
    return true;
  },

  // ---------- игровой такт ----------
  tick(dt) {
    const s = this.state;
    const fx = this.fx = this.effects();
    const cap = this.popCap(fx);
    const need = this.workersNeeded();
    const hands = s.pop * (1 + (fx.workers || 0));   // «Всей семьёй» удваивает рабочие руки
    const eff = need > 0 ? Math.min(1, hands / need) : 1;
    const storage = this.storageCap(fx);
    const rates = {};
    for (const k of RES_KEYS) rates[k] = 0;

    for (const b of s.buildings) {
      const p = this.prodOf(b, fx);
      // здания-переработчики (гавань, литейня…) не тратят сырьё на то, что некуда положить:
      // все выходы полны — отдыхают, часть полна — сырья уходит пропорционально меньше
      const outs = Object.keys(p).filter(k => p[k] > 0), ins = Object.keys(p).filter(k => p[k] < 0);
      let share = 1;
      if (ins.length && outs.length) share = outs.filter(k => s.res[k] < storage - 0.01).length / outs.length;
      b.rest = ins.length && share < 1 ? (share === 0 ? 'full' : 'part') : null;
      if (share === 0) { b.idle = false; continue; }
      let ok = true;
      for (const k of ins) if (s.res[k] < -p[k] * share * eff * dt) ok = false;
      b.idle = !ok;
      if (!ok) continue;
      for (const [k, v] of Object.entries(p)) rates[k] += v * eff * (v < 0 ? share : 1);
    }
    rates.food -= s.pop * BALANCE.foodPerPop;

    for (const k of RES_KEYS) s.res[k] = Math.min(storage, Math.max(0, s.res[k] + rates[k] * dt));

    // население
    const growthTime = BALANCE.growthTime / fx.growth;
    if (s.res.food > 5 && s.pop < cap) {
      s.popAcc += dt;
      while (s.popAcc >= growthTime && s.pop < cap) { s.popAcc -= growthTime; s.pop++; }
    } else s.popAcc = 0;
    if (s.pop > cap) s.pop = cap;
    if (s.res.food <= 0 && rates.food < 0) {
      s.starveAcc += dt;
      if (s.starveAcc >= 8 && s.pop > 1) { s.starveAcc = 0; s.pop--; this.log('⚠️ Голод: житель покинул поселение'); }
    } else s.starveAcc = 0;

    for (const id of Object.keys(s.buffs)) { s.buffs[id] -= dt; if (s.buffs[id] <= 0) delete s.buffs[id]; }
    for (const id of Object.keys(s.cooldowns || {})) { s.cooldowns[id] -= dt; if (s.cooldowns[id] <= 0) delete s.cooldowns[id]; }

    this.rates = rates; this.eff = eff; this.cap = cap; this.need = need; this.storage = storage;
  },

  // ---------- обряды ----------
  ritualLogos(R) { return Math.ceil(R.logos * Math.pow(1.5, Math.max(0, this.state.epoch - R.epoch))); },
  ritualStatus(R) {
    const s = this.state;
    if (R.epoch > s.epoch) return { hidden: true };
    if (R.req && !this.built(R.req)) return { locked: true, reason: `Нужно: ${BUILDINGS[R.req].name}` };
    const cost = R.cost || {}, logos = this.ritualLogos(R);
    const cd = (s.cooldowns || {})[R.id];
    if (cd > 0) return { cost, logos, cd, reason: `Можно снова через ${Math.ceil(cd)} с` };
    const active = Object.keys(s.buffs).filter(id => RITUAL_BY_ID[id]).length;
    if (R.buff && !s.buffs[R.id] && active >= BALANCE.maxBuffs) return { cost, logos, ok: false, full: true, reason: `Одновременно — не больше ${BALANCE.maxBuffs} благословений` };
    if (R.goat && this.goat) return { cost, logos, ok: this.canAfford(cost, logos) };
    const reason = this.lackReason(cost, logos);
    return { cost, logos, ok: !reason, reason };
  },
  perform(id) {
    const R = RITUAL_BY_ID[id], st = R && this.ritualStatus(R);
    if (!st || !st.ok) return null;
    this.pay(st.cost, st.logos);
    const s = this.state, fx = this.fx || this.effects(), cap = this.storageCap(fx);
    let result = '';
    if (R.instant === 'elders') {
      const gains = [];
      for (const k of RES_KEYS) {
        let g = Math.max(0, (this.rates[k] || 0) * 120);
        if (['food', 'wood', 'stone'].includes(k)) g = Math.max(g, 30 * (1 + s.epoch));
        g = Math.floor(Math.min(g, cap - s.res[k]));
        if (g > 0) { s.res[k] += g; gains.push(`${RES[k].icon} +${g}`); }
      }
      result = gains.join(' ') || 'склады полны';
    } else if (R.instant === 'settlers') {
      const n = Math.min(3 + 2 * s.epoch, this.popCap(fx) - s.pop);
      s.pop += n; result = `👥 +${n}`;
    }
    if (R.buff) {
      s.buffs[id] = Math.min(BALANCE.maxBuffMinutes * 60, (s.buffs[id] || 0) + R.dur);
      result = `${Math.round(s.buffs[id] / 60)} мин`;
    }
    if (R.goat && !this.goat) s.timers.goat = 0;
    if (R.cooldown) s.cooldowns[id] = R.cooldown;
    this.log(`${R.icon} ${R.name}: ${result}`);
    this.save();
    return result;
  },

  // ---------- события ----------
  /** Возвращает true, если на карте что-то поменялось. */
  events(dt) {
    const s = this.state, fx = this.fx || this.effects();
    let changed = false;
    if (this.goat) {
      this.goat.ttl -= dt;
      if (this.goat.ttl <= 0) { this.goat = null; changed = true; this.log('🐐 Коза ушла в горы Троодоса…'); }
    } else {
      s.timers.goat -= dt;
      if (s.timers.goat <= 0) {
        const free = this.map.filter(t => t.t !== 'sea' && !this.buildingAt(t.x, t.y));
        const t = free[Math.floor(Math.random() * free.length)];
        if (t) { this.goat = { x: t.x, y: t.y, ttl: 14 }; changed = true; }
        s.timers.goat = fx.goats ? rand(35, 80) : rand(60, 140);
      }
    }
    if (s.epoch >= 1 && !s.finished) {
      if (s.timers.raid == null) s.timers.raid = rand(900, 1500);
      s.timers.raid -= dt;
      if (s.timers.raid <= 0) { s.timers.raid = rand(900, 1500); this.raid(); }
    }
    return changed;
  },

  /** Коза приносит одно из двух: 4 минуты производства случайного ресурса или 1 минуту всех сразу. */
  catchGoat() {
    if (!this.goat) return null;
    const s = this.state, fx = this.fx || this.effects(), cap = this.storageCap(fx);
    const avail = RES_KEYS.filter(k => (this.rates[k] || 0) > 0 || ['food', 'wood', 'stone'].includes(k));
    const mult = fx.goats ? 1.6 : 1, minBase = 20 * (1 + s.epoch);
    const give = (k, sec, min) => {
      const g = Math.floor(Math.min(cap - s.res[k], Math.max(min, Math.max(0, this.rates[k] || 0) * sec) * mult));
      if (g > 0) s.res[k] += g;
      return g > 0 ? `${RES[k].icon} +${g}` : '';
    };
    let parts;
    if (Math.random() < 0.5) {
      const k = avail[Math.floor(Math.random() * avail.length)];
      parts = [give(k, 240, minBase * 3)];
    } else {
      parts = avail.map(k => give(k, 60, ['food', 'wood', 'stone'].includes(k) ? minBase : 0));
    }
    const gained = parts.filter(Boolean).join(' ') || 'склады полны';
    s.stats.goats++;
    const pos = this.goat;
    this.goat = null;
    const line = GOAT_LINES[Math.floor(Math.random() * GOAT_LINES.length)];
    this.log(`🐐 ${line} ${gained}`);
    return { x: pos.x, y: pos.y, gained, line };
  },

  raid() {
    const s = this.state, fx = this.fx || this.effects();
    if (fx.raidShield) {
      const bonus = 60;
      s.res.copper = Math.min(this.storageCap(fx), s.res.copper + bonus);
      this.log(`🧱 Циклопические стены отразили набег «народов моря»! Трофеи: +${bonus} 🟠`);
      if (typeof UI !== 'undefined') UI.toast('🧱 Стены отразили набег «народов моря»!');
      return;
    }
    const lost = [];
    for (const k of RES_KEYS) {
      const d = Math.floor(s.res[k] * 0.15);
      if (d > 0) { s.res[k] -= d; lost.push(`${RES[k].icon} −${d}`); }
    }
    this.log(`⚔️ Набег «народов моря»! Потеряно: ${lost.join(' ')}`);
    if (typeof UI !== 'undefined') UI.toast(`⚔️ Набег «народов моря»! Разграблено 15% запасов. Защитят только Циклопические стены.`);
  },

  /**
   * Прогресс за время отсутствия: первые 5 минут — в полную силу,
   * дальше — вполовину (до 8 часов). Всё упирается в склады.
   */
  catchUp() {
    const away = (Date.now() - (this.state.lastSave || Date.now())) / 1000;
    if (away < 20) return null;
    const capped = Math.min(BALANCE.offlineMaxHours * 3600, away);
    const full = Math.min(BALANCE.offlineFullSec, capped);
    const half = Math.max(0, capped - full) * 0.5;
    const before = { ...this.state.res }, popBefore = this.state.pop;
    const sim = full + half, step = 5;
    for (let t = 0; t < sim; t += step) this.tick(Math.min(step, sim - t));
    const gained = {};
    for (const k of RES_KEYS) { const d = Math.floor(this.state.res[k] - before[k]); if (d > 0) gained[k] = d; }
    this.state.lastSave = Date.now();
    return { seconds: away, gained, pop: this.state.pop - popBefore, halved: away > BALANCE.offlineFullSec };
  },
};
