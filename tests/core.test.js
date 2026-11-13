'use strict';
// Тесты ядра без браузера: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadCore, memoryIO } = require('./load-core');

/** Ядро с новой игрой и новым обучением. */
function fresh(opts) {
  const C = loadCore(opts);
  C.run('Game.genMap(); Game.state = Game.newState(); Learn.state = Learn.newState(); Game.tick(0);');
  return C;
}

test('город: поля дают зерно, жители растут', () => {
  const C = fresh();
  const G = C.get('Game');
  const food0 = G.state.res.food;
  for (let i = 0; i < 60; i++) G.tick(1);
  assert.ok(G.state.pop > 2, 'пришли жители');
  assert.notEqual(G.state.res.food, food0);
});

test('обряды: благословения на один ресурс складываются (×2 и ×2 = ×3)', () => {
  const G = fresh().get('Game');
  const field = G.state.buildings.find(b => b.type === 'field') || (G.state.buildings.push({ id: 900, type: 'field', level: 1, x: 0, y: 0 }), G.state.buildings.at(-1));
  const base = G.prodOf(field, G.effects()).food;
  G.state.buffs = { harvest: 300, festival: 600 };
  assert.ok(Math.abs(G.prodOf(field, G.effects()).food - base * 3) < 1e-9);
});

test('обряды: «Сбор припасов» — 3 минуты выпуска без благословений, раз в 2 минуты', () => {
  const G = fresh().get('Game');
  const s = G.state;
  s.buildings.push({ id: 901, type: 'lumber', level: 3, x: 0, y: 0 });
  s.pop = 20; s.logos = 100; s.res.wood = 0;
  s.buffs = { hearth: 300 }; G.tick(0.001);
  const plain = G.plainRates().wood;
  assert.ok(G.rates.wood > plain * 1.9, 'благословение действует на обычный выпуск');
  const r = G.perform('elders');
  const got = (r.gains.find(([k]) => k === 'wood') || [])[1];
  assert.equal(got, Math.floor(Math.max(30, plain * 180)));
  assert.equal(s.cooldowns.elders, 120);
});

test('эпохи: Лемба и Мастера Суской в бронзовом веке становятся домом и мастерской 5-го уровня', () => {
  const G = fresh().get('Game');
  const s = G.state;
  s.buildings.push({ id: 700, type: 'sp_lemba', level: 1, x: 3, y: 3 }, { id: 701, type: 'sp_souskiou', level: 1, x: 4, y: 3 }, { id: 702, type: 'shrine1', level: 1, x: 5, y: 3 });
  const houseCost = G.buildCost('house').wood;
  assert.deepEqual(JSON.parse(JSON.stringify(G.retiringNext().map(r => r.slice(0, 3)))), [['sp_lemba', 'house', 5], ['sp_souskiou', 'workshop', 5]]);
  s.epoch = 1;
  const out = G.retireWonders();
  assert.equal(out.length, 2);
  const lemba = s.buildings.find(b => b.id === 700), sous = s.buildings.find(b => b.id === 701);
  assert.equal(lemba.type, 'house'); assert.equal(lemba.level, 5); assert.equal(lemba.from, 'sp_lemba');
  assert.equal(sous.type, 'workshop'); assert.equal(sous.level, 5);
  assert.ok(s.buildings.some(b => b.type === 'shrine1'), 'святилище богини не устаревает');
  assert.equal(G.buildCost('house').wood, houseCost, 'подарок не дорожит следующий дом');
  assert.ok(G.buildStatus('sp_lemba').hidden, 'устаревшее чудо больше не строится');
});

test('эпохи: чудо эпохи со склада в новой эпохе ставится обычным зданием', () => {
  const G = fresh().get('Game');
  const s = G.state;
  s.stash = ['sp_lemba']; s.epoch = 1;
  const t = G.map.find(t => !G.buildingAt(t.x, t.y) && G.canPlaceOn('sp_lemba', t));
  assert.ok(G.build('sp_lemba', t.x, t.y));
  const b = G.buildingAt(t.x, t.y);
  assert.equal(b.type, 'house'); assert.equal(b.level, 5);
  assert.equal(s.stash.length, 0);
});

test('обряды: λ-благословения — раз в 4 и 8 часов по настоящим часам', () => {
  const C = fresh(), G = C.get('Game'), s = G.state;
  s.buildings.push({ id: 800, type: 'shrine1', level: 1, x: 2, y: 2 });
  for (const k of Object.keys(s.res)) s.res[k] = 1000;
  assert.ok(G.perform('vigil'));
  assert.equal(G.effects().logos, 1 + 0.1 + 0.5);
  const R = C.run("RITUAL_BY_ID.vigil");
  assert.equal(G.ritualStatus(R).reason.code, 'cooldown');
  C.clock.now += 4 * 3600e3 - 60e3;
  assert.ok(G.ritualWait(R) > 0 && G.ritualWait(R) <= 60);
  C.clock.now += 61e3;
  assert.equal(G.ritualWait(R), 0);
  assert.equal(C.run("RITUAL_BY_ID.hornedfeast").buff.logos, 0.75);
});

test('события: набег через 5–30 минут, срок виден заранее, уносит 10–50%; стены защищают', () => {
  const G = fresh().get('Game'), s = G.state;
  assert.equal(G.raidIn(), null, 'в медно-каменном веке набегов нет');
  s.epoch = 1; G.events(0.01);
  const t = G.raidIn();
  assert.ok(t >= 300 - 1 && t <= 1800, 'срок набега известен');
  for (const k of Object.keys(s.res)) s.res[k] = 1000;
  G.events(t + 0.1);
  const pct = 1 - s.res.wood / 1000;
  assert.ok(pct >= 0.1 - 1e-9 && pct <= 0.5 + 1e-9, 'унесли 10–50%');
  assert.ok(G.raidIn() >= 300 - 1 && G.raidIn() <= 1800, 'новый срок');
  s.buildings.push({ id: 880, type: 'sp_walls', level: 1, x: 1, y: 1 }); G.fx = G.effects();
  for (const k of Object.keys(s.res)) s.res[k] = 1000;
  G.raid();
  assert.equal(s.res.wood, 1000, 'стены отразили');
});

test('офлайн: благословения истекают по настоящему времени', () => {
  const C = fresh(), G = C.get('Game'), s = G.state;
  s.buffs = { harvest: 600, hearth: 9000 }; s.cooldowns = { elders: 100 };
  s.lastSave = C.clock.now - 400e3;                 // 400 секунд: 300 в полную силу + 100 вполовину
  const r = G.catchUp();
  assert.ok(Math.abs(s.buffs.harvest - 200) < 1e-6, 'прошло ровно 400 секунд благословения');
  assert.equal(s.cooldowns.elders, undefined, 'перерыв «Сбора припасов» тоже прошёл');
  s.lastSave = C.clock.now - 3 * 3600e3;
  const r2 = G.catchUp();
  assert.deepEqual([...r2.ended].sort(), ['harvest', 'hearth']);
  assert.deepEqual(s.buffs, {});
  assert.equal(r.raid, null, 'в медно-каменном веке набегов нет');
});

test('офлайн: набег, срок которого подошёл, — ровно один, в конце, по накопленному; потом отсчёт заново', () => {
  const C = fresh(), G = C.get('Game'), s = G.state;
  s.epoch = 1; G.events(0.01);
  s.timers.raid = 600;
  for (const k of Object.keys(s.res)) s.res[k] = 100;
  s.buildings.push({ id: 881, type: 'lumber', level: 3, x: 2, y: 2 }); s.pop = 20;
  const raidsBefore = s.log.filter(e => e.k === 'raid').length;
  s.lastSave = C.clock.now - 3 * 3600e3;            // за 3 часа срок прошёл бы много раз
  const r = G.catchUp();
  assert.equal(s.log.filter(e => e.k === 'raid').length, raidsBefore + 1, 'набег один');
  assert.ok(r.raid && !r.raid.shielded && r.raid.pct >= 0.1 - 1e-9 && r.raid.pct <= 0.5 + 1e-9);
  const lostWood = (r.raid.lost.find(([k]) => k === 'wood') || [])[1] || 0;
  assert.ok(r.gained.wood > 0 && lostWood > 0, 'сначала прибавка, потом потери');
  assert.ok(Math.abs(lostWood - Math.floor((s.res.wood + lostWood) * r.raid.pct)) <= 1, 'уносят долю от накопленного к концу');
  assert.ok(G.raidIn() >= 300 - 1 && G.raidIn() <= 1800, 'после возвращения — новый отсчёт');
  // срок ещё не подошёл — набега нет, отсчёт уменьшился на время отсутствия
  s.timers.raid = 3000; s.lastSave = C.clock.now - 1000e3;
  const r2 = G.catchUp();
  assert.equal(r2.raid, null);
  assert.ok(Math.abs(G.raidIn() - 2000) < 1e-6);
  // стены отбивают и офлайн
  s.buildings.push({ id: 882, type: 'sp_walls', level: 1, x: 3, y: 3 }); G.fx = G.effects();
  s.timers.raid = 10; s.lastSave = C.clock.now - 600e3;
  const before = s.res.wood;
  const r3 = G.catchUp();
  assert.ok(r3.raid && r3.raid.shielded);
  assert.ok(s.res.wood >= before, 'ничего не унесли');
});

/** Город в начале железного века: бронзовый век пройден. */
function ironAge(C) {
  const G = C.get('Game'), s = G.state;
  s.epoch = 2;
  s.techs.push(...C.get('TECHS').filter(t => t.epoch < 2).map(t => t.id));
  s.pop = 60; s.logos = 5000;
  for (const k of Object.keys(s.res)) s.res[k] = 3000;
  s.buildings.push({ id: 870, type: 'storehouse', level: 9, x: 5, y: 7 }, { id: 871, type: 'storehouse', level: 9, x: 6, y: 7 });
  G.tick(0.001);
  return G;
}

test('железный век: предел 11; 10-й уровень просит железо, 11-й — вдвое больше λ, чем 9-й', () => {
  const C = fresh(), G = ironAge(C), s = G.state;
  assert.equal(G.maxLevel(), 11);
  const up10 = G.upgradeCost('house', 10);
  assert.ok(up10.cost.iron > 0 && !up10.cost.bronze, '10-й — железо вместо бронзы');
  assert.equal(G.upgradeCost('house', 11).logos, 2 * G.upgradeCost('house', 9).logos);
  assert.ok(G.upgradeCost('house', 11).cost && !Object.keys(G.upgradeCost('house', 11).cost).length, '11-й — только λ');
  const b = { id: 872, type: 'field', level: 9, x: 7, y: 7 }; s.buildings.push(b);
  s.res.iron = 0;
  assert.deepEqual([...G.upgradeInfo(b).reason.items.map(x => x[0])], ['iron'], 'без железа 10-й не взять');
  // склады на 10-м и 11-м растут резче обычного
  assert.ok(Math.abs(G.storeMult(10) / G.storeMult(9) - 1.3) < 1e-9 && Math.abs(G.storeMult(11) / G.storeMult(10) - 1.6) < 1e-9);
  assert.ok(Math.abs(G.levelMult(11) / G.levelMult(10) - 1.4) < 1e-9);
});

test('железный век: «Железо» — бронза пропадает совсем, литейня устаревает; перестроить или продать', () => {
  const C = fresh(), G = ironAge(C), s = G.state;
  const foundry = { id: 880, type: 'foundry', level: 9, x: 8, y: 8 }, other = { id: 881, type: 'foundry', level: 4, x: 9, y: 8 };
  s.buildings.push(foundry, other);
  s.res.bronze = 700; s.res.iron = 0;
  const bronzeCost = G.ritualStatus(C.get('RITUAL_BY_ID').bullmask).cost;   // цены без бронзы — не меняются
  assert.ok(G.research('iron'));
  assert.equal(s.res.bronze, 0);
  assert.equal(s.res.iron, 0, 'запасы бронзы пропали, в железо не перешли');
  assert.equal(G.resVisible('bronze'), false, 'бронза пропала из шапки');
  assert.deepEqual({ ...G.liveCost({ bronze: 100, stone: 5 }) }, { iron: 100, stone: 5 }, 'цены с бронзой — теперь в железе');
  assert.deepEqual({ ...G.ritualStatus(C.get('RITUAL_BY_ID').bullmask).cost }, { ...bronzeCost });
  assert.deepEqual(Object.keys(G.prodOf(foundry)).length, 0, 'литейня встала и медь не ест');
  assert.equal(G.buildStatus('foundry').hidden, true, 'новые литейни не строят');
  assert.equal(G.buildStatus('forge').ok, true);
  assert.equal(G.upgradeInfo(foundry), null, 'устаревшее не улучшают');
  // перестроить: тот же уровень, теперь кузница
  const rb = G.rebuildInfo(foundry);
  assert.equal(rb.into, 'forge');
  assert.ok(G.rebuild(foundry));
  assert.equal(foundry.type, 'forge'); assert.equal(foundry.level, 9);
  assert.ok(G.prodOf(foundry).iron > 0 && G.prodOf(foundry).wood < 0);
  // продать: весь λ уровней (3 + 5-й) и половина цены постройки
  const logos0 = s.logos, sell = G.sellInfo(other);
  assert.equal(sell.logos, G.upgradeLogos('foundry', 3));
  assert.ok(G.sell(other));
  assert.equal(s.logos, logos0 + sell.logos);
  assert.ok(!s.buildings.includes(other));
  assert.equal(G.rebuildInfo(foundry), null, 'кузница не устарела');
});

test('железный век: дань Ассирии вместо набегов; стены уменьшают её вдвое', () => {
  const C = fresh(), G = ironAge(C), s = G.state;
  assert.equal(G.raidKind(), 'tribute');
  for (const k of Object.keys(s.res)) s.res[k] = 1000;
  const r = G.raid(true);
  assert.ok(r.tribute && !r.halved && r.pct >= 0.1 - 1e-9 && r.pct <= 0.5 + 1e-9);
  s.buildings.push({ id: 890, type: 'sp_walls', level: 1, x: 3, y: 3 }); G.fx = G.effects();
  for (const k of Object.keys(s.res)) s.res[k] = 1000;
  const r2 = G.raid(true);
  assert.ok(r2.tribute && r2.halved && !r2.shielded);
  assert.ok(r2.pct >= 0.05 - 1e-9 && r2.pct <= 0.25 + 1e-9, 'вдвое меньше');
  assert.ok(s.res.wood < 1000, 'стены больше не спасают полностью');
});

test('железный век: «Финикийцы» — ремёсла уходят в серебро 5:1; мастерские и гавани дают серебро; серебро +50%', () => {
  const C = fresh(), G = ironAge(C), s = G.state;
  const ws = { id: 900, type: 'workshop', level: 1, x: 8, y: 9 }; s.buildings.push(ws);
  const goodsBefore = G.prodOf(ws).goods;
  s.res.goods = 1000; s.res.silver = 0;
  assert.ok(G.research('phoenicians'));
  assert.equal(s.res.goods, 0); assert.equal(s.res.silver, 200, '1000 ремёсел → 200 серебра');
  assert.equal(G.resVisible('goods'), false);
  const bb = G.effects().bbonus.workshop || 0;
  assert.ok(Math.abs(G.prodOf(ws).silver - 0.1 / 5 * (1 + 0.5 + bb)) < 1e-9, 'мастерская: серебро = ремёсла / 5, и +50% от финикийцев');
  assert.ok(G.prodOf(ws).silver > goodsBefore / 5);
  assert.equal(G.buildCost('scribe').silver, Math.ceil(BUILDING_GOODS(C) / 5), 'цены в ремёслах — теперь в серебре');
  assert.ok(G.techStatus(C.get('TECH_BY_ID').viticulture).ok !== undefined, '«Виноградарство» открылось после финикийцев');
});
const BUILDING_GOODS = C => C.get('BUILDINGS').scribe.cost.goods * Math.pow(C.get('BALANCE').buildCostGrowth, 0);

test('железный век: «Виноградарство» — сыр в амфоры, загоны в виноградники и рощи, вакханки вместо коз', () => {
  const C = fresh(), G = ironAge(C), s = G.state;
  const T = C.get('TECH_BY_ID');
  assert.equal(G.techStatus(T.viticulture).locked, true, 'сначала финикийцы');
  s.techs.push('phoenicians');
  const hill = G.map.find(t => t.t === 'hill' && !G.buildingAt(t.x, t.y)), forest = G.map.find(t => t.t === 'forest' && !G.buildingAt(t.x, t.y));
  const penH = { id: 910, type: 'goatpen', level: 7, x: hill.x, y: hill.y }, penF = { id: 911, type: 'goatpen', level: 3, x: forest.x, y: forest.y };
  s.buildings.push(penH, penF);
  const R = C.get('RITUAL_BY_ID');
  assert.equal(G.ritualStatus(R.herds).hidden, undefined); assert.equal(G.ritualStatus(R.vintage).hidden, true);
  s.res.cheese = 900; s.res.amphora = 0; s.res.food = 4500; s.res.wood = 4500;
  assert.ok(G.research('viticulture'));
  assert.equal(s.res.amphora, 450, '2 сыра = 1 амфора');
  assert.equal(Object.keys(G.prodOf(penH)).length, 0, 'старый загон стоит');
  assert.equal(G.ritualStatus(R.herds).hidden, true); assert.notEqual(G.ritualStatus(R.vintage).hidden, true);
  assert.equal(G.rebuildInfo(penH).into, 'vineyard'); assert.equal(G.rebuildInfo(penF).into, 'olivegrove');
  assert.ok(G.rebuild(penH) && G.rebuild(penF));
  assert.equal(penH.type, 'vineyard'); assert.equal(penH.level, 7);
  assert.ok(G.prodOf(penH).amphora > 0 && G.prodOf(penF).amphora > 0);
  // обряды платят амфорами вместо сыра
  const fest = G.liveCost(R.festival.cost);
  assert.ok(fest.amphora > 0 && !fest.cheese && fest.silver > 0 && !fest.goods);
  // вакханки
  s.timers.goat = 0; G.goat = null; G.events(0.1);
  assert.equal(G.goat.kind, 'maenad');
});

test('железный век: гавань продаёт амфоры за серебро сверх обычной работы — только то, что сверх половины склада', () => {
  const C = fresh(), G = ironAge(C), s = G.state;
  s.techs.push('phoenicians', 'viticulture');
  const coast = G.map.find(t => t.coast && t.t === 'plain' && !G.buildingAt(t.x, t.y));
  const port = { id: 920, type: 'port', level: 1, x: coast.x, y: coast.y }; s.buildings.push(port);
  for (const k of Object.keys(s.res)) s.res[k] = 500;
  s.res.amphora = 0; G.tick(1);
  const fx = G.effects(), noAmph = G.production(fx, 100, 1).rates;
  const cap = G.storageCap(fx);
  s.res.amphora = Math.floor(cap * 0.5) - 1;
  const half = G.production(fx, 100, 1).rates;
  assert.equal(half.silver, noAmph.silver, 'до половины склада амфоры копятся, а не продаются');
  s.res.amphora = Math.floor(cap * 0.5) + 50;
  const withAmph = G.production(fx, 100, 1).rates;
  assert.ok(withAmph.silver > noAmph.silver, 'сверх половины — серебра больше');
  assert.ok(withAmph.amphora < noAmph.amphora, 'амфоры уходят');
  assert.ok(noAmph.silver > 0 && noAmph.copper < 0, 'без амфор гавань работает как обычно');
});

test('железный век: святилища улучшаются на своём месте, «золотые часы» сменяются', () => {
  const C = fresh(), G = ironAge(C), s = G.state, R = C.get('RITUAL_BY_ID');
  const sh1 = { id: 930, type: 'shrine1', level: 1, x: 9, y: 9 }, sh2 = { id: 931, type: 'shrine2', level: 1, x: 10, y: 9 };
  s.buildings.push(sh1, sh2);
  assert.notEqual(G.ritualStatus(R.vigil).hidden, true); assert.equal(G.ritualStatus(R.morningstar).locked, true);
  assert.equal(G.buildStatus('sp_aphrodite').reason.code, 'needTech', 'Афродита — после финикийцев');
  assert.equal(G.buildStatus('sp_apollo').reason.code, 'needTech', 'Аполлон — после слогового письма');
  s.techs.push('phoenicians', 'syllabary'); s.res.iron = 3000;
  for (const k of ['stone', 'copper']) s.res[k] = 4500;
  s.buildings.push({ id: 932, type: 'storehouse', level: 11, x: 11, y: 9 }, { id: 933, type: 'storehouse', level: 11, x: 12, y: 9 }); G.tick(0.001);
  s.res.stone = 15000; s.res.copper = 5000; s.res.silver = 500;
  assert.ok(G.upgradeWonder('sp_aphrodite'));
  assert.equal(sh1.type, 'sp_aphrodite'); assert.deepEqual([sh1.x, sh1.y], [9, 9]);
  assert.equal(G.buildStatus('shrine1').hidden, true, 'старое святилище заново не строится');
  assert.equal(G.ritualStatus(R.vigil).hidden, true);
  assert.equal(G.ritualStatus(R.morningstar).locked, undefined);
  assert.equal(R.morningstar.buff.logos, 1); assert.equal(R.morningstar.cooldown, 8 * 3600);
  assert.notEqual(G.ritualStatus(R.festival).locked, true, 'праздник плодородия работает и при Афродите');
  s.res.stone = 15000; s.res.copper = 5000;
  assert.ok(G.upgradeWonder('sp_apollo'));
  assert.equal(G.ritualStatus(R.hornedfeast).hidden, true);
  assert.equal(R.gnomon.buff.logos, 0.75); assert.equal(R.gnomon.cooldown, 4 * 3600);
  assert.equal(G.buildStatus('sp_troodos2').locked, true, 'Троодос — после «Виноградарства» и только если есть старый');
  // λ святилищ: улучшение сохраняет λ-бонус старого чуда; Аполлон без λ, но очень дорог
  const B = C.get('BUILDINGS');
  for (const W of Object.values(B).filter(W => W.upgradeOf))
    assert.ok(((W.effect || {}).logos || 0) >= ((B[W.upgradeOf].effect || {}).logos || 0), 'улучшение чуда не отнимает λ');
  assert.equal(B.sp_aphrodite.effect.logos, 0.1); assert.equal(B.sp_apollo.effect.logos, 0.2);
  assert.equal(B.sp_apollo.logos, 0); assert.ok(B.sp_salamis.logos > 0, 'новое λ-чудо — гробницы Саламина');
});

test('железный век: писцам 10-й уровень — только после «Кипрского слогового письма»; цены уровней — по общим правилам', () => {
  const C = fresh(), G = ironAge(C), s = G.state;
  const sc = { id: 940, type: 'scribe', level: 9, x: 12, y: 10 }; s.buildings.push(sc);
  assert.equal(G.upgradeInfo(sc).reason.code, 'needTech');
  s.techs.push('syllabary');
  assert.notEqual((G.upgradeInfo(sc).reason || {}).code, 'needTech');
  const k8 = G.upgradeCost('house', 8).cost.wood, k10 = G.upgradeCost('house', 10).cost.wood;
  assert.ok(Math.abs(k10 / k8 - 1.5 * 1.5) < 0.01, '×1.5 за уровень, без особой наценки на 10-м');
  assert.equal(G.upgradeCost('house', 10).cost.iron, 30);
});

test('переход в железный век: Хала-Султан-Текке — гавань 9-го уровня, Бог на слитке — бронзолитейня 9-го', () => {
  const C = fresh(), G = C.get('Game'), s = G.state;
  s.epoch = 1;
  s.buildings.push({ id: 895, type: 'sp_halasultan', level: 1, x: 2, y: 2 }, { id: 896, type: 'sp_ingot', level: 1, x: 3, y: 2 });
  s.epoch = 2;
  const out = G.retireWonders();
  assert.deepEqual([...out.map(x => [...x])], [['sp_halasultan', 'port', 9], ['sp_ingot', 'foundry', 9]]);
  assert.equal(s.buildings.find(b => b.id === 895).type, 'port');
  assert.equal(s.buildings.find(b => b.id === 896).level, 9);
});

test('город: каждая следующая постройка дороже в 1.25 раза', () => {
  const G = fresh().get('Game');
  const c1 = G.buildCost('field').wood;
  G.state.res.wood = 1000;
  const t = G.map.find(t => !G.buildingAt(t.x, t.y) && G.canPlaceOn('field', t));
  assert.ok(G.build('field', t.x, t.y));
  assert.equal(G.buildCost('field').wood, Math.ceil(25 * 1.25));
  assert.equal(c1, 25);
});

test('город: уровни мудрости 3, 5, 7, 9 — только за λ; 3-й и 7-й символические', () => {
  const G = fresh().get('Game');
  for (const L of [3, 5, 7, 9]) { const u = G.upgradeCost('field', L); assert.equal(JSON.stringify(u.cost), '{}'); assert.ok(u.logos > 0); }
  for (const L of [2, 4, 6, 8, 10]) assert.equal(G.upgradeCost('field', L).logos, 0);
  assert.equal(G.upgradeCost('field', 3).logos, G.upgradeCost('mine', 3).logos);
  assert.ok(G.upgradeCost('field', 9).logos > G.upgradeCost('field', 5).logos);
  assert.ok(G.upgradeCost('field', 6).cost.copper > 0 && !G.upgradeCost('field', 5).cost.copper);
  assert.ok(G.upgradeCost('field', 8).cost.bronze > 0 && !G.upgradeCost('field', 6).cost.bronze);
  // выпуск: ×1.15 за уровень труда, ×1.25 / ×1.4 за уровни мудрости
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  assert.ok(near(G.levelMult(2), 1.15) && near(G.levelMult(3), 1.15 * 1.25) && near(G.levelMult(5), 1.15 * 1.25 * 1.15 * 1.4));
});

test('город: при нехватке рук сначала работает зерно', () => {
  const G = fresh().get('Game');
  const s = G.state, plain = G.map.filter(t => t.t === 'plain' && !G.buildingAt(t.x, t.y)), hills = G.map.filter(t => t.t === 'hill' && !G.buildingAt(t.x, t.y));
  s.buildings.push({ id: 50, type: 'field', level: 1, x: plain[0].x, y: plain[0].y }, { id: 51, type: 'field', level: 1, x: plain[1].x, y: plain[1].y });
  for (let i = 0; i < 3; i++) s.buildings.push({ id: 60 + i, type: 'quarry', level: 1, x: hills[i].x, y: hills[i].y });
  s.pop = 5; G.tick(0.001);
  assert.equal(G.effFood, 1);
  assert.equal(G.effOther, 0);
  assert.equal(G.labor().short, true);
});

test('город: гавань не тратит медь, когда зерно и товары не помещаются', () => {
  const G = fresh().get('Game');
  const s = G.state; s.epoch = 1;
  const coast = G.map.find(t => t.t === 'plain' && t.coast && !G.buildingAt(t.x, t.y));
  s.buildings.push({ id: 80, type: 'port', level: 1, x: coast.x, y: coast.y });
  s.pop = 100; s.res.copper = 500;
  const cap = G.storageCap(G.effects());
  s.res.food = cap; s.res.goods = cap; G.tick(0.001);
  assert.equal(s.buildings.find(b => b.type === 'port').rest, 'full');
  s.res.goods = 0; G.tick(0.001);
  assert.equal(s.buildings.find(b => b.type === 'port').rest, 'part');
});

test('город: не больше 5 благословений; причина — кодом', () => {
  const G = fresh().get('Game');
  G.addLogos(1000); for (const k of Object.keys(G.state.res)) G.state.res[k] = 250;
  G.state.buffs = { settlers: 100, harvest: 100, hearth: 100, herds: 100, festival: 100 };
  // шестое благословение (условный обряд без требований)
  const st = G.ritualStatus({ id: 'test', epoch: 0, logos: 0, buff: { logos: 0.5 }, cost: {} });
  assert.equal(st.ok, false);
  assert.equal(st.reason.code, 'buffsFull');
  // продлить уже идущее можно
  assert.notEqual((G.ritualStatus(C_get(G, 'harvest')).reason || {}).code, 'buffsFull');
});
function C_get(G, id) { return { id, epoch: 0, logos: 12, cost: { food: 20 }, buff: { mult: { food: 1 } }, dur: 300 }; }

test('город: чудо убирается на склад и ставится бесплатно', () => {
  const G = fresh().get('Game');
  const s = G.state, t = G.map.find(t => t.t === 'plain' && !G.buildingAt(t.x, t.y));
  s.buildings.push({ id: 90, type: 'sp_lemba', level: 1, x: t.x, y: t.y });
  assert.ok(G.stashWonder(s.buildings.find(b => b.type === 'sp_lemba')));
  assert.equal(s.stash.join(), 'sp_lemba');
  const logos = s.logos;
  assert.ok(G.build('sp_lemba', t.x, t.y));
  assert.equal(s.logos, logos);
  assert.equal(s.stash.length, 0);
});

test('город: летопись пишет коды, а не фразы', () => {
  const G = fresh().get('Game');
  G.log('starve');
  assert.equal(G.state.log[0].k, 'starve');
  assert.equal(typeof G.state.log[0].msg, 'undefined');
});

test('обучение: шагов до «выучено» ровно столько, сколько в настройках; последний — набор', () => {
  const C = fresh(); const D = C.get('Decks'), L = C.get('Learn');
  for (const steps of [2, 3]) {
    L.state.settings.learnSteps = steps; L.state.progress = {};
    const card = L.state.decks[0].cards[0];
    let ev = null, n = 0;
    while (ev !== 'learned' && n < 10) {
      n++;
      const task = D.needsBuild(L.state, card) ? 'build' : 'gr2ru';
      ev = D.grade(L.state, card, true, 'due', task);
    }
    assert.equal(n, steps, `при ${steps} шагах`);
  }
});

test('обучение: ошибка в написании не откатывает шаг', () => {
  const C = fresh(); const D = C.get('Decks'), L = C.get('Learn');
  const card = L.state.decks[0].cards[0];
  D.grade(L.state, card, true, 'new', 'gr2ru');
  D.grade(L.state, card, true, 'due', 'gr2ru');
  const step = L.state.progress[card.id].step;
  D.grade(L.state, card, false, 'due', 'spell');
  assert.equal(L.state.progress[card.id].step, step);
  D.grade(L.state, card, false, 'due', 'gr2ru');
  assert.equal(L.state.progress[card.id].step, step - 1);
});

test('обучение: награды по типу задания, серии не влияют', () => {
  const C = fresh(); const Ls = C.get('Lesson');
  const p = { kind: 'due' };
  assert.equal(Ls.reward('build', p), 12);
  assert.equal(Ls.reward('ru2gr', p), 7);
  assert.equal(Ls.reward('spell', p), 6);
  assert.equal(Ls.reward('flip', p), 1);
  assert.equal(Ls.reward('match', p), 3);
  assert.equal(Ls.reward('build', { kind: 'early' }), 5);
  assert.equal(Ls.reward('build', p, 1.5), 18);
});

test('обучение: раунд повторяется при том же seed', () => {
  const plan = seed => { const C = fresh({ seed }); const r = C.get('Lesson').plan(C.get('Learn').state); return r.tasks.map(t => t.type + ':' + (t.p ? t.p.card.front : '')).join(','); };
  assert.equal(plan(7), plan(7));
});

test('обучение: набор с ошибкой — подсветка по кускам', () => {
  const C = fresh(); const Ls = C.get('Lesson'), L = C.get('Learn');
  const card = L.state.decks[0].cards[0];   // σπίτι
  const t = { type: 'build', p: { card, kind: 'due', lvl: 2 } };
  Ls.prepare(L.state, C.get('Decks').activeCards(L.state), t);
  const wrongIdx = t.tiles.findIndex(x => !t.target.includes(x.ch));
  t.target.forEach((pc, i) => { const k = i === 1 && wrongIdx >= 0 ? wrongIdx : t.tiles.findIndex(x => !x.used && x.ch === pc); Ls.tapTile(t, k); });
  const r = Ls.checkBuild(t);
  assert.equal(r.ok, false);
  assert.equal(r.marks.filter(m => m !== 'ok').length, 1);
});

test('слоги и трудные места', () => {
  const C = fresh();
  assert.equal(C.get('Syl').split('θάλασσα').join('|'), 'θά|λασ|σα');
  assert.equal(C.get('spellSpots')('σπίτι').map(s => s.from).join('|'), 'ί|ι');
});

test('импорт колоды: разные разделители', () => {
  const D = fresh().get('Decks');
  const r = D.parse('σπίτι\tдом\nνερό; вода\nψωμί — хлеб\n# комментарий');
  assert.equal(r.cards.length, 3);
  assert.equal(r.cards[2].back, 'хлеб');
});

test('колоды: A1 включены с первого дня, A2 и B1 приходят выключенными', () => {
  const C = fresh();
  const L = C.get('Learn'), D = C.get('Decks');
  const lvl = l => L.state.decks.filter(d => D.levelOf(d) === l);
  assert.ok(lvl('A1').length >= 8 && lvl('A1').every(d => d.active));
  assert.ok(lvl('A2').length >= 5 && lvl('A2').every(d => !d.active));
  assert.ok(lvl('B1').length >= 5 && lvl('B1').every(d => !d.active));
  const fronts = new Set(D.activeCards(L.state).map(c => c.front));
  assert.ok(!fronts.has('ξενώνας'), 'слово из A2 не попадает в раунды, пока колода выключена');
  // греческое слово встречается во встроенных колодах A1–B1 один раз
  const seen = new Map();
  for (const d of L.state.decks) if (D.levelOf(d)) for (const c of d.cards) {
    assert.ok(!seen.has(c.front), `${c.front}: ${seen.get(c.front)} и ${d.id}`);
    seen.set(c.front, d.id);
  }
});

test('«Что будем учить?»: подборка включает свои колоды, остальные выключает; прогресс не трогается', () => {
  const C = fresh();
  const L = C.get('Learn'), D = C.get('Decks'), s = L.state;
  const PL = C.get('LEARN_PLANS');
  for (const P of Object.values(PL)) for (const id of P.decks || []) assert.ok(s.decks.some(d => d.id === id), `колода ${id} существует`);
  assert.equal(D.planOf(s), 'a1', 'новое обучение — весь A1 (A1+)');
  assert.deepEqual([...D.plans(s)], ['a1start', 'a1', 'a2', 'b1', 'verbs'], 'без своих колод «Свои колоды» не предлагаем');
  const a1card = s.decks.find(d => d.id === 'a1-fem').cards[0];
  s.progress[a1card.id] = { step: 3, rev: 0, due: 0, right: 3, wrong: 0, built: true };
  D.applyPlan(s, 'a1start');
  assert.equal(D.planOf(s), 'a1start');
  assert.ok(D.planStats(s, 'a1start').words < D.planStats(s, 'a1').words);
  D.applyPlan(s, 'a2');
  assert.equal(D.planOf(s), 'a2');
  assert.ok(s.decks.every(d => d.active === (D.levelOf(d) === 'A2')));
  assert.ok(s.progress[a1card.id], 'прогресс A1 на месте');
  assert.ok(D.selectRound(s).every(p => D.levelOf(D.deckOfCard(s, p.card.id)) === 'A2'));
  D.applyPlan(s, 'verbs');
  assert.ok(D.activeCards(s).length > 200 && s.decks.filter(d => d.active).every(d => /omega|contr|mid|verbs/.test(d.id)));
  s.decks.find(d => d.id === 'a2-verbs').active = false;
  assert.equal(D.planOf(s), null, 'выключили колоду вручную — свой набор');
  s.decks.push(D.makeDeck('Моя', [{ front: 'νερό', back: 'вода' }]));
  assert.ok(D.plans(s).includes('own'));
  D.applyPlan(s, 'own');
  assert.deepEqual([...s.decks.filter(d => d.active).map(d => d.name)], ['Моя']);
});

test('колоды: встроенная колода, которой больше нет, уходит из сохранения со своим прогрессом', () => {
  const C = fresh();
  const L = C.get('Learn'), D = C.get('Decks'), s = L.state;
  const gone = D.makeDeck('B1 · Фразы для письма', [{ front: 'Φιλιά,', back: 'Целую,' }], { id: 'b1-phr', builtin: true });
  const mine = D.makeDeck('Мои фразы', [{ front: 'Φιλιά,', back: 'Целую,' }]);
  s.decks.push(gone, mine);
  s.progress[gone.cards[0].id] = { step: 1, rev: -1, due: 0, right: 1, wrong: 0 };
  s.progress[mine.cards[0].id] = { step: 1, rev: -1, due: 0, right: 1, wrong: 0 };
  D.ensureBuiltins(s);
  assert.ok(!s.decks.some(d => d.id === 'b1-phr'));
  assert.equal(s.progress[gone.cards[0].id], undefined);
  assert.ok(s.decks.includes(mine) && s.progress[mine.cards[0].id], 'свои колоды не трогаются');
});

test('колоды: слово переехало из A1 в A2 — прогресс идёт за ним', () => {
  const C = fresh();
  const L = C.get('Learn'), D = C.get('Decks');
  const s = L.state;
  // сохранение со старыми колодами (v2): «ξενώνας» ещё в A1, колод A2/B1 нет
  const cur = s.decks.find(d => d.id === 'a1-masc');
  const old = D.makeDeck(cur.name, [...cur.cards, { front: 'ξενώνας', back: 'гостевой дом', hint: 'ο ξενώνας' }], { id: 'a1-masc', builtin: true });
  old.ver = 2;
  s.decks = s.decks.filter(d => !/^(a2|b1)-/.test(d.id)).map(d => d.id === 'a1-masc' ? old : d);
  const was = old.cards.at(-1).id, stay = old.cards[0].id;
  s.progress[was] = { step: 3, rev: 2, due: 0, right: 5, wrong: 1, built: true };
  s.progress[stay] = { step: 1, rev: -1, due: 0, right: 1, wrong: 0 };
  const learned = D.learnedCount(s);
  const added = D.ensureBuiltins(s);
  assert.ok(added >= 10, 'добавились колоды A2 и B1');
  const a2 = s.decks.find(d => d.id === 'a2-masc'), moved = a2.cards.find(c => c.front === 'ξενώνας');
  assert.equal(a2.active, false);
  assert.deepEqual(s.progress[moved.id], { step: 3, rev: 2, due: 0, right: 5, wrong: 1, built: true });
  assert.equal(s.progress[was], undefined);
  assert.ok(s.progress[stay], 'прогресс оставшихся в A1 слов не трогается');
  assert.ok(!s.decks.find(d => d.id === 'a1-masc').cards.some(c => c.front === 'ξενώνας'));
  assert.equal(D.learnedCount(s), learned, 'выученных слов не стало меньше');
  assert.equal(D.ensureBuiltins(s), 0, 'повторный запуск ничего не меняет');
});

test('сохранение: старое общее сохранение делится на город и обучение', () => {
  const C = loadCore();
  C.run('Game.genMap();');
  const old = C.run('(() => { const s = Game.newState(); s.decks = Learn.newState().decks; s.progress = { x: { step: 1, rev: -1, due: 0, right: 1, wrong: 0 } }; s.settings = { learnSteps: 4 }; s.learnLog = {}; s.stats = { right: 5, wrong: 1, rounds: 2, learned: 0, goats: 3 }; s.logos = 77; return JSON.stringify(s); })()');
  const io = memoryIO({ 'greekgame.save.v2': old });
  const boot = C.get('Session').start(io);
  assert.equal(boot.migrated, true);
  assert.equal(C.get('Game').state.logos, 77);
  assert.equal(C.get('Game').state.stats.goats, 3);
  assert.equal(C.get('Learn').state.settings.learnSteps, 4);
  assert.equal(C.get('Learn').state.stats.right, 5);
  assert.ok(io.data['greekgame.city.v1'] && io.data['greekgame.learn.v1'] && io.data['greekgame.save.v2.bak']);
  assert.equal(io.data['greekgame.save.v2'], undefined);
});

test('сохранение: новая игра не трогает обучение', () => {
  const C = loadCore(); C.run('Game.genMap();');
  const io = memoryIO();
  C.get('Session').start(io);
  const L = C.get('Learn'), G = C.get('Game');
  L.state.progress.a = { step: 2, rev: -1, due: 0, right: 2, wrong: 0 }; L.save();
  G.state.logos = 100; G.save();
  G.newGame();
  assert.ok(io.restarted);
  const C2 = loadCore(); C2.run('Game.genMap();');
  C2.get('Session').start(io);
  assert.equal(C2.get('Game').state.logos, 0);
  assert.ok(C2.get('Learn').state.progress.a);
});

test('дань: Ассирия грабит, Египет берёт серебро с жителя, Персия — твёрдую сумму с присяги; флот −25%', () => {
  const C = fresh(), G = ironAge(C), s = G.state, BAL = C.get('BALANCE');
  assert.equal(G.overlord(), 'assyria'); assert.equal(G.tributeDue(), null);
  s.techs.push('phoenicians', 'pharaoh'); G.tick(0.001); s.pop = 100;   // такт сам подрежет жителей под дома — число ставим после
  assert.equal(G.overlord(), 'egypt'); assert.equal(G.tributeDue(), 100 * BAL.tribute.egypt);
  // серебра хватает — берут только серебро
  for (const k of Object.keys(s.res)) s.res[k] = 1000;
  let r = G.raid(true);
  assert.equal(r.lord, 'egypt'); assert.equal(r.paid, 200); assert.equal(r.short, 0);
  assert.equal(s.res.silver, 800); assert.equal(s.res.stone, 1000, 'остальное не тронули');
  // серебра не хватает — недостающую долю добирают грабежом
  s.res.silver = 50; r = G.raid(true);
  assert.equal(r.paid, 50); assert.equal(r.short, 150); assert.equal(s.res.silver, 0);
  assert.ok(r.pct > 0 && r.pct <= 0.5 * 150 / 200 + 1e-9, 'грабят только недоплаченную долю');
  // флот: −25%
  s.techs.push('fleet'); G.tick(0.001); s.pop = 100;
  assert.equal(G.tributeDue(), 150);
  // присяга Персии: сумма считается один раз и не растёт с городом
  s.res.silver = 3000; s.res.stone = 3000; s.res.amphora = 3000; s.logos = 5000;
  assert.ok(G.research('gifts'));
  assert.equal(G.overlord(), 'persia'); assert.equal(s.tributeFixed, 100 * BAL.tribute.persia);
  s.pop = 400; assert.equal(G.tributeDue(), Math.ceil(300 * 0.75), 'твёрдая подать: рост города её не меняет');
  // Персия: недоимку берут ровно по ценнику, без случайности
  for (const k of Object.keys(s.res)) s.res[k] = 2000;
  s.res.silver = 25;
  const W = BAL.worth, before = Object.fromEntries(Object.entries(s.res));
  r = G.raid(true);
  assert.equal(r.lord, 'persia'); assert.equal(r.paid, 25); assert.equal(r.short, 225 - 25);
  const value = Object.keys(before).filter(k => k !== 'silver').reduce((t, k) => t + (before[k] - s.res[k]) * (W[k] || 1), 0);
  assert.ok(Math.abs(value - r.short * W.silver) < 100, `взяли по ценнику: ${value} ≈ ${r.short * W.silver}`);
});

test('вторая половина железного века: «через силу» — купить у чужеземцев за серебро; топоры и кирки; врачи; ваза Амафунта; переход', () => {
  const C = fresh(), G = ironAge(C), s = G.state, BAL = C.get('BALANCE'), T = C.get('TECH_BY_ID'), B = C.get('BUILDINGS');
  // путь «через силу»: λ-часть — серебром, без дерева и камня за λ
  const lab = G.techPrice(T.doctors, 'labor').cost;
  assert.equal(lab.silver, Math.ceil((140 * 3 + 280 * BAL.laborSilverPerLogos) * BAL.laborEpochMult[2] / 10) * 10, 'в железном веке путь «через силу» ×1.5');
  assert.equal(lab.wood, undefined); assert.equal(lab.stone, undefined);
  for (const id of ['pharaoh', 'irontools', 'doctors', 'fleet', 'gifts']) assert.ok(T[id].buy && T[id].epoch === 2, id);
  // топоры и кирки: пока есть железо, лесорубы и каменоломни дают +30% и тратят железо
  const lj = { id: 950, type: 'lumber', level: 9, x: 1, y: 1 }; s.buildings.push(lj);
  assert.equal(G.tradeOf(lj), null);
  s.techs.push('phoenicians', 'irontools'); G.tick(0.001);
  const t = G.tradeOf(lj), p = G.prodOf(lj);
  assert.ok(Math.abs(t.wood / p.wood - 0.3) < 1e-9 && t.iron < 0);
  s.res.iron = 0; const r0 = G.production(G.effects(), 999).rates.wood;
  s.res.iron = 500; const r1 = G.production(G.effects(), 999).rates;
  assert.ok(r1.wood > r0 && r1.iron < 0, 'с железом дерева больше, железо уходит');
  // врачи: +2 места в жилище
  const h = { id: 951, type: 'house', level: 5, x: 2, y: 1 }; s.buildings.push(h); G.tick(0.001);
  const cap0 = G.houseCapOf(h); s.techs.push('doctors'); G.tick(0.001);
  assert.equal(G.houseCapOf(h), cap0 + 2);
  // ваза Амафунта: после топоров и кирок, склады +25%
  assert.equal(B.sp_amathus.tech, 'irontools'); assert.equal(B.sp_amathus.logos, 0);
  const cap = G.storageCap(); s.buildings.push({ id: 952, type: 'sp_amathus', level: 1, x: 3, y: 1 }); G.tick(0.001);
  assert.ok(G.storageCap() > cap);
  // переход: нужны гробницы Саламина и все знания эпохи
  const reqs = G.epochReqs();
  assert.ok(reqs.some(q => q.kind === 'special' && q.type === 'sp_salamis' && !q.ok));
  assert.ok(reqs.some(q => q.kind === 'techs' && q.need === C.get('TECHS').filter(x => x.epoch === 2).length));
  assert.ok(reqs.some(q => q.kind === 'res' && q.res === 'silver') && reqs.some(q => q.kind === 'res' && q.res === 'iron'));
});
