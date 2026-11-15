'use strict';
// Галерея рисунков: все рисунки assets/art.js крупно, с названием, где их видно в игре, и «что хотел сказать автор»
// (описания — tools/art/notes.js). Пишет самодостаточную страницу: открывается с диска, без интернета.
//
//   node tools/art/gallery.js [файл.html]        по умолчанию — tools/art/gallery.html   (нужен playwright: npm i)
//
// Перерисовали или добавили рисунок — запустите снова; рисунки без описания перечислятся в консоли и на странице.
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..', '..');
const OUT = path.resolve(process.argv[2] || path.join(__dirname, 'gallery.html'));
const NOTES = require('./notes.js');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.route(/fonts\./, r => r.abort());
  await page.goto('file://' + path.join(ROOT, 'index.html') + '?reset');
  await page.waitForTimeout(300);
  // всё, что нужно странице, берём из самой игры: рисунки, названия, облики по уровням
  const data = await page.evaluate(() => {
    const open = EPOCHS.filter(E => !E.locked).length;
    const svg = k => Art.svg(k);
    const buildings = [];
    for (const [type, pre] of Object.entries(Looks.ART)) {
      const B = BUILDINGS[type], C = Cat.bld[type];
      if (!B || B.special) continue;
      const where = {}, name = {};
      for (let e = B.epoch; e < open; e++) {
        const L = Looks.looks(type, e), max = EPOCHS[e].maxLevel;
        L.forEach((x, i) => {
          if (x.from > max) return;
          const to = Math.min(max, L[i + 1] ? L[i + 1].from - 1 : max), span = x.from === to ? `${x.from}` : `${x.from}–${to}`;
          x.icons.forEach((ic, j) => {
            const w = (where[ic] = where[ic] || {}), we = (w[e] = w[e] || { main: [], side: [] });
            (j ? we.side : we.main).push(span);
            if (!j && !name[ic]) name[ic] = (C.forms[x.form] || C.forms.find(Boolean)).name;
          });
        });
      }
      const keys = [0, 1, 2, 3, 4, 5, 6].map(i => pre + i).filter(k => Art.has(k));
      buildings.push({ type, title: C.forms.find(Boolean).name, epoch: B.epoch,
        items: keys.map(k => ({ key: k, svg: svg(k), name: name[k] || '', where: where[k] || {} })) });
    }
    const wonders = Object.keys(BUILDINGS).filter(t => BUILDINGS[t].special && Art.has(t)).sort((a, b) => BUILDINGS[a].epoch - BUILDINGS[b].epoch)
      .map(t => ({ key: t, svg: svg(t), name: Cat.bld[t].name, sub: Cat.epochs[BUILDINGS[t].epoch].name }));
    const techs = TECHS.filter(T => Art.has('t_' + T.id)).map(T => ({ key: 't_' + T.id, svg: svg('t_' + T.id), name: Cat.tech[T.id].name, sub: Cat.epochs[T.epoch].name }));
    const rites = RITUALS.filter(R => Art.has('r_' + R.id)).map(R => ({ key: 'r_' + R.id, svg: svg('r_' + R.id), name: Cat.rite[R.id].name, sub: Cat.epochs[R.epoch].name }));
    const res = RES_KEYS.map(k => ({ key: 'res:' + k, svg: Art.res(k), name: Cat.res[k].name, sub: Cat.epochs[RES[k].epoch].name }));
    const map = [['tree', 'Лес'], ['hill', 'Холм'], ['goat', 'Беглая коза'], ['maenad', 'Вакханка']].filter(([k]) => Art.has(k)).map(([k, n]) => ({ key: k, svg: svg(k), name: n, sub: 'на карте' }));
    return { epochs: Cat.epochs.map(E => E.name), buildings, wonders, techs, rites, res, map };
  });
  await browser.close();

  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const missing = [];
  const note = k => { const n = NOTES[k]; if (!n) missing.push(k); return n ? `<p>${esc(n)}</p>` : '<p class="none">— описания пока нет —</p>'; };
  const ground = k => /^(field|vineyard|olivegrove)/.test(k) ? 'g-field' : /^(lumber|tree)/.test(k) ? 'g-forest' : /^(quarry|mine|goatpen)/.test(k) ? 'g-hill' : '';
  const whereText = w => {
    const parts = Object.entries(w).map(([e, x]) => {
      const bits = [];
      if (x.main.length) bits.push('ур. ' + x.main.join(', '));
      if (x.side.length) bits.push('малым рядом — ур. ' + x.side.join(', '));
      return `<b>${esc(data.epochs[e])}:</b> ${bits.join('; ')}`;
    });
    return parts.length ? `<div class="where">${parts.join('<br>')}</div>` : '';
  };
  const card = (it, extra = '') => `<figure class="card" id="${esc(it.key.replace(':', '-'))}">
      <div class="pic ${ground(it.key)}">${it.svg}</div>
      <figcaption><div class="nm">${esc(it.name || it.key)}</div><div class="key">${esc(it.key)}${it.sub ? ' · ' + esc(it.sub) : ''}</div>${extra}${note(it.key)}</figcaption>
    </figure>`;
  const section = (id, title, intro, body) => `<section id="${id}"><h2>${title}</h2>${intro ? `<p class="intro">${intro}</p>` : ''}${body}</section>`;

  const bHtml = data.buildings.map(b => `<div class="bgroup" id="b-${b.type}"><h3>${esc(b.title)} <small>${esc(b.type)} · с эпохи «${esc(data.epochs[b.epoch])}»</small></h3>
    <div class="row">${b.items.map(it => card(it, whereText(it.where))).join('')}</div></div>`).join('');
  const total = data.buildings.reduce((n, b) => n + b.items.length, 0) + data.wonders.length + data.techs.length + data.rites.length + data.res.length + data.map.length;

  const html = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Λόγος · рисунки</title>
<style>
  :root { --parch: #f4ead3; --parch-2: #eadcbc; --parch-3: #dccaa2; --ink: #2a2017; --ink-2: #6b5a45; --accent: #8e3d1d; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--parch); color: var(--ink); font: 15px/1.5 'Noto Serif', Georgia, serif; }
  header { background: linear-gradient(180deg, #8e3d1d, #6e2d14); color: #fbf3e2; padding: 18px 24px 14px; }
  header h1 { margin: 0; font-size: 26px; } header p { margin: 6px 0 0; opacity: .85; max-width: 900px; }
  nav { position: sticky; top: 0; z-index: 2; background: var(--parch-2); padding: 8px 24px; display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: 14px; box-shadow: 0 2px 6px rgba(60,35,10,.15); }
  nav a { color: var(--accent); text-decoration: none; font-weight: 600; }
  main { padding: 8px 24px 40px; max-width: 1500px; }
  h2 { margin: 28px 0 6px; font-size: 22px; color: var(--accent); border-bottom: 2px solid var(--parch-3); padding-bottom: 4px; }
  h3 { margin: 20px 0 8px; font-size: 18px; } h3 small { font-weight: 400; color: var(--ink-2); font-size: 13px; }
  .intro { color: var(--ink-2); max-width: 980px; margin: 4px 0 10px; }
  .row, .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 12px; }
  .card { margin: 0; background: #fff8; border-radius: 12px; padding: 10px; box-shadow: 0 1px 4px rgba(60,35,10,.12); }
  .pic { height: 184px; border-radius: 10px; background: #d8c9a0; display: flex; align-items: center; justify-content: center; }
  .pic.g-field { background: #c9b98a; } .pic.g-forest { background: #b9c28f; } .pic.g-hill { background: #c9ad86; }
  .pic svg { width: 168px; height: 168px; }
  .nm { font-weight: 700; margin-top: 8px; } .key { font-size: 12px; color: var(--ink-2); font-family: ui-monospace, Consolas, monospace; }
  .where { font-size: 12.5px; color: #4f3a1c; background: var(--parch-2); border-radius: 6px; padding: 4px 8px; margin: 6px 0 0; }
  figcaption p { margin: 6px 0 0; font-size: 14px; } .none { color: #b23a2a; font-style: italic; }
  .miss { background: #f6d8cf; border-radius: 8px; padding: 8px 12px; }
  section, .bgroup, .card { scroll-margin-top: 96px; }
  @media (max-width: 700px) { nav { flex-wrap: nowrap; overflow-x: auto; white-space: nowrap; scrollbar-width: none; } section, .bgroup, .card { scroll-margin-top: 48px; } }
  @media (max-width: 600px) { header, nav, main { padding-left: 12px; padding-right: 12px; } .pic { height: 150px; } .pic svg { width: 136px; height: 136px; } }
</style></head>
<body>
<header><h1>Λόγος · все рисунки</h1>
<p>${total} рисунков из <code>assets/art.js</code> — крупно, с тем, что на них хотел сказать автор. Поле 64×64, единая палитра, тёмный контур;
медь — терракота, бронза — золото, железо — холодный серый, камень железного века — тёсаный. Страница собрана из игры
командой <code>node tools/art/gallery.js</code> — после правки рисунков её можно пересобрать.</p></header>
<nav><a href="#buildings">Здания</a><a href="#wonders">Чудеса</a><a href="#techs">Знания</a><a href="#rites">Обряды</a><a href="#res">Ресурсы</a><a href="#map">Карта</a>
  ${data.buildings.map(b => `<a href="#b-${b.type}" style="font-weight:400">${esc(b.title)}</a>`).join('')}</nav>
<main>
${section('buildings', 'Здания', `Облик здания зависит от уровня, а каждая эпоха дорисовывает свои верхние уровни. Первый облик новой эпохи — базовый,
  «с нуля, но уже из нового материала» (5-й в бронзе, 9-й в железе); следующий — нарядный (7-й и 11-й). Под каждым рисунком — на каких уровнях
  он стоит на карте; «малым рядом» — второй, маленький рисунок рядом с главным.`, bHtml)}
${section('wonders', 'Чудеса и святилища', 'По одному каждого; эффект и история — в Кипропедии.', `<div class="grid">${data.wonders.map(it => card(it)).join('')}</div>`)}
${section('techs', 'Знания', 'Светлые медальоны.', `<div class="grid">${data.techs.map(it => card(it)).join('')}</div>`)}
${section('rites', 'Обряды', 'Тёмные, «ночные» медальоны: обряды идут на время.', `<div class="grid">${data.rites.map(it => card(it)).join('')}</div>`)}
${section('res', 'Ресурсы', 'Значки в шапке и в ценах.', `<div class="grid">${data.res.map(it => card(it)).join('')}</div>`)}
${section('map', 'Карта', '', `<div class="grid">${data.map.map(it => card(it)).join('')}</div>`)}
MISSING
</main></body></html>`;
  const out = html.replace('MISSING', missing.length ? `<section><h2>Без описания</h2><p class="miss">${missing.map(esc).join(', ')} — добавьте строчку в <code>tools/art/notes.js</code>.</p></section>` : '');
  fs.writeFileSync(OUT, out);
  console.log(`→ ${OUT} · рисунков: ${total}${missing.length ? ` · без описания: ${missing.join(', ')}` : ' · у всех есть описание'}`);
  const extra = Object.keys(NOTES).filter(k => !out.includes(`id="${k.replace(':', '-')}"`));
  if (extra.length) console.log('описания без рисунка (лишние):', extra.join(', '));
})();
