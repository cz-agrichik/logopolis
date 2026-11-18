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
    13: { lp: 9, growth: 1.4 },   // в полтора раза дороже 11-го (эллинский Кипр)
  },
  goodsFromLevel: 4,       // с 4-го уровня улучшения требуют товары (в железном веке — серебро по курсу)
  copperFromLevel: 6,      // с 6-го уровня (первого в бронзовом веке) — ещё и медь
  bronzeFromLevel: 8,      // с 8-го — бронзу…
  ironFromLevel: 10,       // …а с 10-го (железный век) вместо бронзы — железо
  coinFromLevel: 12,       // с 12-го (эллинский Кипр) — ещё и монеты: 60 × 1.5^(уровень − 12); сам уровень открывает знание coinTech
  coinTech: 'coinage',
  storeGrowth: { 10: 1.3, 11: 1.6, 12: 1.3, 13: 1.6 },   // склады на 10–13-м растут резче обычного (×1.15 и ×1.4) — под цены переходов
  offlineMaxHours: 8,
  offlineFullSec: 300,      // первые 5 минут отсутствия — полная скорость, дальше — половина
  maxBuffMinutes: 30, maxBuffs: 5,      // благословения продлеваются, но не дольше
  // беглые козы: следующая — через столько секунд (пока коза на карте, отсчёт стоит); ловить каждую — около +30% к выпуску,
  // с Троодосом (чаще и щедрее на 60%) — около +85%
  goatEvery: [102, 238], goatEveryFast: [60, 136],
  // Курс обрядов: 1 минута полного выпуска города стоит riteRate «настоящих» (медных) λ — по эпохам: 3 в меди и бронзе,
  // в царствах-городах — 3/1.3 (λ становится ценнее). logosInflation — сколько номинальных λ эпохи в одном медном
  // (λ с эпохами дешевеет: в бронзе — на треть, в царствах ×1.7, в эллинском ×2). Номинально выходит 3, 4, ≈3.9 и 3.6 λ за минуту:
  // в эллинском минута выпуска — 1.8 медных λ (×2 = 3.6 номинальных), при мощи ~190–220 зерна/с 1 λ ≈ 3200–3600 зерна.
  // По курсу стоит «Сбор припасов» (perMinute): минуты × 3 λ × инфляция = 3 × 3 = 9 λ в меди, 4 × 3 × 4/3 = 16 — в бронзе.
  // Остальные обряды без logosAt — пока старый костыль: цена ×1.5 за эпоху.
  riteRate: [3, 3, 3 / 1.3, 1.8],
  logosInflation: [1, 4 / 3, 1.7, 2],
  suppliesMin: [3, 4, 5, 6],   // «Сбор припасов»: столько минут выпуска зданий (на минуту больше с каждой эпохой)
  raidEvery: [300, 1800],  // набег «народов моря»: через 5–30 минут игры (срок известен заранее — таймер)
  raidLoot: [0.1, 0.5],    //   уносят 10–50% всех запасов (без Циклопических стен)        // «Сбор припасов»: столько секунд выпуска (без благословений)
  laborPerLogos: 8,        // путь «трудом»: каждый λ цены заменяется 8 единицами ресурсов
  laborTechMult: 3,        //   и ресурсная часть цены знания ×3 (от laborBase, если у знания она своя)
  laborSpecialMult: 2,     //   спецстроения ×2
  // путь «через силу» с эпохами жёстче: вся его цена ×1.7 в бронзе (пересмотрено: знания бронзы на 70% дороже),
  // ×1.5 в железном, ×2.25 в эллинском (их ещё пересмотрим; дальше — ещё больше)
  laborEpochMult: [1, 1.7, 1.5, 2.25],
  laborSilverPerLogos: 0.75,   // «купить у чужеземцев» (buy у знания): λ-часть пути «через силу» — серебром; по ценнику столько же, сколько 8 ед. камня/дерева/товаров
  // Дань в железном веке: Ассирия грабит (raidLoot); Египет берёт серебром столько, сколько в среднем унесли бы ассирийцы
  // (середина raidLoot от ценности остальных запасов, стены — вдвое), но без случайности; Персия — твёрдую сумму с присяги: persia серебра с жителя.
  tribute: { persia: 4 },
  // Ценник труда (README, «Ценник ресурсов»): сколько стоит единица ресурса в секундах работы, в пересчёте на зерно.
  // Персия берёт недоимку ровно по нему. Папирус — по своей «настоящей» цене: ships.price монет (50 × 25).
  worth: { food: 1, wood: 1.4, stone: 2, cheese: 1, goods: 5, copper: 5, bronze: 29, iron: 24, silver: 25, amphora: 3.3, papyrus: 1250 },
  // Корабли (эллинский Кипр, знание «Корабли в Пирей»): через every секунд после ухода прежнего в гавань приходит корабль
  // (время идёт и без игрока) и ждёт сколько угодно. Он просит один из пакетов (packs) и даёт за него give; give можно и купить за buy.
  // Сделок за стоянку — deals; после последней корабль отчаливает сам. Чудеса (effect.ships) улучшают: every — свой срок (берётся
  // меньший), deals — сделок больше (складываются), choice — из скольких грузов выбрать. Гавань Нового Пафоса: +2 сделки и выбор
  // из двух; Корабельные сараи Китиона: раз в 5 минут и +1 сделка.
  // Папирус не производится: его привозят только корабли. «Настоящая» цена листа — price монет (по ней считает балансер);
  // пакет — по курсу эллинского Кипра ≈ 400 монет (≈40 за лист, проверяет балансер), за монеты — 600 (60 за лист).
  ships: {
    every: 360, deals: 3, give: { papyrus: 10 }, buy: { silver: 600 }, price: 50,
    packs: [
      { id: 'grain', want: { food: 5000, amphora: 400 } },
      { id: 'wine', want: { amphora: 900, food: 1700 } },
      { id: 'iron', want: { iron: 200, food: 2500 } },
      { id: 'timber', want: { wood: 3000, amphora: 400 } },
      { id: 'stone', want: { stone: 2000, wood: 1600 } },
    ],
  },
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
  silver: { epoch: 2, tech: 'phoenicians' },   // 1 серебро = 5 ремёсел (мягкая деноминация)
  amphora: { epoch: 2, tech: 'viticulture' },  // амфоры: вино и масло
  papyrus: { epoch: 3, tech: 'piraeus', imported: true },   // папирус: не производится — привозят корабли
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
  { maxLevel: 5, advance: { pop: 50, specials: ['shrine1'], allTechs: true, logos: 120, res: { stone: 3000, goods: 800, cheese: 400 } } },
  { maxLevel: 9, advance: { pop: 100, specials: ['shrine2', 'sp_palace'], allTechs: true, logos: 200, res: { copper: 3000, bronze: 800, goods: 2000 } } },
  { maxLevel: 11, advance: { pop: 150, specials: ['sp_salamis', 'sp_aphrodite', 'sp_apollo'], allTechs: true, logos: 400, res: { silver: 2500, iron: 1500, stone: 10000 } } },
  { maxLevel: 13 },   // эллинский Кипр: первая треть — продолжение и переход дальше ещё не описаны
  { locked: true },
];

// ------------------------------------------------------------
//  Здания. prod — в секунду на 1-м уровне (минус — сырьё); рост по уровням — BALANCE.levelGrowth / wisdomLevels.
//  forms — облик по эпохам (null — в эту эпоху здания ещё нет); capBonus — доп. места в жилище.
//  Какой облик (и название) показывать на каком уровне, решает интерфейс (ui/common/looks.js): нижние уровни берут облик прошлых эпох.
//  lp — цена в λ 5-го уровня (уровня за Логос); 9-й — lp × 3. 3-й и 7-й — малые: одна цена для всех (3 и 9 λ).
//  Цена улучшений — от цены постройки. Рудник, гавань и литейня построены так, чтобы их улучшения окупались в 1.5 раза
//  (литейня — в 2 раза) дольше, чем у мастерской.
//  max — не больше стольких зданий ({ эпоха: число } — с этой эпохи); maxTech — больше после знания (дом писцов: один, после «Кипрского слогового письма» — два).
//  special — чудо древнего Кипра: одно на игру, одна цена (logos — λ), effect — постоянный бонус.
//  retire — чудо эпохи: с эпохи retire.epoch оно становится обычным зданием into уровня level (бонус чуда пропадает).
// ------------------------------------------------------------
const BUILDINGS = {
  house: { terrain: ['plain'], epoch: 0, cost: { wood: 30, stone: 15 }, cap: 4, lp: 10, forms: [{}, { capBonus: 2 }, { capBonus: 2 }, { capBonus: 2 }] },
  field: { terrain: ['plain'], epoch: 0, cost: { wood: 25 }, workers: 2, prod: { food: 0.5 }, lp: 12, forms: [{}, {}, {}, {}] },
  goatpen: { terrain: ['hill', 'forest'], epoch: 0, cost: { wood: 25, food: 15 }, workers: 1, prod: { food: 0.2, cheese: 0.05 }, prodTech: { cheese: 'cheesemaking' }, lp: 12, forms: [{}, {}] },
  // trade — линия «Железных топоров и кирок»: пока есть железо, +30% выпуска; орудия тупятся — железо понемногу уходит.
  // keep (у гавани) — сырьё уходит в торговлю только сверх этой доли склада: амфоры сначала копятся до половины, потом продаются
  lumber: { terrain: ['forest'], epoch: 0, cost: { food: 25 }, workers: 2, prod: { wood: 0.35 }, trade: { tech: 'irontools', in: { iron: 0.005 }, out: { wood: 0.105 } }, lp: 12, forms: [{}, {}, {}, {}] },
  quarry: { terrain: ['hill'], epoch: 0, cost: { wood: 30 }, workers: 2, prod: { stone: 0.25 }, trade: { tech: 'irontools', in: { iron: 0.005 }, out: { stone: 0.075 } }, lp: 12, forms: [{}, {}, {}, {}] },
  workshop: { terrain: ['plain'], epoch: 0, tech: 'carving', cost: { wood: 60, stone: 40 }, workers: 2, prod: { goods: 0.1 }, lp: 14, forms: [{}, {}, {}, {}] },
  storehouse: { terrain: ['plain'], epoch: 0, cost: { wood: 80, stone: 60 }, workers: 1, storage: 400, lp: 14, forms: [{}, {}, {}, {}] },
  mine: { terrain: ['hill'], epoch: 1, tech: 'smelting', cost: { wood: 110, stone: 80 }, workers: 3, prod: { copper: 0.15 }, lp: 14, forms: [null, {}, {}] },
  // гавань: работник даёт столько же чистой ценности, сколько в поле или мастерской (с «Кожаными слитками» +25%); товары — в основном мастерские
  // trade — вторая, необязательная линия: если есть амфоры, гавань продаёт их финикийцам за серебро (той же рабочей силой).
  //   sell — это продажа излишков, а не заработок: цена твёрдая — 0.35 серебра за амфору (≈ труд амфоры: по курсам балансера
  //   0.28 со склонами Троодоса, 0.42 без них), бонусы гавани и «Обряд торговли» растят объём (и амфоры, и серебро), а не цену.
  //   Поэтому вывоз можно держать широким: 0.2 амфоры/с на 1-м уровне × бонусы — гавани продают всё, что сверх полсклада.
  // inKeep — основная работа тоже вывоз излишка: медь гавань берёт, только пока её запас больше половины склада
  //   (и, как у всех переработчиков, только если купленному — товарам/серебру и зерну — есть место). Иначе гавань ждёт.
  port: { terrain: ['plain'], coast: true, epoch: 1, tech: 'seafaring', cost: { wood: 150, stone: 90 }, workers: 3, prod: { copper: -0.096, goods: 0.1, food: 0.525 }, inKeep: 0.5, trade: { tech: 'viticulture', in: { amphora: 0.2 }, out: { silver: 0.07 }, keep: 0.5, sell: true }, lp: 14, forms: [null, {}, {}, {}] },
  foundry: { terrain: ['plain'], epoch: 1, tech: 'bronze', cost: { stone: 100, copper: 40 }, workers: 3, prod: { copper: -0.2, bronze: 0.06 }, lp: 14, forms: [null, {}] },
  vineyard: { terrain: ['hill'], epoch: 2, tech: 'viticulture', cost: { wood: 120, stone: 80 }, workers: 1, prod: { food: 0.05, amphora: 0.06 }, lp: 12, forms: [null, null, {}, {}] },
  olivegrove: { terrain: ['forest'], epoch: 2, tech: 'viticulture', cost: { wood: 80, stone: 100 }, workers: 1, prod: { food: 0.12, amphora: 0.04 }, lp: 12, forms: [null, null, {}, {}] },
  forge: { terrain: ['plain'], epoch: 2, tech: 'iron', cost: { stone: 100, copper: 40 }, workers: 3, prod: { wood: -0.5, iron: 0.06 }, lp: 16, forms: [null, null, {}, {}] },
  // levelTech — уровни, для которых нужно знание (писцам 10-й и выше — кипрское слоговое письмо)
  // дом писцов: дерева и камня вчетверо меньше, вместо них товары (столько же в зерне) — улучшения просят товары, а потом серебро
  scribe: { terrain: ['plain'], epoch: 1, tech: 'writing', levelTech: { 10: 'syllabary', 12: 'alphabet' }, max: 1, maxTech: { syllabary: 2, alphabet: 3 }, cost: { wood: 60, stone: 60, goods: 270 }, workers: 1, logosBonus: 0.08, logosBonusPerLevel: 0.02, lp: 14, forms: [null, {}, {}, {}] },

  // ---------------- Чудеса древнего Кипра ----------------
  sp_lemba: { special: true, epoch: 0, terrain: ['plain'], cost: { wood: 300, stone: 200 }, logos: 40, effect: { all: 0.15, cap: 5 }, retire: { epoch: 1, into: 'house', level: 5 } },
  sp_troodos: { special: true, epoch: 0, terrain: ['hill'], cost: { food: 1500, wood: 900 }, logos: 0, effect: { bmult: { goatpen: 0.6 }, goats: true } },
  sp_souskiou: { special: true, epoch: 0, terrain: ['plain'], tech: 'carving', cost: { stone: 200, goods: 60 }, logos: 40, effect: { bmult: { workshop: 1 } }, retire: { epoch: 1, into: 'workshop', level: 5 } },
  shrine1: { special: true, epoch: 0, terrain: ['plain'], cost: { stone: 300, goods: 80 }, logos: 180, effect: { mult: { food: 0.2 }, growth: 0.5, logos: 0.1 } },
  // Чудеса бронзы по окупаемости (≈1.5 ч). Остаток после устаревания — проверка, что переход не обидный: Хала-Султан-Текке —
  // гавань 7-го уровня (≈27 тыс. зерна при цене 15 тыс.); Святилище Слиткового бога (70 λ + ресурсы, ~2 ч) — литейня 9-го, её продажа вернёт λ уровней
  sp_halasultan: { special: true, epoch: 1, terrain: ['plain'], coast: true, tech: 'seafaring', cost: { wood: 6000, stone: 3000, copper: 1350 }, logos: 0, effect: { bmult: { port: 0.9 }, mult: { food: 0.15 } }, retire: { epoch: 2, into: 'port', level: 7 } },
  sp_ingot: { special: true, epoch: 1, terrain: ['plain'], tech: 'smelting', cost: { stone: 800, copper: 400, goods: 250 }, logos: 70, effect: { mult: { copper: 1 }, bmult: { foundry: 0.5 } }, retire: { epoch: 2, into: 'foundry', level: 9 } },
  // retire.tech — чудо становится обычным зданием не с эпохой, а после знания: «Цистерны и бани Вуни» дают +50% складов всем,
  //   а стены становятся складом
  sp_walls: { special: true, epoch: 1, terrain: ['plain'], cost: { stone: 6000, wood: 1500 }, logos: 0, effect: { raidShield: true, storagePct: 0.5 }, retire: { tech: 'vounibaths', into: 'storehouse', level: 9 } },
  // обязательное бронзы: λ поменьше (дворец 260, святилище 330, переход 200) — реальные λ эпохи растут ровно, ~×2 к меди;
  // зато в обычных ресурсах эти чудеса весомые (+35 тыс. зерна к пути «ресурсами»)
  sp_palace: { special: true, epoch: 1, terrain: ['plain'], cost: { stone: 4000, wood: 3000, goods: 600 }, logos: 260, effect: { all: 0.15, storage: 2000 } },
  shrine2: { special: true, epoch: 1, terrain: ['plain'], cost: { stone: 4000, copper: 1200, goods: 800 }, logos: 330, effect: { logos: 0.2, all: 0.1 } },
  // Царства-города: upgradeOf — чудо не строится заново, а улучшает старое на том же месте
  // Ум или сила: Афродита и гробницы — за λ, Аполлон и Троодос — без λ, но очень дорого. tech — после какого знания можно.
  // Улучшение сохраняет λ-бонус старого чуда (богиня +10%, Рогатый бог +20%) и добавляет своё.
  // Обязательные чудеса царств: Саламин, Святилища Афродиты и Аполлона — весомые в обычных ресурсах (Саламину λ поменьше);
  // подношения Афродите и Саламину заданы в сыре — после «Виноградарства» он сам становится амфорами (2 : 1).
  // Серебра в чудесах царств нет: его забирает дань. Прежнее серебро пересчитано по тогдашней цене вывоза — ≈ 0.65 серебра
  // за амфору (0.3 и бонусы), т. е. 1 серебро ≈ 1.5 амфоры = 3 сыра; где амфор вышло бы больше полсклада — медь и дерево по ценнику.
  // С твёрдой ценой вывоза (0.35) эти чудеса по труду вышли на ~35–40% легче прежнего серебра
  sp_aphrodite: { special: true, epoch: 2, upgradeOf: 'shrine1', tech: 'phoenicians', terrain: ['plain'], cost: { stone: 6000, cheese: 9000, copper: 1500 }, logos: 600, effect: { mult: { food: 0.3 }, growth: 0.75, logos: 0.1 } },
  sp_apollo: { special: true, epoch: 2, upgradeOf: 'shrine2', tech: 'syllabary', terrain: ['plain'], cost: { stone: 10000, copper: 3000, iron: 1200 }, logos: 0, effect: { logos: 0.2, all: 0.15 } },
  // Виноградные склоны — в 3.5 раза дороже прежнего (окупаются ≈ 2 ч), в дорогих ресурсах, чтобы влезать в склад; серебро 600 → амфоры +1000
  sp_troodos2: { special: true, epoch: 2, upgradeOf: 'sp_troodos', tech: 'viticulture', terrain: ['hill'], cost: { food: 10000, wood: 6000, amphora: 4000 }, logos: 0, effect: { bmult: { vineyard: 0.6, olivegrove: 0.6 }, goats: true } },
  // новое чудо за λ — обязательное для перехода в следующую эпоху
  sp_salamis: { special: true, epoch: 2, tech: 'iron', terrain: ['plain'], cost: { stone: 10000, iron: 2500, cheese: 8000, wood: 10000, copper: 1500 }, logos: 450, effect: { all: 0.1, mult: { silver: 0.2 } } },
  // пятое чудо — новое, без λ: каменная ваза Амафунта (VI в. до н. э., 14 т, из одного камня) — склады +25%
  // Эллинский Кипр. ships — корабли (BALANCE.ships): deals — ещё сделок за стоянку, choice — из скольких грузов выбрать, every — свой срок
  sp_neapaphos: { special: true, epoch: 3, tech: 'piraeus', terrain: ['plain'], coast: true, cost: { stone: 16000, wood: 8000, silver: 800 }, logos: 0,
    effect: { bmult: { port: 0.25 }, ships: { deals: 2, choice: 2 } } },
  // Вторая треть. Дворец Вуни (V–IV вв. до н. э.) — улучшение Дворца правителя Аласии на том же месте; нужен для «Цистерн и бань Вуни»,
  //   а значит, и для перехода. Кладовые под пифосы и цистерны — склады +20%; дворцовое хозяйство — +25% ко всему (было +15%).
  sp_vouni: { special: true, epoch: 3, upgradeOf: 'sp_palace', tech: 'alphabet', terrain: ['plain'], cost: { stone: 20000, wood: 12000, iron: 3000, amphora: 8000 }, logos: 0,
    effect: { all: 0.25, storage: 2000, storagePct: 0.2 } },
  // Корабельные сараи Китиона (IV в. до н. э., военная гавань финикийских царей Китиона, для триер) — за λ: корабли раз в 5 минут и +1 сделка
  sp_kition: { special: true, epoch: 3, tech: 'piraeus', terrain: ['plain'], coast: true, cost: { stone: 8000, wood: 8000, iron: 600 }, logos: 120,
    effect: { ships: { every: 300, deals: 1 } } },
  sp_amathus: { special: true, epoch: 2, tech: 'irontools', terrain: ['hill', 'plain'], cost: { stone: 5000, iron: 200, silver: 120 }, logos: 0, effect: { storagePct: 0.25 } },
};

// Знания: λ + ресурсы (путь «с умом») или только ресурсы (путь «через силу»). effect — постоянный бонус.
// laborLogos — от скольких λ считается путь «через силу» (если не задано — от logos). В медно-каменном веке λ «с умом»
// пересчитаны по курсу обрядов (1 λ ≈ 120 зерна: оба пути стоят одинаково), а путь «через силу» оставлен прежним.
const TECHS = [
  { id: 'cheesemaking', epoch: 0, logos: 7, laborLogos: 30, cost: { food: 150 } },
  { id: 'carving', epoch: 0, logos: 12, laborLogos: 40, cost: { stone: 150 } },
  { id: 'granary', epoch: 0, logos: 18, laborLogos: 50, cost: { wood: 400 }, effect: { mult: { food: 0.25 }, storage: 150 } },
  { id: 'foundations', epoch: 0, logos: 28, laborLogos: 60, cost: { stone: 500 }, effect: { houseCap: 1 } },
  { id: 'redwhite', epoch: 0, logos: 30, laborLogos: 80, cost: { goods: 120, wood: 300 }, req: ['carving'], effect: { bmult: { workshop: 0.3 } } },
  { id: 'nativecopper', epoch: 0, logos: 60, laborLogos: 150, cost: { stone: 600, goods: 150 }, req: ['redwhite'], effect: { mult: { wood: 0.2, stone: 0.2 } } },
  // Бронзовый век: «через силу» на 70% дороже прежнего (laborEpochMult) и ещё ~25 тыс. зерна на знания (печи, уголь, тёсаный камень, рукояти),
  // λ «с умом» — по курсу обрядов (1 λ ≈ 400 зерна: оба пути стоят одинаково); λ-часть пути «через силу» считается от прежних цен (laborLogos).
  // Сыр — в припасы мореходов и в учёт писцов.
  { id: 'smelting', epoch: 1, logos: 35, laborLogos: 100, cost: { wood: 900, stone: 300 } },
  { id: 'seafaring', epoch: 1, logos: 35, laborLogos: 130, cost: { wood: 900, cheese: 200 } },
  { id: 'ashlar', epoch: 1, logos: 60, laborLogos: 120, cost: { stone: 1800 }, effect: { houseCap: 2, storagePct: 0.2 } },
  { id: 'bronze', epoch: 1, logos: 60, laborLogos: 160, cost: { copper: 450, wood: 600 }, req: ['smelting', 'seafaring'] },
  { id: 'oxhide', epoch: 1, logos: 70, laborLogos: 200, cost: { copper: 750 }, req: ['seafaring', 'smelting'], effect: { bmult: { port: 0.25 } } },
  { id: 'bronzetools', epoch: 1, logos: 85, laborLogos: 200, cost: { bronze: 150, wood: 500 }, req: ['bronze'], effect: { mult: { food: 0.25, wood: 0.25, stone: 0.25 } } },
  { id: 'writing', epoch: 1, logos: 50, laborLogos: 160, cost: { goods: 350, cheese: 200 } },
  // Царства-города. retire — перемены: цены со старым ресурсом пересчитываются в новый (rate — по ценнику труда),
  // запасы переходят в новый по курсу stock (по умолчанию = rate; 0 — запасы просто пропадают),
  // здания, которые его делали, устаревают — их можно перестроить в новые (уровень сохраняется) или продать (λ уровней возвращается).
  // Царства-города: «через силу» — закупка за рубежом (buy — что платят за каждый λ прежней цены laborLogos): до «Финикийцев» — медью
  // и товарами, после — серебром (товары в ценах сами становятся серебром); лес и камень — там, где к месту (печи, террасы, рукояти, корабли).
  // Путь «ресурсами» эпохи — ×2.7 к прежнему; λ «с умом» — по курсу обрядов (1 λ ≈ 1680 зерна: оба пути стоят одинаково). Железо — в печи, орудия, флот, чудеса.
  // «С умом» — не только λ: ресурсы этого пути (cost) ×1.5 к прежним, чтобы λ не решал всё сам; «через силу» — прежний: он считается
  //   от прежней ресурсной части (laborBase), а не от cost. λ по курсу чуть меньше.
  { id: 'iron', epoch: 2, logos: 55, laborLogos: 200, cost: { copper: 1800, wood: 3000, stone: 2250 }, laborBase: { copper: 1200, wood: 2000, stone: 1500 }, buy: { goods: 15, copper: 10 }, retire: { res: { bronze: { into: 'iron', rate: 1, stock: 0 } }, buildings: { foundry: 'forge' } } },   // бронзу в железо не перекуёшь: запасы пропадают
  { id: 'syllabary', epoch: 2, logos: 50, laborLogos: 200, cost: { goods: 1800, stone: 2250 }, laborBase: { goods: 1200, stone: 1500 }, buy: { goods: 15, copper: 10 } },   // второй дом писцов, писцам 10-й и 11-й уровни, Святилище Аполлона
  // финикийцы: товары уходят в серебро 5 : 1 — и запасы, и цены, и выпуск мастерских и гаваней (prodToo); серебро +50%
  { id: 'phoenicians', epoch: 2, logos: 70, laborLogos: 260, cost: { copper: 1950, goods: 1500 }, laborBase: { copper: 1300, goods: 1000 }, buy: { goods: 15, copper: 12 }, effect: { mult: { silver: 0.5 } }, retire: { res: { goods: { into: 'silver', rate: 0.2, prodToo: true } } } },
  // виноградарство: сыр уходит в амфоры, загоны на холмах — в виноградники, в лесу — в оливковые рощи
  { id: 'viticulture', epoch: 2, logos: 90, laborLogos: 240, cost: { food: 3000, wood: 3000, stone: 3750 }, laborBase: { food: 2000, wood: 2000, stone: 2500 }, buy: { goods: 70 }, req: ['phoenicians'], retire: { res: { cheese: { into: 'amphora', rate: 0.5 } }, buildings: { goatpen: { hill: 'vineyard', forest: 'olivegrove' } } } },
  // Вторая половина: серебро и железо.
  // Дань: «Дань фараону» — Египет вместо Ассирии (серебро с жителя), «Дары царю царей» — Персия (твёрдая сумма с присяги, fixTribute).
  { id: 'pharaoh', epoch: 2, logos: 110, laborLogos: 260, cost: { amphora: 2250, silver: 450, stone: 2250 }, laborBase: { amphora: 1500, silver: 300, stone: 1500 }, buy: { goods: 70 }, req: ['phoenicians'] },
  { id: 'irontools', epoch: 2, logos: 100, laborLogos: 240, cost: { iron: 750, wood: 4500 }, laborBase: { iron: 500, wood: 3000 }, buy: { goods: 70 }, req: ['iron', 'phoenicians'] },   // лесорубы и каменоломни: линия железо → +30%
  { id: 'doctors', epoch: 2, logos: 125, laborLogos: 280, cost: { silver: 600, amphora: 1800 }, laborBase: { silver: 400, amphora: 1200 }, buy: { goods: 80 }, req: ['phoenicians'], effect: { houseCap: 2, growth: 0.5 } },
  // reqWonder — чудо, без которого знание не изучить: флот снаряжают цари Саламина
  { id: 'fleet', epoch: 2, logos: 120, laborLogos: 280, cost: { wood: 4500, iron: 900 }, laborBase: { wood: 3000, iron: 600 }, buy: { goods: 70 }, req: ['pharaoh'], reqWonder: 'sp_salamis', effect: { tributeCut: 0.25 } },
  { id: 'gifts', epoch: 2, logos: 165, laborLogos: 320, cost: { silver: 750, amphora: 3000 }, laborBase: { silver: 500, amphora: 2000 }, buy: { goods: 90 }, req: ['pharaoh', 'fleet'], fixTribute: true },
  // Эллинский Кипр, первая треть. «С умом» — λ и уже заметные ресурсы: cost вчетверо больше прежнего (папирус — нет), чтобы λ не решал всё сам.
  // «Через силу» — прежний: прежняя ресурсная часть (laborBase) ×laborTechMult (3) × laborEpochMult (2.25) и закупка за рубежом
  // (buy — что платят за каждый λ прежней цены laborLogos). λ «с умом» по курсу — меньше прежнего.
  // Знания первой трети «через силу» — ≈1.2 млн зерна (балансер, TARGET: путь «ресурсами» эпохи — 7 млн, из них знания ≥5 млн);
  // λ «с умом» — по курсу обрядов: (через силу − с умом) ÷ зерна в 1 λ (≈3500).
  // coinage — «Серебряная монета»: серебро зовётся монетами, открыт 12-й уровень зданий (BALANCE.coinTech), монет +25%,
  //   гавань продаёт амфоры на 25% дороже.
  // coppercoin — «Медная монета»: медь уходит в монеты — запасы и цены 3 : 1, выпуск рудников вдвое хуже (rate 1/3 и рудники
  //   вполсилы — 6 : 1); рудники доживают (sunset): работают, но новых не строят, не улучшают, можно продать как устаревшие.
  //   Гавань больше не меняет медь на зерно и товары — только продаёт амфоры, ещё на 25% дороже (итого +50%). Монет ещё +25%.
  // piraeus: корабли и папирус (BALANCE.ships); alphabet: писцам открыты 12-й и 13-й уровни (levelTech у здания), их дом — гимнасий.
  //   «Через силу» алфавит — 120 папируса (три полных корабля по 4 сделки) и монеты, всего ≈300 тыс. зерна (папирус по 50 монет);
  //   λ «с умом» по курсу — 80: знание лёгкое, тяжесть — в самих кораблях.
  { id: 'coinage', epoch: 3, logos: 65, laborLogos: 300, cost: { silver: 1760, copper: 2800, iron: 400 }, laborBase: { silver: 440, copper: 700, iron: 100 }, buy: { silver: 12, copper: 6 }, effect: { mult: { silver: 0.25 }, trade: { port: 0.25 } } },
  { id: 'coppercoin', epoch: 3, logos: 70, laborLogos: 300, cost: { silver: 1200, copper: 6000, iron: 600 }, laborBase: { silver: 300, copper: 1500, iron: 150 }, buy: { silver: 13.5, copper: 4 }, req: ['coinage'],
    effect: { mult: { silver: 0.25 }, trade: { port: 0.25 }, scale: { mine: 0.5 } },
    retire: { res: { copper: { into: 'silver', rate: 1 / 3, prodToo: true } }, sunset: ['mine'] } },
  { id: 'piraeus', epoch: 3, logos: 80, laborLogos: 320, cost: { food: 12000, wood: 10000, amphora: 2400 }, laborBase: { food: 3000, wood: 2500, amphora: 600 }, buy: { silver: 17.5, amphora: 3 }, req: ['coinage'] },
  { id: 'alphabet', epoch: 3, logos: 80, laborLogos: 340, cost: { papyrus: 10, silver: 800 }, laborBase: { papyrus: 10, silver: 200 }, buy: { silver: 13, papyrus: 0.029 }, req: ['piraeus'] },
  // Эллинский Кипр, вторая треть (≈410–323 до н. э.): «через силу» ≈1.7 млн зерна, ресурсы «с умом» ≈250 тыс.; 1 λ — по курсу начала эпохи
  //   (≈3500 зерна, внутри эпохи не пересчитывается). Папирус — там, где к месту (тексты пьес, письма Александру): дорогой лист
  //   собирает цену в немного единиц. Три знания улучшают медно-каменные обряды (rite: tech / untilTech).
  // symposion — «Симпосий»: виноградники +30%; «Обряд урожая» → «Фалисии»
  { id: 'symposion', epoch: 3, logos: 75, laborLogos: 300, cost: { amphora: 2800, wood: 6000, silver: 750 }, laborBase: { amphora: 600, wood: 1500, silver: 200 }, buy: { silver: 17, amphora: 3 }, req: ['alphabet'],
    effect: { bmult: { vineyard: 0.3 } } },
  // kitionsword — «Меч царя Китиона»: кузницы +30%
  { id: 'kitionsword', epoch: 3, logos: 80, laborLogos: 320, cost: { iron: 1000, wood: 5000, silver: 800 }, laborBase: { iron: 225, wood: 1000, silver: 200 }, buy: { silver: 17, iron: 1 }, req: ['alphabet'],
    effect: { bmult: { forge: 0.3 } } },
  // vounibaths — «Цистерны и бани Вуни» (нужен Дворец Вуни): жители прибывают на 50% быстрее, склады +50% (вместо Циклопических стен —
  //   они становятся складом), «Обряд труда» → «Халкеи»
  { id: 'vounibaths', epoch: 3, logos: 85, laborLogos: 340, cost: { stone: 8000, wood: 6000, silver: 1100 }, laborBase: { stone: 2000, wood: 1500, silver: 275 }, buy: { silver: 17.5 }, req: ['alphabet'], reqWonder: 'sp_vouni',
    effect: { growth: 0.5, storagePct: 0.5 } },
  // choregia — «Хорегия»: «Праздник плодородия» → «Афродисии»
  { id: 'choregia', epoch: 3, logos: 90, laborLogos: 360, cost: { amphora: 2500, silver: 1100, papyrus: 20 }, laborBase: { amphora: 625, silver: 250, papyrus: 5 }, buy: { silver: 16, papyrus: 0.032 }, req: ['symposion'] },
  // alexander — «Поддержка Александра»: дани больше нет
  { id: 'alexander', epoch: 3, logos: 90, laborLogos: 380, cost: { food: 12000, iron: 800, silver: 1150, papyrus: 10 }, laborBase: { food: 3000, iron: 200, silver: 240 }, buy: { silver: 13, papyrus: 0.105 }, req: ['choregia', 'kitionsword'],
    effect: { noTribute: true } },
];
const TECH_BY_ID = Object.fromEntries(TECHS.map(t => [t.id, t]));

// Обряды. Курс обрядов (ориентир, tools/balance — раздел 9): 3 λ = 1 минута выпуска города на начало эпохи
// (в медно-каменном веке — от трети выпуска конца эпохи). «Сбор припасов» — ровно по курсу: 9 λ за 3 минуты.
// Благословения переводятся на этот курс по очереди: на один ресурс, зато дольше (10–30 минут) — цена = сколько минут выпуска они дают.
// λ-благословения святилищ — «золотой час»: 15 минут, потом перерыв в настоящих часах (realTime — по часам, а не по игровому времени).
// instant — мгновенный эффект, buff/dur — благословение на время (сек), cooldown — перерыв (сек), req — нужное чудо.
// logosAt — своя цена в λ по эпохам (по курсу обрядов); где не задана — старое правило ×1.5 за эпоху.
// Эллинский Кипр (≈3.6 λ за минуту, 1 λ ≈ 3500 зерна): пока цены царств — по курсу урожай и виноград дешевле, торговля дороже.
const RITUALS = [
  { id: 'elders', epoch: 0, logos: 9, perMinute: true, instant: 'elders', cooldown: 120 },
  // fixedPrice — цена в λ не растёт с эпохами; durPerEpoch — с каждой эпохой обряд длится дольше (30, 35, 40, 45 минут)
  { id: 'settlers', epoch: 0, logos: 15, buff: { workers: 1 }, dur: 1800, fixedPrice: true, durPerEpoch: 300 },
  // «Обряд урожая» (зерно ×2) появляется после «Виноградарства», когда загоны уходят, а с ними и «Благословение полей и стад»
  { id: 'harvest', epoch: 0, logos: 12, logosAt: { 2: 12, 3: 12 }, cost: { food: 20 }, tech: 'viticulture', untilTech: 'symposion', buff: { mult: { food: 1 } }, dur: 600 },
  // Царства-города (≈3.9 λ за минуту, 1 λ ≈ 1650 зерна): цены прежние — по курсу они худо-бедно годятся (труда и рудокопы чуть дороже, урожай — заметно).
  // Бронза (курс 4 λ за минуту, 1 λ ≈ 410 зерна): обряд труда и поля со стадами — по медным ценам (в курсе или чуть щедрее),
  // праздник — 50, рудокопы — 15 минут, торговля — гавани и мастерские (бронзу литеен удваивают только рудокопы).
  // по курсу обрядов: 10 минут дерева и камня ×2 — около 6 минут выпуска города (дерево и камень — главные траты эпохи)
  { id: 'hearth', epoch: 0, logos: 18, logosAt: { 1: 18, 2: 18, 3: 18 }, untilTech: 'vounibaths', buff: { mult: { wood: 1, stone: 1 } }, dur: 600 },
  // поля и загоны ×2 и беглая коза: по курсу около 14 λ, но зерно и сыр в основном лишние (≈8% трат эпохи) — половина благословения + коза
  { id: 'herds', epoch: 0, logos: 10, logosAt: { 1: 10, 2: 10 }, buff: { bmult: { field: 1, goatpen: 1 } }, dur: 600, goat: true, cooldown: 60, untilTech: 'viticulture' },
  { id: 'festival', epoch: 0, logos: 40, logosAt: { 1: 50, 2: 50, 3: 50 }, cost: { cheese: 80, goods: 60 }, req: 'shrine1', untilTech: 'choregia', buff: { all: 1, growth: 2 }, dur: 1200 },
  { id: 'vigil', epoch: 0, logos: 0, cost: { cheese: 100, goods: 80, food: 150 }, req: 'shrine1', buff: { logos: 0.5 }, dur: 900, cooldown: 4 * 3600, realTime: true, until: 'sp_aphrodite' },
  // рудокопы — по зданиям (рудники, литейни, кузницы), а не по ресурсам: после «Медной монеты» медь стала монетами,
  //   и «медь ×2» удвоило бы все монеты города
  { id: 'bullmask', epoch: 1, logos: 15, logosAt: { 2: 15, 3: 15 }, cost: { goods: 100 }, buff: { bmult: { mine: 1, foundry: 1, forge: 1 } }, dur: 900 },
  // reqUntil — с этой эпохи чудо обряду не нужно: Святилище Слиткового бога в железном веке становится литейней,
  //   а торговля — делом всего острова. Удваивает основную работу гаваней (серебро и зерно — без лишней меди) и мастерских;
  //   вывоз амфор под благословением вдвое шире, но по той же цене (вместе с амфорами) — это не прибыль.
  //   По курсу это 7 минут выпуска города всю эпоху (доля гаваней и мастерских ≈ 36%, зерно вполцены) = 28 λ; в бронзе — тоже
  //   ≈ 28 λ, но там обряд — подарок Святилища Слиткового бога (16 λ)
  { id: 'ingot', epoch: 1, logos: 16, logosAt: { 2: 28, 3: 28 }, cost: { copper: 150 }, req: 'sp_ingot', reqUntil: 2, buff: { bmult: { port: 1, workshop: 1 } }, dur: 1200 },
  { id: 'hornedfeast', epoch: 1, logos: 0, cost: { copper: 100, goods: 200, cheese: 150 }, req: 'shrine2', buff: { logos: 0.75 }, dur: 900, cooldown: 8 * 3600, realTime: true, until: 'sp_apollo' },
  // Царства-города. untilTech / until — обряд уходит после знания / улучшения святилища; tech — появляется после знания.
  { id: 'vintage', epoch: 2, logos: 12, logosAt: { 3: 12 }, cost: { food: 60 }, tech: 'viticulture', buff: { bmult: { vineyard: 1, olivegrove: 1 } }, dur: 600, goat: true, cooldown: 60 },
  // «золотые часы» святилищ: подношения заданы в старых ресурсах и сами пересчитываются, когда те уходят (сыр → амфоры, товары → серебро)
  { id: 'morningstar', epoch: 2, logos: 0, cost: { cheese: 300, goods: 350 }, req: 'sp_aphrodite', buff: { logos: 1 }, dur: 900, cooldown: 8 * 3600, realTime: true },
  { id: 'gnomon', epoch: 2, logos: 0, cost: { goods: 900, cheese: 450 }, req: 'sp_apollo', buff: { logos: 0.75 }, dur: 900, cooldown: 4 * 3600, realTime: true },
  // Эллинский Кипр, вторая треть: улучшенные медно-каменные обряды — сильнее и дольше (×3, а не ×2). Знание приносит новый обряд
  // и уносит старый (untilTech у старого). Цена — по курсу обрядов эпохи: 3.6 λ за каждую минуту выпуска города, которую обряд
  // прибавляет (зерно вполцены, вывоз амфор — не прибыль), по городу балансера в начале эпохи и в конце описанной части:
  // Фалисии ≈2 мин выпуска → 8 λ, Халкеи ≈10 мин → 35 λ, Афродисии ≈40 мин → 140 λ (втрое ценнее прежних обрядов по курсу).
  { id: 'thalysia', epoch: 3, logos: 8, cost: { food: 150, amphora: 30 }, tech: 'symposion', buff: { mult: { food: 2 } }, dur: 900 },
  { id: 'chalkeia', epoch: 3, logos: 35, cost: { iron: 20 }, tech: 'vounibaths', buff: { mult: { wood: 2, stone: 2 } }, dur: 900 },
  { id: 'aphrodisia', epoch: 3, logos: 140, cost: { amphora: 200, silver: 50 }, req: 'shrine1', tech: 'choregia', buff: { all: 2, growth: 3 }, dur: 1200 },
];
const RITUAL_BY_ID = Object.fromEntries(RITUALS.map(r => [r.id, r]));
