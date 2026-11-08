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
  upProdGrowth: 1.2,       // а выпуск растёт лишь в 1.2 раза за уровень (сложный процент)
  logosFromLevel: 4,       // λ нужен на 4-м уровне и дальше через один: 4, 6, 8, 10
  logosEvery: 2,
  logosGrowth: 1.5,        // каждый следующий «λ-уровень» дороже в 1.5 раза
  logosHighLevel: 7,       // начиная с 8-го λ ещё ×2
  logosHighMult: 2,
  copperFromLevel: 7,      // с 7-го уровня улучшения требуют медь
  bronzeFromLevel: 9,      // с 9-го — бронзу
  offlineMaxHours: 8,
  offlineFullSec: 300,      // первые 5 минут отсутствия — полная скорость, дальше — половина
  maxBuffMinutes: 30, maxBuffs: 5,      // благословения продлеваются, но не дольше
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

// maxLevel — предел улучшения зданий; advance — условия перехода в следующую эпоху
const EPOCHS = [
  { maxLevel: 6, advance: { pop: 35, specials: ['shrine1'], allTechs: true, logos: 250, res: { stone: 3000, goods: 800, cheese: 400 } } },
  { maxLevel: 10, advance: { pop: 80, specials: ['shrine2', 'sp_palace'], allTechs: true, logos: 600, res: { copper: 3000, bronze: 800, goods: 2000 } } },
  { locked: true },
];

// ------------------------------------------------------------
//  Здания. prod — в секунду на 1-м уровне (минус — сырьё); каждый уровень ×1.2.
//  forms — облик по эпохам (null — в эту эпоху здания ещё нет); capBonus — доп. места в жилище.
//  lp — базовая цена в λ для «λ-уровней» (4, 6, 8, 10).
//  special — чудо древнего Кипра: одно на игру, одна цена (logos — λ), effect — постоянный бонус.
// ------------------------------------------------------------
const BUILDINGS = {
  house: { terrain: ['plain'], epoch: 0, cost: { wood: 30, stone: 15 }, cap: 4, lp: 12, forms: [{}, { capBonus: 2 }] },
  field: { terrain: ['plain'], epoch: 0, cost: { wood: 25 }, workers: 2, prod: { food: 0.5 }, lp: 15, forms: [{}, {}] },
  goatpen: { terrain: ['hill', 'forest'], epoch: 0, cost: { wood: 25, food: 15 }, workers: 1, prod: { food: 0.2, cheese: 0.05 }, prodTech: { cheese: 'cheesemaking' }, lp: 15, forms: [{}, {}] },
  lumber: { terrain: ['forest'], epoch: 0, cost: { food: 25 }, workers: 2, prod: { wood: 0.35 }, lp: 15, forms: [{}, {}] },
  quarry: { terrain: ['hill'], epoch: 0, cost: { wood: 30 }, workers: 2, prod: { stone: 0.25 }, lp: 15, forms: [{}, {}] },
  workshop: { terrain: ['plain'], epoch: 0, tech: 'carving', cost: { wood: 60, stone: 40 }, workers: 2, prod: { goods: 0.1 }, lp: 18, forms: [{}, {}] },
  storehouse: { terrain: ['plain'], epoch: 0, cost: { wood: 80, stone: 60 }, workers: 1, storage: 400, lp: 18, forms: [{}, {}] },
  mine: { terrain: ['hill'], epoch: 1, tech: 'smelting', cost: { wood: 200, stone: 150 }, workers: 3, prod: { copper: 0.15 }, lp: 30, forms: [null, {}] },
  port: { terrain: ['plain'], coast: true, epoch: 1, tech: 'seafaring', cost: { wood: 350, stone: 200 }, workers: 3, prod: { copper: -0.12, goods: 0.16, food: 0.32 }, lp: 30, forms: [null, {}] },
  foundry: { terrain: ['plain'], epoch: 1, tech: 'bronze', cost: { stone: 350, copper: 150 }, workers: 3, prod: { copper: -0.2, bronze: 0.06 }, lp: 30, forms: [null, {}] },
  scribe: { terrain: ['plain'], epoch: 1, tech: 'writing', max: 2, cost: { wood: 250, stone: 250, goods: 150 }, workers: 1, logosBonus: 0.08, logosBonusPerLevel: 0.02, lp: 35, forms: [null, {}] },

  // ---------------- Чудеса древнего Кипра ----------------
  sp_lemba: { special: true, epoch: 0, terrain: ['plain'], cost: { wood: 300, stone: 200 }, logos: 120, effect: { all: 0.1, cap: 5 } },
  sp_troodos: { special: true, epoch: 0, terrain: ['hill'], cost: { food: 1500, wood: 900 }, logos: 0, effect: { bmult: { goatpen: 0.6 }, goats: true } },
  sp_souskiou: { special: true, epoch: 0, terrain: ['plain'], tech: 'carving', cost: { stone: 200, goods: 60 }, logos: 140, effect: { bmult: { workshop: 0.5 } } },
  shrine1: { special: true, epoch: 0, terrain: ['plain'], cost: { stone: 300, goods: 100, cheese: 60 }, logos: 180, effect: { mult: { food: 0.2 }, growth: 0.5, logos: 0.1 } },
  sp_halasultan: { special: true, epoch: 1, terrain: ['plain'], coast: true, tech: 'seafaring', cost: { wood: 4000, stone: 2000, copper: 900 }, logos: 0, effect: { bmult: { port: 0.6 }, mult: { food: 0.1 } } },
  sp_ingot: { special: true, epoch: 1, terrain: ['plain'], tech: 'smelting', cost: { stone: 400, copper: 200, goods: 150 }, logos: 300, effect: { mult: { copper: 0.5 }, bmult: { foundry: 0.3 } } },
  sp_walls: { special: true, epoch: 1, terrain: ['plain'], cost: { stone: 6000, wood: 1500 }, logos: 0, effect: { raidShield: true, storagePct: 0.2 } },
  sp_palace: { special: true, epoch: 1, terrain: ['plain'], cost: { stone: 800, wood: 500, copper: 150 }, logos: 350, effect: { all: 0.15, storage: 2000 } },
  shrine2: { special: true, epoch: 1, terrain: ['plain'], cost: { stone: 600, bronze: 80, goods: 200 }, logos: 450, effect: { logos: 0.2, all: 0.1 } },
};

// Знания: λ + ресурсы (путь «с умом») или только ресурсы (путь «через силу»). effect — постоянный бонус.
const TECHS = [
  { id: 'cheesemaking', epoch: 0, logos: 30, cost: { food: 150 } },
  { id: 'carving', epoch: 0, logos: 40, cost: { stone: 150 } },
  { id: 'granary', epoch: 0, logos: 50, cost: { wood: 400 }, effect: { mult: { food: 0.25 }, storage: 150 } },
  { id: 'foundations', epoch: 0, logos: 60, cost: { stone: 500 }, effect: { houseCap: 1 } },
  { id: 'redwhite', epoch: 0, logos: 80, cost: { goods: 120, wood: 300 }, req: ['carving'], effect: { bmult: { workshop: 0.3 } } },
  { id: 'nativecopper', epoch: 0, logos: 100, cost: { stone: 600, goods: 150 }, req: ['carving'], effect: { mult: { wood: 0.2, stone: 0.2 } } },
  { id: 'smelting', epoch: 1, logos: 100, cost: { wood: 900 } },
  { id: 'seafaring', epoch: 1, logos: 130, cost: { wood: 1200 } },
  { id: 'ashlar', epoch: 1, logos: 120, cost: { stone: 1200 }, effect: { houseCap: 2, storagePct: 0.2 } },
  { id: 'bronze', epoch: 1, logos: 160, cost: { copper: 450 }, req: ['smelting', 'seafaring'] },
  { id: 'oxhide', epoch: 1, logos: 200, cost: { copper: 600 }, req: ['seafaring', 'smelting'], effect: { bmult: { port: 0.5 } } },
  { id: 'bronzetools', epoch: 1, logos: 200, cost: { bronze: 150 }, req: ['bronze'], effect: { mult: { food: 0.25, wood: 0.25, stone: 0.25 } } },
  { id: 'writing', epoch: 1, logos: 160, cost: { goods: 450 } },
];
const TECH_BY_ID = Object.fromEntries(TECHS.map(t => [t.id, t]));

// Обряды: instant — мгновенный эффект, buff/dur — благословение на время (сек), cooldown — перерыв (сек), req — нужное чудо.
const RITUALS = [
  { id: 'elders', epoch: 0, logos: 5, instant: 'elders', cooldown: 60 },
  { id: 'settlers', epoch: 0, logos: 15, buff: { workers: 1 }, dur: 900 },
  { id: 'harvest', epoch: 0, logos: 12, cost: { food: 20 }, buff: { mult: { food: 1 } }, dur: 300 },
  { id: 'hearth', epoch: 0, logos: 12, buff: { mult: { wood: 1, stone: 1 } }, dur: 300 },
  { id: 'herds', epoch: 0, logos: 10, cost: { food: 30 }, buff: { bmult: { goatpen: 1 } }, dur: 300, goat: true, cooldown: 60 },
  { id: 'festival', epoch: 0, logos: 40, cost: { cheese: 80, goods: 60 }, req: 'shrine1', buff: { all: 1, growth: 2 }, dur: 600 },
  { id: 'vigil', epoch: 0, logos: 0, cost: { cheese: 100, goods: 80, food: 150 }, req: 'shrine1', buff: { logos: 0.5 }, dur: 900 },
  { id: 'bullmask', epoch: 1, logos: 30, cost: { goods: 100 }, buff: { mult: { copper: 1, bronze: 1 } }, dur: 300 },
  { id: 'ingot', epoch: 1, logos: 40, cost: { copper: 150 }, req: 'sp_ingot', buff: { bmult: { port: 1, foundry: 1 } }, dur: 600 },
  { id: 'hornedfeast', epoch: 1, logos: 0, cost: { bronze: 60, goods: 200, cheese: 150 }, req: 'shrine2', buff: { logos: 1 }, dur: 900 },
];
const RITUAL_BY_ID = Object.fromEntries(RITUALS.map(r => [r.id, r]));
