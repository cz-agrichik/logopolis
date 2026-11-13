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
