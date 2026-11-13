'use strict';
// ============================================================
//  Определения мира — только числа и связи: ресурсы, карта, эпохи, здания, знания, обряды.
//  Названия, описания и истории — в content/ru/lexicon.js, рисунки — в assets/ и ui/common/looks.js.
//  Всё, что касается баланса, — здесь и в BALANCE.
// ============================================================

const BALANCE = {
  baseStorage: 300,        // вместимость склада без построек
  foodPerPop: 0.05,        // зерна в секунду на жителя
  growthTime: 6,           // секунд на нового жителя
  baseCap: 2,              // мест без домов
  buildCostGrowth: 1.25,   // каждое следующее здание того же типа дороже
  upCostBase: 1.5,         // цена улучшения 1→2 = цена постройки × 1.5
  upCostGrowth: 1.5,       // каждое следующее улучшение дороже в 1.5 раза
  // Лесенка уровней (предел — 5 в медно-каменном веке, 9 в бронзовом). «Уровни труда» (2, 4, 6, 8) — за ресурсы, выпуск ×1.15.
  // «Уровни мудрости» — только за λ: 3-й и 7-й символические (выпуск ×1.25), 5-й и 9-й полноценные (×1.4, цена — lp здания).
  levelGrowth: 1.15,
  wisdomLevels: {
    3: { logos: 3, growth: 1.25 },
    5: { lp: 1, growth: 1.4 },
    7: { logos: 9, growth: 1.25 },
    9: { lp: 3, growth: 1.4 },
    11: { lp: 6, growth: 1.4 },   // вдвое дороже 9-го
  },
  copperFromLevel: 6,      // с 6-го уровня (первого в бронзовом веке) улучшения требуют медь
  bronzeFromLevel: 8,      // с 8-го — бронзу…
  ironFromLevel: 10,       // …а с 10-го (железный век) вместо бронзы — железо
  storeGrowth: { 10: 1.3, 11: 1.6 },   // склады на 10-м и 11-м растут резче обычного (×1.15 и ×1.4) — под цены переходов
  offlineMaxHours: 8,
  offlineFullSec: 300,      // первые 5 минут отсутствия — полная скорость, дальше — половина
  maxBuffMinutes: 30, maxBuffs: 5,      // благословения продлеваются, но не дольше
  suppliesSec: 180,
  raidEvery: [300, 1800],  // набег «народов моря»: через 5–30 минут игры (срок известен заранее — таймер)
  raidLoot: [0.1, 0.5],    //   уносят 10–50% всех запасов (без Циклопических стен)        // «Сбор припасов»: столько секунд выпуска (без благословений)
  laborPerLogos: 8,        // путь «трудом»: каждый λ цены заменяется 8 единицами ресурсов
  laborTechMult: 3,        //   и ресурсная часть цены знания ×3
  laborSpecialMult: 2,     //   спецстроения ×2
};

const RES = {
  food: { epoch: 0 },
  wood: { epoch: 0 },
  stone: { epoch: 0 },
  cheese: { epoch: 0, tech: 'cheesemaking' },
  goods: { epoch: 0, tech: 'carving' },
  copper: { epoch: 1 },
  bronze: { epoch: 1 },
  iron: { epoch: 2, tech: 'iron' },
};
const RES_KEYS = Object.keys(RES);

// gather — что даёт клик по клетке
const TERRAIN = {
  sea: {},
  plain: { gather: 'food' },
  forest: { gather: 'wood' },
  hill: { gather: 'stone' },
};

// ~ море · . равнина · F лес · H холмы  (рамка всегда становится морем)
const MAP_ROWS = [
  '~~~~~~~~~~~~~~~~~~',
  '~~~~~.HHHHHH..~~~~',
  '~~~.FFF......FF.~~',
  '~~.FFHHF.........~',
  '~..FHHHHF....FF..~',
  '~..FHHHHF...FFF.~~',
  '~~..FHHF.........~',
  '~~~..FF......F..~~',
  '~~~~.........~~~~~',
  '~~~~~~...~~~~~~~~~',
  '~~~~~~~~~~~~~~~~~~',
];
const MAP_W = 18, MAP_H = MAP_ROWS.length;

// maxLevel — предел улучшения зданий; advance — условия перехода в следующую эпоху.
// Крупные траты λ разнесены по эпохе: в начале — первые знания и чудо, в середине — обязательное святилище
// (оно не ждёт поздних ресурсов), в конце — последнее знание; сам переход стоит немного λ, главное в нём — запасы.
const EPOCHS = [
  { maxLevel: 5, advance: { pop: 35, specials: ['shrine1'], allTechs: true, logos: 120, res: { stone: 3000, goods: 800, cheese: 400 } } },
  { maxLevel: 9, advance: { pop: 80, specials: ['shrine2', 'sp_palace'], allTechs: true, logos: 250, res: { copper: 3000, bronze: 800, goods: 2000 } } },
  { maxLevel: 11, advance: null },   // «Царства-города»: вторая половина эпохи и переход — в следующей версии
  { locked: true },
];

// ------------------------------------------------------------
//  Здания. prod — в секунду на 1-м уровне (минус — сырьё); рост по уровням — BALANCE.levelGrowth / wisdomLevels.
//  forms — облик по эпохам (null — в эту эпоху здания ещё нет); capBonus — доп. места в жилище.
//  lp — цена в λ 5-го уровня (уровня за Логос); 9-й — lp × 3. 3-й и 7-й — малые: одна цена для всех (3 и 9 λ).
//  special — чудо древнего Кипра: одно на игру, одна цена (logos — λ), effect — постоянный бонус.
//  retire — чудо эпохи: с эпохи retire.epoch оно становится обычным зданием into уровня level (бонус чуда пропадает).
// ------------------------------------------------------------
const BUILDINGS = {
  house: { terrain: ['plain'], epoch: 0, cost: { wood: 30, stone: 15 }, cap: 4, lp: 10, forms: [{}, { capBonus: 2 }] },
  field: { terrain: ['plain'], epoch: 0, cost: { wood: 25 }, workers: 2, prod: { food: 0.5 }, lp: 12, forms: [{}, {}] },
  goatpen: { terrain: ['hill', 'forest'], epoch: 0, cost: { wood: 25, food: 15 }, workers: 1, prod: { food: 0.2, cheese: 0.05 }, prodTech: { cheese: 'cheesemaking' }, lp: 12, forms: [{}, {}] },
  lumber: { terrain: ['forest'], epoch: 0, cost: { food: 25 }, workers: 2, prod: { wood: 0.35 }, lp: 12, forms: [{}, {}] },
  quarry: { terrain: ['hill'], epoch: 0, cost: { wood: 30 }, workers: 2, prod: { stone: 0.25 }, lp: 12, forms: [{}, {}] },
  workshop: { terrain: ['plain'], epoch: 0, tech: 'carving', cost: { wood: 60, stone: 40 }, workers: 2, prod: { goods: 0.1 }, lp: 14, forms: [{}, {}] },
  storehouse: { terrain: ['plain'], epoch: 0, cost: { wood: 80, stone: 60 }, workers: 1, storage: 400, lp: 14, forms: [{}, {}] },
  mine: { terrain: ['hill'], epoch: 1, tech: 'smelting', cost: { wood: 200, stone: 150 }, workers: 3, prod: { copper: 0.15 }, lp: 14, forms: [null, {}] },
  port: { terrain: ['plain'], coast: true, epoch: 1, tech: 'seafaring', cost: { wood: 350, stone: 200 }, workers: 3, prod: { copper: -0.12, goods: 0.2, food: 0.35 }, lp: 14, forms: [null, {}] },
  foundry: { terrain: ['plain'], epoch: 1, tech: 'bronze', cost: { stone: 350, copper: 150 }, workers: 3, prod: { copper: -0.2, bronze: 0.06 }, lp: 14, forms: [null, {}] },
  forge: { terrain: ['plain'], epoch: 2, tech: 'iron', cost: { stone: 350, copper: 150 }, workers: 3, prod: { wood: -0.5, iron: 0.06 }, lp: 16, forms: [null, null, {}] },
  scribe: { terrain: ['plain'], epoch: 1, tech: 'writing', max: 2, cost: { wood: 250, stone: 250, goods: 150 }, workers: 1, logosBonus: 0.08, logosBonusPerLevel: 0.02, lp: 14, forms: [null, {}] },

  // ---------------- Чудеса древнего Кипра ----------------
  sp_lemba: { special: true, epoch: 0, terrain: ['plain'], cost: { wood: 300, stone: 200 }, logos: 90, effect: { all: 0.15, cap: 5 }, retire: { epoch: 1, into: 'house', level: 5 } },
  sp_troodos: { special: true, epoch: 0, terrain: ['hill'], cost: { food: 1500, wood: 900 }, logos: 0, effect: { bmult: { goatpen: 0.6 }, goats: true } },
  sp_souskiou: { special: true, epoch: 0, terrain: ['plain'], tech: 'carving', cost: { stone: 200, goods: 60 }, logos: 60, effect: { bmult: { workshop: 1.5 } }, retire: { epoch: 1, into: 'workshop', level: 5 } },
  shrine1: { special: true, epoch: 0, terrain: ['plain'], cost: { stone: 300, goods: 80 }, logos: 180, effect: { mult: { food: 0.2 }, growth: 0.5, logos: 0.1 } },
  sp_halasultan: { special: true, epoch: 1, terrain: ['plain'], coast: true, tech: 'seafaring', cost: { wood: 4000, stone: 2000, copper: 900 }, logos: 0, effect: { bmult: { port: 0.6 }, mult: { food: 0.1 } }, retire: { epoch: 2, into: 'port', level: 9 } },
  sp_ingot: { special: true, epoch: 1, terrain: ['plain'], tech: 'smelting', cost: { stone: 400, copper: 200, goods: 150 }, logos: 150, effect: { mult: { copper: 1 }, bmult: { foundry: 0.5 } }, retire: { epoch: 2, into: 'foundry', level: 9 } },
  sp_walls: { special: true, epoch: 1, terrain: ['plain'], cost: { stone: 6000, wood: 1500 }, logos: 0, effect: { raidShield: true, storagePct: 0.5 } },
  sp_palace: { special: true, epoch: 1, terrain: ['plain'], cost: { stone: 800, wood: 500, goods: 150 }, logos: 350, effect: { all: 0.15, storage: 2000 } },
  shrine2: { special: true, epoch: 1, terrain: ['plain'], cost: { stone: 600, copper: 200, goods: 200 }, logos: 450, effect: { logos: 0.2, all: 0.1 } },
};

// Знания: λ + ресурсы (путь «с умом») или только ресурсы (путь «через силу»). effect — постоянный бонус.
const TECHS = [
  { id: 'cheesemaking', epoch: 0, logos: 30, cost: { food: 150 } },
  { id: 'carving', epoch: 0, logos: 40, cost: { stone: 150 } },
  { id: 'granary', epoch: 0, logos: 50, cost: { wood: 400 }, effect: { mult: { food: 0.25 }, storage: 150 } },
  { id: 'foundations', epoch: 0, logos: 60, cost: { stone: 500 }, effect: { houseCap: 1 } },
  { id: 'redwhite', epoch: 0, logos: 80, cost: { goods: 120, wood: 300 }, req: ['carving'], effect: { bmult: { workshop: 0.3 } } },
  { id: 'nativecopper', epoch: 0, logos: 150, cost: { stone: 600, goods: 150 }, req: ['redwhite'], effect: { mult: { wood: 0.2, stone: 0.2 } } },
  { id: 'smelting', epoch: 1, logos: 100, cost: { wood: 900 } },
  { id: 'seafaring', epoch: 1, logos: 130, cost: { wood: 1200 } },
  { id: 'ashlar', epoch: 1, logos: 120, cost: { stone: 1200 }, effect: { houseCap: 2, storagePct: 0.2 } },
  { id: 'bronze', epoch: 1, logos: 160, cost: { copper: 450 }, req: ['smelting', 'seafaring'] },
  { id: 'oxhide', epoch: 1, logos: 200, cost: { copper: 600 }, req: ['seafaring', 'smelting'], effect: { bmult: { port: 0.5 } } },
  { id: 'bronzetools', epoch: 1, logos: 200, cost: { bronze: 150 }, req: ['bronze'], effect: { mult: { food: 0.25, wood: 0.25, stone: 0.25 } } },
  { id: 'writing', epoch: 1, logos: 160, cost: { goods: 450 } },
  // Царства-города. retire — перемены: запасы уходящего ресурса переходят в новый (rate — по ценнику труда),
  // здания, которые его делали, устаревают — их можно перестроить в новые (уровень сохраняется) или продать (λ уровней возвращается).
  { id: 'iron', epoch: 2, logos: 200, cost: { copper: 1500 }, retire: { res: { bronze: { into: 'iron', rate: 1 } }, buildings: { foundry: 'forge' } } },
];
const TECH_BY_ID = Object.fromEntries(TECHS.map(t => [t.id, t]));

// Обряды. «Сбор припасов» — быстро и на всё, поэтому дороже; благословения — дольше (10–30 минут), но на свои ресурсы.
// Цены сверены по ценнику труда (README, «Ценник ресурсов»): благословение даёт на 1 λ примерно в 1.2–1.6 раза больше «Сбора».
// λ-благословения святилищ — «золотой час»: 15 минут, потом перерыв в настоящих часах (realTime — по часам, а не по игровому времени).
// instant — мгновенный эффект, buff/dur — благословение на время (сек), cooldown — перерыв (сек), req — нужное чудо.
const RITUALS = [
  { id: 'elders', epoch: 0, logos: 8, instant: 'elders', cooldown: 120 },
  { id: 'settlers', epoch: 0, logos: 15, buff: { workers: 1 }, dur: 1800 },
  { id: 'harvest', epoch: 0, logos: 12, cost: { food: 20 }, buff: { mult: { food: 1 } }, dur: 600 },
  { id: 'hearth', epoch: 0, logos: 12, buff: { mult: { wood: 1, stone: 1 } }, dur: 600 },
  { id: 'herds', epoch: 0, logos: 5, cost: { food: 30 }, buff: { bmult: { goatpen: 1 } }, dur: 600, goat: true, cooldown: 60 },
  { id: 'festival', epoch: 0, logos: 40, cost: { cheese: 80, goods: 60 }, req: 'shrine1', buff: { all: 1, growth: 2 }, dur: 1200 },
  { id: 'vigil', epoch: 0, logos: 0, cost: { cheese: 100, goods: 80, food: 150 }, req: 'shrine1', buff: { logos: 0.5 }, dur: 900, cooldown: 4 * 3600, realTime: true },
  { id: 'bullmask', epoch: 1, logos: 15, cost: { goods: 100 }, buff: { mult: { copper: 1, bronze: 1 } }, dur: 600 },
  { id: 'ingot', epoch: 1, logos: 25, cost: { copper: 150 }, req: 'sp_ingot', buff: { bmult: { port: 1, foundry: 1 } }, dur: 1200 },
  { id: 'hornedfeast', epoch: 1, logos: 0, cost: { copper: 100, goods: 200, cheese: 150 }, req: 'shrine2', buff: { logos: 0.75 }, dur: 900, cooldown: 8 * 3600, realTime: true },
];
const RITUAL_BY_ID = Object.fromEntries(RITUALS.map(r => [r.id, r]));
