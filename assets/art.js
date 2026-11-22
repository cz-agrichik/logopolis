'use strict';
// ============================================================
//  Рисованные SVG-иконки: здания (по стадиям облика), спецстроения,
//  ресурсы, местность. Всё в поле 64×64, единая палитра.
// ============================================================

const Art = (() => {
  const O = '#4a3320';                       // контур
  const C = {
    thatch: '#d4aa52', thatchD: '#a97f2c', mud: '#d9b07a', mudD: '#b98a52', plaster: '#f3ead8',
    stone: '#bdb6a8', stoneD: '#8f877a', wood: '#9c6b3c', woodD: '#6f4824', terra: '#b5532c',
    green: '#7fa23e', greenD: '#55732a', wheat: '#e6bd4e', wheatD: '#b88a22', water: '#3f86b0', waterD: '#2c6a91',
    copper: '#cf7a3e', copperD: '#9c4f22', bronze: '#c39433', bronzeD: '#8a6619', pic: '#6fb3a6', picD: '#3f7d72',
    furrow: '#a87a4a', furrowD: '#9c6c3c', fire: '#f08a24', fireL: '#ffd35a', dark: '#3b2a1c', white: '#f7f2e6', red: '#a8402a', sky: '#bfe0ee',
  };
  const st = (w = 1.8) => `stroke="${O}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
  const shadow = (rx = 22, cx = 32) => `<ellipse cx="${cx}" cy="56" rx="${rx}" ry="3.6" fill="#000" opacity=".16"/>`;

  // ---------- переиспользуемые детали ----------
  const goat = (x, y, s = 1, col = C.white, flip = false) => `
    <g transform="translate(${x} ${y}) scale(${flip ? -s : s} ${s})">
      <path d="M-9 -1 Q-9 -7 -2 -7 L6 -7 Q9 -7 9 -3 L9 1 Q9 3 6 3 L-6 3 Q-9 3 -9 -1Z" fill="${col}" ${st(1.5)}/>
      <path d="M-6 3 L-6 9 M-2 3 L-2 9 M3 3 L3 9 M7 2 L7 9" ${st(1.6)} fill="none"/>
      <path d="M7 -6 L11 -11 Q14 -12 15 -9 L14 -5 Q12 -3 9 -4Z" fill="${col}" ${st(1.5)}/>
      <path d="M11 -11 Q9 -16 6 -15 M12 -11 Q12 -16 9 -17" fill="none" ${st(1.4)}/>
      <path d="M14 -5 L14 -2" ${st(1.2)}/>
      <path d="M-9 -4 L-12 -7" ${st(1.4)}/>
    </g>`;
  const pithos = (x, y, s = 1, col = C.mud) => `
    <g transform="translate(${x} ${y}) scale(${s})">
      <path d="M-5 -16 L5 -16 L6 -13 Q12 -8 11 2 Q10 10 4 13 L-4 13 Q-10 10 -11 2 Q-12 -8 -6 -13Z" fill="${col}" ${st(1.6)}/>
      <path d="M-10 -3 Q0 0 10 -3 M-10.5 3 Q0 6 10.5 3" fill="none" stroke="${C.terra}" stroke-width="1.6"/>
    </g>`;
  const pine = (x, y, s = 1) => `
    <g transform="translate(${x} ${y}) scale(${s})">
      <rect x="-1.6" y="2" width="3.2" height="7" fill="${C.woodD}" ${st(1.2)}/>
      <path d="M0 -16 L8 -4 L4 -4 L10 4 L-10 4 L-4 -4 L-8 -4Z" fill="${C.greenD}" ${st(1.4)}/>
    </g>`;
  const idol = (x, y, s = 1, col = C.pic, colD = C.picD) => `
    <g transform="translate(${x} ${y}) scale(${s})">
      <path d="M-3 -18 Q0 -21 3 -18 L3 -13 L3 -10 L13 -10 Q15 -8 13 -5 L3 -5 L3 2 Q6 6 5 12 L1 14 L0 8 L-1 14 L-5 12 Q-6 6 -3 2 L-3 -5 L-13 -5 Q-15 -8 -13 -10 L-3 -10 L-3 -13Z" fill="${col}" ${st(1.5)}/>
      <path d="M-2 -16 L2 -16" stroke="${colD}" stroke-width="1.2"/>
    </g>`;
  const ingotShape = (x, y, s = 1, col = C.copper, colD = C.copperD) => `
    <g transform="translate(${x} ${y}) scale(${s})">
      <path d="M-14 -7 Q-8 -4 0 -6 Q8 -4 14 -7 Q12 0 14 7 Q8 4 0 6 Q-8 4 -14 7 Q-12 0 -14 -7Z" fill="${col}" ${st(1.6)}/>
      <path d="M-8 -2 Q0 0 8 -2" fill="none" stroke="${colD}" stroke-width="1.3"/>
    </g>`;
  const flame = (x, y, s = 1) => `
    <g transform="translate(${x} ${y}) scale(${s})">
      <path d="M0 -10 Q6 -3 4 3 Q2 7 0 7 Q-2 7 -4 3 Q-6 -3 0 -10Z" fill="${C.fire}" ${st(1.2)}/>
      <path d="M0 -3 Q2 1 1 4 L-1 4 Q-2 1 0 -3Z" fill="${C.fireL}"/>
    </g>`;
  const smoke = (x, y) => `<path d="M${x} ${y} q-3 -4 0 -7 q3 -3 0 -7" fill="none" stroke="#9a9488" stroke-width="2" stroke-linecap="round" opacity=".8"/>`;
  const tablet = (x, y, s = 1) => `
    <g transform="translate(${x} ${y}) scale(${s})">
      <rect x="-9" y="-12" width="18" height="24" rx="3" fill="${C.mud}" ${st(1.5)}/>
      <path d="M-5 -7 l2 2 l2 -2 M2 -7 l0 3 M-5 -1 l3 0 M1 -1 l2 2 l2 -2 M-5 5 l2 -2 M0 5 l4 0" fill="none" stroke="${C.woodD}" stroke-width="1.3"/>
    </g>`;
  const logEnds = (x, y, s = 1) => `
    <g transform="translate(${x} ${y}) scale(${s})">
      <rect x="-16" y="-5" width="30" height="10" rx="5" fill="${C.wood}" ${st(1.5)}/>
      <ellipse cx="14" cy="0" rx="4" ry="5" fill="${C.wheat}" ${st(1.4)}/>
      <ellipse cx="14" cy="0" rx="1.6" ry="2" fill="none" stroke="${C.wheatD}" stroke-width="1"/>
    </g>`;
  const block = (x, y, w = 12, h = 8) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1" fill="${C.stone}" ${st(1.4)}/>`;
  const furrows = (wet = false) => `
    <path d="M6 46 L22 32 L60 32 L50 50 Z" fill="${wet ? '#8a5d34' : '#a57444'}" ${st(1.6)}/>
    <path d="M12 46 L26 34 M20 47 L32 34 M29 48 L40 34 M38 49 L48 34 M46 50 L56 34" stroke="#7a4f2a" stroke-width="1.4"/>`;
  const sprout = (x, y, s = 1) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0 0 L0 -6 M0 -4 Q-4 -7 -5 -9 Q-1 -9 0 -5 M0 -5 Q3 -9 6 -9 Q5 -6 0 -3" fill="${C.green}" stroke="${C.greenD}" stroke-width="1.3" stroke-linejoin="round"/>`;
  const stalk = (x, y, h = 16, ripe = false) => `
    <path d="M${x} ${y} L${x} ${y - h}" stroke="${ripe ? C.wheatD : C.greenD}" stroke-width="1.6"/>
    <ellipse cx="${x}" cy="${y - h - 3}" rx="2.4" ry="5" fill="${ripe ? C.wheat : C.green}" ${st(1.1)}/>
    <path d="M${x} ${y - h / 2} q-4 -3 -6 -2 M${x} ${y - h / 2 + 3} q4 -3 6 -2" fill="none" stroke="${ripe ? C.wheatD : C.greenD}" stroke-width="1.3"/>`;
  // ряды на поле: 4 борозды, на каждой — посадки
  const rows = (furrow, plant) => [14, 27, 40, 53].map((y, r) =>
    `<path d="M3 ${y + 2} Q32 ${y - 1} 61 ${y + 2}" stroke="${furrow}" stroke-width="5" stroke-linecap="round" fill="none" opacity=".75"/>` +
    [8, 19, 30, 41, 52].map(x => plant(x + (r % 2) * 5, y, r)).join('')).join('');
  const tuft =(x, y, c, cd) => `<path d="M${x} ${y} q-3 -6 -5 -8 M${x} ${y} q0 -7 0 -10 M${x} ${y} q3 -6 5 -8" stroke="${cd}" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M${x} ${y} q-1.5 -6 -3 -7 M${x} ${y} q1.5 -6 3 -7" stroke="${c}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
  const ear = (x, y) => `<path d="M${x} ${y} L${x} ${y - 9}" stroke="${C.wheatD}" stroke-width="1.6"/>
    <ellipse cx="${x}" cy="${y - 11}" rx="2" ry="4" fill="${C.wheat}" stroke="${C.wheatD}" stroke-width="1"/>`;
  // злак по эпохам. Медный век: плёнчатый ячмень и однозернянка — низкие, колос мелкий, а полполя — чечевица и горох;
  // бронза: остистый ячмень и полба соломенного цвета; железо — золотой колос (ear); эллинский Кипр — тяжёлый колос
  // голозёрной пшеницы, которую остров уже вывозит
  const earCu = (x, y) => `<path d="M${x} ${y} L${x} ${y - 6}" stroke="${C.greenD}" stroke-width="1.3"/>
    <ellipse cx="${x}" cy="${y - 8.5}" rx="1.5" ry="2.9" fill="#c6c466" stroke="#7d8a32" stroke-width="1"/>
    <path d="M${x} ${y - 11} l0 -2.6" stroke="#7d8a32" stroke-width=".9"/>`;
  const lentil = (x, y) => `<path d="M${x} ${y} Q${x - 1} ${y - 4} ${x - 4} ${y - 6} M${x} ${y} Q${x} ${y - 5} ${x + 1} ${y - 8} M${x} ${y} Q${x + 2} ${y - 3} ${x + 5} ${y - 5}" stroke="${C.greenD}" stroke-width="1.2" fill="none"/>
    ${[[-4, -6], [1, -8], [5, -5], [-2.5, -3], [3, -2.5]].map(([a, b]) => `<ellipse cx="${x + a}" cy="${y + b}" rx="1.7" ry="1.2" fill="${C.green}" stroke="${C.greenD}" stroke-width=".7"/>`).join('')}`;
  const earBz = (x, y) => `<path d="M${x} ${y} L${x} ${y - 8}" stroke="#b39548" stroke-width="1.5"/>
    <ellipse cx="${x}" cy="${y - 10.5}" rx="1.8" ry="3.8" fill="#ddc685" stroke="#a8893a" stroke-width="1"/>
    <path d="M${x - 1} ${y - 13} l-2 -5 M${x} ${y - 14} l0 -5.5 M${x + 1} ${y - 13} l2 -5" stroke="#a8893a" stroke-width=".8"/>`;
  const earGr = (x, y) => `<path d="M${x} ${y} L${x} ${y - 9}" stroke="${C.wheatD}" stroke-width="1.7"/>
    <ellipse cx="${x}" cy="${y - 12.5}" rx="2.7" ry="5.2" fill="#eebd3c" stroke="${C.wheatD}" stroke-width="1"/>
    <path d="M${x - 2.3} ${y - 15} l2.3 1.4 l2.3 -1.4 M${x - 2.5} ${y - 12} l2.5 1.4 l2.5 -1.4 M${x - 2.1} ${y - 9} l2.1 1.2 l2.1 -1.2" stroke="${C.wheatD}" stroke-width=".8" fill="none"/>`;
  const sheaf =(x, y) => `<g transform="translate(${x} ${y})"><path d="M-5 0 L0 -16 L5 0Z" fill="${C.wheat}" ${st(1.3)}/>
    <path d="M-5 -7 L5 -7" stroke="${C.terra}" stroke-width="2.2"/><path d="M0 -16 l-3 -3 M0 -16 l3 -3 M0 -16 l0 -4" stroke="${C.wheatD}" stroke-width="1.4"/></g>`;
  const fence = (y = 44) => `
    <path d="M6 ${y} L58 ${y} M6 ${y + 6} L58 ${y + 6}" stroke="${C.wood}" stroke-width="2.6" stroke-linecap="round"/>
    ${[8, 20, 32, 44, 56].map(x => `<rect x="${x - 1.6}" y="${y - 5}" width="3.2" height="15" rx="1" fill="${C.wood}" ${st(1.2)}/>`).join('')}`;
  const roundHut = (x, y, s, opt = {}) => `
    <g transform="translate(${x} ${y}) scale(${s})">
      <path d="M-17 0 L-17 14 Q0 20 17 14 L17 0Z" fill="${opt.wall || C.mud}" ${st()}/>
      ${opt.base ? `<path d="M-17 9 Q0 15 17 9 L17 14 Q0 20 -17 14Z" fill="${C.stone}" ${st(1.4)}/>
        <path d="M-10 11.5 l0 3 M-3 12.5 l0 3.5 M4 12.5 l0 3.5 M11 11.5 l0 3" stroke="${C.stoneD}" stroke-width="1.2"/>` : ''}
      <rect x="-4" y="4" width="8" height="12" rx="4" fill="${C.dark}" ${st(1.4)}/>
      <path d="M-21 2 Q0 9 21 2 L0 -22Z" fill="${C.thatch}" ${st()}/>
      <path d="M-12 1 L0 -20 M-5 4 L0 -20 M5 4 L0 -20 M12 1 L0 -20" stroke="${C.thatchD}" stroke-width="1.2"/>
      ${opt.knob ? `<circle cx="0" cy="-22" r="2.4" fill="${C.thatchD}" ${st(1.2)}/>` : ''}
    </g>`;

  const ashlar = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1" fill="#ece2c8" ${st(1.4)}/><path d="M${x + 2} ${y + 2} l${w - 4} 0" stroke="#fff" stroke-width="1" opacity=".8"/>`;
  const olive = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">
      <path d="M0 14 Q-2 6 1 0" stroke="${C.woodD}" stroke-width="3" fill="none" stroke-linecap="round"/>
      <circle cx="-6" cy="-2" r="6" fill="#8d9b5c" ${st(1.3)}/><circle cx="6" cy="-3" r="6.5" fill="#8d9b5c" ${st(1.3)}/><circle cx="0" cy="-8" r="6.5" fill="#9aa866" ${st(1.3)}/>
      <circle cx="-3" cy="-6" r="1.1" fill="#3c4a2a"/><circle cx="5" cy="-1" r="1.1" fill="#3c4a2a"/><circle cx="1" cy="-11" r="1.1" fill="#3c4a2a"/></g>`;
  const cheeseStack = (x, y) => [0, 1, 2].map(i => `<ellipse cx="${x}" cy="${y - i * 5}" rx="7" ry="3" fill="#f4e6b8" ${st(1.3)}/><path d="M${x - 4} ${y - i * 5 - 1} l3 2 M${x} ${y - i * 5 - 1} l3 2" stroke="#b9873a" stroke-width="1"/>`).join('');
  const pennant = (x, y) => `<path d="M${x} ${y} L${x} ${y - 12}" stroke="${C.woodD}" stroke-width="1.8"/><path d="M${x} ${y - 12} L${x + 9} ${y - 9.5} L${x} ${y - 7}Z" fill="${C.red}" ${st(1.1)}/>`;
  const H2 = `
      <rect x="10" y="26" width="30" height="27" fill="${C.mud}" ${st()}/>
      <rect x="38" y="34" width="17" height="19" fill="${C.mudD}" ${st()}/>
      <rect x="8" y="21" width="34" height="6" fill="${C.woodD}" ${st()}/>
      <rect x="36" y="30" width="21" height="5" fill="${C.woodD}" ${st()}/>
      <path d="M12 27 l0 -3 M20 27 l0 -3 M28 27 l0 -3 M36 27 l0 -3" stroke="${O}" stroke-width="1.2"/>
      <rect x="21" y="38" width="9" height="15" rx="1" fill="${C.dark}" ${st(1.4)}/>
      <rect x="13" y="32" width="5" height="5" fill="${C.dark}" ${st(1.2)}/>
      <rect x="44" y="40" width="5" height="5" fill="${C.dark}" ${st(1.2)}/>
      <path d="M10 49 L40 49" stroke="${C.stoneD}" stroke-width="2"/>`;

  // ---------- железный век: лоза, амфора, вакханка ----------
  const GR = '#7b3f73', GRD = '#4f2448', GRL = '#a8679c';
  const grapes = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">
      <path d="M0 -9 Q2 -13 5 -14" stroke="${C.woodD}" stroke-width="1.4" fill="none"/>
      <path d="M2 -12 Q8 -16 11 -11 Q6 -8 2 -12Z" fill="${C.green}" stroke="${C.greenD}" stroke-width="1"/>
      ${[[-3, -6], [3, -6], [0, -2], [-5, -1], [5, -1], [-2, 3], [3, 3], [0, 7]].map(([a, b]) => `<circle cx="${a}" cy="${b}" r="3" fill="${GR}" stroke="${GRD}" stroke-width="1"/>`).join('')}
      <circle cx="-4" cy="-7" r="1" fill="${GRL}"/><circle cx="2" cy="-3" r="1" fill="${GRL}"/></g>`;
  const vine = (x, y, s = 1, fruit = true) => `<g transform="translate(${x} ${y}) scale(${s})">
      <path d="M0 10 L0 -16" stroke="${C.wood}" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M0 4 Q-6 -2 -2 -10 Q4 -6 0 4Z M0 -2 Q8 -6 6 -14 Q-1 -11 0 -2Z" fill="${C.green}" ${st(1.2)}/>
      <path d="M-3 -12 Q-10 -14 -9 -6 Q-4 -7 -3 -12Z" fill="${C.greenD}" ${st(1.1)}/>
      ${fruit ? `<g transform="translate(4 -2) scale(.55)">${[[-3, -2], [3, -2], [0, 2], [-2, 6], [2, 6], [0, 10]].map(([a, b]) => `<circle cx="${a}" cy="${b}" r="3" fill="${GR}" stroke="${GRD}" stroke-width="1.2"/>`).join('')}</g>` : ''}</g>`;
  const terrace = (y, x1 = 4, x2 = 60) => `<path d="M${x1} ${y} L${x2} ${y - 2} L${x2} ${y + 4} L${x1} ${y + 6}Z" fill="${C.stone}" ${st(1.4)}/>
      <path d="M${x1 + 8} ${y + 1} l0 4 M${x1 + 20} ${y + 0.5} l0 4 M${x1 + 32} ${y} l0 4 M${x1 + 44} ${y - 0.5} l0 4" stroke="${C.stoneD}" stroke-width="1.1"/>`;
  const amphoraShape = (x, y, s = 1, col = '#c9693a') => `<g transform="translate(${x} ${y}) scale(${s})">
      <path d="M-3 -16 L3 -16 L3 -12 Q10 -8 9 2 Q8 10 0 18 Q-8 10 -9 2 Q-10 -8 -3 -12Z" fill="${col}" ${st(1.5)}/>
      <path d="M-3 -13 Q-9 -14 -8 -6 M3 -13 Q9 -14 8 -6" fill="none" ${st(1.6)}/>
      <path d="M-8 -1 Q0 2 8 -1" fill="none" stroke="${C.dark}" stroke-width="1.4"/></g>`;
  const maenad = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">
      <path d="M-8 18 Q-6 2 0 -2 Q6 2 8 18Z" fill="${GR}" ${st(1.5)}/>
      <path d="M-4 4 Q0 8 4 4" fill="none" stroke="${GRL}" stroke-width="1.2"/>
      <circle cx="0" cy="-7" r="5" fill="${C.mud}" ${st(1.4)}/>
      <path d="M-5 -10 Q0 -15 5 -10" fill="none" stroke="${C.greenD}" stroke-width="2.4" stroke-linecap="round"/>
      <circle cx="-5" cy="-10" r="1.6" fill="${C.green}"/><circle cx="5" cy="-10" r="1.6" fill="${C.green}"/><circle cx="0" cy="-13" r="1.6" fill="${C.green}"/>
      <path d="M4 0 L12 -10" ${st(1.6)}/><circle cx="13" cy="-12" r="5" fill="${C.thatch}" ${st(1.4)}/><circle cx="13" cy="-12" r="2.4" fill="none" stroke="${C.thatchD}" stroke-width="1"/>
      <path d="M-4 0 L-11 -4 L-11 -20" ${st(1.5)} fill="none"/><path d="M-14 -24 Q-11 -28 -8 -24 Q-11 -20 -14 -24Z" fill="${C.green}" ${st(1.1)}/></g>`;


  // Бронзовый век, 7-й уровень строится на этих основах (нарядные облики); 5-й — свой, базовый (ниже, в B).
  // канал у полей с 5-го уровня — не на рисунке, а полосой воды по левому краю клетки (ui: класс canal), чтобы каналы соседей смыкались
  const fieldIrrigated = rows(C.furrowD, (x, y) => earBz(x + 2, y)) + sheaf(52, 54);
  const lumberShed = shadow(28) + pine(12, 34, 1.15) + `
      <path d="M22 26 L50 20 L56 26 L28 32Z" fill="${C.woodD}" ${st()}/>
      <path d="M28 32 L28 50 M54 26 L54 46" stroke="${C.woodD}" stroke-width="3"/>` +
      logEnds(38, 48) + logEnds(34, 39) + logEnds(44, 39, .9);
  // каменоломня бронзы: подъёмных кранов ещё нет (блочный подъёмник у греков — с VI в. до н. э.) — глыбу везут на санях
  // по деревянным каткам и подваживают рычагом
  const quarrySledge = shadow(28) + `
      <path d="M6 44 L10 22 L24 16 L36 20 L36 44Z" fill="${C.stoneD}" ${st()}/>` +
      block(8, 46, 14, 8) + block(23, 46, 14, 8) + block(15, 38, 14, 8) + `
      ${[42, 51, 60].map(x => `<ellipse cx="${x}" cy="54" rx="3.2" ry="2.6" fill="${C.wood}" ${st(1.1)}/><circle cx="${x}" cy="54" r=".9" fill="${C.woodD}"/>`).join('')}
      <path d="M37 50 L62 50 Q64 47 62 45" fill="none" stroke="${C.woodD}" stroke-width="3" stroke-linecap="round"/>
      <path d="M37 50 Q35 48 37 46 L60 46" fill="none" stroke="${C.woodD}" stroke-width="2.2" stroke-linecap="round"/>` +
      ashlar(41, 34, 17, 11) + `
      <path d="M62 45 Q66 40 70 41" fill="none" stroke="#c9a26a" stroke-width="1.4"/>
      <path d="M34 58 L44 40" stroke="${C.wood}" stroke-width="2.6" stroke-linecap="round"/>`;

  // каменный топор медно-каменного века: шлифованное лезвие из зелёного камня вставлено в рукоять и примотано ремнём
  const stoneAxe = (x, y, s = 1, rot = 0) => `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})">
      <path d="M0 24 L0 -10" stroke="${O}" stroke-width="5.4" stroke-linecap="round"/><path d="M0 24 L0 -10" stroke="${C.wood}" stroke-width="3.4" stroke-linecap="round"/>
      <path d="M3 -9 Q-2 -12 -8 -12 Q-14 -11 -15 -6.5 Q-14 -2 -8 -1 Q-2 -1 3 -4Z" fill="#7f8f7a" ${st(1.4)}/>
      <path d="M-13 -8 Q-12 -4 -9 -3" fill="none" stroke="#a9b6a1" stroke-width="1.1"/>
      <path d="M-2.6 -10.5 L2.6 -6 M-2.6 -6.5 L2.6 -2.5 M-2.6 -2.5 L2.6 1" stroke="#c9a26a" stroke-width="1.3"/></g>`;
  // лиственное дерево (дуб, платан): ствол и три кроны
  const leafTree = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">
      <rect x="-1.8" y="0" width="3.6" height="10" fill="${C.woodD}" ${st(1.2)}/>
      <circle cx="-5" cy="-3" r="6.5" fill="${C.greenD}" ${st(1.3)}/><circle cx="5" cy="-4" r="6.5" fill="${C.greenD}" ${st(1.3)}/>
      <circle cx="0" cy="-9" r="7" fill="${C.green}" ${st(1.3)}/><circle cx="-2" cy="-11" r="1.6" fill="#a3c060"/></g>`;
  // литейня бронзы: мехи-горшки (глиняный горшок, затянутый кожей, — по египетским росписям), тигель
  const potBellows = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">
      <path d="M-6 0 Q-7 7 0 7 Q7 7 6 0Z" fill="#b5703f" ${st(1.3)}/><path d="M-6 0 Q0 -4.5 6 0 Q0 2 -6 0Z" fill="#d9b98a" ${st(1.1)}/>
      <path d="M0 -1.5 L0 -11" stroke="${C.woodD}" stroke-width="1.6" stroke-linecap="round"/></g>`;
  const crucible = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">
      <path d="M-5 -2 L5 -2 L3 5 L-3 5Z" fill="#8b7f73" ${st(1.3)}/><ellipse cx="0" cy="-2" rx="5" ry="1.7" fill="${C.fireL}" ${st(1)}/></g>`;
  // кипрская стойка-треножник из бронзовых прутьев (XIII–XII вв. до н. э.) с котлом
  const rodTripod = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">
      ${['M-8 10 L-3 -4', 'M8 10 L3 -4', 'M0 11 L0 -4'].map(d => `<path d="${d}" stroke="${O}" stroke-width="3.6" stroke-linecap="round"/><path d="${d}" stroke="${C.bronze}" stroke-width="1.8" stroke-linecap="round"/>`).join('')}
      <path d="M-6 3 L6 3" stroke="${C.bronzeD}" stroke-width="1.2"/>
      <path d="M-8 -5 Q-7 -13 0 -13 Q7 -13 8 -5Z" fill="${C.bronze}" ${st(1.4)}/><path d="M-9 -5 L9 -5" stroke="${O}" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M-5 -10 Q0 -12 5 -10" fill="none" stroke="#e8c67a" stroke-width="1"/></g>`;

  // вода гавани: волна во всю ширину рисунка и до самого низа, без обводки по краям — на карте сливается с морем
  const harbor = y => `<path d="M0 ${y} Q16 ${y - 4} 32 ${y} Q48 ${y + 4} 64 ${y} L64 64 L0 64Z" fill="${C.water}"/>
      <path d="M0 ${y} Q16 ${y - 4} 32 ${y} Q48 ${y + 4} 64 ${y}" fill="none" stroke="${C.waterD}" stroke-width="1.6"/>`;

  // ---------- здания: облик меняется с эпохой и на 4-м уровне — и заметно ----------
  const B = {
    house0: shadow(20) + roundHut(32, 36, 1),
    // ур. 4+: уже не хижина, а двор — большой дом на каменном цоколе, вторая хижина, кувшин
    house1: shadow(29) + smoke(52, 8) + roundHut(48, 31, .62) + roundHut(25, 36, 1.02, { base: true, wall: C.plaster, knob: true }) + pithos(54, 50, .42),
    house2: shadow(24) + H2,

    // поле — «нарисовано» прямо на земле клетки: без подставки и тени
    field0: rows(C.furrow, (x, y) => sprout(x, y, .85)),
    // ур. 3+: мотыжное поле медного века — ряд мелкого зеленоватого ячменя, ряд чечевицы
    field1: rows(C.furrow, (x, y, r) => r % 2 ? lentil(x - 2, y) : earCu(x, y)),
    goatpen0: shadow(26) + fence(40) + goat(30, 42, 1.25, C.white),
    // ур. 4+: каменная овчарня с пастушьей хижиной и стадом
    goatpen1: shadow(29) + roundHut(51, 24, .48) +
      `<path d="M5 45 A27 11 0 0 1 59 45" fill="none" stroke="${O}" stroke-width="7.5" stroke-linecap="round"/><path d="M5 45 A27 11 0 0 1 59 45" fill="none" stroke="${C.stone}" stroke-width="4.6" stroke-linecap="round"/>` +
      goat(28, 40, .78, C.mudD) + goat(17, 47, .95, C.white) + goat(41, 48, 1, C.white, true) +
      `<path d="M5 45 A27 11 0 0 0 59 45" fill="none" stroke="${O}" stroke-width="7.5" stroke-linecap="round"/><path d="M5 45 A27 11 0 0 0 59 45" fill="none" stroke="${C.stone}" stroke-width="4.6" stroke-linecap="round"/>
      <path d="M14 53.5 l0 3 M24 55.5 l0 3 M34 56 l0 3 M44 55 l0 3 M53 52 l0 3" stroke="${C.stoneD}" stroke-width="1.3"/>`,
    goatpen2: shadow(28) + `
      <path d="M30 14 L58 14 L58 40 L30 40Z" fill="${C.mudD}" ${st()}/>
      <path d="M26 16 L62 10 L62 16 L26 22Z" fill="${C.woodD}" ${st()}/>
      <rect x="40" y="26" width="9" height="14" fill="${C.dark}" ${st(1.3)}/>` +
      fence(42) + goat(18, 44, 1.1, C.white) + goat(42, 46, 1, C.mudD, true) + `
      <ellipse cx="54" cy="52" rx="6" ry="3.4" fill="${C.white}" ${st(1.3)}/><path d="M48 52 l0 -2 Q54 47 60 50 l0 2" fill="${C.white}" ${st(1.3)}/>`,

    // вырубка ещё в лесу: пень с каменным топором, вокруг — сосны и дуб
    lumber0: shadow(22) + pine(46, 22, .8) + pine(10, 32, .95) + leafTree(54, 36, .95) + `
      <path d="M20 42 L20 53 Q32 57 44 53 L44 42Z" fill="${C.wood}" ${st()}/>
      <ellipse cx="32" cy="42" rx="12" ry="4.4" fill="${C.wheat}" ${st()}/>
      <ellipse cx="32" cy="42" rx="6" ry="2.2" fill="none" stroke="${C.wheatD}" stroke-width="1.2"/>` + stoneAxe(37, 18, .95, 18) + `
      <path d="M12 54 l4 -2 M48 56 l4 -3 M16 48 l3 1" stroke="${C.wheatD}" stroke-width="2"/>`,
    // ур. 3+: лес ещё стоит, у вырубки — пара брёвен и каменный топор
    lumber1: shadow(26) + pine(30, 16, .75) + pine(8, 28, .95) + leafTree(55, 24, .9) + logEnds(28, 50) + logEnds(31, 41, .85) +
      stoneAxe(53, 40, .9, 14) + pine(4, 50, .6),


    quarry0: shadow(24) + `
      <path d="M8 52 L14 30 L26 22 L40 26 L50 20 L58 34 L56 52Z" fill="${C.stone}" ${st()}/>
      <path d="M14 30 L22 38 L26 22 M40 26 L36 40 L50 20 M22 38 L36 40 L44 52" fill="none" stroke="${C.stoneD}" stroke-width="1.4"/>
      <path d="M33 33 L39 34.5 L35 42Z M20 33 L25 32 L22.5 39Z" fill="${C.wood}" ${st(1.1)}/>
      <ellipse cx="46" cy="53" rx="6" ry="5" fill="#7f8f7a" ${st(1.4)}/><path d="M42 51 Q44 48 48 49" fill="none" stroke="#a9b6a1" stroke-width="1.1"/>
      <path d="M14 56 l3 -1 M26 57 l3 0 M56 56 l2 -2" stroke="${C.stoneD}" stroke-width="1.8" stroke-linecap="round"/>`,
    // ур. 3+: выработка ещё без тёски — скалу колют деревянными клиньями и рычагом, камень идёт рваный, как есть
    quarry1: shadow(28) + `
      <path d="M4 42 L7 22 L17 12 L30 15 L39 8 L52 14 L60 26 L60 42Z" fill="${C.stone}" ${st()}/>
      <path d="M17 12 L21 26 L15 42 M39 8 L35 21 L43 31 L41 42 M21 26 L35 21 M52 14 L49 27 L60 30" fill="none" stroke="${C.stoneD}" stroke-width="1.4"/>
      <path d="M32 19 L38 20.5 L34.5 27Z M18.5 22 L24 21.5 L21.5 28.5Z M46 25 L51.5 24.5 L49 31Z" fill="${C.wood}" ${st(1.1)}/>
      <path d="M43 31 L58 31 L60 42 L41 42Z" fill="${C.stoneD}" ${st(1.4)}/>
      <path d="M38 50 L58 33" stroke="${C.woodD}" stroke-width="3" stroke-linecap="round"/>
      <path d="M5 54 L7 47 L13 45 L17 49 L15 55Z" fill="${C.stone}" ${st(1.3)}/>
      <path d="M15 56 L17 49 L24 47 L28 52 L25 57Z" fill="#a9a194" ${st(1.3)}/>
      <path d="M9 47 L12 41 L18 40 L21 45 L16 49Z" fill="${C.stone}" ${st(1.3)}/>
      <path d="M26 58 L28 52 L34 51 L36 56 L32 59Z" fill="${C.stone}" ${st(1.3)}/>
      <ellipse cx="48" cy="54" rx="5.5" ry="4.5" fill="#7f8f7a" ${st(1.4)}/><path d="M44.5 52 Q46 49.5 49.5 50" fill="none" stroke="#a9b6a1" stroke-width="1.1"/>
      <path d="M54 52 L62 52 L60.5 59 L55.5 59Z" fill="${C.thatch}" ${st(1.2)}/><path d="M55 55.5 L61.5 55.5" stroke="${C.thatchD}" stroke-width="1"/>
      <circle cx="56.5" cy="51.5" r="1.6" fill="${C.stone}" ${st(.8)}/><circle cx="59.5" cy="51" r="1.4" fill="${C.stoneD}" ${st(.8)}/>
      <path d="M38 60 l3 -1 M6 60 l3 0" stroke="${C.stoneD}" stroke-width="1.8" stroke-linecap="round"/>`,


    // мастерская резчиков: верстак, глыба зелёного камня, резец и киянка, нитка бус
    workshop0: shadow(22) + `
      <rect x="8" y="38" width="48" height="6" rx="1" fill="${C.wood}" ${st()}/>
      <path d="M12 44 L12 54 M52 44 L52 54" stroke="${C.woodD}" stroke-width="3"/>
      <path d="M14 38 L16 28 L26 24 L34 30 L32 38Z" fill="${C.pic}" ${st(1.6)}/>
      <path d="M18 30 L24 33 L28 28" fill="none" stroke="${C.picD}" stroke-width="1.4"/>
      <path d="M38 36 L48 22" stroke="${C.stoneD}" stroke-width="2.6" stroke-linecap="round"/>
      <rect x="44" y="12" width="12" height="7" rx="2" transform="rotate(30 50 15)" fill="${C.wood}" ${st(1.4)}/>
      <path d="M36 50 Q44 56 52 50" fill="none" stroke="${C.woodD}" stroke-width="1.2"/>
      ${[38, 41.5, 45, 48.5].map((x, i) => `<circle cx="${x}" cy="${52 + (i % 2)}" r="2" fill="${C.pic}" stroke="${O}" stroke-width="1"/>`).join('')}`,
    // мастерская резчиков побогаче: навес, на верстаке — глыба пикролита и лучковое сверло для бус;
    //   готовые фигурки с раскинутыми руками, связка подвесок
    workshop1: shadow(28) + `
      <path d="M7 22 L7 55 M41 18 L41 50" stroke="${C.woodD}" stroke-width="3"/>
      <path d="M1 20 L47 13 L48 19 L2 26Z" fill="${C.thatch}" ${st()}/><path d="M9 23 l0 -4 M19 21.5 l0 -4.5 M29 20 l0 -4.5 M39 18.5 l0 -4" stroke="${C.thatchD}" stroke-width="1.2"/>
      <path d="M11 25 Q20 32 31 23" fill="none" stroke="${C.woodD}" stroke-width="1.1"/>
      ${[13, 17, 21, 25, 29].map((x, i) => `<circle cx="${x}" cy="${[26.6, 28.6, 29.4, 28.4, 25.6][i]}" r="1.8" fill="${i === 2 ? C.white : C.pic}" stroke="${O}" stroke-width=".9"/>`).join('')}
      <rect x="4" y="41" width="40" height="5" rx="1" fill="${C.wood}" ${st(1.4)}/>
      <path d="M9 46 L9 55 M39 46 L39 55" stroke="${C.woodD}" stroke-width="2.6"/>
      <path d="M8 41 L10 33 L18 30 L24 35 L22 41Z" fill="${C.pic}" ${st(1.4)}/><path d="M11 35 L16 37 L19 33" fill="none" stroke="${C.picD}" stroke-width="1.2"/>
      <path d="M32 41 L32 28" stroke="${C.woodD}" stroke-width="1.8"/><circle cx="32" cy="28" r="1.8" fill="${C.wood}" ${st(1)}/>
      <path d="M24 33 Q32 29 40 33" fill="none" stroke="${C.woodD}" stroke-width="2.2" stroke-linecap="round"/><path d="M24.5 33.5 L32 35 L39.5 33.5" fill="none" stroke="${O}" stroke-width=".9"/>
      <path d="M14 58 l3 -1 M24 59 l2 -2 M30 57 l3 0" stroke="${C.picD}" stroke-width="1.6" stroke-linecap="round"/>` +
      `<rect x="47" y="54" width="12" height="4" rx="1" fill="${C.stone}" ${st(1.2)}/>` + idol(53, 43, .62) + idol(27, 52, .36, '#e6dcc2', C.stoneD),
    // гончарная мастерская бронзового века: мастерская из сырца с плоской кровлей, к ней пристроена печь для обжига;
    //   у печи — дрова, перед дверью — белый пифос и красный кувшин (белый ангоб и «базовое кольцо» — кипрский вывоз)
    workshop2: shadow(30) + `
      <rect x="4" y="22" width="30" height="30" fill="${C.mud}" ${st()}/><rect x="2" y="17" width="34" height="6" fill="${C.woodD}" ${st()}/>
      <path d="M4 32 L34 32 M4 42 L34 42 M14 22 L14 32 M26 22 L26 32 M9 32 L9 42 M20 32 L20 42 M31 32 L31 42" stroke="${C.mudD}" stroke-width="1.1"/>
      <rect x="15" y="36" width="9" height="16" fill="${C.dark}" ${st(1.3)}/>
      <path d="M30 54 Q30 30 44 28 Q58 30 58 54Z" fill="${C.mudD}" ${st()}/>
      <path d="M38 54 Q38 43 44 43 Q50 43 50 54Z" fill="${C.dark}" ${st(1.4)}/>` + flame(44, 50, .85) + smoke(44, 24) + `
      <path d="M55 58 L64 58 M54 54.5 L63 54.5 M56 51 L63 51" stroke="${O}" stroke-width="4" stroke-linecap="round"/>
      <path d="M55 58 L64 58 M54 54.5 L63 54.5 M56 51 L63 51" stroke="${C.wood}" stroke-width="2.4" stroke-linecap="round"/>` +
      pithos(9, 53, .42, C.white) + `<path d="M5 53 Q9 54.5 13 53" fill="none" stroke="${C.red}" stroke-width="1.3"/>` +
      `<path d="M26 60 Q24 54 27 51 L31 51 Q34 54 32 60Z" fill="${C.terra}" ${st(1.3)}/>`,
    store0: shadow(20) + `
      <path d="M12 30 L52 30 L47 53 L17 53Z" fill="${C.thatch}" ${st()}/>
      <path d="M14 37 L50 37 M15 44 L49 44 M22 30 L24 53 M32 30 L32 53 M42 30 L40 53" stroke="${C.thatchD}" stroke-width="1.4"/>
      <path d="M12 30 Q32 18 52 30" fill="${C.wheat}" ${st()}/>
      <path d="M22 26 l2 -4 M32 22 l0 -5 M42 26 l-2 -4" stroke="${C.wheatD}" stroke-width="2" stroke-linecap="round"/>`,
    store1: shadow(26) + pithos(22, 38, 1.1) + pithos(44, 40, .95, C.mudD),
    store2: shadow(28) + `
      <rect x="22" y="16" width="36" height="32" fill="${C.stone}" ${st()}/>
      <rect x="20" y="12" width="40" height="6" fill="${C.woodD}" ${st()}/>
      <path d="M22 26 L58 26 M22 37 L58 37 M34 16 L34 26 M46 26 L46 37 M30 37 L30 48 M50 37 L50 48" stroke="${C.stoneD}" stroke-width="1.3"/>
      <rect x="36" y="33" width="9" height="15" fill="${C.dark}" ${st(1.3)}/>` + pithos(14, 41, .85) + pithos(54, 45, .62, C.mudD),

    mine0: shadow(26) + `
      <path d="M4 54 Q14 18 34 14 Q54 18 60 54Z" fill="${C.stoneD}" ${st()}/>
      <path d="M22 54 L22 36 Q32 28 42 36 L42 54Z" fill="${C.dark}" ${st()}/>
      <path d="M20 54 L20 34 M44 54 L44 34 M18 34 L46 34" stroke="${C.wood}" stroke-width="3.4" stroke-linecap="round"/>
      <circle cx="14" cy="40" r="2" fill="#4fa58d"/><circle cx="50" cy="30" r="2" fill="#4fa58d"/><circle cx="30" cy="22" r="1.6" fill="#4fa58d"/>`,
    mine1: shadow(28) + `
      <path d="M4 50 Q12 16 30 12 Q48 16 54 50Z" fill="${C.stoneD}" ${st()}/>
      <path d="M18 50 L18 34 Q28 26 38 34 L38 50Z" fill="${C.dark}" ${st()}/>
      <path d="M16 50 L16 32 M40 50 L40 32 M14 32 L42 32" stroke="${C.wood}" stroke-width="3.2" stroke-linecap="round"/>
      <path d="M40 42 L60 42 L57 52 L43 52Z" fill="${C.wood}" ${st()}/>
      <circle cx="46" cy="40" r="3" fill="#4fa58d" ${st(1.2)}/><circle cx="52" cy="39" r="3.2" fill="${C.copper}" ${st(1.2)}/><circle cx="57" cy="41" r="2.4" fill="#4fa58d" ${st(1.2)}/>
      <circle cx="46" cy="55" r="2.4" fill="${C.dark}"/><circle cx="56" cy="55" r="2.4" fill="${C.dark}"/>
      <path d="M20 20 L29 3 L38 20" fill="none" stroke="${C.wood}" stroke-width="3" stroke-linecap="round"/>
      <circle cx="29" cy="6" r="3.2" fill="${C.woodD}" ${st(1.2)}/><path d="M29 9 L29 30" stroke="${O}" stroke-width="1.1"/>
      <path d="M2 56 Q6 46 12 46 Q17 48 18 56Z" fill="#6f7d5a" ${st(1.3)}/><circle cx="8" cy="50" r="1.8" fill="#4fa58d"/><circle cx="13" cy="51" r="1.8" fill="${C.copper}"/>`,
    mine2: shadow(30) + `
      <path d="M2 46 Q8 16 24 12 Q40 16 44 46Z" fill="${C.stoneD}" ${st()}/>
      <path d="M12 46 L12 32 Q20 26 28 32 L28 46Z" fill="${C.dark}" ${st()}/>
      <path d="M10 46 L10 30 M30 46 L30 30 M8 30 L32 30" stroke="${C.wood}" stroke-width="3" stroke-linecap="round"/>
      <path d="M42 54 L44 30 Q50 24 56 30 L58 54Z" fill="${C.mudD}" ${st()}/>
      <path d="M46 54 Q46 44 50 44 Q54 44 54 54Z" fill="${C.dark}"/>` + flame(50, 50, .7) + smoke(50, 24) + ingotShape(24, 52, .55),

    port0: harbor(40) + `
      <path d="M8 48 q4 -2 8 0 M40 50 q4 -2 8 0" stroke="${C.sky}" stroke-width="1.6" fill="none"/>
      <rect x="30" y="28" width="30" height="5" fill="${C.wood}" ${st()}/>
      <path d="M34 33 L34 52 M44 33 L44 52 M54 33 L54 52" stroke="${C.woodD}" stroke-width="3"/>
      <path d="M6 40 Q16 50 28 40Z" fill="${C.wood}" ${st()}/>
      <path d="M10 36 L24 44" stroke="${C.woodD}" stroke-width="2"/>`,
    port1: harbor(42) + `
      <path d="M8 50 q4 -2 8 0 M44 52 q4 -2 8 0" stroke="${C.sky}" stroke-width="1.6" fill="none"/>
      <path d="M8 42 Q24 54 48 42Z" fill="${C.wood}" ${st()}/>
      <path d="M28 44 L28 10" stroke="${C.woodD}" stroke-width="2.4"/>
      <path d="M16 14 L40 14 L38 36 L18 36Z" fill="${C.white}" ${st()}/>
      <path d="M16 14 L40 14" stroke="${C.woodD}" stroke-width="2.4"/>
      <path d="M48 42 Q54 36 56 30" fill="none" stroke="${C.woodD}" stroke-width="2.4"/>`,
    port2: harbor(44) + `
      <path d="M6 44 Q28 58 52 44 Q58 40 60 32 L56 34 Q52 42 46 44Z" fill="${C.woodD}" ${st()}/>
      <path d="M6 44 Q4 38 8 34" fill="none" stroke="${C.woodD}" stroke-width="2.6"/>
      <path d="M30 46 L30 6" stroke="${C.dark}" stroke-width="2.6"/>
      <path d="M14 10 L46 10 L44 38 L16 38Z" fill="${C.white}" ${st()}/>
      <path d="M14 18 L46 18 M15 26 L45 26 M16 32 L44 32" stroke="${C.red}" stroke-width="2"/>
      <path d="M14 10 L46 10 M16 38 L44 38" stroke="${C.dark}" stroke-width="2.2"/>` + ingotShape(48, 52, .45),

    // Литейня (1): каменный горн с глиняной трубкой-соплом, мехи-горшки, тигель с бронзой, медный слиток
    foundry0: shadow(26) + `
      <path d="M8 54 L8 34 Q8 28 14 28 L30 28 Q36 28 36 34 L36 54Z" fill="${C.stone}" ${st()}/>
      <path d="M8 40 L36 40 M8 47 L36 47 M16 28 L16 40 M27 28 L27 40 M12 40 L12 47 M22 40 L22 47 M31 40 L31 47 M17 47 L17 54 M28 47 L28 54" stroke="${C.stoneD}" stroke-width="1.1"/>
      <path d="M15 54 Q15 44 22 44 Q29 44 29 54Z" fill="${C.dark}" ${st(1.3)}/>` + flame(22, 51, .75) + crucible(22, 25, .9) + smoke(22, 16) + `
      <path d="M36 47 L46 49" stroke="#b5703f" stroke-width="3" stroke-linecap="round"/><path d="M36 47 L46 49" stroke="${O}" stroke-width=".8"/>` +
      potBellows(47, 50, .85) + potBellows(57, 48, .85) + ingotShape(14, 59, .42),
    // Литейня (3): мастерская из сырца под плоской кровлей; из тигля льют бронзу в каменную форму; слитки меди
    foundry1: shadow(30) + `
      <rect x="4" y="20" width="34" height="34" fill="${C.mud}" ${st()}/><rect x="2" y="15" width="38" height="6" fill="${C.woodD}" ${st()}/>
      <path d="M4 30 L38 30 M4 42 L38 42 M14 20 L14 30 M28 20 L28 30 M9 30 L9 42 M21 30 L21 42 M33 30 L33 42" stroke="${C.mudD}" stroke-width="1.1"/>
      <path d="M12 54 Q12 40 21 40 Q30 40 30 54Z" fill="${C.dark}" ${st(1.3)}/>` + flame(21, 51, .8) + `
      <rect x="31" y="8" width="5" height="8" fill="${C.mudD}" ${st(1.1)}/>` + smoke(33.5, 6) + `
      <g transform="rotate(35 47 34)">` + crucible(47, 34, 1) + `</g>
      <path d="M49 38 Q51 44 50.5 48" stroke="${C.fire}" stroke-width="3" stroke-linecap="round"/><path d="M49 38 Q51 44 50.5 48" stroke="${C.fireL}" stroke-width="1.2" stroke-linecap="round"/>
      <rect x="42" y="48" width="18" height="7" rx="1.5" fill="#9c958a" ${st(1.3)}/><path d="M47 51.5 L55 51.5 Q57 50 57 53 L47 53Z" fill="${C.fireL}" ${st(.8)}/>` +
      ingotShape(14, 60, .4) + ingotShape(30, 60, .4),
    // Царская литейня (7): мастерская из тёсаного камня с трубой, горн, мехи; штабель медных слитков-«шкур»,
    //   кипрская стойка-треножник с котлом — готовая бронза на продажу
    foundry2: shadow(30) + `
      <rect x="3" y="22" width="34" height="32" fill="#e6dcc2" ${st()}/>
      ${[30, 38, 46].map((y, r) => `<path d="M3 ${y} L37 ${y}" stroke="#bfb293" stroke-width="1.1"/>` + [0, 1, 2].map(i => `<path d="M${9 + i * 11 + (r % 2) * 5} ${y - 8} l0 8" stroke="#bfb293" stroke-width="1.1"/>`).join('')).join('')}
      <rect x="1" y="17" width="38" height="6" fill="${C.woodD}" ${st()}/><rect x="27" y="5" width="7" height="13" fill="#d6ccb3" ${st(1.2)}/>` + smoke(30.5, 4) + `
      <path d="M10 54 Q10 38 20 38 Q30 38 30 54Z" fill="${C.dark}" ${st(1.3)}/>` + flame(20, 51, .9) + `
      <rect x="15" y="34" width="10" height="3" fill="${C.bronze}" ${st(1)}/>` +
      potBellows(40, 52, .7) + ingotShape(52, 59, .45) + ingotShape(52, 55, .45) + ingotShape(52, 51, .45) + rodTripod(52, 34, 1.05),

    // виноградник: лоза на террасе → две террасы → давильня с амфорами
    vineyard0: shadow(26) + terrace(44) + vine(20, 36, 1.1) + vine(42, 34, 1.15),
    vineyard1: shadow(27) + terrace(46) + vine(14, 38, 1) + vine(32, 37, 1.05) + vine(50, 36, 1) +
      `<path d="M44 60 L56 60 L54 55 L46 55Z" fill="${C.thatch}" ${st(1.2)}/>` + grapes(50, 53, .32),
    vineyard2: shadow(30) + terrace(52) + vine(10, 44, .85) + vine(24, 43, .9) + `
      <rect x="34" y="22" width="24" height="20" fill="${C.plaster}" ${st()}/><path d="M32 23 L46 14 L60 23Z" fill="${C.terra}" ${st(1.5)}/>
      <rect x="41" y="30" width="9" height="12" fill="${C.dark}" ${st(1.3)}/>` + amphoraShape(54, 50, .55) + amphoraShape(44, 52, .5, '#b85d33') + grapes(30, 26, .55),
    // оливковая роща: две оливы → три и корзина → и маслодавильня
    olivegrove0: shadow(24) + olive(22, 40, 1.15) + olive(42, 42, 1.25),
    olivegrove1: shadow(28) + olive(14, 36, 1) + olive(34, 32, 1.15) + olive(50, 42, 1.05) + `
      <path d="M20 52 L36 52 L34 58 L22 58Z" fill="${C.thatch}" ${st(1.3)}/>
      ${[23, 27, 31].map(x => `<circle cx="${x}" cy="51" r="1.8" fill="#3c4a2a"/>`).join('')}`,
    olivegrove2: shadow(30) + olive(14, 34, 1) + olive(30, 28, 1.05) + `
      <circle cx="44" cy="46" r="11" fill="${C.stone}" ${st()}/><circle cx="44" cy="46" r="4" fill="${C.stoneD}" ${st(1.2)}/>
      <path d="M44 46 L62 36" stroke="${C.woodD}" stroke-width="3.4" stroke-linecap="round"/>
      <rect x="38" y="30" width="12" height="7" rx="2" fill="${C.stoneD}" ${st(1.3)}/>` + amphoraShape(20, 50, .5, '#b85d33') + amphoraShape(28, 52, .48),

    scribe0: shadow(18) + tablet(32, 36, 1.2) + `<path d="M44 52 L56 26" stroke="${C.woodD}" stroke-width="2.6" stroke-linecap="round"/>`,
    // ур. 4+: навес писцов — скамья с табличками, печать, кувшин-архив
    scribe1: shadow(28) + `
      <path d="M10 22 L10 55 M52 18 L52 55" stroke="${C.woodD}" stroke-width="3"/>
      <path d="M4 18 L58 12 L59 18 L5 25Z" fill="${C.thatch}" ${st()}/><path d="M14 22 l0 -4 M26 21 l0 -5 M38 19 l0 -4 M50 18 l0 -4" stroke="${C.thatchD}" stroke-width="1.2"/>
      <rect x="12" y="44" width="38" height="5" rx="1" fill="${C.wood}" ${st(1.4)}/>
      <path d="M16 49 L16 56 M46 49 L46 56" stroke="${C.woodD}" stroke-width="2.4"/>` +
      tablet(21, 35, .72) + tablet(34, 36, .66) + `
      <rect x="42" y="36" width="6" height="8" rx="2.5" fill="${C.stone}" ${st(1.2)}/><path d="M43 39 l4 0 M43 41.5 l4 0" stroke="${C.stoneD}" stroke-width="1"/>` +
      pithos(58, 49, .45),
    scribe2: shadow(28) + `
      <rect x="8" y="20" width="36" height="34" fill="${C.plaster}" ${st()}/>
      <rect x="6" y="15" width="40" height="6" fill="${C.woodD}" ${st()}/>
      <rect x="20" y="38" width="10" height="16" fill="${C.dark}" ${st(1.3)}/>
      <rect x="12" y="26" width="7" height="7" fill="${C.dark}" ${st(1.2)}/><rect x="31" y="26" width="7" height="7" fill="${C.dark}" ${st(1.2)}/>` +
      tablet(52, 42, .8),
  };

  // ---------- бронзовый век, 4+ уровень: тот же облик, но богаче ----------
  // ур. 4+ бронзового века: второй этаж, виноградная лоза над пристройкой, флажок
  B.house3 = shadow(28) + `
    <rect x="12" y="8" width="26" height="14" fill="${C.plaster}" ${st()}/>
    <rect x="10" y="4" width="30" height="5" fill="${C.woodD}" ${st()}/>
    <path d="M13 4 l0 -2.5 M21 4 l0 -2.5 M29 4 l0 -2.5 M37 4 l0 -2.5" stroke="${O}" stroke-width="1.2"/>
    <rect x="16" y="11" width="6" height="6" fill="${C.dark}" ${st(1.2)}/><rect x="28" y="11" width="6" height="6" fill="${C.dark}" ${st(1.2)}/>` + H2 + `
    <path d="M38 31 Q47 25 57 30" stroke="${C.greenD}" stroke-width="2.6" fill="none"/>
    <circle cx="42" cy="29" r="2.6" fill="${C.green}" ${st(1)}/><circle cx="48" cy="27" r="2.8" fill="${C.green}" ${st(1)}/><circle cx="54" cy="28.5" r="2.6" fill="${C.green}" ${st(1)}/>
    <circle cx="46" cy="31" r="1.4" fill="#6b3b6e"/><circle cx="52" cy="31.5" r="1.4" fill="#6b3b6e"/>` + pennant(58, 30) + pithos(59, 51, .42);
  B.field3 = fieldIrrigated + olive(52, 16, 1.05) + sheaf(16, 57) + sheaf(31, 59) + pithos(42, 54, .42, C.white);
  B.goatpen3 = B.goatpen2 + pennant(60, 12) + cheeseStack(12, 34) + goat(30, 53, .72, C.mudD, true) + pithos(6, 52, .4, C.white);
  B.lumber3 = pine(56, 15, .8) + lumberShed + `
    <rect x="1" y="45" width="24" height="5" rx="1" fill="${C.wood}" ${st(1.4)}/>
    <circle cx="6" cy="53" r="4" fill="${C.woodD}" ${st(1.3)}/><circle cx="20" cy="53" r="4" fill="${C.woodD}" ${st(1.3)}/>` + logEnds(14, 41, .55) + logEnds(12, 36, .5);
  B.quarry3 = quarrySledge + ashlar(12, 10, 12, 7) + ashlar(22, 6, 11, 7) + `
    <path d="M6 61 L36 61" stroke="${C.woodD}" stroke-width="2.6" stroke-linecap="round"/><path d="M6 58 L1 55" stroke="${C.woodD}" stroke-width="1.6"/>` + ashlar(9, 53, 25, 7);
  // ур. 7+: на плоской кровле сохнут кувшины, у двери — полка с расписной посудой, флажок: мастерская работает на вывоз
  B.workshop3 = B.workshop2 + [8, 16, 24].map((x, i) => `<path d="M${x - 3} 17 Q${x - 4.5} 12 ${x - 1.5} 9 L${x + 1.5} 9 Q${x + 4.5} 12 ${x + 3} 17Z" fill="${i === 1 ? C.terra : C.white}" ${st(1.2)}/>
      <path d="M${x - 3.6} 13.5 Q${x} 15.5 ${x + 3.6} 13.5" stroke="${i === 1 ? C.white : C.red}" stroke-width="1.2" fill="none"/>`).join('') + pennant(32, 17) + `
    <rect x="13" y="46" width="13" height="3" rx="1" fill="${C.wood}" ${st(1.1)}/>
    <path d="M14.5 46 Q13 42 15.5 40 L18.5 40 Q21 42 19.5 46Z M21 46 Q20 43 22 41.5 L24 41.5 Q26 43 25 46Z" fill="${C.white}" ${st(1)}/>
    <path d="M14 43 Q17 44.2 20 43" stroke="${C.red}" stroke-width="1" fill="none"/>` +
    pithos(19, 61, .34, C.white) + `<ellipse cx="38" cy="61" rx="5" ry="2.2" fill="${C.terra}" ${st(1.1)}/><ellipse cx="38" cy="59.5" rx="4" ry="1.6" fill="${C.white}" ${st(1)}/>`;
  B.store3 = `<path d="M20 13 L40 2 L60 13Z" fill="${C.thatch}" ${st()}/><path d="M28 13 L40 5 M40 5 L52 13 M34 13 L40 5 L46 13" stroke="${C.thatchD}" stroke-width="1.2"/>` + B.store2 +
    `<rect x="22" y="24" width="36" height="3" fill="${C.red}"/>` + pithos(30, 52, .45, C.white) + ingotShape(47, 57, .38) + ingotShape(47, 53, .38);

  // ---------- железный век: 9-й и 12-й уровни старых зданий и кузница ----------
  // Камень — тёсаные блоки, металл — серое железо, акценты — финикийский пурпур и серебро.
  const IRN = '#8e979e', IRND = '#5f676d', IRNL = '#c9d1d6', PUR = '#7b2d5a', SLV = '#d9dee2';
  const wallA = (x, y, w, h, fill = '#e6dcc2') => {   // кладка из тёсаных блоков: ряды по 6, швы вперевязку
    let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${st()}/>`;
    for (let yy = y + 6, r = 0; yy < y + h - 1; yy += 6, r++) s += `<path d="M${x} ${yy} L${x + w} ${yy}" stroke="${C.stoneD}" stroke-width="1.1"/>`;
    for (let yy = y, r = 0; yy < y + h - 1; yy += 6, r++)
      for (let xx = x + (r % 2 ? 5 : 9); xx < x + w - 2; xx += 10) s += `<path d="M${xx} ${yy} L${xx} ${Math.min(yy + 6, y + h)}" stroke="${C.stoneD}" stroke-width="1"/>`;
    return s;
  };
  // колонна с «протоэолийской» капителью — кипрские завитки-волюты эпохи царств
  const aeolic = (x, y, h, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">
      <rect x="-2.4" y="0" width="4.8" height="${h}" fill="${C.plaster}" ${st(1.3)}/>
      <path d="M-1 0 C-4 0 -8 -1 -8 -4 C-8 -7 -4 -7 -4 -4.5 C-4 -3 -6 -3 -6 -4.2 M1 0 C4 0 8 -1 8 -4 C8 -7 4 -7 4 -4.5 C4 -3 6 -3 6 -4.2" fill="none" ${st(1.3)}/>
      <path d="M-2.6 0 L0 -6 L2.6 0Z" fill="${C.terra}" ${st(1)}/><rect x="-8" y="-0.6" width="16" height="2.2" fill="${C.plaster}" ${st(1)}/></g>`;
  const anvil = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">
      <path d="M-11 -5 L9 -5 L15 -8 L14 -3 Q11 0 6 0 L3 0 L4 5 L8 7 L-8 7 L-4 5 L-4 0 L-8 0 Q-12 -1 -11 -5Z" fill="${IRN}" ${st(1.4)}/>
      <path d="M-9 -4 L9 -4" stroke="${IRNL}" stroke-width="1"/></g>`;
  const hotBar = (x1, y1, x2, y2) => `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="${C.fire}" stroke-width="3.4" stroke-linecap="round"/><path d="M${x1} ${y1} L${x2} ${y2}" stroke="${C.fireL}" stroke-width="1.3" stroke-linecap="round"/>`;
  const hammer = (x, y, s = 1, rot = -35) => `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})">
      <path d="M0 0 L0 16" stroke="${C.woodD}" stroke-width="2.6" stroke-linecap="round"/><rect x="-5" y="-3.5" width="10" height="5" rx="1" fill="${IRND}" ${st(1.2)}/></g>`;
  const ironBars = (x, y, n = 3) => Array.from({ length: n }, (_, i) =>
      `<path d="M${x - 9 + i * 1.5} ${y - i * 3.4} L${x + 9 + i * 1.5} ${y - i * 3.4} L${x + 11 + i * 1.5} ${y - i * 3.4 - 2.6} L${x - 7 + i * 1.5} ${y - i * 3.4 - 2.6}Z" fill="${i % 2 ? IRND : IRN}" ${st(1.1)}/>`).join('');
  const slag = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">
      <path d="M-14 6 Q-12 -6 -3 -8 Q6 -10 12 -2 Q15 2 14 6Z" fill="#2f2a2e" ${st(1.4)}/>
      <circle cx="-5" cy="-3" r="1.4" fill="#6d6a78"/><circle cx="3" cy="-6" r="1.2" fill="#6d6a78"/><circle cx="8" cy="0" r="1.3" fill="#6d6a78"/><circle cx="-9" cy="2" r="1" fill="#6d6a78"/></g>`;
  const silverBowl = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">
      <path d="M-8 -2 Q-7 5 0 5 Q7 5 8 -2Z" fill="${SLV}" ${st(1.3)}/><ellipse cx="0" cy="-2" rx="8" ry="2" fill="#eef1f3" ${st(1.1)}/>
      <ellipse cx="0" cy="-2" rx="4" ry="1" fill="none" stroke="${IRN}" stroke-width=".8"/></g>`;
  const scales = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">
      <path d="M0 0 L0 -16 M-10 -14 L10 -14" stroke="${C.woodD}" stroke-width="2" stroke-linecap="round"/>
      <path d="M-10 -14 L-13 -7 M-10 -14 L-7 -7 M10 -14 L7 -7 M10 -14 L13 -7" stroke="${O}" stroke-width=".9"/>
      <path d="M-14 -7 Q-10 -3 -6 -7Z M6 -7 Q10 -3 14 -7Z" fill="${C.bronze}" ${st(1)}/>
      <path d="M-4 0 L4 0" stroke="${C.woodD}" stroke-width="3" stroke-linecap="round"/><rect x="8.5" y="-10" width="3" height="2" fill="${SLV}" ${st(.6)}/></g>`;
  // кувшин «свободного поля»: на боку птица
  const birdJug = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">
      <path d="M-4 -16 L4 -16 L4 -11 Q12 -7 12 3 Q11 13 0 15 Q-11 13 -12 3 Q-12 -7 -4 -11Z" fill="#f1e2c4" ${st(1.5)}/>
      <path d="M4 -13 Q10 -14 9 -6" fill="none" ${st(1.5)}/>
      <path d="M-11 -4 Q0 -1 11 -4 M-11.5 9 Q0 12 11.5 9" fill="none" stroke="${C.red}" stroke-width="1.6"/>
      <path d="M-6 4 Q-2 -2 4 1 L8 -1 L6 2 Q4 5 -2 5 L-5 7Z" fill="${C.dark}"/><circle cx="5" cy="0.6" r=".7" fill="#f1e2c4"/></g>`;
  const ram = (x, y, s = 1) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0 0 L-8 2 L0 4Z" fill="${C.bronze}" ${st(1.1)}/>`;
  const eyeShip = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><circle r="1.8" fill="${C.white}" ${st(.9)}/><circle r=".7" fill="${C.dark}"/></g>`;
  // финикийский «гаулос»: круглый корпус, конская голова на носу
  const gaulos = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">
      <path d="M-22 0 Q0 14 22 0 Q20 -2 18 -2 L-18 -2 Q-20 -2 -22 0Z" fill="${C.wood}" ${st(1.6)}/>
      <path d="M22 0 Q26 -6 24 -12 Q20 -12 20 -8 L18 -2" fill="${C.wood}" ${st(1.3)}/><circle cx="23" cy="-10" r=".9" fill="${O}"/>
      <path d="M-22 0 Q-25 -5 -22 -10" fill="none" stroke="${C.woodD}" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M0 -2 L0 -30" stroke="${C.dark}" stroke-width="2"/><path d="M-12 -28 L12 -28 L10 -8 L-10 -8Z" fill="#efe6d2" ${st(1.4)}/>
      <path d="M-11 -20 L11 -20 M-10.5 -13 L10.5 -13" stroke="${PUR}" stroke-width="2"/></g>`;

  Object.assign(B, {
    // Дом знатного киприота: портик с протоэолийскими колоннами, верхний этаж, пурпурный флажок
    house5: shadow(31) + wallA(8, 20, 48, 34) + `<rect x="6" y="17" width="52" height="4" fill="${C.woodD}" ${st()}/>` +
      wallA(18, 7, 28, 11) + `<rect x="16" y="4" width="32" height="4" fill="${C.woodD}" ${st(1.5)}/>
      <rect x="23" y="10" width="5" height="5" fill="${C.dark}" ${st(1.1)}/><rect x="36" y="10" width="5" height="5" fill="${C.dark}" ${st(1.1)}/>
      <rect x="25" y="36" width="14" height="18" fill="${C.dark}" ${st(1.3)}/><rect x="14" y="27" width="36" height="3" fill="${C.plaster}" ${st(1.2)}/>` +
      aeolic(19, 36, 18, .85) + aeolic(45, 36, 18, .85) +
      `<path d="M56 18 L56 4" stroke="${C.woodD}" stroke-width="1.8"/><path d="M56 4 L64 6.5 L56 9Z" fill="${PUR}" ${st(1.1)}/>`,

    // Поле-усадьба: журавль для полива, круглое каменное зернохранилище
    field5: `<ellipse cx="4" cy="27" rx="5" ry="2.6" fill="${C.water}" ${st(1.1)}/>` +
      rows(C.furrowD, (x, y) => ear(x + 2, y)) + `
      <path d="M12 26 L12 4" stroke="${C.woodD}" stroke-width="2.6"/><path d="M2 14 L26 4" stroke="${C.woodD}" stroke-width="2.2" stroke-linecap="round"/>
      <circle cx="25" cy="4.6" r="2.4" fill="${C.stoneD}" ${st(1)}/><path d="M3 14 L3 22" stroke="${O}" stroke-width="1"/><path d="M0 22 L6 22 L5 26 L1 26Z" fill="${C.wood}" ${st(1)}/>
      <path d="M40 58 L40 44 Q50 34 60 44 L60 58Z" fill="#ddd2b6" ${st(1.6)}/><path d="M38 45 Q50 28 62 45Z" fill="${C.thatch}" ${st(1.5)}/>
      <rect x="47" y="49" width="6" height="9" fill="${C.dark}" ${st(1.1)}/>` + sheaf(32, 60),

    // Верфь: остов корабля из кедровых брусьев на подпорах, штабель брёвен
    lumber5: shadow(30) + pine(56, 18, .85) + `
      <path d="M4 44 L50 44" stroke="${C.woodD}" stroke-width="3.4" stroke-linecap="round"/>
      ${[10, 18, 26, 34, 42].map(x => `<path d="M${x} 44 Q${x - 6} 34 ${x - 2} 24" fill="none" stroke="${C.wood}" stroke-width="2.6" stroke-linecap="round"/><path d="M${x} 44 Q${x - 6} 34 ${x - 2} 24" fill="none" stroke="${O}" stroke-width=".8"/>`).join('')}
      <path d="M2 26 Q24 22 46 24" fill="none" stroke="${C.woodD}" stroke-width="2.4"/>
      <path d="M50 44 Q58 36 56 24" fill="none" stroke="${C.woodD}" stroke-width="3" stroke-linecap="round"/>
      <path d="M12 44 L10 54 M30 44 L30 54 M46 44 L48 54" stroke="${C.woodD}" stroke-width="2.4"/>` + logEnds(48, 52, .62) + logEnds(52, 46, .55),

    // Царская каменоломня: подъёмник с блоком, высеченная протоэолийская капитель
    quarry5: shadow(30) + `
      <path d="M2 44 L2 18 L16 14 L16 26 L30 24 L30 44Z" fill="#d6ccb3" ${st()}/>
      <path d="M2 26 L16 26 M2 35 L30 35 M9 18 L9 26 M22 26 L22 35 M9 35 L9 44" stroke="${C.stoneD}" stroke-width="1.1"/>
      <path d="M34 54 L44 6 L56 54" fill="none" stroke="${C.woodD}" stroke-width="3" stroke-linecap="round"/><path d="M38 34 L52 34" stroke="${C.woodD}" stroke-width="2.4"/>
      <circle cx="44" cy="8" r="2.6" fill="${IRN}" ${st(1.1)}/><path d="M44 10 L44 22" stroke="${O}" stroke-width="1.1"/>` + ashlar(38, 22, 12, 7) + `
      <g transform="translate(18 52)"><rect x="-13" y="-3" width="26" height="6" fill="#ece2c8" ${st(1.3)}/>
        <path d="M-8 -3 C-11 -3 -15 -5 -15 -9 C-15 -13 -10 -13 -10 -9.5 C-10 -7.5 -12.5 -7.5 -12.5 -9 M8 -3 C11 -3 15 -5 15 -9 C15 -13 10 -13 10 -9.5 C10 -7.5 12.5 -7.5 12.5 -9" fill="none" ${st(1.4)}/>
        <path d="M-4 -3 L0 -11 L4 -3Z" fill="${C.terra}" ${st(1)}/></g>`,

    // Мастерская серебряных дел: весы с гирями, чаши с чеканкой, тигель на огне, навес в пурпурную полоску
    workshop5: shadow(30) + `
      <path d="M4 14 L4 54 M60 14 L60 54" stroke="${C.woodD}" stroke-width="2.6"/>
      <path d="M1 16 L63 10 L63 16 L1 22Z" fill="#efe6d2" ${st(1.5)}/>
      ${[8, 22, 36, 50].map(x => `<path d="M${x} ${19.2 - x * .097} L${x + 7} ${18.5 - (x + 7) * .097} L${x + 7} ${12.5 - (x + 7) * .097} L${x} ${13.2 - x * .097}Z" fill="${PUR}"/>`).join('')}
      <rect x="8" y="40" width="48" height="5" rx="1" fill="${C.wood}" ${st(1.4)}/><path d="M12 45 L12 54 M52 45 L52 54" stroke="${C.woodD}" stroke-width="2.4"/>` +
      scales(20, 40, .95) + silverBowl(38, 37, .9) + silverBowl(50, 38, .7) + `
      <path d="M36 56 Q36 50 42 50 Q48 50 48 56Z" fill="${C.stoneD}" ${st(1.2)}/>` + flame(42, 52, .55) +
      `<path d="M38 50 L46 50 L45 47 L39 47Z" fill="${IRN}" ${st(1)}/>`,

    // Царская кладовая: портик с колоннами, сундук с серебром, слитки и амфоры
    store5: shadow(31) + wallA(10, 16, 46, 38) + `<rect x="8" y="12" width="50" height="5" fill="${C.woodD}" ${st()}/>
      <path d="M8 12 L33 3 L58 12Z" fill="${C.terra}" ${st(1.5)}/>
      <rect x="27" y="34" width="12" height="20" fill="${C.dark}" ${st(1.3)}/><rect x="16" y="24" width="34" height="3" fill="${C.plaster}" ${st(1.1)}/>` +
      aeolic(20, 32, 22, .8) + aeolic(46, 32, 22, .8) + `
      <rect x="2" y="46" width="14" height="9" rx="1" fill="${C.wood}" ${st(1.3)}/><path d="M2 49 L16 49" stroke="${IRN}" stroke-width="1.6"/>` +
      silverBowl(9, 45, .55) + amphoraShape(58, 50, .42) + ironBars(52, 58, 2),

    // Рудник с плавильней: печь с мехами, отвал шлака, стопка слитков
    mine4: shadow(31) + `
      <path d="M2 46 Q8 14 24 10 Q40 14 44 46Z" fill="${C.stoneD}" ${st()}/>
      <path d="M12 46 L12 34 Q18 28 24 34 L24 46Z" fill="${C.dark}" ${st(1.3)}/><path d="M10 46 L10 32 M26 46 L26 32 M8 32 L28 32" stroke="${C.wood}" stroke-width="2.6" stroke-linecap="round"/>
      <path d="M40 56 L42 26 Q48 20 54 26 L56 56Z" fill="${C.mudD}" ${st()}/><path d="M44 56 Q44 46 48 46 Q52 46 52 56Z" fill="${C.dark}"/>` + flame(48, 52, .7) + smoke(48, 20) + `
      <path d="M56 50 Q64 46 62 40 Q58 38 56 44Z" fill="#a9825a" ${st(1.2)}/>` + slag(14, 54, .7) + ingotShape(30, 54, .5) + ingotShape(30, 49, .5) + `<circle cx="34" cy="20" r="1.8" fill="#4fa58d"/>`,

    // Военная гавань Китиона: корабельный сарай на колоннах и боевой корабль с тараном
    port4: harbor(46) + `
      <path d="M8 54 q4 -2 8 0" stroke="${C.sky}" stroke-width="1.6" fill="none"/>
      <path d="M30 46 L62 40 L62 50 L34 52Z" fill="#d6ccb3" ${st(1.4)}/>
      <path d="M32 14 L62 6 L62 12 L32 20Z" fill="${C.terra}" ${st(1.5)}/>${[36, 46, 56].map(x => `<rect x="${x}" y="${19 - (x - 32) * .27}" width="3.4" height="${27 + (x - 32) * .1}" fill="${C.plaster}" ${st(1.1)}/>`).join('')}
      <path d="M36 36 L60 30 L60 34 Q48 40 38 40Z" fill="${C.woodD}" ${st(1.3)}/>
      <path d="M4 46 L36 46 Q34 52 28 52 L10 52 Q6 50 4 46Z" fill="${C.woodD}" ${st(1.5)}/>` + ram(4, 47, 1.1) + eyeShip(10, 48, .9) + `
      ${[14, 19, 24, 29].map(x => `<path d="M${x} 51 L${x - 3} 58" stroke="${C.wood}" stroke-width="1.5"/>`).join('')}
      <path d="M20 46 L20 24" stroke="${C.dark}" stroke-width="2"/><path d="M12 26 L28 26 L27 40 L13 40Z" fill="#efe6d2" ${st(1.3)}/><path d="M12.5 33 L27.5 33" stroke="${PUR}" stroke-width="2"/>`,

    // Царская канцелярия: два этажа, портик, большая бронзовая табличка на подставке
    scribe4: shadow(31) + wallA(14, 20, 44, 34) + `<rect x="12" y="16" width="48" height="5" fill="${C.woodD}" ${st()}/>` +
      wallA(24, 6, 26, 11) + `<rect x="22" y="3" width="30" height="4" fill="${C.woodD}" ${st(1.4)}/>
      <rect x="29" y="9" width="5" height="5" fill="${C.dark}" ${st(1)}/><rect x="40" y="9" width="5" height="5" fill="${C.dark}" ${st(1)}/>
      <rect x="31" y="36" width="12" height="18" fill="${C.dark}" ${st(1.3)}/><rect x="20" y="27" width="34" height="3" fill="${C.plaster}" ${st(1.1)}/>` +
      aeolic(25, 34, 20, .75) + aeolic(49, 34, 20, .75) + `
      <path d="M8 56 L8 40 M2 56 L14 56" stroke="${C.woodD}" stroke-width="2.4" stroke-linecap="round"/>
      <rect x="0" y="26" width="16" height="16" rx="1.5" fill="${C.bronze}" ${st(1.4)}/>
      <path d="M3 30 l2 2 l2 -2 M10 29 l0 4 M3 35 l4 0 M9 35 l2 2 l2 -2 M3 39 l3 -2 M9 39 l4 0" stroke="${C.bronzeD}" stroke-width="1.1" fill="none"/>`,

    // Кузница: сыродутный горн, наковальня с раскалённой полосой, молот
    forge0: shadow(24) + `
      <path d="M8 54 L12 18 Q20 12 28 18 L32 54Z" fill="${C.mudD}" ${st()}/><path d="M16 54 Q16 44 20 44 Q24 44 24 54Z" fill="${C.dark}" ${st(1.3)}/>` +
      flame(20, 50, .75) + smoke(20, 12) + anvil(46, 46, 1) + hotBar(40, 41, 54, 40) + hammer(56, 30, .95, 35),
    // Кузнечный навес: мехи у горна, наковальня, корыто для закалки с паром
    forge1: shadow(30) + `
      <path d="M4 16 L4 55 M60 12 L60 55" stroke="${C.woodD}" stroke-width="2.6"/>
      <path d="M1 16 L63 9 L63 15 L1 22Z" fill="${C.thatch}" ${st(1.5)}/><path d="M12 20 l0 -4 M26 18 l0 -4 M40 17 l0 -4 M54 15 l0 -4" stroke="${C.thatchD}" stroke-width="1.1"/>
      <path d="M6 55 L9 30 Q15 25 21 30 L24 55Z" fill="${C.mudD}" ${st(1.5)}/><path d="M12 55 Q12 47 15 47 Q18 47 18 55Z" fill="${C.dark}"/>` + flame(15, 52, .6) + `
      <path d="M24 44 Q30 38 34 44 Q30 48 24 46Z" fill="#a9825a" ${st(1.2)}/>` + anvil(42, 46, .9) + hotBar(36, 42, 48, 41) + `
      <rect x="44" y="51" width="16" height="5" rx="1" fill="${C.wood}" ${st(1.2)}/><path d="M45 51 L59 51" stroke="${C.water}" stroke-width="2"/>
      <path d="M50 49 q-2 -3 0 -6 M55 49 q2 -3 0 -6" stroke="#cfd5da" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
    // Царская кузница: каменный дом с двумя трубами, стойка с оружием, железные крицы
    forge2: shadow(31) + wallA(4, 22, 34, 32, '#ddd2b6') + `<rect x="2" y="18" width="38" height="5" fill="${C.woodD}" ${st()}/>
      <rect x="10" y="8" width="6" height="11" fill="${C.stoneD}" ${st(1.2)}/><rect x="26" y="10" width="6" height="9" fill="${C.stoneD}" ${st(1.2)}/>` +
      smoke(13, 6) + smoke(29, 8) + `<path d="M14 54 Q14 40 21 40 Q28 40 28 54Z" fill="${C.dark}" ${st(1.3)}/>` + flame(21, 50, .75) + `
      <path d="M42 54 L42 22 M60 54 L60 22 M40 22 L62 22" stroke="${C.woodD}" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M46 24 L46 46" stroke="${IRNL}" stroke-width="2.6"/><path d="M46 24 L46 46" stroke="${IRND}" stroke-width=".8"/><path d="M43 44 L49 44" stroke="${C.woodD}" stroke-width="2.4"/>
      <path d="M52 22 L52 52" stroke="${C.woodD}" stroke-width="1.8"/><path d="M49.5 22 L52 14 L54.5 22Z" fill="${IRN}" ${st(1)}/>
      <path d="M57 26 L57 46" stroke="${C.woodD}" stroke-width="2"/><path d="M57 27 Q63 29 61 35 L57 33Z" fill="${IRN}" ${st(1)}/>` + ironBars(52, 59, 2),
  });


  // ---------- базовые облики новой эпохи: «с нуля, но уже бронза» (5-й) и «с нуля, но уже железо» (9-й) ----------
  // Новая эпоха начинает с простого: меньше построек и утвари, чем у нарядного облика прошлой эпохи, —
  // зато сразу видно, из чего сделано: бронзовые серп, топор, резец; железные лемех, топор, кирка, оковка; тёсаный камень.
  const bronzeEdge = (d, w = 3) => `<path d="${d}" stroke="${O}" stroke-width="${w + 2}" stroke-linecap="round" fill="none"/><path d="${d}" stroke="${C.bronze}" stroke-width="${w}" stroke-linecap="round" fill="none"/>`;
  const furrowRows = (ys, col = C.furrowD) => ys.map(y => `<path d="M7 ${y + 2} Q34 ${y - 1} 61 ${y + 2}" stroke="${col}" stroke-width="5" stroke-linecap="round" fill="none" opacity=".75"/>`).join('');
  Object.assign(B, {
    // Поле полбы: небольшой орошаемый участок — половина ещё колосится, половина сжата; на меже — бронзовый серп
    field2: furrowRows([14, 28, 42]) +
      [14, 28, 42].map((y, r) => [11, 20, 29].map(x => earBz(x + (r % 2) * 3, y)).join('') +
        [40, 48, 56].map(x => `<path d="M${x + (r % 2) * 2} ${y} l0 -4 M${x + 2 + (r % 2) * 2} ${y} l0 -3" stroke="${C.wheatD}" stroke-width="1.5"/>`).join('')).join('') + `
      <path d="M30 61 L38 54" stroke="${C.woodD}" stroke-width="3.6" stroke-linecap="round"/>
      <path d="M37 55 Q40 41 54 42 Q61 43 60 49 Q55 45 47 47 Q41 50 40 57Z" fill="${C.bronze}" ${st(1.5)}/>
      <path d="M41 53 Q44 47 52 45.5" fill="none" stroke="${C.bronzeD}" stroke-width="1.2"/>`,
    // Лесорубы с бронзовыми топорами: сосну свалили, обрубают сучья; у пня — бронзовый топор, рядом брёвна на вывоз
    //   (лес — кипрский товар бронзового века: в письме EA 35 царь Аласии просит фараона платы за «мой лес»)
    lumber2: shadow(28) + pine(9, 20, .85) + leafTree(57, 15, .8) + `
      <path d="M14 38 L50 30" stroke="${O}" stroke-width="8.6" stroke-linecap="round"/><path d="M14 38 L50 30" stroke="${C.wood}" stroke-width="6" stroke-linecap="round"/>
      <path d="M22 34.5 L46 29.2" stroke="${C.woodD}" stroke-width="1" opacity=".7"/>
      <ellipse cx="51" cy="29.8" rx="2.6" ry="3.4" transform="rotate(-12 51 29.8)" fill="${C.wheat}" ${st(1.2)}/>
      <path d="M3 40 Q2 32 9 30 Q12 26 18 29 Q23 30 22 36 Q24 42 17 43 Q11 47 6 44 Q2 44 3 40Z" fill="${C.greenD}" ${st(1.4)}/>
      <path d="M7 35 l4 2 M12 32 l2 4 M15 40 l3 -2 M8 41 l3 -2" stroke="${C.green}" stroke-width="1.4" stroke-linecap="round"/>
      <path d="M30 33.5 l-2 -5 M38 31.6 l1 -5" stroke="${C.woodD}" stroke-width="2" stroke-linecap="round"/>
      <path d="M26 45 Q30 41 36 43" stroke="${C.greenD}" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M30 42 l1 -3 M33 42.5 l2 -2.5" stroke="${C.greenD}" stroke-width="1.6" stroke-linecap="round"/>` +
      logEnds(20, 55, .7) + logEnds(16, 48, .6) + logEnds(27, 48, .6) + `
      <path d="M38 48 L38 56 Q46 60 54 56 L54 48Z" fill="${C.wood}" ${st()}/>
      <ellipse cx="46" cy="48" rx="8" ry="3.2" fill="${C.wheat}" ${st()}/><ellipse cx="46" cy="48" rx="4" ry="1.6" fill="none" stroke="${C.wheatD}" stroke-width="1.1"/>
      <path d="M47 47 L55 38" stroke="${C.woodD}" stroke-width="3.2" stroke-linecap="round"/>
      <path d="M51 37 Q56 31 63 35 L58 43 Q57 39 51 37Z" fill="${C.bronze}" ${st(1.4)}/><path d="M59.5 33.5 L62 36" stroke="${C.bronzeD}" stroke-width="1.2"/>
      <path d="M34 61 l4 -2 M56 61 l4 -2 M58 52 l3 1" stroke="${C.wheatD}" stroke-width="2" stroke-linecap="round"/>`,
    // Каменоломня тёсаного камня: у скалы — ровный срез, перед ним один тёсаный блок, бронзовый резец и деревянная колотушка
    quarry2: shadow(26) + `
      <path d="M6 46 L9 22 L22 14 L34 18 L36 46Z" fill="${C.stoneD}" ${st()}/>
      <path d="M24 20 L34 18 L36 46 L24 46Z" fill="${C.stone}" ${st(1.4)}/><path d="M24 29 L35 28 M24 38 L35.5 37" stroke="${C.stoneD}" stroke-width="1.2"/>
      <path d="M12 30 L18 36 L16 44" fill="none" stroke="${O}" stroke-width="1.1" opacity=".5"/>` +
      block(30, 46, 20, 9) + `<path d="M32 48 l16 0" stroke="#fff" stroke-width="1" opacity=".7"/>` +
      bronzeEdge('M46 43 L56 27', 3.2) + `<path d="M54 30 L57 25" stroke="${C.bronzeD}" stroke-width="1.4"/>
      <path d="M54 56 L62 47" stroke="${C.woodD}" stroke-width="2.6" stroke-linecap="round"/>
      <rect x="57" y="40" width="7" height="10" rx="2" transform="rotate(42 60 45)" fill="${C.wood}" ${st(1.3)}/>
      <path d="M14 52 l3 -1 M22 54 l2 -2" stroke="${C.stoneD}" stroke-width="2" stroke-linecap="round"/>`,

    // Дом с внутренним двором: одноэтажный дом из тёсаного камня, низкая стенка двора, во дворе — железный треножник с котлом
    house4: shadow(30) + `
      <path d="M10 52 L13 40 M19 52 L16 40 M14.5 52 L14.5 41" stroke="${IRND}" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M8 34 Q8 42 14.5 42 Q21 42 21 34Z" fill="${IRN}" ${st(1.4)}/><ellipse cx="14.5" cy="34" rx="6.5" ry="1.8" fill="${IRND}" ${st(1.1)}/>` +
      smoke(14, 28) + wallA(3, 44, 23, 10, '#ddd2b6') + `<rect x="2" y="42" width="25" height="3" fill="${C.stoneD}" ${st(1.1)}/>` +
      wallA(26, 24, 33, 30) + `<rect x="24" y="20" width="37" height="5" fill="${C.woodD}" ${st()}/>
      <path d="M27 20 l0 -2.5 M36 20 l0 -2.5 M45 20 l0 -2.5 M54 20 l0 -2.5" stroke="${O}" stroke-width="1.2"/>
      <rect x="37" y="36" width="11" height="18" fill="${C.wood}" ${st(1.3)}/>
      <path d="M37 40.5 L48 40.5 M37 49 L48 49" stroke="${IRND}" stroke-width="2"/><circle cx="45.5" cy="45" r="1.4" fill="none" stroke="${IRND}" stroke-width="1.2"/>
      <rect x="29" y="29" width="5" height="5" fill="${C.dark}" ${st(1.1)}/><rect x="51" y="29" width="5" height="5" fill="${C.dark}" ${st(1.1)}/>`,
    // Пшеничное поле: старая пашня уже в золотой пшенице, ниже — свежая распашка; рало с железным лемехом прямо в борозде
    field4: furrowRows([18, 30]) + furrowRows([40, 50, 60], C.furrow) + `
      <path d="M6 40 Q34 37 61 40 M6 50 Q34 47 61 50 M6 60 Q34 57 61 60" stroke="#7a4f2a" stroke-width="1.3" fill="none" opacity=".7"/>` +
      [18, 30].map((y, r) => [10, 20, 30, 40, 50].map(x => ear(x + r * 4, y)).join('')).join('') + `
      <path d="M8 51 L22 51" stroke="#6e4423" stroke-width="3" stroke-linecap="round" opacity=".55"/>
      <path d="M20 51 L44 51" stroke="${C.woodD}" stroke-width="3.4" stroke-linecap="round"/>
      <path d="M22 51 L13 36 M10 38 L16 35" stroke="${C.woodD}" stroke-width="2.8" stroke-linecap="round"/>
      <path d="M36 51 L61 31" stroke="${C.woodD}" stroke-width="3.2" stroke-linecap="round"/>
      <path d="M42 47 L57 51 L42 55Z" fill="${IRN}" ${st(1.5)}/><path d="M44 49.5 L54 51" stroke="${IRNL}" stroke-width="1.3"/>`,
    // Лесорубы с железными топорами: ствол колют железными клиньями на доски, колотые доски — штабелем; топор в бревне
    lumber4: shadow(30) + pine(8, 20, .85) + pine(57, 14, .8) + leafTree(33, 13, .75) + `
      <rect x="4" y="30" width="42" height="14" rx="7" fill="${C.wood}" ${st()}/>
      <path d="M8 37 L44 37" stroke="${O}" stroke-width="1.3"/><path d="M10 33 Q26 31.5 42 33 M10 41 Q26 42.5 42 41" fill="none" stroke="${C.woodD}" stroke-width="1"/>
      <ellipse cx="46" cy="37" rx="5.5" ry="7" fill="${C.wheat}" ${st()}/><path d="M41 37 L51.5 37" stroke="${O}" stroke-width="1.3"/>
      <path d="M14 31.5 L18 31.5 L16 38Z M28 31.5 L32 31.5 L30 38Z" fill="${IRND}" ${st(1.1)}/>
      <path d="M38 31 L47 12" stroke="${C.woodD}" stroke-width="3.4" stroke-linecap="round"/>
      <path d="M36 28 L42 19 Q48 23 46 31Z" fill="${IRN}" ${st(1.4)}/><path d="M42.5 21.5 Q46 24 45 29" fill="none" stroke="${IRNL}" stroke-width="1.2"/>
      ${[0, 1, 2].map(i => `<rect x="${22 + i * 2}" y="${55 - i * 4.5}" width="${36 - i * 4}" height="4.5" fill="${i === 1 ? '#b0794a' : C.wood}" ${st(1.2)}/><rect x="${55 - i * 2}" y="${55 - i * 4.5}" width="3" height="4.5" fill="${C.wheat}" ${st(1)}/>`).join('')}
      <path d="M6 61 l5 -2 M16 61 l4 -2 M58 62 l4 -2" stroke="${C.wheatD}" stroke-width="2" stroke-linecap="round"/>`,
    // Каменоломня с железными кирками: ровные ступени выработки, железная кирка, клинья в пропиле, один тёсаный блок
    quarry4: shadow(28) + `
      <path d="M4 46 L4 14 L22 11 L22 26 L40 24 L40 46Z" fill="#d6ccb3" ${st()}/>
      <path d="M4 26 L22 26 M4 36 L40 36 M13 14 L13 26 M31 26 L31 36 M13 36 L13 46 M27 36 L27 46" stroke="${C.stoneD}" stroke-width="1.1"/>
      <path d="M6 31 L20 31" stroke="${O}" stroke-width="1.1"/><path d="M9 31 l2 -3 l2 3Z M15 31 l2 -3 l2 3Z" fill="${IRND}" ${st(.9)}/>` +
      ashlar(16, 48, 22, 8) + `
      <path d="M48 56 L54 26" stroke="${C.woodD}" stroke-width="3.2" stroke-linecap="round"/>
      <path d="M42 26 Q52 18 63 25 Q53 22 49 30Z" fill="${IRN}" ${st(1.5)}/><path d="M45 25 Q52 20 60 24" fill="none" stroke="${IRNL}" stroke-width="1.2"/>`,
    // Мастерская расписной керамики: мастерская из тёсаного камня с пристроенной печью, перед ней — один кувшин нового,
    //   расписного стиля; у печи — железная кочерга
    workshop4: shadow(30) + wallA(4, 22, 28, 30) + `<rect x="2" y="18" width="32" height="5" fill="${C.woodD}" ${st()}/>
      <rect x="9" y="36" width="9" height="16" fill="${C.dark}" ${st(1.3)}/>
      <path d="M30 54 Q30 30 44 28 Q58 30 58 54Z" fill="${C.mudD}" ${st()}/>
      <path d="M38 54 Q38 43 44 43 Q50 43 50 54Z" fill="${C.dark}" ${st(1.4)}/>` + flame(44, 50, .8) + smoke(44, 24) + `
      <path d="M57 56 L63 36" stroke="${IRND}" stroke-width="2.2" stroke-linecap="round"/>
      <rect x="15" y="57" width="18" height="3.5" rx="1" fill="${C.wood}" ${st(1.2)}/>` + birdJug(24, 47, .62),
    // Каменный склад амфор: небольшая кладовая из тёсаного камня, дверь в железной оковке, у стены — две амфоры
    store4: shadow(28) + wallA(24, 22, 34, 31) + `<rect x="22" y="18" width="38" height="5" fill="${C.woodD}" ${st()}/>
      <rect x="35" y="35" width="12" height="18" fill="${C.wood}" ${st(1.3)}/>
      <path d="M35 39.5 L47 39.5 M35 48 L47 48" stroke="${IRND}" stroke-width="2"/><circle cx="44" cy="44" r="1.3" fill="${IRND}"/>
      <path d="M38 35 L38 53 M44 35 L44 53" stroke="${C.woodD}" stroke-width=".9"/>` +
      amphoraShape(10, 40, .5) + amphoraShape(19, 43, .46, '#b85d33'),
    // Рудник с галереями: одна крепёжная галерея в склоне, железная кирка у входа, кучка шлака
    mine3: shadow(28) + `
      <path d="M2 54 Q10 18 30 13 Q50 18 58 54Z" fill="${C.stoneD}" ${st()}/>
      <path d="M18 54 L18 38 Q25 31 32 38 L32 54Z" fill="${C.dark}" ${st(1.4)}/>
      <path d="M16 54 L16 35 M34 54 L34 35 M13 35 L37 35" stroke="${C.wood}" stroke-width="3" stroke-linecap="round"/>
      <path d="M16 35 L34 35" stroke="${O}" stroke-width=".8"/>
      <circle cx="24" cy="24" r="1.7" fill="#4fa58d"/><circle cx="44" cy="34" r="1.7" fill="${C.copper}"/>
      <path d="M44 56 L49 32" stroke="${C.woodD}" stroke-width="3" stroke-linecap="round"/>
      <path d="M40 32 Q49 25 58 31 Q50 29 46 36Z" fill="${IRN}" ${st(1.4)}/><path d="M43 31 Q49 27 55 30" fill="none" stroke="${IRNL}" stroke-width="1.1"/>` + slag(57, 54, .55),
    // Гавань с каменным молом: короткий мол из тёсаных блоков, лодка у тумбы, на моле — каменный якорь с тремя отверстиями
    //   (такие — сотнями в храмах Китиона и Хала-Султан-Текке; железные якоря — уже римские)
    port3: harbor(42) + `
      <path d="M8 56 q4 -2 8 0 M24 58 q4 -2 8 0" stroke="${C.sky}" stroke-width="1.6" fill="none"/>
      <path d="M32 46 L62 40 L62 52 L35 54Z" fill="#d6ccb3" ${st(1.5)}/>
      <path d="M35 49.5 L62 45.5 M42 45 L42 53 M50 43.4 L50 52 M57 42 L57 50.6" stroke="${C.stoneD}" stroke-width="1.1"/>
      <rect x="37" y="38" width="4" height="8" rx="1.5" fill="${C.woodD}" ${st(1.1)}/>
      <path d="M4 44 Q16 54 30 44 Q28 42 26 42 L8 42 Q6 42 4 44Z" fill="${C.wood}" ${st(1.5)}/>
      <path d="M17 42 L17 18" stroke="${C.dark}" stroke-width="2"/><path d="M9 21 L25 21" stroke="${C.woodD}" stroke-width="2.2" stroke-linecap="round"/>
      <rect x="9" y="21" width="16" height="4" rx="2" fill="#efe6d2" ${st(1.2)}/>
      <path d="M29 43 Q34 40 38 41" fill="none" stroke="${C.woodD}" stroke-width="1.2"/>
      <g transform="translate(53 32)"><path d="M-4 -10 L4 -10 L8.5 9 L-8.5 9Z" fill="${C.stone}" ${st(1.4)}/>
        <circle cx="0" cy="-5.5" r="1.9" fill="${C.dark}"/><circle cx="-4" cy="4.5" r="1.5" fill="${C.dark}"/><circle cx="4" cy="4.5" r="1.5" fill="${C.dark}"/>
        <path d="M-2 -6 Q-10 -12 -15 -6" fill="none" stroke="#c9a26a" stroke-width="1.4"/></g>`,
    // Царский архив: небольшая палата из тёсаного камня, перед ней — каменная стела с кипрским слоговым письмом
    scribe3: shadow(28) + wallA(26, 22, 32, 32) + `<rect x="24" y="18" width="36" height="5" fill="${C.woodD}" ${st()}/>
      <rect x="37" y="37" width="10" height="17" fill="${C.dark}" ${st(1.3)}/><rect x="35" y="34" width="14" height="3" fill="${C.stoneD}" ${st(1)}/>
      <rect x="51" y="28" width="4" height="4" fill="${C.dark}" ${st(1)}/>
      <path d="M5 55 L7 22 Q14 16 21 22 L23 55Z" fill="#ddd2b6" ${st(1.6)}/>
      <path d="M10 27 l2 3 l2 -3 M16 26 l0 4 M10 34 l4 0 M16 33 l2 2 l2 -2 M10 40 l2 -2 l2 2 M17 39 l0 4 M10 47 l4 0 l0 -3 M16 46 l3 0"
        fill="none" stroke="${C.stoneD}" stroke-width="1.4" stroke-linecap="round"/>`,
  });

  // ---------- эллинский Кипр: 12-й (базовый) и 15-й (нарядный) уровни ----------
  // Стены — беленая штукатурка с расписной полосой внизу, крыши — плоские, земляные, с парапетом: черепица на Кипре
  // приходит поздно и остаётся редкостью, поэтому она только у нарядных обликов 15-го уровня. Колонны — дорические и ионические;
  // знаки эпохи — монеты, папирус, амфоры с клеймом, винный пурпур.
  const WINE = '#7d2e52', WINED = '#4f1a35', STU = '#f6efe0', STUD = '#ddd0b3', OCH = '#c4733c';
  const TER = '#b8562e', TERD = '#86391b', TERL = '#dd8150', CALC = '#dccb98', CALCD = '#b59f68', PAP = '#ecdca8', PAPD = '#b89a5a';
  const stucco = (x, y, w, h, band = WINE) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${STU}" ${st()}/>
      <rect x="${x + 1}" y="${y + h - 5.5}" width="${w - 2}" height="3.6" fill="${band}" opacity=".85"/>
      <path d="M${x + 1} ${y + h - 7} L${x + w - 1} ${y + h - 7}" stroke="${STUD}" stroke-width="1"/>`;
  const flatRoof = (x, y, w) => `<rect x="${x - 2}" y="${y}" width="${w + 4}" height="4" fill="${STUD}" ${st(1.5)}/>
      <path d="M${x} ${y + 4.6} L${x + w} ${y + 4.6}" stroke="${C.woodD}" stroke-width="1.4"/>`;
  // скат под черепицей, вид сбоку: ряды калиптеров, светлый конёк, антефиксы по карнизу
  const tiles = (x1, x2, y, h, inset = 6) => {
    let s = `<path d="M${x1} ${y} L${x1 + inset} ${y - h} L${x2 - inset} ${y - h} L${x2} ${y}Z" fill="${TER}" ${st(1.6)}/>`;
    for (let xx = x1 + 4; xx < x2 - 2; xx += 4) { const t = (xx - x1) / (x2 - x1); s += `<path d="M${xx} ${y - .8} L${(x1 + inset + t * (x2 - x1 - 2 * inset)).toFixed(1)} ${y - h + .8}" stroke="${TERD}" stroke-width="1.1"/>`; }
    s += `<path d="M${x1 + inset} ${y - h} L${x2 - inset} ${y - h}" stroke="${TERL}" stroke-width="1.8" stroke-linecap="round"/>`;
    for (let xx = x1 + 3; xx < x2 - 1; xx += 4) s += `<path d="M${xx - 1.4} ${y} a1.4 1.7 0 0 1 2.8 0Z" fill="${TERL}" stroke="${O}" stroke-width=".7"/>`;
    return s;
  };
  const doric = (x, y, h, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">
      <path d="M-2.7 ${h} L-2.2 2 L2.2 2 L2.7 ${h}Z" fill="${STU}" ${st(1.2)}/><path d="M-.8 3 L-.9 ${h - 1} M.8 3 L.9 ${h - 1}" stroke="${STUD}" stroke-width=".9"/>
      <path d="M-3.4 2 Q0 -.6 3.4 2Z" fill="${STU}" ${st(1)}/><rect x="-3.9" y="-1.6" width="7.8" height="1.9" fill="${STU}" ${st(1)}/></g>`;
  const ionic = (x, y, h, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">
      <rect x="-2.1" y="1.4" width="4.2" height="${h - 1.4}" fill="${STU}" ${st(1.2)}/><path d="M-.7 3 L-.7 ${h - 1} M.7 3 L.7 ${h - 1}" stroke="${STUD}" stroke-width=".8"/>
      <rect x="-4.2" y="-.8" width="8.4" height="2.2" fill="${STU}" ${st(1)}/>
      <circle cx="-4.1" cy="1.6" r="1.8" fill="${STU}" ${st(.9)}/><circle cx="4.1" cy="1.6" r="1.8" fill="${STU}" ${st(.9)}/>
      <circle cx="-4.1" cy="1.6" r=".55" fill="${O}"/><circle cx="4.1" cy="1.6" r=".55" fill="${O}"/></g>`;
  const coinStack = (x, y, n = 3) => Array.from({ length: n }, (_, i) => `<ellipse cx="${x}" cy="${y - i * 2.1}" rx="4.2" ry="1.7" fill="${i % 2 ? '#c3cad0' : SLV}" ${st(.9)}/>`).join('');
  // папирус: свиток — раскрытый (строки письма) или свёрнутый
  const scroll = (x, y, s = 1, open = true) => `<g transform="translate(${x} ${y}) scale(${s})">${open
      ? `<rect x="-8" y="-5.5" width="16" height="11" fill="${PAP}" ${st(1.1)}/><path d="M-5 -2.5 L5 -2.5 M-5 .3 L4 .3 M-5 3 L2.5 3" stroke="${PAPD}" stroke-width=".9"/>
        <rect x="-10.4" y="-6.5" width="3.6" height="13" rx="1.8" fill="${PAP}" ${st(1.1)}/><rect x="6.8" y="-6.5" width="3.6" height="13" rx="1.8" fill="${PAP}" ${st(1.1)}/>`
      : `<rect x="-9" y="-2.6" width="18" height="5.2" rx="2.6" fill="${PAP}" ${st(1.1)}/><ellipse cx="9" cy="0" rx="1.4" ry="2.6" fill="${PAPD}" ${st(.8)}/><path d="M-1 -2.6 L-1 2.6" stroke="${WINE}" stroke-width="1.4"/>`}</g>`;
  // амфора эллинистического вида: светлая глина, длинная шея, острый носок, клеймо на ручке
  const amph2 = (x, y, s = 1, col = '#d6966a') => `<g transform="translate(${x} ${y}) scale(${s})">
      <path d="M-2.4 -17 L2.4 -17 L2.6 -10 Q8 -7 7.4 1 Q6.6 9 1.2 13 L.6 18 L-.6 18 L-1.2 13 Q-6.6 9 -7.4 1 Q-8 -7 -2.6 -10Z" fill="${col}" ${st(1.4)}/>
      <path d="M-2.4 -15 Q-7 -15 -6.4 -8 M2.4 -15 Q7 -15 6.4 -8" fill="none" ${st(1.5)}/><circle cx="-5.6" cy="-12.4" r="1.1" fill="${TERD}"/></g>`;
  // терракотовая статуэтка «танагрского» вида: женщина в гиматии и шляпке-фолии
  const figurine = (x, y, s = 1, robe = '#f0dccb', accent = '#e48aa6') => `<g transform="translate(${x} ${y}) scale(${s})">
      <path d="M-4.4 11 L-3.4 -1 Q0 -3 3.4 -1 L4.4 11Z" fill="${robe}" ${st(1.1)}/>
      <path d="M-3.4 0 Q0 4 3.4 0 M-3.8 6 Q0 8 4 5" fill="none" stroke="${accent}" stroke-width="1.1"/>
      <circle cx="0" cy="-4.4" r="2.5" fill="#e9c9a8" ${st(1)}/><path d="M-4.4 -6.4 L4.4 -6.4 L0 -10Z" fill="${accent}" ${st(.9)}/></g>`;
  const herm = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">
      <path d="M-3 0 L3 0 L2.4 -16 L-2.4 -16Z" fill="${STU}" ${st(1.2)}/><rect x="-5" y="-12" width="10" height="2" fill="${STU}" ${st(.9)}/>
      <circle cx="0" cy="-19.4" r="3.6" fill="${STU}" ${st(1.2)}/><path d="M-3 -18.6 Q0 -12.6 3 -18.6" fill="${STUD}" ${st(.8)}/></g>`;
  const aspis = (x, y, r = 6) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${C.bronze}" ${st(1.3)}/><circle cx="${x}" cy="${y}" r="${r - 1.8}" fill="${WINE}" stroke="${C.bronzeD}" stroke-width=".9"/>
      <circle cx="${x}" cy="${y}" r="${r * .28}" fill="${C.bronze}" stroke="${C.bronzeD}" stroke-width=".7"/>`;
  // мельница-тёрка «олинфского» типа: камень с воронкой ходит рычагом по каменной постели
  const hopperMill = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">
      <rect x="-11" y="2" width="22" height="6" fill="${C.stoneD}" ${st(1.3)}/>
      <path d="M-7 2 L-6 -6 L6 -6 L7 2Z" fill="${C.stone}" ${st(1.3)}/><path d="M-3 -6 L-2 -2 L2 -2 L3 -6" fill="${C.dark}" ${st(.9)}/>
      <path d="M-18 -4 L18 -5" stroke="${C.woodD}" stroke-width="2.6" stroke-linecap="round"/><circle cx="-16" cy="-4" r="1.4" fill="${IRND}"/></g>`;
  // рычажный пресс: столб, балка, корзины-мешки под ней и камень-груз на конце
  const beamPress = (x, y, w = 40) => `<rect x="${x}" y="${y - 22}" width="5" height="24" fill="${STU}" ${st(1.3)}/>
      <path d="M${x + 3} ${y - 14} L${x + w} ${y - 10}" stroke="${C.woodD}" stroke-width="3.2" stroke-linecap="round"/>
      ${[0, 1, 2].map(i => `<ellipse cx="${x + 14}" cy="${y - 2 - i * 3}" rx="6" ry="1.8" fill="${C.thatch}" ${st(.9)}/>`).join('')}
      <rect x="${x + 6}" y="${y - 1}" width="16" height="3" fill="${C.stone}" ${st(1)}/>
      <path d="M${x + w - 1} ${y - 10} L${x + w - 1} ${y - 4}" stroke="${O}" stroke-width="1"/>
      <path d="M${x + w - 6} ${y - 4} L${x + w + 4} ${y - 4} L${x + w + 3} ${y + 3} L${x + w - 5} ${y + 3}Z" fill="${C.stoneD}" ${st(1.2)}/>`;

  Object.assign(B, {
    // Дом с перистилем (12): одноэтажный беленый дом под плоской крышей, вход между двумя дорическими колоннами
    house6: shadow(30) + stucco(8, 26, 48, 28) + flatRoof(8, 22, 48) + `
      <rect x="19" y="30" width="26" height="3" fill="${STU}" ${st(1.1)}/>
      <rect x="27" y="36" width="10" height="18" fill="${C.dark}" ${st(1.3)}/>
      <rect x="12" y="34" width="5" height="5" fill="${C.dark}" ${st(1.1)}/><rect x="48" y="34" width="5" height="5" fill="${C.dark}" ${st(1.1)}/>` +
      doric(22.5, 33, 21, .92) + doric(41.5, 33, 21, .92),
    // Дом с перистилем (15): верхний этаж под черепицей, ионическая колоннада по фасаду, пурпурный фриз и занавес в дверях
    house7: shadow(31) + tiles(10, 54, 17, 9) + stucco(15, 17, 34, 14, OCH) + `
      <rect x="20" y="21" width="5" height="6" fill="${C.dark}" ${st(1)}/><rect x="39" y="21" width="5" height="6" fill="${C.dark}" ${st(1)}/>
      <rect x="30" y="21" width="4" height="6" fill="${C.dark}" ${st(1)}/>` + stucco(4, 33, 56, 21) + `
      <rect x="2" y="29" width="60" height="4.4" fill="${STU}" ${st(1.3)}/><path d="M4 31.2 L60 31.2" stroke="${WINE}" stroke-width="1.8" stroke-dasharray="3 1.5"/>
      <rect x="27.5" y="39" width="9" height="15" fill="${C.dark}" ${st(1.3)}/><path d="M27.5 39 Q32 47 36.5 39Z" fill="${WINE}" ${st(.9)}/>` +
      ionic(9, 34.4, 19.6, .95) + ionic(21, 34.4, 19.6, .95) + ionic(43, 34.4, 19.6, .95) + ionic(55, 34.4, 19.6, .95),

    // Поле отборной пшеницы (12): тяжёлый колос в три ряда, на меже — мельница-тёрка с рычагом и мешок зерна
    field6: furrowRows([12, 25, 38]) + [12, 25, 38].map((y, r) => [10, 20, 30, 40, 50].map(x => earGr(x + (r % 2) * 4, y)).join('')).join('') + `
      <path d="M6 58 Q4 50 9 47 L15 47 Q19 50 17 58Z" fill="#e8d8b0" ${st(1.3)}/><path d="M8 48 Q12 45 16 48" fill="none" stroke="${C.woodD}" stroke-width="1.5"/>` +
      hopperMill(42, 50, 1),
    // Поле отборной пшеницы (15): ток — каменный круг со снопами и молотильной доской, мельница, мешки, амфора с зерном
    field7: furrowRows([10, 22]) + [10, 22].map((y, r) => [12, 22, 32, 42, 52].map(x => earGr(x + (r % 2) * 4, y)).join('')).join('') + `
      <ellipse cx="24" cy="44" rx="18" ry="8.5" fill="#e3cf98" ${st(1.6)}/><ellipse cx="24" cy="44" rx="14" ry="6" fill="none" stroke="${CALCD}" stroke-width="1" stroke-dasharray="2 2"/>
      <rect x="15" y="41" width="13" height="6" rx="1" fill="${C.wood}" ${st(1.2)}/>${[18, 21, 24].map(x => `<circle cx="${x}" cy="44" r=".8" fill="${C.dark}"/>`).join('')}` +
      sheaf(34, 46) + sheaf(38, 44) + hopperMill(50, 54, .85) + `
      <path d="M44 40 Q42 33 47 31 L52 31 Q56 33 54 40Z" fill="#e8d8b0" ${st(1.2)}/><path d="M55 42 Q53 35 58 33 L62 33 Q64 36 63 42Z" fill="#e8d8b0" ${st(1.2)}/>`,

    // Корабельный лес (12): брус на козлах, рамная пила с железным полотном, опилки
    lumber6: shadow(28) + pine(10, 26, .95) + `
      <path d="M22 54 L30 38 M30 54 L22 38 M48 54 L56 38 M56 54 L48 38" stroke="${C.woodD}" stroke-width="2.4" stroke-linecap="round"/>
      <rect x="14" y="34" width="48" height="7" fill="${C.wood}" ${st(1.4)}/><path d="M15 35.5 L61 35.5" stroke="${C.wheat}" stroke-width="1.2"/>
      <rect x="36" y="20" width="12" height="30" fill="none" stroke="${C.woodD}" stroke-width="2.4"/><path d="M42 20 L42 50" stroke="${IRN}" stroke-width="1.8"/>
      <path d="M36 35 L48 35" stroke="${C.woodD}" stroke-width="1.6"/><path d="M42 41 L42 44" stroke="${C.dark}" stroke-width="2"/>
      <path d="M34 56 l2 -1 M40 57 l2 -1 M46 56 l2 -1 M38 53 l1 -1" stroke="${C.wheatD}" stroke-width="1.8" stroke-linecap="round"/>`,
    // Корабельный лес (15): высокие кедры, штабель брусьев с царской меткой, мачтовое бревно на катках, рамная пила
    lumber7: shadow(31) + pine(8, 22, 1.1) + pine(57, 18, .95) + `
      ${[0, 1, 2].map(i => `<rect x="${4 + i * 3}" y="${50 - i * 7}" width="${30 - i * 6}" height="7" fill="${i % 2 ? C.woodD : C.wood}" ${st(1.3)}/>
        <rect x="${4 + i * 3 + 30 - i * 6 - 5}" y="${50 - i * 7}" width="5" height="7" fill="${C.wheat}" ${st(1)}/>
        <path d="M${4 + i * 3 + 30 - i * 6 - 3.6} ${52 - i * 7} l1.4 3 l1.4 -3Z" fill="${WINE}"/>`).join('')}
      <rect x="36" y="45" width="27" height="6" rx="3" fill="${C.wood}" ${st(1.3)}/><ellipse cx="62" cy="48" rx="2" ry="3" fill="${C.wheat}" ${st(1)}/>
      <circle cx="42" cy="54" r="2.4" fill="${C.woodD}" ${st(1)}/><circle cx="56" cy="54" r="2.4" fill="${C.woodD}" ${st(1)}/>
      <path d="M36 42 L44 28 M44 42 L36 28" stroke="${C.woodD}" stroke-width="2" stroke-linecap="round"/>
      <rect x="31" y="26" width="25" height="5" fill="${C.wood}" ${st(1.2)}/>
      <rect x="45" y="14" width="9" height="22" fill="none" stroke="${C.woodD}" stroke-width="2"/><path d="M49.5 14 L49.5 36" stroke="${IRN}" stroke-width="1.6"/>`,

    // Скальная каменоломня (12): светлый песчаник, выработка «шахматкой», блок отжимают железными клиньями, кирка
    quarry6: shadow(28) + `
      <path d="M2 50 L4 24 Q14 14 30 14 Q44 16 48 26 L50 50Z" fill="${CALC}" ${st()}/>
      <path d="M8 26 L22 26 L22 34 L36 34 L36 26 L46 26" fill="none" stroke="${CALCD}" stroke-width="1.4"/>
      <path d="M8 26 L8 34 L22 34 M36 34 L36 42 L48 42 M22 34 L22 42 L36 42" fill="none" stroke="${CALCD}" stroke-width="1.4"/>
      <path d="M22 26 L36 26 L36 34 L22 34Z" fill="#c9b47f" ${st(1.1)}/>
      <path d="M24 24 l1.6 -3 l1.6 3Z M31 24 l1.6 -3 l1.6 3Z" fill="${IRND}" ${st(.8)}/>` +
      `<rect x="24" y="46" width="18" height="8" rx="1" fill="${CALC}" ${st(1.4)}/><path d="M26 48 l14 0" stroke="#fff" stroke-width="1" opacity=".7"/>
      <path d="M50 58 L56 34" stroke="${C.woodD}" stroke-width="3" stroke-linecap="round"/>
      <path d="M45 34 Q54 27 63 33 Q55 31 52 38Z" fill="${IRN}" ${st(1.4)}/>`,
    // Скальная каменоломня (15): в скале вырублен фасад с дорическими полуколоннами и триглифами — как в Царских гробницах Пафоса;
    // журавль поднимает блок
    quarry7: shadow(31) + `
      <path d="M1 54 L2 14 Q16 6 34 8 Q44 10 44 20 L44 54Z" fill="${CALC}" ${st()}/>
      <rect x="6" y="24" width="34" height="30" fill="#c9b47f" ${st(1.3)}/>
      <rect x="4" y="18" width="38" height="6" fill="${CALC}" ${st(1.2)}/>
      ${[8, 14, 20, 26, 32, 38].map(x => `<path d="M${x - .8} 18.6 L${x - .8} 23.4 M${x + .8} 18.6 L${x + .8} 23.4" stroke="${CALCD}" stroke-width=".9"/>`).join('')}
      <rect x="18" y="34" width="10" height="20" fill="${C.dark}" ${st(1.2)}/>` +
      doric(11, 26, 28, .9) + doric(35, 26, 28, .9) + `
      <path d="M46 56 L54 6 L62 56" fill="none" stroke="${C.woodD}" stroke-width="2.8" stroke-linecap="round"/><path d="M49 36 L59 36" stroke="${C.woodD}" stroke-width="2.2"/>
      <circle cx="54" cy="8" r="2.4" fill="${IRN}" ${st(1)}/><path d="M54 10 L54 26" stroke="${O}" stroke-width="1"/>` +
      `<rect x="48" y="26" width="12" height="7" rx="1" fill="${CALC}" ${st(1.2)}/>`,

    // Мастерская терракот (12): печь, на доске — двустворчатая форма и одна статуэтка в шляпке
    workshop6: shadow(26) + `
      <path d="M4 52 Q4 30 17 28 Q30 30 30 52Z" fill="${C.mudD}" ${st()}/>
      <path d="M12 52 Q12 42 17 42 Q22 42 22 52Z" fill="${C.dark}" ${st(1.4)}/>` + flame(17, 49, .75) + smoke(17, 24) + `
      <rect x="32" y="44" width="30" height="4" rx="1" fill="${C.wood}" ${st(1.3)}/><path d="M36 48 L36 56 M58 48 L58 56" stroke="${C.woodD}" stroke-width="2.4"/>
      <path d="M36 44 Q35 33 41 32 Q45 33 45 44Z" fill="${C.mud}" ${st(1.2)}/><path d="M38 41 Q41 36 43 41" fill="none" stroke="${C.mudD}" stroke-width="1"/>` +
      figurine(53, 33, 1),
    // Мастерская терракот (15): лавка-стоа с пурпурным навесом, на полках расписные статуэтки и светильники, печь
    workshop7: shadow(31) + `
      <rect x="4" y="22" width="44" height="32" fill="${STU}" ${st()}/>
      <path d="M2 22 L50 22 L48 14 L4 14Z" fill="${STU}" ${st(1.3)}/>
      ${[6, 16, 26, 36].map(x => `<path d="M${x} 22 L${x + 5} 22 L${x + 4.6} 14 L${x + .4} 14Z" fill="${WINE}"/>`).join('')}
      <rect x="8" y="36" width="36" height="2.6" fill="${C.wood}" ${st(1)}/><rect x="8" y="50" width="36" height="2.6" fill="${C.wood}" ${st(1)}/>` +
      figurine(13, 25, .82, '#f3d1dc') + figurine(23, 25, .82, '#cfe0ef', '#5d8fb8') + figurine(33, 25, .82, '#f0dccb') + figurine(41, 25.6, .7, '#f3d1dc') + `
      ${[14, 24, 34].map(x => `<path d="M${x - 4} 49 Q${x} 44 ${x + 4} 49Z M${x + 4} 47.6 l2.4 -.6" fill="${TER}" ${st(.9)}/>`).join('')}
      <path d="M48 54 Q48 36 56 34 Q64 36 64 54Z" fill="${C.mudD}" ${st(1.5)}/><path d="M53 54 Q53 47 56 47 Q59 47 59 54Z" fill="${C.dark}"/>` + flame(56, 52, .5) + smoke(56, 30),

    // Эмпорий (12): длинный беленый склад под плоской крышей, широкие ворота, у стены — стойка с амфорами и мешок
    store6: shadow(30) + stucco(20, 24, 42, 30, OCH) + flatRoof(20, 20, 42) + `
      <rect x="33" y="34" width="16" height="20" fill="${C.wood}" ${st(1.3)}/><path d="M41 34 L41 54" stroke="${C.woodD}" stroke-width="1.2"/>
      <path d="M33 38 L49 38" stroke="${IRND}" stroke-width="1.8"/><rect x="25" y="30" width="5" height="4" fill="${C.dark}" ${st(1)}/><rect x="53" y="30" width="5" height="4" fill="${C.dark}" ${st(1)}/>
      <path d="M2 40 L18 40 M2 47 L18 47" stroke="${C.woodD}" stroke-width="2" stroke-linecap="round"/>` +
      amph2(6, 37, .62) + amph2(14, 37, .62, '#c9845a') + `
      <path d="M2 58 Q1 52 5 50 L10 50 Q13 52 12 58Z" fill="#e8d8b0" ${st(1.2)}/>`,
    // Эмпорий (15): дорическая стоа под черепицей, внутри ряды амфор, у входа — весы и столбик монет
    store7: shadow(31) + tiles(2, 62, 18, 8, 5) + `
      <rect x="4" y="18" width="56" height="5" fill="${STU}" ${st(1.3)}/>
      ${[8, 14, 20, 26, 32, 38, 44, 50, 56].map(x => `<path d="M${x - .8} 18.8 L${x - .8} 22.2 M${x + .8} 18.8 L${x + .8} 22.2" stroke="${STUD}" stroke-width=".9"/>`).join('')}
      <rect x="6" y="23" width="52" height="31" fill="#5e4a38" ${st(1.3)}/>` +
      [12, 20, 28, 36, 44, 52].map((x, i) => amph2(x, 41, .55, i % 2 ? '#c9845a' : '#d6966a')).join('') +
      doric(9, 24, 30, .9) + doric(32, 24, 30, .9) + doric(55, 24, 30, .9) + scales(20, 60, .7) + coinStack(44, 58, 4),

    // Гавань с верфью (12): корабельный сарай на столбах под плоской крышей, по слипу из воды вытащен корпус
    port5: harbor(46) + `
      <path d="M6 54 q4 -2 8 0 M44 56 q4 -2 8 0" stroke="${C.sky}" stroke-width="1.6" fill="none"/>
      <path d="M10 52 L62 34 L62 42 L18 56Z" fill="${CALC}" ${st(1.4)}/>
      <rect x="14" y="14" width="50" height="4" fill="${STUD}" ${st(1.4)}/>
      ${[18, 34, 50].map((x, i) => `<rect x="${x}" y="18" width="4" height="${30 - i * 5}" fill="${STU}" ${st(1.1)}/>`).join('')}
      <path d="M22 46 Q38 44 58 36 L60 32 Q40 38 24 40 Q20 42 22 46Z" fill="${C.wood}" ${st(1.5)}/>
      <path d="M58 36 Q63 30 60 24" fill="none" stroke="${C.woodD}" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M22 46 L16 47" stroke="${C.bronze}" stroke-width="3" stroke-linecap="round"/>`,
    // Гавань с верфью (15): корабельные сараи под черепицей на колоннах и большой боевой корабль в два ряда вёсел
    port6: harbor(44) + `
      <path d="M36 44 L62 38 L62 48 L38 50Z" fill="${CALC}" ${st(1.4)}/>` + tiles(30, 64, 14, 7, 4) + `
      <rect x="31" y="14" width="33" height="3" fill="${STU}" ${st(1.1)}/>
      ${[34, 45, 56].map(x => `<rect x="${x}" y="17" width="3.4" height="${26 - (x - 34) * .2}" fill="${STU}" ${st(1.1)}/>`).join('')}
      <path d="M38 40 L60 34 L60 38 Q50 42 40 43Z" fill="${C.woodD}" ${st(1.2)}/>
      <path d="M2 44 L40 44 Q38 51 31 52 L9 52 Q4 50 2 44Z" fill="${C.woodD}" ${st(1.5)}/>
      <path d="M4 47 L38 47" stroke="${C.bronze}" stroke-width="1.4"/>` + ram(2, 46, 1.2) + eyeShip(8, 47.6, .9) + `
      ${[11, 16, 21, 26, 31].map(x => `<path d="M${x} 50 L${x - 3} 58 M${x + 2} 50 L${x - 1} 57" stroke="${C.wood}" stroke-width="1.4"/>`).join('')}
      <path d="M40 44 Q46 40 44 34" fill="none" stroke="${C.woodD}" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M20 44 L20 16" stroke="${C.dark}" stroke-width="2"/><path d="M10 18 L30 18 L29 38 L11 38Z" fill="#efe6d2" ${st(1.3)}/>
      <path d="M10.5 26 L29.5 26 M11 32 L29 32" stroke="${WINE}" stroke-width="2"/><path d="M10 18 L30 18" stroke="${C.woodD}" stroke-width="2"/>`,

    // Гимнасий (12): беленый зал под плоской крышей, перед ним — герма и подставка с раскрытым свитком
    scribe5: shadow(29) + stucco(24, 24, 36, 30) + flatRoof(24, 20, 36) + `
      <rect x="37" y="36" width="10" height="18" fill="${C.dark}" ${st(1.3)}/><rect x="35" y="33" width="14" height="3" fill="${STUD}" ${st(1)}/>
      <rect x="28" y="30" width="4" height="4" fill="${C.dark}" ${st(1)}/><rect x="52" y="30" width="4" height="4" fill="${C.dark}" ${st(1)}/>` +
      herm(9, 55, 1) + `<path d="M17 56 L21 42 M25 56 L21 42" stroke="${C.woodD}" stroke-width="2" stroke-linecap="round"/>` + scroll(21, 39, .8),
    // Гимнасий (15): палестра под черепицей, ионическая колоннада, в стене — ниши со свитками (библиотека), герма
    scribe6: shadow(31) + tiles(6, 62, 18, 8, 5) + `
      <rect x="8" y="18" width="52" height="4" fill="${STU}" ${st(1.2)}/><path d="M10 20 L58 20" stroke="${WINE}" stroke-width="1.6" stroke-dasharray="3 1.5"/>
      <rect x="10" y="22" width="48" height="32" fill="${STU}" ${st(1.3)}/>
      ${[0, 1, 2].map(r => [0, 1, 2, 3].map(c => `<rect x="${15 + c * 10}" y="${26 + r * 8}" width="7" height="6" fill="#6b5640" ${st(.9)}/>
        <circle cx="${17 + c * 10}" cy="${30 + r * 8}" r="1.4" fill="${PAP}" stroke="${PAPD}" stroke-width=".6"/><circle cx="${20 + c * 10}" cy="${30 + r * 8}" r="1.4" fill="${PAP}" stroke="${PAPD}" stroke-width=".6"/>`).join('')).join('')}` +
      ionic(12, 23.4, 30.6, .9) + ionic(56, 23.4, 30.6, .9) + herm(5, 58, .9) + scroll(36, 56, .7, false),

    // Виноградник с давильней (12): терраса с лозами, каменный чан-ленос со стоком в сосуд и амфора
    vineyard3: shadow(28) + terrace(30) + vine(14, 22, .9) + vine(30, 21, .9) + vine(46, 20, .9) + `
      <path d="M6 44 L40 44 L38 54 L8 54Z" fill="${C.stone}" ${st(1.5)}/><path d="M9 46 L37 46 L36 50 L10 50Z" fill="${GR}" ${st(1)}/>
      <path d="M38 50 L44 51" stroke="${C.stoneD}" stroke-width="2.6" stroke-linecap="round"/>
      <path d="M42 52 Q41 58 46 59 Q51 58 50 52Z" fill="${C.mud}" ${st(1.2)}/>` + grapes(22, 44, .45) + amph2(57, 45, .55),
    // Виноградник с давильней (15): две террасы лоз, в чане топчут виноград, рядом — ряд амфор с клеймами под пурпурным навесом
    vineyard4: shadow(31) + terrace(22) + vine(10, 14, .75) + vine(24, 13, .75) + vine(38, 12, .75) + vine(52, 11, .75) + `
      <path d="M2 40 L32 40 L30 54 L4 54Z" fill="${C.stone}" ${st(1.5)}/><path d="M5 42 L29 42 L28 47 L6 47Z" fill="${GR}" ${st(1)}/>
      <path d="M17 42 L15 30 M17 42 L20 31" stroke="${C.mudD}" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M13 32 Q17 26 21 32 L20 37 L14 37Z" fill="${STU}" ${st(1.1)}/><circle cx="17" cy="25" r="2.6" fill="#e9c9a8" ${st(1)}/>
      <path d="M14.4 23.4 Q17 20.6 19.6 23.4" fill="none" stroke="${C.greenD}" stroke-width="1.6"/>
      <path d="M30 50 L36 51" stroke="${C.stoneD}" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M36 28 L64 28 L62 33 L38 33Z" fill="${WINE}" ${st(1.2)}/><path d="M38 33 L38 56 M62 33 L62 56" stroke="${C.woodD}" stroke-width="2"/>` +
      amph2(44, 44, .58) + amph2(51, 45, .58, '#c9845a') + amph2(58, 44, .58) + grapes(9, 48, .4) + grapes(24, 48, .4),

    // Роща с рычажным прессом (12): две оливы и пресс — балка давит корзины с мезгой, на конце камень-груз; кувшин масла
    olivegrove3: shadow(28) + olive(14, 26, 1) + olive(50, 24, 1) + beamPress(4, 52, 44) + `
      <path d="M26 52 Q25 58 30 59 Q35 58 34 52Z" fill="${C.mud}" ${st(1.2)}/><path d="M24 52 L36 52" stroke="${O}" stroke-width="1.2"/>`,
    // Роща с рычажным прессом (15): три оливы, беленая давильня с балкой из стены, груз, отстойник и амфоры масла
    olivegrove4: shadow(31) + olive(10, 20, .95) + olive(30, 16, .95) + olive(52, 18, .95) + stucco(2, 32, 16, 22, OCH) + flatRoof(2, 28, 16) + `
      <rect x="6" y="40" width="8" height="14" fill="${C.dark}" ${st(1.1)}/>
      <path d="M16 38 L50 44" stroke="${C.woodD}" stroke-width="3.2" stroke-linecap="round"/>
      ${[0, 1, 2].map(i => `<ellipse cx="27" cy="${52 - i * 3}" rx="6" ry="1.8" fill="${C.thatch}" ${st(.9)}/>`).join('')}
      <rect x="19" y="53" width="16" height="3" fill="${C.stone}" ${st(1)}/>
      <path d="M48 44 L48 50" stroke="${O}" stroke-width="1"/><path d="M43 50 L53 50 L52 57 L44 57Z" fill="${C.stoneD}" ${st(1.2)}/>
      <ellipse cx="38" cy="58" rx="5" ry="2" fill="#c9b04a" ${st(1)}/>` + amph2(58, 45, .55, '#c9845a'),

    // Кузница оружейников (12): беленая мастерская под плоской кровлей с двумя трубами, мехи у горна, на наковальне — меч,
    //   корыто для закалки, у стены — копья и железные крицы (богаче железной кузницы 9-го)
    forge3: shadow(30) + stucco(3, 22, 36, 32, OCH) + flatRoof(3, 18, 36) + `
      <rect x="9" y="8" width="6" height="10" fill="${STUD}" ${st(1.1)}/><rect x="27" y="10" width="5" height="8" fill="${STUD}" ${st(1.1)}/>` + smoke(12, 6) + smoke(29.5, 8) + `
      <path d="M8 54 Q8 37 18 37 Q28 37 28 54Z" fill="${C.dark}" ${st(1.3)}/>` + flame(18, 50, .85) + `
      <path d="M29 46 Q34 41 37 46 Q34 50 29 48Z" fill="#a9825a" ${st(1.1)}/>` + anvil(45, 49, .85) + `
      <path d="M38 44.5 L52 44" stroke="${IRNL}" stroke-width="2.6" stroke-linecap="round"/><path d="M38 44.5 L52 44" stroke="${IRND}" stroke-width=".7"/>
      <path d="M52 42 L52 47 M52 44 L56 43.8" stroke="${C.woodD}" stroke-width="2" stroke-linecap="round"/>
      <path d="M56 56 L56 14 M61 56 L61 18" stroke="${C.woodD}" stroke-width="1.8"/>
      <path d="M54 15 L56 8 L58 15Z M59 19 L61 12 L63 19Z" fill="${IRN}" ${st(1)}/>
      <rect x="30" y="56" width="14" height="5" rx="1" fill="${C.wood}" ${st(1.1)}/><path d="M31 56 L43 56" stroke="${C.water}" stroke-width="1.8"/>` + ironBars(6, 61, 2),
    // Кузница оружейников (15): мастерская под черепицей, стойка с круглыми щитами и шлемом, сариссы, горн с дымом
    forge4: shadow(31) + tiles(2, 40, 18, 7, 4) + stucco(4, 18, 34, 36, OCH) + `
      <rect x="10" y="8" width="5" height="10" fill="${C.stoneD}" ${st(1.1)}/>` + smoke(12.5, 6) + `
      <path d="M12 54 Q12 40 20 40 Q28 40 28 54Z" fill="${C.dark}" ${st(1.3)}/>` + flame(20, 50, .75) + `
      ${[42, 47, 52].map((x, i) => `<path d="M${x} 56 L${x + 10} 2" stroke="${C.woodD}" stroke-width="1.6"/><path d="M${x + 9} 6 L${x + 11} -1 L${x + 12} 7Z" fill="${IRN}" ${st(.8)}/>`).join('')}` +
      aspis(46, 42, 6.4) + aspis(57, 46, 6) + `
      <path d="M52 30 Q52 22 58 22 Q64 22 64 30 L62 34 L60 30 L56 30 L54 34Z" fill="${C.bronze}" ${st(1.2)}/><path d="M58 22 Q57 16 61 14" fill="none" stroke="${WINE}" stroke-width="2"/>`,
  });

  // ---------- спецстроения ----------
  // корабль у причала: круглый корпус, как у корабля из Кирении, парус с пурпурной полосой, амфоры в трюме (карта и чудо)
  const merchantShip = `<path d="M6 38 Q32 54 58 38 Q56 36 52 36 L12 36 Q8 36 6 38Z" fill="${C.wood}" ${st(1.8)}/>
      <path d="M8 42 Q32 52 56 42" fill="none" stroke="${C.woodD}" stroke-width="1.4"/>
      <path d="M58 38 Q64 32 60 24" fill="none" stroke="${C.woodD}" stroke-width="2.8" stroke-linecap="round"/>
      <path d="M6 38 Q3 34 6 30" fill="none" stroke="${C.woodD}" stroke-width="2.4" stroke-linecap="round"/>
      ${[16, 22, 40, 46].map(x => `<ellipse cx="${x}" cy="35" rx="2.2" ry="2.6" fill="#d6966a" ${st(1)}/>`).join('')}
      <path d="M31 37 L31 6" stroke="${C.dark}" stroke-width="2.2"/>
      <path d="M17 9 L45 9 L43 31 L19 31Z" fill="#efe6d2" ${st(1.5)}/>
      <path d="M24 9 L24 31 M31 9 L31 31 M38 9 L38 31" stroke="#c9b48c" stroke-width="1"/>
      <path d="M18 19 L44 19" stroke="${WINE}" stroke-width="2.6"/><path d="M16 9 L46 9" stroke="${C.woodD}" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M52 38 L57 52" stroke="${C.woodD}" stroke-width="2.6" stroke-linecap="round"/>`;
  const S = {
    // Гавань Нового Пафоса: каменный мол с маяком, стоа под черепицей на берегу, купеческий корабль в гавани
    sp_neapaphos: `<path d="M2 36 Q18 32 34 38 Q48 42 62 38 L62 62 L2 62Z" fill="${C.water}" ${st(1.4)}/>
      <path d="M30 50 q4 -2 8 0 M44 56 q4 -2 8 0 M6 58 q4 -2 8 0" stroke="${C.sky}" stroke-width="1.6" fill="none"/>
      <path d="M2 20 L36 20 L38 34 Q20 30 2 34Z" fill="${CALC}" ${st(1.3)}/>` + tiles(2, 36, 12, 6, 3) + `
      <rect x="3" y="12" width="32" height="3" fill="${STU}" ${st(1)}/>` + doric(7, 15, 14, .7) + doric(15, 15, 14, .7) + doric(23, 15, 14, .7) + doric(31, 15, 14, .7) + `
      <path d="M62 44 Q50 44 44 52 L40 60 L46 60 Q50 52 62 50Z" fill="${CALC}" ${st(1.4)}/>
      <path d="M47 52 L51 49 M53 48 L56 47" stroke="${CALCD}" stroke-width="1.1"/>
      <path d="M38 60 L39 40 L47 40 L48 60Z" fill="${STU}" ${st(1.4)}/><path d="M38.6 52 L47.4 52" stroke="${WINE}" stroke-width="2"/>
      <rect x="37" y="37" width="12" height="3.4" fill="${STUD}" ${st(1.1)}/><rect x="40" y="31" width="6" height="6" fill="${STU}" ${st(1.1)}/>` +
      flame(43, 31, .7) + `<g transform="translate(8 34) scale(.5)">${merchantShip}</g>`,
    // Дворец Вуни: на склоне холма — дворец с плоской крышей, во дворе цистерна, сбоку пифосы; на вершине — храм Афины
    sp_vouni: shadow(30) + `<path d="M2 56 Q8 40 20 34 Q32 22 44 24 Q56 28 62 56Z" fill="${C.furrow}" ${st(1.6)}/>
      <path d="M12 44 Q20 40 26 42 M40 34 Q48 34 54 40" stroke="${C.furrowD}" stroke-width="1.4" fill="none"/>
      <path d="M36 20 L44 14 L52 20Z" fill="${CALC}" ${st(1.4)}/><rect x="37" y="20" width="14" height="2.4" fill="${STU}" ${st(1)}/>
      ${[39, 43, 47].map(x => `<rect x="${x}" y="22.4" width="2" height="6" fill="${STU}" ${st(.9)}/>`).join('')}
      <rect x="35" y="28.4" width="18" height="2.4" fill="${CALC}" ${st(1)}/>
      <rect x="6" y="38" width="40" height="15" fill="${STU}" ${st(1.6)}/><rect x="4" y="35" width="44" height="4" fill="${STUD}" ${st(1.3)}/>
      <rect x="18" y="41" width="16" height="9" fill="${CALC}" ${st(1.2)}/><circle cx="26" cy="45.5" r="2.6" fill="${C.water}" ${st(1)}/>
      <rect x="9" y="42" width="5" height="11" fill="${C.dark}" ${st(1.1)}/><rect x="38" y="42" width="5" height="6" fill="${C.dark}" ${st(1.1)}/>` +
      pithos(53, 50, .42) + pithos(58, 52, .36),
    // Корабельные сараи Китиона: ряд длинных сараев под двускатными крышами, каменные пандусы к воде, триера на пандусе
    sp_kition: `<path d="M2 46 Q32 42 62 46 L62 62 L2 62Z" fill="${C.water}" ${st(1.4)}/>
      <path d="M8 56 q4 -2 8 0 M40 58 q4 -2 8 0" stroke="${C.sky}" stroke-width="1.6" fill="none"/>
      ${[4, 24, 44].map(x => `<path d="M${x} 22 L${x + 8} 14 L${x + 16} 22 L${x + 16} 40 L${x} 40Z" fill="${CALC}" ${st(1.4)}/>
        <path d="M${x + 3} 40 L${x + 3} 26 L${x + 13} 26 L${x + 13} 40" fill="${C.dark}" opacity=".7"/>
        <path d="M${x + 2} 40 L${x + 14} 40 L${x + 16} 50 L${x} 50Z" fill="${C.stone}" ${st(1.1)}/>`).join('')}
      <path d="M26 44 L38 44 L42 40 L44 42 L40 49 L28 49Z" fill="${C.wood}" ${st(1.3)}/><circle cx="38.5" cy="45" r="1.1" fill="${C.white}"/>
      <path d="M44 42 L48 43" stroke="#8e979e" stroke-width="2" stroke-linecap="round"/>`,
    // Стоя Зенона: длинная колоннада под черепицей на ступенях, на задней стене — расписные панели (как в Расписной стое)
    sp_stoa: shadow(30) + `<rect x="4" y="50" width="56" height="4" fill="${CALC}" ${st(1.3)}/><rect x="6" y="47" width="52" height="3.4" fill="${CALC}" ${st(1.2)}/>
      <rect x="7" y="27" width="50" height="20" fill="${STUD}" ${st(1.2)}/>
      ${[[11, OCH], [19, WINE], [27, C.water], [35, OCH], [43, WINE], [51, C.green]].map(([x, c]) => `<rect x="${x}" y="31" width="6" height="11" fill="${c}" opacity=".7"/>`).join('')}` +
      [9, 17, 25, 33, 41, 49, 55].map(x => doric(x, 27, 20, .95)).join('') +
      `<rect x="5" y="22" width="54" height="5" fill="${STU}" ${st(1.3)}/><path d="M6 24.5 L58 24.5" stroke="${WINE}" stroke-width="1.6"/>` + tiles(3, 61, 22, 8, 4),
    // Театр Нового Пафоса: полукруг рядов на склоне холма, орхестра и сцена со входами
    sp_theatre: shadow(30) + `<path d="M2 52 Q3 16 32 12 Q61 16 62 52Z" fill="${C.furrow}" ${st(1.5)}/>
      <path d="M6 46 A26 28 0 0 1 58 46 L46 46 A14 15 0 0 0 18 46Z" fill="${CALC}" ${st(1.4)}/>
      ${[17, 20, 23].map(r => `<path d="M${32 - r * 26 / 26 - (r - 14) * .5} 46 A${r + 3} ${r + 4} 0 0 1 ${32 + r * 26 / 26 + (r - 14) * .5} 46" fill="none" stroke="${CALCD}" stroke-width="1"/>`).join('')}
      ${[-60, -30, 0, 30, 60].map(a => { const r = a * Math.PI / 180; return `<path d="M${(32 + Math.sin(r) * 14).toFixed(1)} ${(46 - Math.cos(r) * 15).toFixed(1)} L${(32 + Math.sin(r) * 26).toFixed(1)} ${(46 - Math.cos(r) * 28).toFixed(1)}" stroke="${CALCD}" stroke-width="1.2"/>`; }).join('')}
      <path d="M18 46 A14 15 0 0 1 46 46Z" fill="${STU}" ${st(1.2)}/><circle cx="32" cy="41" r="1.8" fill="${CALC}" ${st(.9)}/>
      <rect x="10" y="46" width="44" height="9" fill="${STU}" ${st(1.4)}/><rect x="9" y="44.5" width="46" height="2.4" fill="${STUD}" ${st(1)}/>
      <rect x="18" y="48.5" width="4" height="6.5" fill="${C.dark}"/><rect x="30" y="48" width="4.4" height="7" fill="${C.dark}"/><rect x="42" y="48.5" width="4" height="6.5" fill="${C.dark}"/>`,
    // Римский храм Афродиты Пафосской — как на монетах провинции: высокая середина с коническим камнем, крылья с колоннами
    //   под черепицей, голуби на крышах, над фронтоном — звезда и полумесяц
    sp_paphia: shadow(30) + `<rect x="4" y="48" width="56" height="7" fill="${C.stone}" ${st(1.5)}/><rect x="6" y="45.6" width="52" height="3" fill="${CALC}" ${st(1.1)}/>
      <rect x="7" y="30" width="15" height="15.6" fill="${STU}" ${st(1.3)}/><rect x="42" y="30" width="15" height="15.6" fill="${STU}" ${st(1.3)}/>` +
      [11, 18, 46, 53].map(x => ionic(x, 31.6, 17, .8)).join('') + tiles(5, 24, 30, 4, 3) + tiles(40, 59, 30, 4, 3) +
      `<rect x="22" y="20" width="20" height="25.6" fill="${STU}" ${st(1.4)}/><path d="M25 45.6 L25 28 Q32 22 39 28 L39 45.6Z" fill="${C.dark}" opacity=".75"/>
      <path d="M27 45.6 Q28.4 32 32 28 Q35.6 32 37 45.6Z" fill="#5d5a66" ${st(1.4)}/><path d="M30 37 Q31.4 32.6 33.6 33.4" stroke="#8f8b99" stroke-width="1.2" fill="none"/>
      <path d="M20 20 L32 11.5 L44 20Z" fill="${TER}" ${st(1.5)}/><path d="M24.5 18.6 L32 13.6 L39.5 18.6" fill="none" stroke="${TERL}" stroke-width="1"/>
      <path d="M9 25 q3 -3 6 0 q-3 1 -6 0Z M49 25 q3 -3 6 0 q-3 1 -6 0Z" fill="${C.white}" ${st(.9)}/>
      <path d="M28.6 7.4 A3.6 3.6 0 0 0 35.4 7.4 A3 3 0 0 1 28.6 7.4Z" fill="${C.wheat}" ${st(.8)}/>
      <path d="M32 1.2 L32.9 3.4 L35 4.2 L32.9 5 L32 7.2 L31.1 5 L29 4.2 L31.1 3.4Z" fill="#ffe69a" ${st(.6)}/>`,
    // Палеопафос: двор с колоннами, конический камень богини, голуби
    sp_aphrodite: shadow(28) + `
      <rect x="6" y="46" width="52" height="9" fill="${C.stone}" ${st()}/>
      <rect x="10" y="20" width="44" height="6" fill="${C.plaster}" ${st(1.5)}/>
      ${[12, 46].map(x => `<rect x="${x}" y="26" width="6" height="20" fill="${C.plaster}" ${st(1.4)}/>`).join('')}
      <path d="M22 46 Q24 22 32 18 Q40 22 42 46Z" fill="#5d5a66" ${st(1.8)}/><path d="M28 30 Q31 24 34 26" stroke="#8f8b99" stroke-width="1.6" fill="none"/>
      <path d="M8 20 L32 8 L56 20Z" fill="${C.terra}" ${st(1.5)}/>
      <path d="M48 12 q3 -3 6 0 q-3 1 -6 0Z M50 10 l3 -1" fill="${C.white}" ${st(1)}/><path d="M10 14 q3 -3 6 0 q-3 1 -6 0Z" fill="${C.white}" ${st(1)}/>
      <circle cx="14" cy="52" r="2.4" fill="#d9536e"/><circle cx="50" cy="52" r="2.4" fill="#d9536e"/>`,
    // Курион: храм с колоннами, солнце, роща
    sp_apollo: shadow(28) + `
      ${[0, 30, 60, 90, 120, 150].map(a => { const r = (a + 195) * Math.PI / 180; return `<path d="M${46 + Math.cos(r) * 9} ${14 + Math.sin(r) * 9} L${46 + Math.cos(r) * 14} ${14 + Math.sin(r) * 14}" stroke="${C.fire}" stroke-width="2" stroke-linecap="round"/>`; }).join('')}
      <circle cx="46" cy="14" r="7" fill="${C.fireL}" ${st(1.4)}/>` + pine(10, 44, .7) + `
      <rect x="14" y="48" width="44" height="7" fill="${C.stone}" ${st()}/>
      ${[18, 28, 38, 48].map(x => `<rect x="${x}" y="30" width="5" height="18" fill="${C.plaster}" ${st(1.3)}/>`).join('')}
      <rect x="15" y="26" width="40" height="5" fill="${C.plaster}" ${st(1.4)}/><path d="M14 26 L35 16 L56 26Z" fill="${C.plaster}" ${st(1.5)}/>
      <circle cx="35" cy="22" r="2" fill="${C.bronze}" ${st(1)}/>`,
    // Троодос в лозах: склоны с террасами и гроздья
    sp_troodos2: `
      <path d="M2 54 L20 16 L30 30 L40 10 L62 54Z" fill="${C.stoneD}" ${st()}/>
      <path d="M20 16 L26 24 L22 26 L18 22Z M40 10 L47 22 L42 24 L36 18Z" fill="${C.white}" ${st(1.2)}/>
      <path d="M10 46 L54 46 M14 38 L50 38 M20 30 L44 30" stroke="${C.stone}" stroke-width="2.4"/>` +
      vine(14, 44, .55) + vine(26, 44, .55) + vine(38, 44, .55) + vine(50, 44, .55) + vine(22, 36, .5) + vine(34, 36, .5) + vine(44, 36, .5) + grapes(52, 52, .6),
    sp_lemba: shadow(28) + smoke(44, 6) + roundHut(32, 34, 1.3, { base: true, wall: C.plaster, knob: true }),
    sp_troodos: `
      <path d="M2 54 L20 16 L30 30 L40 10 L62 54Z" fill="${C.stoneD}" ${st()}/>
      <path d="M20 16 L26 24 L22 26 L18 22Z M40 10 L47 22 L42 24 L36 18Z" fill="${C.white}" ${st(1.2)}/>` +
      pine(12, 46, .7) + pine(54, 46, .75) + `
      <g transform="translate(34 46)"><path d="M-8 -2 Q-8 -7 -2 -7 L6 -7 Q8 -6 8 -3 L8 1 L-8 1Z" fill="${C.mudD}" ${st(1.4)}/>
        <path d="M-6 1 L-6 7 M-2 1 L-2 7 M3 1 L3 7 M6 1 L6 7" ${st(1.5)}/>
        <path d="M6 -6 L10 -10 Q13 -10 13 -7 L11 -4Z" fill="${C.mudD}" ${st(1.3)}/>
        <path d="M10 -10 Q3 -16 2 -9 Q3 -5 7 -7" fill="none" stroke="${C.wheat}" stroke-width="2.4" stroke-linecap="round"/></g>`,
    sp_souskiou: shadow(26) + `
      <path d="M6 52 Q8 24 30 20 Q52 24 56 52Z" fill="${C.stoneD}" ${st()}/>
      <path d="M22 52 Q22 36 30 36 Q38 36 38 52Z" fill="${C.dark}" ${st(1.5)}/>
      <path d="M18 30 L22 34 M40 28 L44 33" stroke="${O}" stroke-width="1.2" opacity=".5"/>
      ${[[44, 50, 5], [52, 52, 4], [48, 45, 4], [56, 46, 3.5], [40, 53, 3]].map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * .75}" fill="${C.pic}" stroke="${O}" stroke-width="1.2"/>`).join('')}
      <path d="M8 46 Q14 40 18 46" fill="none" stroke="${C.pic}" stroke-width="2.4" stroke-linecap="round"/>
      <circle cx="13" cy="47" r="2.4" fill="${C.pic}" stroke="${O}" stroke-width="1"/>`,
    shrine1: shadow(26) + `
      <rect x="12" y="42" width="40" height="12" fill="${C.stone}" ${st()}/>
      <path d="M12 47 L52 47" stroke="${C.stoneD}" stroke-width="1.2"/>` + idol(32, 26, 1.2) + `
      <circle cx="16" cy="38" r="3" fill="${C.wheat}" ${st(1.2)}/><circle cx="48" cy="38" r="3" fill="${C.wheat}" ${st(1.2)}/>` +
      flame(10, 52, .5) + flame(54, 52, .5),
    sp_halasultan: `
      <path d="M2 34 Q32 26 62 34 L62 58 L2 58Z" fill="${C.water}" ${st(1.4)}/>
      <path d="M2 34 L2 26 Q16 22 26 26 L22 34Z" fill="${C.mud}" ${st(1.4)}/>
      <ellipse cx="44" cy="22" rx="16" ry="5" fill="#e9e3d6" ${st(1.3)}/>
      <path d="M10 48 Q24 58 40 48Z" fill="${C.woodD}" ${st()}/>
      <path d="M24 50 L24 28" stroke="${C.dark}" stroke-width="2"/>
      <path d="M15 31 L33 31 L32 45 L16 45Z" fill="${C.white}" ${st(1.5)}/>
      <path d="M15 37 L33 37" stroke="${C.red}" stroke-width="2"/>
      <path d="M46 46 q4 -2 8 0" stroke="${C.sky}" stroke-width="1.6" fill="none"/>`,
    sp_ingot: shadow(20) + ingotShape(32, 50, 1, C.copper, C.copperD) + `
      <g transform="translate(32 26)">
        <path d="M-4 -4 L4 -4 L5 10 L2 10 L1 20 L-1 20 L-2 10 L-5 10Z" fill="${C.bronze}" ${st(1.5)}/>
        <circle cx="0" cy="-9" r="4.5" fill="${C.bronze}" ${st(1.5)}/>
        <path d="M-4 -12 Q-10 -16 -9 -21 M4 -12 Q10 -16 9 -21" fill="none" stroke="${C.bronzeD}" stroke-width="2" stroke-linecap="round"/>
        <path d="M5 -2 L12 6 L12 -14" fill="none" stroke="${C.bronzeD}" stroke-width="2" stroke-linecap="round"/>
        <ellipse cx="-9" cy="2" rx="4" ry="6" fill="${C.bronzeD}" ${st(1.3)}/>
      </g>`,
    sp_walls: shadow(30) + `
      <path d="M2 54 L2 20 L62 20 L62 54Z" fill="${C.stone}" ${st()}/>
      <path d="M2 30 L18 28 L30 31 L46 28 L62 30 M2 42 L12 40 L26 43 L40 41 L52 43 L62 41 M18 20 L16 28 M34 20 L30 31 M50 20 L46 28 M12 30 L10 40 M40 30 L40 41 M24 43 L22 54 M52 43 L54 54" fill="none" stroke="${C.stoneD}" stroke-width="1.6"/>
      <path d="M26 54 L26 38 Q32 32 38 38 L38 54Z" fill="${C.dark}" ${st()}/>`,
    // каменная ваза Амафунта: огромная чаша из одного камня с четырьмя ручками-быками на акрополе
    sp_amathus: shadow(28) + `
      <path d="M4 56 L14 44 L50 44 L60 56Z" fill="${C.stoneD}" ${st(1.4)}/>
      <path d="M24 44 L26 38 L38 38 L40 44Z" fill="${C.stone}" ${st(1.5)}/>
      <path d="M8 18 L56 18 Q56 30 44 36 Q38 39 32 39 Q26 39 20 36 Q8 30 8 18Z" fill="#cbc3b2" ${st(1.8)}/>
      <ellipse cx="32" cy="18" rx="24" ry="5" fill="#b0a897" ${st(1.6)}/><ellipse cx="32" cy="18" rx="19" ry="3" fill="#8f877a"/>
      <path d="M12 26 Q20 33 32 33 Q44 33 52 26" fill="none" stroke="${C.stoneD}" stroke-width="1.2"/>
      ${[[14, 24], [50, 24]].map(([x, y]) => `<path d="M${x} ${y} q${x < 32 ? -6 : 6} 0 ${x < 32 ? -6 : 6} 6 q0 4 ${x < 32 ? 4 : -4} 4" fill="none" ${st(2.2)}/>
        <path d="M${x + (x < 32 ? -8 : 8)} ${y - 3} l${x < 32 ? -2 : 2} -3 M${x + (x < 32 ? -4 : 4)} ${y - 3} l${x < 32 ? 2 : -2} -3" stroke="${O}" stroke-width="1.4" stroke-linecap="round"/>`).join('')}
      <path d="M26 27 q3 -3 6 0 q3 -3 6 0" fill="none" stroke="${C.stoneD}" stroke-width="1.2"/>`,
    // царская гробница Саламина: каменный фасад, дромос и колесничное колесо у входа
    sp_salamis: shadow(30) + `
      <path d="M6 54 L22 34 L42 34 L58 54Z" fill="${C.mud}" ${st(1.6)}/><path d="M14 54 L26 38 L38 38 L50 54" fill="none" stroke="${C.mudD}" stroke-width="1.4"/>
      <rect x="18" y="12" width="28" height="24" fill="${C.stone}" ${st()}/><path d="M18 20 L46 20 M18 28 L46 28 M26 12 L26 20 M38 20 L38 28 M30 28 L30 36" stroke="${C.stoneD}" stroke-width="1.2"/>
      <path d="M27 36 L27 26 Q32 22 37 26 L37 36Z" fill="${C.dark}" ${st(1.5)}/>
      <circle cx="16" cy="46" r="8" fill="none" stroke="${C.woodD}" stroke-width="2.4"/>${[0, 45, 90, 135].map(a => { const r = a * Math.PI / 180; return `<path d="M${16 - Math.cos(r) * 8} ${46 - Math.sin(r) * 8} L${16 + Math.cos(r) * 8} ${46 + Math.sin(r) * 8}" stroke="${C.woodD}" stroke-width="1.4"/>`; }).join('')}
      <circle cx="16" cy="46" r="2" fill="${C.bronze}" ${st(1)}/>` + amphoraShape(50, 46, .5),
    sp_palace: shadow(30) + `
      <rect x="4" y="22" width="56" height="32" fill="${C.plaster}" ${st()}/>
      <rect x="2" y="16" width="60" height="7" fill="${C.stoneD}" ${st()}/>
      <path d="M4 34 L60 34 M4 44 L60 44" stroke="${C.stone}" stroke-width="1.4"/>
      ${[10, 22, 38, 50].map(x => `<rect x="${x}" y="25" width="5" height="7" fill="${C.dark}" ${st(1.1)}/>`).join('')}
      <rect x="26" y="38" width="12" height="16" fill="${C.dark}" ${st(1.3)}/>
      <path d="M26 16 L32 10 L38 16" fill="${C.terra}" ${st(1.4)}/>`,
    shrine2: shadow(24) + `
      <rect x="18" y="46" width="28" height="8" fill="${C.stone}" ${st()}/>
      <g transform="translate(32 28)">
        <path d="M-7 4 L7 4 L9 18 L-9 18Z" fill="${C.bronze}" ${st(1.6)}/>
        <path d="M-6 -6 Q-6 -14 0 -14 Q6 -14 6 -6 L6 2 Q0 6 -6 2Z" fill="${C.bronze}" ${st(1.6)}/>
        <path d="M-6 -10 Q-16 -12 -18 -22 Q-11 -18 -5 -14 M6 -10 Q16 -12 18 -22 Q11 -18 5 -14" fill="${C.white}" ${st(1.5)}/>
        <path d="M-3 -4 l2 0 M1 -4 l2 0" stroke="${O}" stroke-width="1.4"/>
      </g>`,
  };

  // лежащий баран с монет Эвелфонта Саламинского: туловище, поднятая голова с закрученным рогом, поджатые ноги
  const coinRam = (x, y, s = 1, col = '#b3bcc3') => `<g transform="translate(${x} ${y}) scale(${s})">
      <path d="M-6 5 Q-8 -1 -2 -1.6 L7 -1.6 Q11.5 -1 11.5 3.6 Q11.5 8 7 8 L-3 8 Q-6 8 -6 5Z" fill="${col}" ${st(1.3)}/>
      <path d="M-3 1 Q-5 -5 -10 -5.4 Q-14.6 -5.4 -15.4 -2.4 Q-15.6 .4 -12.6 1 Q-8.6 1.6 -6.4 5Z" fill="${col}" ${st(1.3)}/>
      <circle cx="-8.6" cy="-3" r="3.4" fill="${col}" ${st(1.3)}/><path d="M-8.6 -3 m-1.5 0 a1.5 1.5 0 1 0 1.5 -1.5" fill="none" ${st(1.1)}/>
      <circle cx="-13" cy="-3" r=".7" fill="${O}"/>
      <path d="M-.5 1.6 q1.6 -1.6 3.2 0 q1.6 -1.6 3.2 0 M1 5 q1.6 -1.6 3.2 0 q1.6 -1.6 3.2 0" fill="none" stroke="#7d868d" stroke-width=".9"/>
      <path d="M-2 8 l-3.4 1.6 M7 8 l3.4 1.6" ${st(1.2)}/></g>`;
  // ---------- ресурсы ----------
  const R = {
    food: `${[22, 32, 42].map((x, i) => `<path d="M32 58 L${x} ${16 + Math.abs(i - 1) * 4}" stroke="${C.wheatD}" stroke-width="2.6"/>
      <ellipse cx="${x}" cy="${12 + Math.abs(i - 1) * 4}" rx="4" ry="8" transform="rotate(${(i - 1) * 18} ${x} ${12 + Math.abs(i - 1) * 4})" fill="${C.wheat}" ${st(1.6)}/>`).join('')}
      <path d="M24 44 L40 44" stroke="${C.terra}" stroke-width="3.4"/>`,
    wood: logEnds(30, 42, 1.25) + logEnds(34, 26, 1.1),
    stone: `<path d="M6 52 L10 34 L24 28 L34 36 L32 52Z" fill="${C.stone}" ${st(2)}/>
      <path d="M28 52 L32 30 L46 20 L58 30 L58 52Z" fill="${C.stoneD}" ${st(2)}/>`,
    // халлуми: плотный белый брусок с полосками от гриля и листиком мяты
    cheese: `<path d="M6 34 L34 22 L58 32 L30 46Z" fill="#fbf6e6" ${st(2)}/>
      <path d="M6 34 L6 44 L30 56 L30 46Z" fill="#ece1c2" ${st(2)}/>
      <path d="M30 46 L30 56 L58 42 L58 32Z" fill="#e0d2ad" ${st(2)}/>
      <path d="M18 31 L40 40 M25 28 L47 37 M32 25 L52 33" stroke="#9c6b3c" stroke-width="2.6" stroke-linecap="round" opacity=".85"/>
      <path d="M36 12 Q48 8 52 18 Q42 22 36 12Z" fill="${C.green}" ${st(1.6)}/>
      <path d="M38 13 Q45 14 50 17" stroke="${C.greenD}" stroke-width="1.2" fill="none"/>`,
    // товары: амфора и тюк, перевязанный верёвкой
    goods: `<path d="M8 58 Q4 44 10 36 Q16 30 22 36 Q28 44 24 58Z" fill="${C.thatch}" ${st(2)}/>
      <path d="M12 36 Q16 30 20 36" fill="none" stroke="${C.woodD}" stroke-width="2.4"/>
      <path d="M8 46 Q16 50 24 46" fill="none" stroke="${C.thatchD}" stroke-width="1.6"/>
      <path d="M34 8 L46 8 L45 14 L35 14Z" fill="${C.terra}" ${st(1.8)}/>
      <path d="M35 14 Q24 22 26 36 Q28 48 40 58 Q52 48 54 36 Q56 22 45 14Z" fill="#c9693a" ${st(2)}/>
      <path d="M35 16 Q26 16 28 26 M45 16 Q54 16 52 26" fill="none" ${st(2.2)}/>
      <path d="M27 32 Q40 37 53 32" fill="none" stroke="${C.dark}" stroke-width="2"/>
      <path d="M28 38 Q40 43 52 38" fill="none" stroke="${C.white}" stroke-width="1.6"/>`,
    copper: ingotShape(32, 34, 1.9),
    bronze: `<path d="M10 22 Q20 10 34 18 L54 18 L54 30 L34 30 Q20 38 10 26Z" fill="${C.bronze}" ${st(2)}/>
      <path d="M34 18 L34 30" stroke="${C.bronzeD}" stroke-width="2"/>
      <path d="M44 30 L44 58" stroke="${C.woodD}" stroke-width="5" stroke-linecap="round"/>`,
    // железо: кипрский железный нож XI в. до н. э. — рукоять ещё на бронзовых заклёпках
    iron: `<path d="M20 40 L46 16 Q54 10 60 10 Q58 18 50 24 L26 46Z" fill="#a3aab0" ${st(2)}/>
      <path d="M24 42 L50 18" stroke="#d6dde2" stroke-width="2" stroke-linecap="round"/>
      <path d="M20 40 L26 46 L12 60 Q6 60 6 54Z" fill="${C.wood}" ${st(2)}/>
      <circle cx="14" cy="52" r="2.2" fill="${C.bronze}" ${st(1)}/><circle cx="19" cy="47" r="2.2" fill="${C.bronze}" ${st(1)}/>`,
    // серебро: рубленые куски на весах — монет ещё нет
    silver: `<path d="M8 50 L20 40 L32 46 L26 58 L12 58Z" fill="#cfd5da" ${st(1.8)}/>
      <path d="M30 34 L46 28 L56 38 L48 50 L34 46Z" fill="#b9c1c8" ${st(1.8)}/>
      <path d="M36 54 Q44 50 52 56 Q46 62 38 60Z" fill="#dfe4e8" ${st(1.6)}/>
      <path d="M12 52 L22 46 M34 38 L46 33" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M14 22 L50 18" stroke="${C.woodD}" stroke-width="2.4" stroke-linecap="round"/><path d="M32 20 L32 10" stroke="${C.woodD}" stroke-width="2.4"/>
      <path d="M10 22 Q14 30 18 22Z M46 18 Q50 26 54 18Z" fill="${C.bronze}" ${st(1.2)}/>`,
    // монеты (серебро после «Своей монеты»): кипрский статер с лежащим бараном, за ним — второй
    coin: `<circle cx="42" cy="22" r="15" fill="#c3cad0" ${st(2)}/><circle cx="42" cy="22" r="11" fill="none" stroke="#8e979e" stroke-width="1"/>
      <circle cx="27" cy="38" r="21" fill="${SLV}" ${st(2.2)}/><circle cx="27" cy="38" r="17" fill="none" stroke="#8e979e" stroke-width="1.2" stroke-dasharray="1.6 2"/>` +
      coinRam(29, 39, 1.2) + `<path d="M30 21 Q38 22 42 29" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity=".8"/>`,
    // папирус: свиток с письмом и метёлки нильского папируса за ним
    papyrus: `<path d="M44 60 L42 18 M51 60 L54 14" stroke="${C.greenD}" stroke-width="2.4" stroke-linecap="round"/>
      ${[[42, 18], [54, 14]].map(([x, y]) => [-60, -30, 0, 30, 60].map(a => { const r = (a - 90) * Math.PI / 180; return `<path d="M${x} ${y} L${(x + Math.cos(r) * 10).toFixed(1)} ${(y + Math.sin(r) * 10).toFixed(1)}" stroke="${C.green}" stroke-width="1.6" stroke-linecap="round"/>`; }).join('')).join('')}
      <rect x="8" y="30" width="32" height="24" fill="${PAP}" ${st(2)}/>
      <path d="M13 36 L35 36 M13 41 L33 41 M13 46 L34 46 M13 51 L26 51" stroke="${PAPD}" stroke-width="1.6"/>
      <rect x="2" y="27" width="8" height="30" rx="4" fill="${PAP}" ${st(2)}/><rect x="38" y="27" width="8" height="30" rx="4" fill="${PAP}" ${st(2)}/>
      <ellipse cx="6" cy="27.6" rx="3" ry="1.4" fill="${PAPD}"/><ellipse cx="42" cy="27.6" rx="3" ry="1.4" fill="${PAPD}"/>`,
    // амфоры: вино и масло
    amphora: amphoraShape(28, 34, 1.55) + grapes(48, 46, .7) + `<path d="M44 14 Q54 10 58 18 Q50 20 44 14Z" fill="#8d9b5c" ${st(1.3)}/><circle cx="52" cy="22" r="2.4" fill="#3c4a2a"/>`,
  };

  // ---------- местность и звери ----------
  const T = {
    tree: pine(22, 40, 1.15) + pine(42, 44, 1.3),
    hill: `<path d="M4 54 Q18 20 34 24 Q48 26 60 54Z" fill="#9f7b4d" ${st(1.6)} opacity=".75"/>
      <path d="M20 32 L26 40 M38 30 L44 40" stroke="#6f532f" stroke-width="1.6" opacity=".6"/>`,
    goat: goat(30, 40, 1.6, C.white),
    // купеческий корабль у причала: круглый корпус, как у корабля из Кирении, парус с пурпурной полосой, амфоры в трюме
    ship: merchantShip + `<path d="M2 54 q5 -3 10 0 t10 0 M40 56 q5 -3 10 0 t10 0" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity=".8"/>`,
    maenad: maenad(32, 34, 1.5),
  };

  // ---------- медальоны знаний (светлые) и обрядов (тёмные, «ночные») ----------
  const disc = (bg, rim) => `<circle cx="32" cy="32" r="28" fill="${bg}" stroke="${rim}" stroke-width="2.4"/>`;
  const tdisc = disc('#f1e4c3', O);
  const rdisc = disc('#3c3a5c', '#22203a');
  const star = (x, y, r = 2) => `<path d="M${x} ${y - r * 2} L${x + r * .6} ${y - r * .6} L${x + r * 2} ${y} L${x + r * .6} ${y + r * .6} L${x} ${y + r * 2} L${x - r * .6} ${y + r * .6} L${x - r * 2} ${y} L${x - r * .6} ${y - r * .6}Z" fill="#ffe69a"/>`;
  const M = {
    // знания
    t_cheesemaking: tdisc + `<path d="M14 30 L50 30 Q50 48 32 50 Q14 48 14 30Z" fill="${C.terra}" ${st(2)}/>
      <ellipse cx="32" cy="30" rx="18" ry="5" fill="${C.white}" ${st(1.6)}/>
      ${[[26, 28], [33, 31], [39, 28], [30, 32]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="#fbf6e6" stroke="#c9b48c" stroke-width="1"/>`).join('')}
      <path d="M44 12 Q48 18 44 21 Q40 18 44 12Z" fill="${C.sky}" ${st(1.3)}/>`,
    t_carving: tdisc + `<path d="M14 46 L18 30 L32 24 L42 32 L40 46Z" fill="${C.pic}" ${st(1.8)}/>
      <path d="M20 34 L28 38 L34 31" fill="none" stroke="${C.picD}" stroke-width="1.6"/>
      <path d="M36 30 L50 14" stroke="${C.stoneD}" stroke-width="3" stroke-linecap="round"/>
      <rect x="44" y="34" width="12" height="7" rx="2" transform="rotate(-35 50 37)" fill="${C.wood}" ${st(1.5)}/>
      <path d="M44 42 L36 50" stroke="${C.woodD}" stroke-width="3" stroke-linecap="round"/>`,
    t_granary: tdisc + `<path d="M18 50 L26 36 L34 50Z" fill="${C.mud}" ${st(1.6)}/><circle cx="42" cy="44" r="6" fill="${C.mud}" ${st(1.6)}/>
      <rect x="24" y="18" width="10" height="10" rx="2" fill="${C.mudD}" ${st(1.4)}/><circle cx="44" cy="24" r="4" fill="${C.mudD}" ${st(1.4)}/>
      <path d="M29 23 l0 0 M20 46 l0 0" stroke="${O}" stroke-width="2.4" stroke-linecap="round"/>`,
    t_foundations: tdisc + `${[[12, 40], [24, 40], [36, 40], [18, 30], [30, 30]].map(([x, y]) => `<rect x="${x}" y="${y}" width="12" height="9" rx="2" fill="${C.stone}" ${st(1.5)}/>`).join('')}
      <path d="M48 12 L48 34" stroke="${O}" stroke-width="1.4"/><path d="M44 34 L52 34 L48 44Z" fill="${C.copper}" ${st(1.4)}/>`,
    t_redwhite: tdisc + `<path d="M10 28 Q32 26 54 28 Q52 46 32 48 Q12 46 10 28Z" fill="${C.white}" ${st(2)}/>
      <path d="M12 34 Q32 38 52 34" fill="none" stroke="${C.red}" stroke-width="2.6"/>
      <path d="M16 40 l4 -4 l4 4 l4 -4 l4 4 l4 -4 l4 4 l4 -4" fill="none" stroke="${C.red}" stroke-width="1.8"/>`,
    t_nativecopper: tdisc + `<path d="M12 40 Q14 28 24 28 Q30 22 36 28 Q42 30 40 40 Q34 48 24 46 Q14 48 12 40Z" fill="${C.copper}" ${st(1.8)}/>
      <path d="M20 36 Q26 32 32 36" fill="none" stroke="${C.copperD}" stroke-width="1.6"/>
      <path d="M44 16 L50 44" stroke="${C.copperD}" stroke-width="3.2" stroke-linecap="round"/><path d="M42 14 L48 12 L46 18Z" fill="${C.wood}" ${st(1.2)}/>`,
    t_smelting: tdisc + flame(32, 50, 1.2) + `<path d="M18 22 L46 22 L42 40 L22 40Z" fill="${C.stoneD}" ${st(2)}/>
      <ellipse cx="32" cy="22" rx="14" ry="4" fill="${C.fireL}" ${st(1.6)}/><ellipse cx="32" cy="22" rx="8" ry="2" fill="${C.copper}"/>`,
    t_seafaring: tdisc + star(20, 18, 2.2) + star(40, 14, 1.6) + star(48, 24, 1.4) +
      `<path d="M14 40 L50 40 Q46 50 32 50 Q18 50 14 40Z" fill="${C.wood}" ${st(1.8)}/>
      <path d="M32 40 L32 22" stroke="${C.dark}" stroke-width="2"/><path d="M24 24 L40 24 L38 36 L26 36Z" fill="${C.white}" ${st(1.4)}/>
      <path d="M8 52 q6 -4 12 0 t12 0 t12 0 t12 0" fill="none" stroke="${C.water}" stroke-width="2.4"/>`,
    t_ashlar: tdisc + `<rect x="14" y="22" width="30" height="22" fill="${C.stone}" ${st(2)}/>
      <rect x="18" y="26" width="22" height="14" fill="none" stroke="${C.stoneD}" stroke-width="1.4" stroke-dasharray="2 2"/>
      <path d="M42 46 L50 46 L50 18" fill="none" stroke="${C.woodD}" stroke-width="3" stroke-linecap="square"/>`,
    t_bronze: tdisc + `<circle cx="25" cy="32" r="12" fill="${C.copper}" ${st(1.8)}/><circle cx="39" cy="32" r="12" fill="#b9b9b2" ${st(1.8)}/>
      <path d="M32 22.3 A12 12 0 0 1 32 41.7 A12 12 0 0 1 32 22.3Z" fill="${C.bronze}" ${st(1.4)}/>`,
    t_oxhide: tdisc + ingotShape(32, 40, .9) + `<path d="M32 12 L32 26 M18 18 L46 18" stroke="${O}" stroke-width="2"/>
      <path d="M14 18 L22 18 L18 26Z M42 18 L50 18 L46 26Z" fill="${C.bronze}" ${st(1.2)}/>`,
    t_bronzetools: tdisc + `<path d="M18 46 L40 18" stroke="${C.woodD}" stroke-width="3.4" stroke-linecap="round"/>
      <path d="M34 14 Q44 10 48 20 L40 24Z" fill="${C.bronze}" ${st(1.5)}/>
      <path d="M46 46 Q20 44 22 22 Q30 34 46 38Z" fill="${C.bronze}" ${st(1.5)}/><path d="M46 38 L52 50" stroke="${C.woodD}" stroke-width="3.4" stroke-linecap="round"/>`,
    // железо: наковальня, молот и раскалённая полоса
    t_iron: tdisc + `<path d="M14 40 L50 40 L46 46 L40 46 L42 54 L22 54 L24 46 L18 46Z" fill="#7d858b" ${st(1.8)}/>
      <path d="M20 36 L42 36" stroke="${C.fire}" stroke-width="4" stroke-linecap="round"/><path d="M22 36 L38 36" stroke="${C.fireL}" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M30 12 L46 28" stroke="${C.woodD}" stroke-width="3.4" stroke-linecap="round"/>
      <path d="M40 10 L52 22 L46 26 L34 14Z" fill="#a3aab0" ${st(1.6)}/>
      <path d="M50 30 l4 -2 M52 34 l5 0 M48 26 l3 -4" stroke="${C.fireL}" stroke-width="1.6" stroke-linecap="round"/>`,
    // слоговое письмо: бронзовая табличка из Идалиона с кипрскими знаками
    t_syllabary: tdisc + `<rect x="14" y="16" width="36" height="32" rx="2" fill="${C.bronze}" ${st(1.8)}/>
      <circle cx="32" cy="12" r="4" fill="none" ${st(1.6)}/>
      <path d="M18 22 l4 4 l4 -4 M30 21 l0 6 M28 24 l4 0 M38 22 l3 5 l3 -5 M18 32 l0 6 M18 35 l5 0 M28 31 l4 7 M32 31 l-4 7 M38 31 q4 3 0 7 M18 42 l8 0 M30 42 l3 -3 l3 3 M40 40 l4 4" fill="none" stroke="${C.bronzeD}" stroke-width="1.5" stroke-linecap="round"/>`,
    // финикийцы: корабль с конской головой на носу и рубленое серебро
    t_phoenicians: tdisc + `<path d="M12 38 L52 38 Q48 48 32 48 Q16 48 12 38Z" fill="${C.wood}" ${st(1.8)}/>
      <path d="M52 38 Q56 32 54 26 Q50 26 50 30 L48 38" fill="${C.wood}" ${st(1.4)}/><circle cx="53" cy="28" r="1" fill="${O}"/>
      <path d="M30 38 L30 16" stroke="${C.dark}" stroke-width="2"/><path d="M20 18 L40 18 L38 32 L22 32Z" fill="#8a3a5c" ${st(1.4)}/>
      <path d="M22 25 L38 25" stroke="${C.white}" stroke-width="1.6"/>
      <path d="M14 52 L20 48 L24 52 L20 56Z M26 54 L32 50 L36 55 L30 57Z" fill="#cfd5da" ${st(1.2)}/>`,
    // виноградарство: лоза с гроздью и садовый нож
    t_viticulture: tdisc + vine(24, 34, 1.3, false) + grapes(36, 30, .95) +
      `<path d="M16 50 Q28 46 34 52" stroke="${C.woodD}" stroke-width="3" stroke-linecap="round" fill="none"/><path d="M34 52 Q44 50 44 42 Q38 46 34 48Z" fill="#a3aab0" ${st(1.3)}/>`,
    // дань фараону: анх и рубленое серебро на весах-чаше
    t_pharaoh: tdisc + `<circle cx="24" cy="18" r="7" fill="none" stroke="${C.bronze}" stroke-width="4"/><circle cx="24" cy="18" r="7" fill="none" ${st(1)}/>
      <path d="M24 25 L24 50 M13 30 L35 30" stroke="${C.bronze}" stroke-width="5" stroke-linecap="round"/>
      <path d="M24 25 L24 50 M13 30 L35 30" stroke="${C.bronzeD}" stroke-width="1" stroke-linecap="round" opacity=".7"/>
      <path d="M36 44 Q44 52 54 44Z" fill="${C.bronze}" ${st(1.4)}/>
      <path d="M38 42 L43 38 L47 42 L42 45Z M45 41 L50 37 L53 41 L48 44Z" fill="#cfd5da" ${st(1.1)}/>`,
    // железные топоры и кирки: топор и кирка крест-накрест, искры
    t_irontools: tdisc + `<path d="M16 50 L44 18" stroke="${C.woodD}" stroke-width="3.4" stroke-linecap="round"/>
      <path d="M38 12 Q50 10 52 22 L44 26 L36 18Z" fill="#8e979e" ${st(1.5)}/><path d="M40 16 L48 22" stroke="#c9d1d6" stroke-width="1.4"/>
      <path d="M48 50 L22 20" stroke="${C.woodD}" stroke-width="3.4" stroke-linecap="round"/>
      <path d="M12 26 Q20 14 34 16 Q24 18 20 30Z" fill="#7d858b" ${st(1.4)}/>
      <path d="M50 30 l5 -2 M52 35 l5 1 M28 46 l-3 4" stroke="${C.fireL}" stroke-width="1.6" stroke-linecap="round"/>`,
    // врачи Идалиона: флакон-арибалл с маслом, повязка и веточка
    t_doctors: tdisc + `<path d="M26 20 L38 20 L36 26 Q46 32 44 42 Q42 52 32 52 Q22 52 20 42 Q18 32 28 26Z" fill="#c9693a" ${st(1.6)}/>
      <path d="M24 16 L40 16 L38 20 L26 20Z" fill="#c9693a" ${st(1.4)}/><path d="M22 40 Q32 44 42 40" fill="none" stroke="${C.dark}" stroke-width="1.4"/>
      <path d="M26 34 L38 34 M32 28 L32 40" stroke="${C.white}" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M48 52 Q50 40 56 32" fill="none" stroke="${C.greenD}" stroke-width="1.6"/>
      <path d="M50 44 q-6 -2 -6 -6 q6 0 6 6Z M53 38 q6 -2 6 -6 q-6 0 -6 6Z" fill="${C.green}" ${st(1)}/>`,
    // флот царей: боевой корабль с тараном, глазом и рядом вёсел
    t_fleet: tdisc + `<path d="M8 38 L52 38 Q50 46 40 48 L16 48 Q10 46 8 38Z" fill="${C.wood}" ${st(1.8)}/>
      <path d="M8 38 L4 42 L10 44" fill="#8e979e" ${st(1.2)}/><circle cx="14" cy="42" r="1.6" fill="${C.white}" ${st(.8)}/>
      <path d="M52 38 Q58 34 56 26" fill="none" stroke="${C.woodD}" stroke-width="2.4" stroke-linecap="round"/>
      ${[18, 24, 30, 36, 42].map(x => `<path d="M${x} 46 L${x - 4} 56" stroke="${C.woodD}" stroke-width="1.6"/>`).join('')}
      <path d="M30 38 L30 12" stroke="${C.dark}" stroke-width="2"/><path d="M20 14 L40 14 L38 30 L22 30Z" fill="${C.white}" ${st(1.4)}/>
      <path d="M22 22 L38 22" stroke="${C.red}" stroke-width="2"/>`,
    // дары царю царей: зубчатая корона над чашей с серебром и амфорой
    t_gifts: tdisc + `<path d="M18 26 L18 12 L24 18 L28 10 L32 16 L36 10 L40 18 L46 12 L46 26Z" fill="${C.wheat}" ${st(1.6)}/>
      <path d="M18 22 L46 22" stroke="${C.wheatD}" stroke-width="1.4"/><circle cx="32" cy="24" r="1.6" fill="${C.red}"/>
      <path d="M12 42 Q32 56 52 42Z" fill="${C.bronze}" ${st(1.6)}/>
      <path d="M18 42 L24 36 L30 40 L24 44Z M30 40 L36 34 L42 39 L36 43Z" fill="#cfd5da" ${st(1.1)}/>` + amphoraShape(46, 38, .45),
    // своя монета: штемпель, молот и свежая монета с бараном
    t_coinage: tdisc + `<rect x="34" y="40" width="16" height="12" rx="1" fill="#7d858b" ${st(1.6)}/>
      <circle cx="26" cy="38" r="13" fill="${SLV}" ${st(1.8)}/>` + coinRam(28, 38, .85) + `
      <path d="M40 10 L48 30" stroke="${C.woodD}" stroke-width="3.2" stroke-linecap="round"/><path d="M34 12 L46 6 L48 11 L36 17Z" fill="#8e979e" ${st(1.4)}/>
      <path d="M46 34 l5 -3 M48 38 l6 -1" stroke="${C.fireL}" stroke-width="1.6" stroke-linecap="round"/>`,
    // медная монета: медный слиток «воловья шкура» уходит в столбик медных монет; на большой — палица Геракла, как у Эвагора
    t_coppercoin: tdisc + ingotShape(20, 44, .85) + `
      <path d="M30 42 Q34 38 38 40" fill="none" stroke="${C.copperD}" stroke-width="1.6" stroke-linecap="round"/><path d="M36.5 37.5 L39 40.4 L35.4 41.2Z" fill="${C.copperD}"/>
      <ellipse cx="47" cy="48" rx="8" ry="3" fill="${C.copperD}" ${st(1.3)}/><ellipse cx="47" cy="45" rx="8" ry="3" fill="${C.copper}" ${st(1.3)}/>
      <ellipse cx="47" cy="42" rx="8" ry="3" fill="${C.copper}" ${st(1.3)}/>
      <circle cx="30" cy="22" r="12" fill="${C.copper}" ${st(1.8)}/><circle cx="30" cy="22" r="9" fill="none" stroke="${C.copperD}" stroke-width="1"/>
      <path d="M26 30 L33 15 Q35 13 36.4 14.6 Q37.4 16.4 35.4 18 L28.4 31Z" fill="${C.copperD}" ${st(1.1)}/>
      <circle cx="34.2" cy="16.6" r=".9" fill="${C.copper}"/><circle cx="31.6" cy="21.6" r=".8" fill="${C.copper}"/>`,
    // корабли в Пирей: купеческий корабль под парусом и сова — знак Афин
    t_piraeus: tdisc + `<path d="M10 40 Q30 52 50 40 Q48 38 45 38 L15 38 Q12 38 10 40Z" fill="${C.wood}" ${st(1.7)}/>
      <path d="M50 40 Q55 35 52 29" fill="none" stroke="${C.woodD}" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M28 38 L28 14" stroke="${C.dark}" stroke-width="2"/><path d="M17 16 L39 16 L37 34 L19 34Z" fill="${C.white}" ${st(1.4)}/>
      <path d="M18 24 L38 24" stroke="${WINE}" stroke-width="2.2"/>
      <path d="M8 50 q5 -3 10 0 t10 0 t10 0 t10 0" fill="none" stroke="${C.water}" stroke-width="2.2"/>
      <g transform="translate(47 18)"><path d="M-5 6 Q-6 -3 0 -4 Q6 -3 5 6Z" fill="#a98a62" ${st(1.2)}/>
        <circle cx="-2" cy="-1" r="2" fill="${C.white}" ${st(.8)}/><circle cx="2" cy="-1" r="2" fill="${C.white}" ${st(.8)}/>
        <circle cx="-2" cy="-1" r=".8" fill="${O}"/><circle cx="2" cy="-1" r=".8" fill="${O}"/><path d="M-.8 1 L0 2.4 L.8 1Z" fill="${C.bronze}"/></g>`,
    // алфавит Эвагора: раскрытый свиток с буквами ΑΒΓ и тростниковое перо
    t_alphabet: tdisc + `<rect x="14" y="20" width="30" height="24" fill="${PAP}" ${st(1.7)}/>
      <rect x="9" y="17" width="7" height="30" rx="3.5" fill="${PAP}" ${st(1.6)}/><rect x="42" y="17" width="7" height="30" rx="3.5" fill="${PAP}" ${st(1.6)}/>
      <path d="M18 37 L21.5 27 L25 37 M19.3 33.5 L23.7 33.5 M28 27 L28 37 M28 27 L31 27 Q33.5 27.4 33.4 29.6 Q33.2 31.6 30.6 31.8 L28 31.8 M30.6 31.8 Q34 32 34 34.4 Q34 37 31 37 L28 37 M36 37 L36 27 L41 27"
        fill="none" stroke="${C.dark}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M44 54 L56 34" stroke="${C.wheatD}" stroke-width="2.6" stroke-linecap="round"/><path d="M44 54 L43 57" stroke="${C.dark}" stroke-width="1.6" stroke-linecap="round"/>`,
    // симпосий: чаша-килик с вином, гроздь
    t_symposion: tdisc + `<path d="M10 24 Q32 46 54 24Z" fill="${TER}" ${st(1.7)}/><path d="M14 25 Q32 31 50 25" fill="none" stroke="${WINE}" stroke-width="3"/>
      <path d="M16 30 Q32 40 48 30" fill="none" stroke="${C.dark}" stroke-width="1.6"/>
      <path d="M10 24 Q4 22 6 17 M54 24 Q60 22 58 17" fill="none" ${st(1.9)}/>
      <path d="M29 35 L29 42 Q22 44 22 48 L42 48 Q42 44 35 42 L35 35" fill="${TER}" ${st(1.5)}/>` + grapes(48, 48, .5),
    // меч царя Китиона: лёгкий клинок-«лист» с бронзовой гардой и искры от закалки
    t_kitionsword: tdisc + `<path d="M32 7 Q39 22 36 37 L34 42 L30 42 L28 37 Q25 22 32 7Z" fill="${IRNL}" ${st(1.6)}/>
      <path d="M32 11 L32 39" stroke="${IRN}" stroke-width="1.2"/>
      <rect x="21" y="42" width="22" height="4" rx="1.6" fill="${C.bronze}" ${st(1.4)}/>
      <rect x="29.5" y="46" width="5" height="9" fill="${C.woodD}" ${st(1.3)}/><circle cx="32" cy="57" r="2.6" fill="${C.bronze}" ${st(1.2)}/>
      <path d="M44 15 l5 -3 M46 22 l6 0 M20 15 l-5 -3 M18 22 l-6 0" stroke="${C.fireL}" stroke-width="1.8" stroke-linecap="round"/>`,
    // цистерны и бани Вуни: каменная ванна с тёплой водой, пар; сбоку — кувшин-гидрия
    t_vounibaths: tdisc + `<path d="M10 32 L50 32 L46 48 Q30 53 14 48Z" fill="${C.stone}" ${st(1.7)}/>
      <path d="M13 35 Q30 40 47 35 L46 39 Q30 44 14 39Z" fill="${C.water}"/>
      <path d="M20 26 q-3 -4 0 -8 q3 -4 0 -8 M30 26 q-3 -4 0 -8 q3 -4 0 -8 M40 26 q-3 -4 0 -8 q3 -4 0 -8" fill="none" stroke="#9fb6c4" stroke-width="2" stroke-linecap="round"/>` +
      amphoraShape(52, 44, .5, TER),
    // хорегия: маска трагика в венке из плюща и свиток пьесы
    t_choregia: tdisc + `<path d="M18 16 Q32 10 46 16 L44 36 Q32 50 20 36Z" fill="${C.white}" ${st(1.7)}/>
      <path d="M22 24 Q26 21 29 25 Q26 28 22 24Z M35 25 Q38 21 42 24 Q38 28 35 25Z" fill="${C.dark}"/>
      <path d="M26 39 Q32 34 38 39 Q32 41 26 39Z" fill="${C.dark}"/><path d="M24 20 Q26 18 29 20 M35 20 Q38 18 40 20" fill="none" stroke="${C.dark}" stroke-width="1.4"/>
      ${[[18, 15], [24, 11], [32, 9], [40, 11], [46, 15]].map(([x, y]) => `<path d="M${x} ${y} q-3 -4 0 -6 q3 2 0 6Z" fill="${C.green}" stroke="${C.greenD}" stroke-width="1"/>`).join('')}
      <rect x="44" y="40" width="12" height="14" fill="${PAP}" ${st(1.4)}/><rect x="42" y="38" width="4" height="18" rx="2" fill="${PAP}" ${st(1.2)}/>
      <path d="M48 44 l6 0 M48 47 l6 0 M48 50 l4 0" stroke="${PAPD}" stroke-width="1.1"/>`,
    // поддержка Александра: нос боевого корабля с тараном и македонская звезда над ним
    t_alexander: tdisc + `<path d="M8 42 L46 42 Q44 50 34 52 L14 52 Q9 50 8 42Z" fill="${C.wood}" ${st(1.8)}/>
      <path d="M8 42 L3 46 L9 48" fill="#8e979e" ${st(1.2)}/><circle cx="14" cy="46" r="1.6" fill="${C.white}" ${st(.8)}/>
      ${[18, 24, 30, 36].map(x => `<path d="M${x} 50 L${x - 4} 58" stroke="${C.woodD}" stroke-width="1.6"/>`).join('')}
      <path d="M46 42 Q52 38 50 30" fill="none" stroke="${C.woodD}" stroke-width="2.4" stroke-linecap="round"/>
      <circle cx="34" cy="22" r="5" fill="${C.wheat}" ${st(1.4)}/>
      ${Array.from({ length: 16 }, (_, i) => { const a = i * Math.PI / 8, r1 = 6.5, r2 = i % 2 ? 11 : 14; return `<path d="M${34 + Math.cos(a) * r1} ${22 + Math.sin(a) * r1} L${34 + Math.cos(a) * r2} ${22 + Math.sin(a) * r2}" stroke="${C.wheatD}" stroke-width="1.8" stroke-linecap="round"/>`; }).join('')}`,
    // гелеполь Деметрия: девятиярусная осадная башня на колёсах у крепостной стены, летит камень из катапульты
    t_demetrius: tdisc + `<path d="M43 54 L43 30 L46 30 L46 27 L49 27 L49 30 L52 30 L52 27 L55 27 L55 30 L58 30 L58 54Z" fill="${C.stone}" ${st(1.5)}/>
      <path d="M43 38 L58 38 M43 46 L58 46 M50 30 L50 38 M47 38 L47 46 M54 38 L54 46 M50 46 L50 54" stroke="${C.stoneD}" stroke-width="1"/>
      <path d="M18 54 L22 10 L36 10 L40 54Z" fill="${C.wood}" ${st(1.7)}/>
      ${[15, 20, 25, 30, 35, 40, 45, 50].map(y => { const d = (54 - y) * 4 / 44; return `<path d="M${(18 + d).toFixed(1)} ${y} L${(40 - d).toFixed(1)} ${y}" stroke="${C.woodD}" stroke-width="1.1"/>`; }).join('')}
      ${[17.5, 27.5, 37.5, 47.5].map(y => `<rect x="27" y="${y - 1.6}" width="4" height="3.2" fill="${C.dark}"/>`).join('')}
      <path d="M22 10 L29 5 L36 10Z" fill="${C.woodD}" ${st(1.3)}/>
      <circle cx="22" cy="55" r="3.4" fill="${C.woodD}" ${st(1.2)}/><circle cx="36" cy="55" r="3.4" fill="${C.woodD}" ${st(1.2)}/>
      <path d="M33 22 Q40 14 46 19" fill="none" stroke="${C.dark}" stroke-width="1.1" stroke-dasharray="1.6 1.8"/><circle cx="47" cy="20" r="2.4" fill="${C.stone}" ${st(1.1)}/>`,
    // стратег и наварх: серебряная монета Птолемеев — орёл на перуне
    t_strategos: tdisc + `<circle cx="32" cy="32" r="21" fill="${SLV}" ${st(1.8)}/><circle cx="32" cy="32" r="17.5" fill="none" stroke="#b6bdc3" stroke-width="1.1" stroke-dasharray="1.4 1.6"/>
      <path d="M20 45 L28 42 L26 46 L36 42 L34 46 L44 43" fill="none" stroke="${C.bronzeD}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M24 41 Q22 30 30 25 Q36 22 40 27 Q42 33 38 38 Q34 42 28 42Z" fill="#7d858b" ${st(1.4)}/>
      <path d="M27 40 Q30 32 37 30 M28 37 Q31 31 36 29.5 M24 41 L19 44 M25 42 L21 46" fill="none" stroke="#c3cad0" stroke-width="1.2"/>
      <path d="M24 41 L19 44 L21 46 L26 42Z" fill="#7d858b" ${st(1.1)}/>
      <circle cx="38" cy="21" r="3.6" fill="#7d858b" ${st(1.3)}/><path d="M41 19.4 Q46.4 19.2 45.4 23.6 Q44.6 22 41.4 22.6Z" fill="${C.bronze}" ${st(.9)}/><circle cx="38.6" cy="20.4" r=".7" fill="${C.white}"/>
      <path d="M28 42 L27 45 M32 42 L32 45" stroke="${O}" stroke-width="1.4" stroke-linecap="round"/>`,
    // учение Зенона: дорическая колонна расписной стои, раскрытый свиток и золотая λ — логос
    t_zeno: tdisc + doric(22, 14, 34, 1.2) + `<rect x="10" y="54" width="24" height="3.6" fill="${CALC}" ${st(1.2)}/>
      <rect x="13" y="10" width="18" height="4" fill="${STU}" ${st(1.2)}/><path d="M14 12 L30 12" stroke="${WINE}" stroke-width="1.4"/>` + scroll(44, 42, 1.25) +
      `<path d="M40 11 Q44 11 46 16 L53 31 M47 19 L41 31" fill="none" stroke="${C.bronzeD}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M40 11 Q44 11 46 16 L53 31 M47 19 L41 31" fill="none" stroke="${C.wheat}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`,
    // койнон киприотов: почётная стела с декретом под оливковым венком
    t_koinon: tdisc + `<path d="M20 56 L21 22 L43 22 L44 56Z" fill="${STU}" ${st(1.7)}/><path d="M19 22 L32 14 L45 22Z" fill="${CALC}" ${st(1.5)}/>
      ${[28, 32, 36, 40, 44, 48].map((y, i) => `<path d="M24 ${y} L${i % 3 === 2 ? 34 : 40} ${y}" stroke="${C.stoneD}" stroke-width="1.3" stroke-linecap="round"/>`).join('')}
      <rect x="17" y="55" width="30" height="3.4" fill="${CALC}" ${st(1.2)}/>
      <path d="M22 10 Q32 2 42 10" fill="none" stroke="${C.greenD}" stroke-width="1.6"/>
      ${[[23, 8.5], [27, 6], [32, 5], [37, 6], [41, 8.5]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="2.4" ry="1.1" transform="rotate(${(x - 32) * 3} ${x} ${y})" fill="#b3bf86" stroke="#2a2a1c" stroke-width=".7"/>`).join('')}`,
    // папирус Александрии: маяк Фарос с огнём и стебли папируса у его подножия
    t_alexandria: tdisc + `<rect x="22" y="38" width="20" height="16" fill="${STU}" ${st(1.6)}/><path d="M24 54 L24 44 L28 44 L28 54" fill="${C.dark}" opacity=".7"/>
      <path d="M25 38 L26 26 L38 26 L39 38Z" fill="${STU}" ${st(1.5)}/><rect x="21" y="36" width="22" height="2.6" fill="${STUD}" ${st(1)}/>
      <path d="M28.5 26 L29 17 L35 17 L35.5 26Z" fill="${STU}" ${st(1.4)}/><rect x="24.5" y="24.4" width="15" height="2.2" fill="${STUD}" ${st(.9)}/>` + flame(32, 16, .8) +
      `${[[10, 56, 12, 40], [14, 56, 15, 36], [50, 56, 49, 38], [54, 56, 53, 42]].map(([x1, y1, x2, y2]) => `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="${C.greenD}" stroke-width="1.5"/>
        <path d="M${x2} ${y2} l-4 -4 M${x2} ${y2} l-2 -5 M${x2} ${y2} l0 -5.5 M${x2} ${y2} l2 -5 M${x2} ${y2} l4 -4" stroke="${C.green}" stroke-width="1.2" stroke-linecap="round"/>`).join('')}
      <path d="M6 57 L58 57" stroke="${C.water}" stroke-width="2.4" stroke-linecap="round"/>`,
    // Помпей и пираты: римская военная галера с тараном и значок-вексиллум на корме
    t_pompey: tdisc + `<path d="M6 40 L50 40 Q49 48 40 50 L14 50 Q8 48 6 40Z" fill="${C.woodD}" ${st(1.8)}/>
      <path d="M6 40 L2 44 L8 46" fill="#8e979e" ${st(1.2)}/><path d="M10 43 L46 43" stroke="${C.red}" stroke-width="2"/>
      ${[14, 20, 26, 32, 38].map(x => `<path d="M${x} 48 L${x - 4} 57" stroke="${C.wood}" stroke-width="1.6"/>`).join('')}
      <path d="M28 40 L28 14" stroke="${C.dark}" stroke-width="2"/><path d="M18 16 L38 16 L36 34 L20 34Z" fill="${C.red}" ${st(1.4)}/>
      <path d="M50 40 Q56 36 55 26" fill="none" stroke="${C.woodD}" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M46 40 L46 16" stroke="${C.dark}" stroke-width="1.6"/><path d="M42 18 L50 18" stroke="${C.dark}" stroke-width="1.6"/>
      <rect x="42.6" y="18.6" width="6.8" height="8" fill="${C.red}" ${st(1)}/><path d="M42.6 26.6 l1.2 2 M45.2 26.6 l.8 2 M47.6 26.6 l.4 2" stroke="${C.wheatD}" stroke-width="1"/>
      <circle cx="46" cy="14.6" r="1.8" fill="${C.wheat}" ${st(.9)}/>`,
    // Эдикт Цицерона: ровные весы — на одной чаше монеты, на другой свиток эдикта (не больше 12% в год)
    t_cicero: tdisc + `<path d="M32 17 L32 50" stroke="${C.woodD}" stroke-width="2.6" stroke-linecap="round"/><path d="M24 54 L40 54 L37 49 L27 49Z" fill="${C.woodD}" ${st(1.3)}/>
      <path d="M13 20 L51 20" stroke="${C.bronzeD}" stroke-width="2.4" stroke-linecap="round"/><circle cx="32" cy="17" r="2.6" fill="${C.bronze}" ${st(1.1)}/>
      <path d="M14 20 L8.5 36 M14 20 L19.5 36 M50 20 L44.5 36 M50 20 L55.5 36" stroke="${O}" stroke-width="1"/>
      <path d="M7 36 Q14 43 21 36Z M43 36 Q50 43 57 36Z" fill="${C.bronze}" ${st(1.2)}/>` + coinStack(14, 35, 3) + scroll(50, 33.4, .6, false),
    // Скамья Гиппократа (Аполлоний Китийский): раскрытый свиток Гиппократа «О суставах» и кость поверх
    t_apollonius: tdisc + scroll(32, 33, 2.1) + `<g transform="rotate(-38 32 32)">
      <path d="M21 32 L43 32" stroke="${O}" stroke-width="7.6" stroke-linecap="round"/>
      ${[[19.4, 29.4], [19.4, 34.6], [44.6, 29.4], [44.6, 34.6]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.9" fill="${O}"/>`).join('')}
      ${[[19.4, 29.4], [19.4, 34.6], [44.6, 29.4], [44.6, 34.6]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.6" fill="${C.white}"/>`).join('')}
      <path d="M21 32 L43 32" stroke="${C.white}" stroke-width="5" stroke-linecap="round"/><path d="M24 33.4 L40 33.4" stroke="${STUD}" stroke-width="1"/></g>`,
    // Pax Romana: золотой орёл легиона над лавровым венком и спокойное море
    t_pax: tdisc + `<path d="M9 49 q5.75 -3 11.5 0 t11.5 0 t11.5 0 t11.5 0" fill="none" stroke="${C.water}" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M14 54.4 q4.5 -2.4 9 0 t9 0 t9 0 t9 0" fill="none" stroke="${C.water}" stroke-width="1.8" stroke-linecap="round" opacity=".7"/>
      <path d="M32 26 L32 47" stroke="${C.woodD}" stroke-width="2.4" stroke-linecap="round"/>
      <circle cx="32" cy="37" r="7" fill="none" stroke="${C.greenD}" stroke-width="1.5"/>
      ${Array.from({ length: 10 }, (_, i) => { const a = i * Math.PI / 5 + .3, x = 32 + Math.cos(a) * 7, y = 37 + Math.sin(a) * 7; return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="2.4" ry="1.1" transform="rotate(${(a * 180 / Math.PI + 90).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})" fill="#b3bf86" stroke="#2a2a1c" stroke-width=".7"/>`; }).join('')}
      <path d="M27 27 L37 27" stroke="${C.bronzeD}" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M31 21 Q22 21 13 11 Q19 12.4 23 15 Q21 11 22 8 Q27 14 31 17Z M33 21 Q42 21 51 11 Q45 12.4 41 15 Q43 11 42 8 Q37 14 33 17Z" fill="${C.wheat}" ${st(1.3)}/>
      <path d="M28.4 18 Q32 14 35.6 18 L34.8 26 L29.2 26Z" fill="${C.wheat}" ${st(1.3)}/><circle cx="32" cy="14" r="3" fill="${C.wheat}" ${st(1.2)}/>
      <path d="M34.6 13.4 L37.4 14.6 L34.6 15.8Z" fill="${C.bronze}" ${st(.7)}/><circle cx="32.8" cy="13.4" r=".7" fill="${O}"/>`,
    // Милость Августа: раковина Венеры, прародительницы Юлиев, рождённой из моря, и Утренняя звезда — звезда Венеры
    t_genetrix: tdisc + (() => {
      const P = (a, r = 1) => [32 + Math.cos(a) * 19 * r, 33 + Math.sin(a) * 20 * r], f = ([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`;
      let d = `M${f(P(Math.PI))}`;
      for (let i = 1; i <= 7; i++) d += ` Q${f(P(Math.PI + (i - .5) * Math.PI / 7, 1.16))} ${f(P(Math.PI + i * Math.PI / 7))}`;
      const ribs = Array.from({ length: 6 }, (_, i) => `M32 51 L${f(P(Math.PI + (i + 1) * Math.PI / 7, .96))}`).join(' ');
      return `<path d="${d} L32 51Z" fill="#f4cdd3" ${st(1.7)}/><path d="${ribs}" stroke="#d98a9a" stroke-width="1.3" fill="none"/>
        <path d="M25 49 L32 51 L39 49 L37 55 L27 55Z" fill="#f4cdd3" ${st(1.4)}/><circle cx="32" cy="45" r="2.2" fill="${C.white}" ${st(.9)}/>
        <path d="M48 7 L49.2 10.4 L52.6 11.6 L49.2 12.8 L48 16.2 L46.8 12.8 L43.4 11.6 L46.8 10.4Z" fill="#ffe69a" ${st(.8)}/>`;
    })(),
    // Стадион Куриона (знание пока спрятано — ждёт бонуса и названия): беговая дорожка с одним скруглённым концом, ряды скамей и оливковая ветвь — масло атлетов и наград
    t_kourion: tdisc + `<path d="M9 22 L36 22 A12 12 0 0 1 36 46 L9 46Z" fill="${CALC}" ${st(1.6)}/>
      <path d="M9 25 L36 25 A9 9 0 0 1 36 43 L9 43" fill="none" stroke="${CALCD}" stroke-width="1"/>
      <path d="M9 28 L36 28 A6 6 0 0 1 36 40 L9 40Z" fill="#e8cf98" ${st(1.2)}/>
      <path d="M11 34 L37 34" stroke="${C.white}" stroke-width="1" stroke-dasharray="2 1.6"/><path d="M13.6 28.6 L13.6 39.4" stroke="${C.white}" stroke-width="1.6"/>
      <path d="M16 18 Q32 8 48 14" fill="none" stroke="${C.greenD}" stroke-width="1.6"/>
      ${[[20, 15.4, -35], [25.6, 12.4, -25], [31, 10.8, -12], [36.6, 10.6, 5], [42.4, 11.8, 18]].map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="3.2" ry="1.3" transform="rotate(${r} ${x} ${y})" fill="#9aa866" stroke="#3c4a2a" stroke-width=".7"/>`).join('')}
      <circle cx="28.6" cy="15" r="1.7" fill="#3c4a2a"/><circle cx="40" cy="14.6" r="1.7" fill="#3c4a2a"/>
      <circle cx="51" cy="34" r="4.2" fill="${C.wheat}" ${st(1.2)}/><path d="M51 30.4 L51 37.6 M47.6 34 L54.4 34" stroke="${C.wheatD}" stroke-width="1"/>`,
    t_writing: tdisc + tablet(28, 33, 1) + `<rect x="40" y="18" width="9" height="18" rx="4" fill="${C.stone}" ${st(1.4)}/>
      <path d="M42 22 l5 0 M42 27 l5 0 M42 32 l5 0" stroke="${C.stoneD}" stroke-width="1.2"/><path d="M40 44 L54 48" stroke="${C.woodD}" stroke-width="2.4" stroke-linecap="round"/>`,

    // обряды
    r_elders: disc('#e8f0d8', '#55732a') + `<path d="M14 50 Q12 32 22 28 L30 28 Q38 32 36 50Z" fill="${C.thatch}" ${st(1.6)}/>
      <path d="M18 28 Q26 20 34 28" fill="none" stroke="${C.woodD}" stroke-width="2"/>
      <path d="M38 50 Q36 38 42 34 L48 34 Q54 38 52 50Z" fill="${C.terra}" ${st(1.6)}/>
      <path d="M44 34 L44 20 M44 22 q-4 -3 -6 -6 M44 26 q4 -3 6 -6" stroke="${C.wheatD}" stroke-width="2" fill="none"/>`,
    r_settlers: rdisc + [[20, '#e8c39a'], [32, '#d9a877'], [44, '#e8c39a']].map(([x, c], i) => `<circle cx="${x}" cy="${i === 1 ? 26 : 22}" r="${i === 1 ? 4.5 : 5.5}" fill="${c}" ${st(1.3)}/>
      <path d="M${x - 6} ${i === 1 ? 50 : 50} L${x - 5} ${i === 1 ? 32 : 30} Q${x} ${i === 1 ? 29 : 27} ${x + 5} ${i === 1 ? 32 : 30} L${x + 6} 50Z" fill="${['#a8402a', '#6d7a3b', '#2c6e95'][i]}" ${st(1.3)}/>`).join('') +
      `<path d="M25 38 L28 38 M36 38 L39 38" stroke="#e8c39a" stroke-width="3" stroke-linecap="round"/>`,
    r_harvest: rdisc + `<path d="M18 48 Q14 22 40 16" fill="none" stroke="#d8dce3" stroke-width="4" stroke-linecap="round"/>
      <path d="M18 48 L22 52" stroke="${C.wood}" stroke-width="4" stroke-linecap="round"/>` + sheaf(40, 50).replace('translate(40 50)', 'translate(40 50) scale(1.4)'),
    r_hearth: rdisc + flame(32, 46, 1.3) + `<path d="M14 18 L42 46" stroke="${C.wood}" stroke-width="3" stroke-linecap="round"/><path d="M10 18 Q14 10 22 14 L16 22Z" fill="#d8dce3" ${st(1.3)}/>
      <path d="M50 18 L22 46" stroke="${C.wood}" stroke-width="3" stroke-linecap="round"/><path d="M44 12 Q52 12 56 18 Q50 16 46 20Z" fill="#d8dce3" ${st(1.3)}/>`,
    r_herds: rdisc + `<path d="M14 32 Q32 10 50 32" fill="none" stroke="${C.green}" stroke-width="3"/>
      ${[16, 24, 40, 48].map(x => `<ellipse cx="${x}" cy="${x < 32 ? 26 + (x - 16) * -0.6 : 26 - (48 - x) * 0.6 + 0}" rx="3" ry="1.6" fill="${C.green}"/>`).join('')}` + sheaf(18, 54) + goat(37, 45, 1.1, C.white),
    r_festival: rdisc + `<circle cx="32" cy="38" r="13" fill="${C.mud}" ${st(1.8)}/><circle cx="32" cy="38" r="8" fill="none" stroke="${C.mudD}" stroke-width="1.4"/>
      ${[0, 72, 144, 216, 288].map(a => { const r = a * Math.PI / 180; return `<circle cx="${32 + Math.cos(r) * 13}" cy="${38 + Math.sin(r) * 13}" r="2" fill="${C.bronze}" stroke="${O}" stroke-width=".8"/>`; }).join('')}
      <path d="M14 16 q4 -4 8 0 q-4 4 -8 0Z M42 14 q4 -4 8 0 q-4 4 -8 0Z" fill="#e88aa8"/><circle cx="18" cy="16" r="1.6" fill="#ffe69a"/><circle cx="46" cy="14" r="1.6" fill="#ffe69a"/>`,
    r_vigil: rdisc + star(18, 18, 1.6) + star(30, 12, 1.2) + star(44, 20, 1.8) + star(24, 30, 1) + star(50, 32, 1.1) +
      `<path d="M38 10 Q30 16 34 26 Q40 32 48 28 Q38 26 38 10Z" fill="#ffe69a"/>
      <path d="M8 52 Q20 40 32 46 Q44 40 56 52Z" fill="#2a2840"/><circle cx="22" cy="42" r="2.4" fill="#2a2840"/><path d="M22 44 L22 50" stroke="#2a2840" stroke-width="3"/>
      <path d="M23 43 L30 36" stroke="#2a2840" stroke-width="1.6"/>`,
    r_bullmask: rdisc + `<path d="M20 22 Q8 18 10 8 Q16 16 24 18Z M44 22 Q56 18 54 8 Q48 16 40 18Z" fill="${C.white}" ${st(1.5)}/>
      <path d="M20 20 L44 20 Q46 36 40 46 Q32 54 24 46 Q18 36 20 20Z" fill="${C.terra}" ${st(1.8)}/>
      <circle cx="26" cy="30" r="2.6" fill="${C.dark}"/><circle cx="38" cy="30" r="2.6" fill="${C.dark}"/>
      <path d="M27 42 Q32 46 37 42" fill="none" stroke="${C.dark}" stroke-width="1.6"/>`,
    r_ingot: rdisc + `<path d="M14 40 Q32 50 50 40 L48 46 Q32 54 16 46Z" fill="${C.woodD}" ${st(1.4)}/>
      <path d="M32 40 L32 12" stroke="${C.dark}" stroke-width="2"/><path d="M22 14 L42 14 L40 34 L24 34Z" fill="${C.white}" ${st(1.4)}/>
      <path d="M22 22 L42 22" stroke="${C.red}" stroke-width="2"/>` + ingotShape(32, 54, .5),
    r_hornedfeast: rdisc + [0, 40, 80, 120, 160, 200, 240, 280, 320].map(a => { const r = a * Math.PI / 180; return `<path d="M${32 + Math.cos(r) * 18} ${34 + Math.sin(r) * 18} L${32 + Math.cos(r) * 25} ${34 + Math.sin(r) * 25}" stroke="#ffe69a" stroke-width="2"/>`; }).join('') +
      `<path d="M24 30 Q24 20 32 20 Q40 20 40 30 L40 40 Q32 46 24 40Z" fill="${C.bronze}" ${st(1.6)}/>
      <path d="M24 26 Q12 24 12 12 Q18 20 26 22 M40 26 Q52 24 52 12 Q46 20 38 22" fill="${C.white}" ${st(1.4)}/>
      <path d="M28 32 l3 0 M33 32 l3 0" stroke="${O}" stroke-width="1.6"/>`,
    // лоза и олива: гроздь, веточка оливы с плодами, тимпан вакханок и амфора
    r_vintage: rdisc + grapes(32, 30, 1.25) + `<g transform="translate(9 20)">
      <path d="M2 14 Q3 6 12 -1" stroke="${C.woodD}" stroke-width="1.7" fill="none" stroke-linecap="round"/>
      ${[[3, 9, -70], [6, 4, -15], [6.5, 9.5, 35], [10, 1, -60], [11, 5, 20]].map(([x, y, a]) => `<ellipse cx="${x}" cy="${y}" rx="4.8" ry="1.3" transform="rotate(${a} ${x} ${y})" fill="#b3bf86" stroke="#2a2a1c" stroke-width=".8"/>`).join('')}
      <ellipse cx="1.5" cy="5" rx="2.4" ry="1.8" fill="#8f9c3e" stroke="#2a2a1c" stroke-width=".8"/><ellipse cx="9" cy="12.5" rx="2.4" ry="1.8" fill="#6d5a86" stroke="#2a2a1c" stroke-width=".8"/><circle cx="8.3" cy="11.9" r=".6" fill="#fff" opacity=".6"/></g>` + `<circle cx="16" cy="44" r="7" fill="${C.thatch}" ${st(1.4)}/><circle cx="16" cy="44" r="3.4" fill="none" stroke="${C.thatchD}" stroke-width="1.2"/>
      ${[0, 90, 180, 270].map(a => { const r = a * Math.PI / 180; return `<circle cx="${16 + Math.cos(r) * 7}" cy="${44 + Math.sin(r) * 7}" r="1.3" fill="${C.bronze}"/>`; }).join('')}` + amphoraShape(48, 44, .55),
    // Утренняя звезда — Венера, звезда Афродиты, над морем перед рассветом
    r_morningstar: rdisc + `<path d="M6 44 Q32 38 58 44 L58 50 Q32 46 6 50Z" fill="#e9a06b" opacity=".75"/>
      <path d="M8 50 Q32 46 56 50 L52 56 Q32 58 12 56Z" fill="${C.water}"/>` + star(40, 22, 3.2) + star(22, 16, 1) + star(30, 30, .8) +
      `<circle cx="40" cy="22" r="9" fill="#fff6c2" opacity=".25"/>` + tablet(18, 34, .55),
    // гномон и полос: тень солнечных часов в каменной чаше
    r_gnomon: rdisc + `<circle cx="18" cy="18" r="6" fill="${C.fireL}" ${st(1.2)}/>
      <path d="M12 38 Q32 58 52 38Z" fill="${C.stone}" ${st(1.8)}/><path d="M12 38 L52 38" stroke="${C.stoneD}" stroke-width="1.6"/>
      ${[0, 1, 2, 3, 4, 5, 6].map(i => { const a = Math.PI * (i / 6); return `<path d="M${32 - Math.cos(a) * 14} ${38 + Math.sin(a) * 10} L${32 - Math.cos(a) * 18} ${38 + Math.sin(a) * 13}" stroke="${C.stoneD}" stroke-width="1.2"/>`; }).join('')}
      <path d="M32 38 L32 20" stroke="${C.dark}" stroke-width="2.4" stroke-linecap="round"/><path d="M32 38 L44 46" stroke="#2a2840" stroke-width="3" stroke-linecap="round" opacity=".7"/>`,
    // Фалисии: сноп и чаша молодого вина — Деметре и Дионису
    r_thalysia: rdisc + sheaf(24, 50).replace('translate(24 50)', 'translate(24 50) scale(1.5)') + `
      <path d="M36 30 Q46 42 56 30Z" fill="${TER}" ${st(1.5)}/><path d="M38 31 Q46 34 54 31" fill="none" stroke="${WINE}" stroke-width="2.4"/>
      <path d="M44 37 L44 44 L40 46 L48 46 L44 44" fill="${TER}" ${st(1.2)}/>` + grapes(46, 18, .55),
    // Халкеи: наковальня, молот и пламя — праздник ремесленников Афины Эрганы и Гефеста
    r_chalkeia: rdisc + flame(18, 22, 1.1) + `<path d="M14 40 L50 40 L46 46 L40 46 L42 52 L22 52 L24 46 L18 46Z" fill="#8e979e" ${st(1.6)}/>
      <path d="M50 40 Q56 40 58 36 L50 36Z" fill="#8e979e" ${st(1.2)}/>
      <path d="M34 34 L46 14" stroke="${C.wood}" stroke-width="3" stroke-linecap="round"/><rect x="40" y="9" width="14" height="7" rx="1.4" fill="#cfd5da" transform="rotate(30 47 12.5)" ${st(1.3)}/>
      <path d="M28 34 l-3 -4 M34 32 l1 -5" stroke="${C.fireL}" stroke-width="1.6" stroke-linecap="round"/>`,
    // Афродисии: конический камень богини в гирлянде, голуби и путь паломников
    r_aphrodisia: rdisc + `<path d="M22 50 Q24 24 32 18 Q40 24 42 50Z" fill="#5d5a66" ${st(1.8)}/><path d="M28 30 Q31 24 34 26" stroke="#8f8b99" stroke-width="1.6" fill="none"/>
      <path d="M23 38 Q32 44 41 38" fill="none" stroke="#e88aa8" stroke-width="2.6" stroke-linecap="round"/>
      ${[26, 32, 38].map(x => `<circle cx="${x}" cy="${x === 32 ? 42.5 : 40.5}" r="1.6" fill="#ffe69a"/>`).join('')}
      <path d="M10 22 q4 -5 9 -2 q-2 3 -5 3 l-4 2Z M45 16 q4 -5 9 -2 q-2 3 -5 3 l-4 2Z" fill="${C.white}" ${st(1.1)}/>
      <path d="M8 54 Q32 48 56 54" fill="none" stroke="#c9b48a" stroke-width="2.2" stroke-dasharray="3 3"/>`,
    // Меркуралии: жезл Меркурия с крыльями и двумя змеями и капли из его источника — ими кропят товары
    r_mercuralia: rdisc + `<path d="M32 15 L32 54" stroke="${C.wheat}" stroke-width="2.6" stroke-linecap="round"/><circle cx="32" cy="13.4" r="2.6" fill="${C.wheat}" ${st(1)}/>
      <path d="M30 17.6 Q22 12 15 15.6 Q21 17 23.4 19 Q19.4 20 17.4 23.4 Q25 22.4 30 20.6Z M34 17.6 Q42 12 49 15.6 Q43 17 40.6 19 Q44.6 20 46.6 23.4 Q39 22.4 34 20.6Z" fill="${C.white}" ${st(1.1)}/>
      <path d="M32 51 C24 47 24 43 32 39 C40 35 40 31 32 27 C27 24.4 27.4 22.4 30 21.8 M32 51 C40 47 40 43 32 39 C24 35 24 31 32 27 C37 24.4 36.6 22.4 34 21.8" fill="none" stroke="${C.green}" stroke-width="2.2" stroke-linecap="round"/>
      <circle cx="29.6" cy="22" r="1.5" fill="${C.green}"/><circle cx="34.4" cy="22" r="1.5" fill="${C.green}"/>
      ${[[14, 34], [50, 37], [18, 46], [46.6, 48]].map(([x, y]) => `<path d="M${x} ${y} q-2.6 4.4 0 6.2 q2.6 -1.8 0 -6.2Z" fill="${C.sky}" ${st(.6)}/>`).join('')}`,
  };

  const ALL = Object.assign({}, B, S, T, M);
  const wrap = (inner, cls) => `<svg class="ico ${cls || ''}" viewBox="0 0 64 64" aria-hidden="true">${inner}</svg>`;

  const api = {
    has: k => !!ALL[k],
    svg: (k, cls) => ALL[k] ? wrap(ALL[k], cls) : '',
    /** Значок ресурса. resKey — подмена рисунка (серебро после «Своей монеты» рисуется монетой): её ставит ui/common/catalog.js. */
    res: (k, cls) => { k = api.resKey(k); return R[k] ? wrap(R[k], 'res-ico ' + (cls || '')) : (k === 'logos' ? '<b class="lg">λ</b>' : ''); },
    resKey: k => k,
    /** Значок ресурса без подмены — для галереи рисунков. */
    resRaw: (k, cls) => R[k] ? wrap(R[k], 'res-ico ' + (cls || '')) : '',
  };
  return api;
})();
