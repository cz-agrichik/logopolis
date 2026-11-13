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
    [8, 19, 30, 41, 52].map(x => plant(x + (r % 2) * 5, y)).join('')).join('');
  const tuft = (x, y, c, cd) => `<path d="M${x} ${y} q-3 -6 -5 -8 M${x} ${y} q0 -7 0 -10 M${x} ${y} q3 -6 5 -8" stroke="${cd}" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M${x} ${y} q-1.5 -6 -3 -7 M${x} ${y} q1.5 -6 3 -7" stroke="${c}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
  const ear = (x, y) => `<path d="M${x} ${y} L${x} ${y - 9}" stroke="${C.wheatD}" stroke-width="1.6"/>
    <ellipse cx="${x}" cy="${y - 11}" rx="2" ry="4" fill="${C.wheat}" stroke="${C.wheatD}" stroke-width="1"/>`;
  const sheaf = (x, y) => `<g transform="translate(${x} ${y})"><path d="M-5 0 L0 -16 L5 0Z" fill="${C.wheat}" ${st(1.3)}/>
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

  // ---------- здания: облик меняется с эпохой и на 4-м уровне — и заметно ----------
  const B = {
    house0: shadow(20) + roundHut(32, 36, 1),
    // ур. 4+: уже не хижина, а двор — большой дом на каменном цоколе, вторая хижина, кувшин
    house1: shadow(29) + smoke(52, 8) + roundHut(48, 31, .62) + roundHut(25, 36, 1.02, { base: true, wall: C.plaster, knob: true }) + pithos(54, 50, .42),
    house2: shadow(24) + H2,

    // поле — «нарисовано» прямо на земле клетки: без подставки и тени
    field0: rows(C.furrow, (x, y) => sprout(x, y, .85)),
    field1: rows(C.furrow, (x, y) => ear(x, y)),   // ур. 4+: всходы → спелый золотой колос
    // бронзовый век: орошаемое поле — канал вдоль края
    field2: `<rect x="0" y="0" width="5" height="64" fill="${C.water}"/><path d="M5 0 L5 64" stroke="${C.waterD}" stroke-width="1.4"/>
      <path d="M2.5 8 l0 5 M2.5 30 l0 5 M2.5 50 l0 5" stroke="${C.sky}" stroke-width="1.2"/>` + rows(C.furrowD, (x, y) => ear(x + 2, y)) + sheaf(52, 54),
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

    lumber0: shadow(18) + `
      <path d="M18 40 L18 52 Q32 57 46 52 L46 40Z" fill="${C.wood}" ${st()}/>
      <ellipse cx="32" cy="40" rx="14" ry="5" fill="${C.wheat}" ${st()}/>
      <ellipse cx="32" cy="40" rx="7" ry="2.5" fill="none" stroke="${C.wheatD}" stroke-width="1.2"/>
      <path d="M33 38 L42 14" stroke="${C.woodD}" stroke-width="3.4" stroke-linecap="round"/>
      <path d="M36 16 Q44 10 50 16 L44 22 Q42 17 36 16Z" fill="${C.stone}" ${st(1.5)}/>
      <path d="M12 52 l4 -2 M50 54 l4 -3 M14 46 l3 1" stroke="${C.wheatD}" stroke-width="2"/>`,
    lumber1: shadow(28) + pine(10, 27, .95) + logEnds(30, 48) + logEnds(24, 38) + logEnds(36, 38) + logEnds(30, 28, .95) + `
      <path d="M50 52 L56 30" stroke="${C.woodD}" stroke-width="3" stroke-linecap="round"/>
      <path d="M52 32 Q57 26 62 31 L57 36Z" fill="${C.stone}" ${st(1.4)}/>`,
    lumber2: shadow(28) + pine(12, 34, 1.15) + `
      <path d="M22 26 L50 20 L56 26 L28 32Z" fill="${C.woodD}" ${st()}/>
      <path d="M28 32 L28 50 M54 26 L54 46" stroke="${C.woodD}" stroke-width="3"/>` +
      logEnds(38, 48) + logEnds(34, 39) + logEnds(44, 39, .9),

    quarry0: shadow(24) + `
      <path d="M8 52 L14 30 L26 22 L40 26 L50 20 L58 34 L56 52Z" fill="${C.stone}" ${st()}/>
      <path d="M14 30 L22 38 L26 22 M40 26 L36 40 L50 20 M22 38 L36 40 L44 52" fill="none" stroke="${C.stoneD}" stroke-width="1.4"/>
      <path d="M18 54 L34 36" stroke="${C.woodD}" stroke-width="3" stroke-linecap="round"/>
      <path d="M26 34 Q34 30 42 38 Q34 36 30 40Z" fill="${C.stoneD}" ${st(1.4)}/>`,
    quarry1: shadow(26) + `
      <path d="M8 40 L12 18 L30 12 L52 16 L58 40Z" fill="${C.stoneD}" ${st()}/>
      <path d="M18 22 L18 40 M30 18 L30 40 M44 20 L44 40 M12 30 L58 30" stroke="${O}" stroke-width="1.2" opacity=".55"/>` +
      block(10, 44, 14, 9) + block(25, 44, 14, 9) + block(40, 44, 14, 9) + block(17, 36, 14, 8) + block(32, 36, 14, 8),
    quarry2: shadow(28) + `
      <path d="M6 44 L10 22 L24 16 L36 20 L36 44Z" fill="${C.stoneD}" ${st()}/>
      <path d="M38 52 L48 10 L58 52" fill="none" stroke="${C.woodD}" stroke-width="3" stroke-linecap="round"/>
      <path d="M41 36 L55 36" stroke="${C.woodD}" stroke-width="2.4"/>
      <path d="M48 12 L48 30" stroke="${O}" stroke-width="1.2"/>` +
      block(43, 30, 10, 7) + block(8, 46, 14, 8) + block(23, 46, 14, 8) + block(15, 38, 14, 8),

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
    // мастерская побогаче: гончарный круг и расписной горшок
    workshop1: shadow(24) + `
      <ellipse cx="22" cy="48" rx="15" ry="4" fill="${C.woodD}" ${st(1.6)}/>
      <rect x="20" y="48" width="4" height="7" fill="${C.woodD}"/>
      <path d="M14 46 Q12 34 18 30 L26 30 Q32 34 30 46Z" fill="${C.white}" ${st(1.6)}/>
      <path d="M13 38 Q22 41 31 38" fill="none" stroke="${C.red}" stroke-width="2"/>
      <path d="M17 34 l2 2 l2 -2 l2 2 l2 -2 l2 2" fill="none" stroke="${C.red}" stroke-width="1.3"/>
      <path d="M38 52 Q34 38 42 32 L52 32 Q60 38 56 52Z" fill="${C.white}" ${st(1.8)}/>
      <path d="M36 42 Q47 46 58 42" fill="none" stroke="${C.red}" stroke-width="2.2"/>
      <path d="M40 36 Q47 39 54 36" fill="none" stroke="${C.red}" stroke-width="1.4"/>`,
    // гончарная мастерская бронзового века: печь для обжига и кувшины
    workshop2: shadow(28) + `
      <path d="M30 52 Q30 26 46 24 Q62 26 62 52Z" fill="${C.mudD}" ${st()}/>
      <path d="M40 52 Q40 40 46 40 Q52 40 52 52Z" fill="${C.dark}" ${st(1.4)}/>` + flame(46, 47, .9) + smoke(46, 20) +
      pithos(14, 40, .72, C.white) + `<path d="M7 40 Q14 43 21 40" fill="none" stroke="${C.red}" stroke-width="1.6"/>` +
      `<path d="M24 54 Q21 46 25 42 L31 42 Q35 46 32 54Z" fill="${C.terra}" ${st(1.4)}/>`,
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

    port0: `
      <path d="M2 40 Q16 36 32 40 Q48 44 62 40 L62 58 L2 58Z" fill="${C.water}" ${st(1.4)}/>
      <path d="M8 48 q4 -2 8 0 M40 50 q4 -2 8 0" stroke="${C.sky}" stroke-width="1.6" fill="none"/>
      <rect x="30" y="28" width="30" height="5" fill="${C.wood}" ${st()}/>
      <path d="M34 33 L34 52 M44 33 L44 52 M54 33 L54 52" stroke="${C.woodD}" stroke-width="3"/>
      <path d="M6 40 Q16 50 28 40Z" fill="${C.wood}" ${st()}/>
      <path d="M10 36 L24 44" stroke="${C.woodD}" stroke-width="2"/>`,
    port1: `
      <path d="M2 42 Q16 38 32 42 Q48 46 62 42 L62 58 L2 58Z" fill="${C.water}" ${st(1.4)}/>
      <path d="M8 50 q4 -2 8 0 M44 52 q4 -2 8 0" stroke="${C.sky}" stroke-width="1.6" fill="none"/>
      <path d="M8 42 Q24 54 48 42Z" fill="${C.wood}" ${st()}/>
      <path d="M28 44 L28 10" stroke="${C.woodD}" stroke-width="2.4"/>
      <path d="M16 14 L40 14 L38 36 L18 36Z" fill="${C.white}" ${st()}/>
      <path d="M16 14 L40 14" stroke="${C.woodD}" stroke-width="2.4"/>
      <path d="M48 42 Q54 36 56 30" fill="none" stroke="${C.woodD}" stroke-width="2.4"/>`,
    port2: `
      <path d="M2 44 Q16 40 32 44 Q48 48 62 44 L62 58 L2 58Z" fill="${C.water}" ${st(1.4)}/>
      <path d="M6 44 Q28 58 52 44 Q58 40 60 32 L56 34 Q52 42 46 44Z" fill="${C.woodD}" ${st()}/>
      <path d="M6 44 Q4 38 8 34" fill="none" stroke="${C.woodD}" stroke-width="2.6"/>
      <path d="M30 46 L30 6" stroke="${C.dark}" stroke-width="2.6"/>
      <path d="M14 10 L46 10 L44 38 L16 38Z" fill="${C.white}" ${st()}/>
      <path d="M14 18 L46 18 M15 26 L45 26 M16 32 L44 32" stroke="${C.red}" stroke-width="2"/>
      <path d="M14 10 L46 10 M16 38 L44 38" stroke="${C.dark}" stroke-width="2.2"/>` + ingotShape(48, 52, .45),

    foundry0: shadow(22) + `
      <path d="M14 54 Q12 22 32 18 Q52 22 50 54Z" fill="${C.mudD}" ${st()}/>
      <path d="M24 54 Q24 38 32 38 Q40 38 40 54Z" fill="${C.dark}" ${st(1.4)}/>` + flame(32, 50, 1) + smoke(32, 14) + `
      <path d="M50 46 L60 40 L60 50Z" fill="${C.wood}" ${st(1.4)}/>`,
    foundry1: shadow(26) + `
      <path d="M6 54 Q4 26 22 22 Q40 26 38 54Z" fill="${C.mudD}" ${st()}/>
      <path d="M14 54 Q14 40 22 40 Q30 40 30 54Z" fill="${C.dark}" ${st(1.4)}/>` + flame(22, 50, .9) + smoke(22, 18) + `
      <path d="M38 30 L46 26 Q52 30 50 38 L44 40Z" fill="${C.stoneD}" ${st(1.5)}/>
      <path d="M47 38 Q50 44 49 50" stroke="${C.fireL}" stroke-width="3" stroke-linecap="round"/>
      <rect x="42" y="50" width="16" height="5" rx="1" fill="${C.stone}" ${st(1.3)}/>`,
    foundry2: shadow(28) + `
      <path d="M4 54 Q2 26 20 22 Q38 26 36 54Z" fill="${C.mudD}" ${st()}/>
      <path d="M12 54 Q12 40 20 40 Q28 40 28 54Z" fill="${C.dark}" ${st(1.4)}/>` + flame(20, 50, .9) + smoke(20, 18) +
      ingotShape(50, 50, .62, C.bronze, C.bronzeD) + `
      <path d="M44 22 L56 18 Q60 26 56 34 L44 30Z" fill="${C.bronze}" ${st(1.5)}/>
      <path d="M44 26 L36 26" stroke="${C.woodD}" stroke-width="3" stroke-linecap="round"/>`,

    // виноградник: лоза на террасе → две террасы → давильня с амфорами
    vineyard0: shadow(26) + terrace(44) + vine(20, 36, 1.1) + vine(42, 34, 1.15),
    vineyard1: shadow(28) + terrace(50) + terrace(32, 10, 58) + vine(16, 42, .9) + vine(34, 41, .95) + vine(52, 40, .9) + vine(26, 24, .85) + vine(44, 23, .85) +
      `<path d="M4 58 L14 52 L20 58Z" fill="${C.thatch}" ${st(1.3)}/>` + grapes(11, 51, .45),
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
  B.field3 = B.field2 + olive(52, 16, 1.05) + sheaf(16, 57) + sheaf(31, 59) + pithos(42, 54, .42, C.white);
  B.goatpen3 = B.goatpen2 + pennant(60, 12) + cheeseStack(12, 34) + goat(30, 53, .72, C.mudD, true) + pithos(6, 52, .4, C.white);
  B.lumber3 = pine(56, 15, .8) + B.lumber2 + `
    <rect x="1" y="45" width="24" height="5" rx="1" fill="${C.wood}" ${st(1.4)}/>
    <circle cx="6" cy="53" r="4" fill="${C.woodD}" ${st(1.3)}/><circle cx="20" cy="53" r="4" fill="${C.woodD}" ${st(1.3)}/>` + logEnds(14, 41, .55) + logEnds(12, 36, .5);
  B.quarry3 = B.quarry2 + ashlar(12, 10, 12, 7) + ashlar(22, 6, 11, 7) + `
    <path d="M6 61 L36 61" stroke="${C.woodD}" stroke-width="2.6" stroke-linecap="round"/><path d="M6 58 L1 55" stroke="${C.woodD}" stroke-width="1.6"/>` + ashlar(9, 53, 25, 7);
  B.workshop3 = B.workshop2 + `
    <path d="M3 26 L3 56 M27 26 L27 40" stroke="${C.woodD}" stroke-width="2.4"/>
    <rect x="1" y="23" width="28" height="3.5" rx="1" fill="${C.wood}" ${st(1.3)}/>` +
    [6, 14, 22].map((x, i) => `<path d="M${x - 3.5} 23 Q${x - 5} 17 ${x - 2} 14 L${x + 2} 14 Q${x + 5} 17 ${x + 3.5} 23Z" fill="${i === 1 ? C.terra : C.white}" ${st(1.2)}/>
      <path d="M${x - 4} 19 Q${x} 21 ${x + 4} 19" stroke="${i === 1 ? C.white : C.red}" stroke-width="1.3" fill="none"/>`).join('') + pennant(57, 22);
  B.store3 = `<path d="M20 13 L40 2 L60 13Z" fill="${C.thatch}" ${st()}/><path d="M28 13 L40 5 M40 5 L52 13 M34 13 L40 5 L46 13" stroke="${C.thatchD}" stroke-width="1.2"/>` + B.store2 +
    `<rect x="22" y="24" width="36" height="3" fill="${C.red}"/>` + pithos(30, 52, .45, C.white) + ingotShape(47, 57, .38) + ingotShape(47, 53, .38);

  // ---------- железный век: 9-й и 11-й уровни старых зданий и кузница ----------
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
    // Дом с внутренним двором: каменный дом с верхней комнатой, навес с лозой на крыше, двор за стеной
    house4: shadow(30) + wallA(4, 40, 18, 13, '#ddd2b6') + `<rect x="9" y="44" width="7" height="9" fill="${C.dark}" ${st(1.2)}/>` +
      wallA(22, 22, 36, 31) + `<rect x="20" y="18" width="40" height="5" fill="${C.woodD}" ${st()}/>` +
      wallA(38, 8, 18, 11) + `<rect x="36" y="5" width="22" height="4" fill="${C.woodD}" ${st(1.5)}/>
      <rect x="43" y="11" width="5" height="5" fill="${C.dark}" ${st(1.1)}/>
      <path d="M24 18 L24 9 M33 18 L33 9 M22 9 L36 9" stroke="${C.woodD}" stroke-width="2" stroke-linecap="round"/>
      <path d="M22 9 Q29 5 36 9" stroke="${C.greenD}" stroke-width="2.4" fill="none"/><circle cx="26" cy="8" r="2.2" fill="${C.green}" ${st(.9)}/><circle cx="32" cy="7.5" r="2.3" fill="${C.green}" ${st(.9)}/>
      <rect x="32" y="35" width="13" height="3" fill="${C.stoneD}" ${st(1.1)}/><rect x="34" y="38" width="9" height="15" fill="${C.dark}" ${st(1.3)}/>
      <rect x="26" y="27" width="5" height="5" fill="${C.dark}" ${st(1.1)}/><rect x="49" y="27" width="5" height="5" fill="${C.dark}" ${st(1.1)}/>` + amphoraShape(13, 34, .38),
    // Дом знатного киприота: портик с протоэолийскими колоннами, верхний этаж, пурпурный флажок
    house5: shadow(31) + wallA(8, 20, 48, 34) + `<rect x="6" y="17" width="52" height="4" fill="${C.woodD}" ${st()}/>` +
      wallA(18, 7, 28, 11) + `<rect x="16" y="4" width="32" height="4" fill="${C.woodD}" ${st(1.5)}/>
      <rect x="23" y="10" width="5" height="5" fill="${C.dark}" ${st(1.1)}/><rect x="36" y="10" width="5" height="5" fill="${C.dark}" ${st(1.1)}/>
      <rect x="25" y="36" width="14" height="18" fill="${C.dark}" ${st(1.3)}/><rect x="14" y="27" width="36" height="3" fill="${C.plaster}" ${st(1.2)}/>` +
      aeolic(19, 36, 18, .85) + aeolic(45, 36, 18, .85) +
      `<path d="M56 18 L56 4" stroke="${C.woodD}" stroke-width="1.8"/><path d="M56 4 L64 6.5 L56 9Z" fill="${PUR}" ${st(1.1)}/>`,

    // Поле с железным плугом: канал, спелые ряды, рало с железным лемехом и ток для обмолота
    field4: `<rect x="0" y="0" width="5" height="64" fill="${C.water}"/><path d="M5 0 L5 64" stroke="${C.waterD}" stroke-width="1.4"/>` +
      rows(C.furrowD, (x, y) => ear(x + 2, y)) + `
      <ellipse cx="50" cy="13" rx="12" ry="7" fill="#d9c08a" ${st(1.5)}/><ellipse cx="50" cy="13" rx="8" ry="4.4" fill="none" stroke="${C.stoneD}" stroke-width="1.2"/>
      <path d="M44 13 Q50 6 56 13Z" fill="${C.wheat}" ${st(1.1)}/>
      <path d="M22 60 L46 46" stroke="${C.woodD}" stroke-width="3" stroke-linecap="round"/><path d="M40 50 L44 58" stroke="${C.woodD}" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M43 56 L50 60 L42 61Z" fill="${IRN}" ${st(1.2)}/>`,
    // Поле-усадьба: журавль для полива, круглое каменное зернохранилище
    field5: `<rect x="0" y="0" width="5" height="64" fill="${C.water}"/><path d="M5 0 L5 64" stroke="${C.waterD}" stroke-width="1.4"/>` +
      rows(C.furrowD, (x, y) => ear(x + 2, y)) + `
      <path d="M12 26 L12 4" stroke="${C.woodD}" stroke-width="2.6"/><path d="M2 14 L26 4" stroke="${C.woodD}" stroke-width="2.2" stroke-linecap="round"/>
      <circle cx="25" cy="4.6" r="2.4" fill="${C.stoneD}" ${st(1)}/><path d="M3 14 L3 22" stroke="${O}" stroke-width="1"/><path d="M0 22 L6 22 L5 26 L1 26Z" fill="${C.wood}" ${st(1)}/>
      <path d="M40 58 L40 44 Q50 34 60 44 L60 58Z" fill="#ddd2b6" ${st(1.6)}/><path d="M38 45 Q50 28 62 45Z" fill="${C.thatch}" ${st(1.5)}/>
      <rect x="47" y="49" width="6" height="9" fill="${C.dark}" ${st(1.1)}/>` + sheaf(32, 60),

    // Лесорубы с железными топорами: пила на козлах, доски, топор в колоде
    lumber4: shadow(28) + pine(9, 30, .95) + `
      <path d="M22 54 L30 38 M38 54 L30 38 M42 54 L50 38 M58 54 L50 38" stroke="${C.woodD}" stroke-width="2.4" stroke-linecap="round"/>` +
      logEnds(40, 36, .95) + `
      <path d="M30 22 L36 46" stroke="${IRN}" stroke-width="3.6"/><path d="M30 22 L36 46" stroke="${IRNL}" stroke-width="1"/>
      <path d="M27 20 L33 19 M35 47 L40 45" stroke="${C.woodD}" stroke-width="3" stroke-linecap="round"/>
      ${[0, 1, 2].map(i => `<rect x="${6 + i * 1.5}" y="${50 - i * 4}" width="16" height="4" rx="1" fill="${i % 2 ? C.wheat : '#e2c178'}" ${st(1.1)}/>`).join('')}
      <path d="M53 26 L60 12" stroke="${C.woodD}" stroke-width="2.6" stroke-linecap="round"/><path d="M56 13 Q61 7 64 13 L60 17Z" fill="${IRN}" ${st(1.2)}/>`,
    // Верфь: остов корабля из кедровых брусьев на подпорах, штабель брёвен
    lumber5: shadow(30) + pine(56, 18, .85) + `
      <path d="M4 44 L50 44" stroke="${C.woodD}" stroke-width="3.4" stroke-linecap="round"/>
      ${[10, 18, 26, 34, 42].map(x => `<path d="M${x} 44 Q${x - 6} 34 ${x - 2} 24" fill="none" stroke="${C.wood}" stroke-width="2.6" stroke-linecap="round"/><path d="M${x} 44 Q${x - 6} 34 ${x - 2} 24" fill="none" stroke="${O}" stroke-width=".8"/>`).join('')}
      <path d="M2 26 Q24 22 46 24" fill="none" stroke="${C.woodD}" stroke-width="2.4"/>
      <path d="M50 44 Q58 36 56 24" fill="none" stroke="${C.woodD}" stroke-width="3" stroke-linecap="round"/>
      <path d="M12 44 L10 54 M30 44 L30 54 M46 44 L48 54" stroke="${C.woodD}" stroke-width="2.4"/>` + logEnds(48, 52, .62) + logEnds(52, 46, .55),

    // Каменоломня с железными кирками: ступенчатая выработка, клинья, блок на волокуше
    quarry4: shadow(28) + `
      <path d="M4 46 L4 14 L20 10 L20 22 L36 20 L36 32 L52 30 L52 46Z" fill="#d6ccb3" ${st()}/>
      <path d="M4 22 L20 22 M20 32 L36 32 M4 32 L20 32 M4 40 L52 40 M12 14 L12 22 M28 22 L28 32 M12 32 L12 40 M44 32 L44 40 M28 40 L28 46" stroke="${C.stoneD}" stroke-width="1.1"/>
      <path d="M38 22 L44 12" stroke="${C.woodD}" stroke-width="2.6" stroke-linecap="round"/><path d="M38 12 Q44 8 50 13 Q44 12 42 15Z" fill="${IRN}" ${st(1.2)}/>
      <path d="M22 26 l3 -2 l1 3Z M30 26 l3 -2 l1 3Z" fill="${IRND}" ${st(.8)}/>
      <path d="M28 56 L60 56 L58 52 L30 52Z" fill="${C.wood}" ${st(1.3)}/>` + ashlar(32, 44, 22, 8) + `<path d="M28 54 L18 50" stroke="${C.woodD}" stroke-width="1.6"/>`,
    // Царская каменоломня: подъёмник с блоком, высеченная протоэолийская капитель
    quarry5: shadow(30) + `
      <path d="M2 44 L2 18 L16 14 L16 26 L30 24 L30 44Z" fill="#d6ccb3" ${st()}/>
      <path d="M2 26 L16 26 M2 35 L30 35 M9 18 L9 26 M22 26 L22 35 M9 35 L9 44" stroke="${C.stoneD}" stroke-width="1.1"/>
      <path d="M34 54 L44 6 L56 54" fill="none" stroke="${C.woodD}" stroke-width="3" stroke-linecap="round"/><path d="M38 34 L52 34" stroke="${C.woodD}" stroke-width="2.4"/>
      <circle cx="44" cy="8" r="2.6" fill="${IRN}" ${st(1.1)}/><path d="M44 10 L44 22" stroke="${O}" stroke-width="1.1"/>` + ashlar(38, 22, 12, 7) + `
      <g transform="translate(18 52)"><rect x="-13" y="-3" width="26" height="6" fill="#ece2c8" ${st(1.3)}/>
        <path d="M-8 -3 C-11 -3 -15 -5 -15 -9 C-15 -13 -10 -13 -10 -9.5 C-10 -7.5 -12.5 -7.5 -12.5 -9 M8 -3 C11 -3 15 -5 15 -9 C15 -13 10 -13 10 -9.5 C10 -7.5 12.5 -7.5 12.5 -9" fill="none" ${st(1.4)}/>
        <path d="M-4 -3 L0 -11 L4 -3Z" fill="${C.terra}" ${st(1)}/></g>`,

    // Мастерская расписной керамики: печь, кувшин с птицей «свободного поля», полка с кувшинчиками
    workshop4: shadow(28) + `
      <path d="M34 52 Q34 26 48 24 Q62 26 62 52Z" fill="${C.mudD}" ${st()}/>
      <path d="M43 52 Q43 41 48 41 Q53 41 53 52Z" fill="${C.dark}" ${st(1.4)}/>` + flame(48, 48, .85) + smoke(48, 20) +
      birdJug(18, 40, 1.05) + `<rect x="2" y="17" width="28" height="3" rx="1" fill="${C.wood}" ${st(1.2)}/><path d="M4 20 L4 26 M28 20 L28 26" stroke="${C.woodD}" stroke-width="2"/>` +
      birdJug(9, 11, .38) + birdJug(21, 11, .38) + amphoraShape(32, 52, .42, '#b85d33'),
    // Мастерская серебряных дел: весы с гирями, чаши с чеканкой, тигель на огне, навес в пурпурную полоску
    workshop5: shadow(30) + `
      <path d="M4 14 L4 54 M60 14 L60 54" stroke="${C.woodD}" stroke-width="2.6"/>
      <path d="M1 16 L63 10 L63 16 L1 22Z" fill="#efe6d2" ${st(1.5)}/>
      ${[8, 22, 36, 50].map(x => `<path d="M${x} ${19.2 - x * .097} L${x + 7} ${18.5 - (x + 7) * .097} L${x + 7} ${12.5 - (x + 7) * .097} L${x} ${13.2 - x * .097}Z" fill="${PUR}"/>`).join('')}
      <rect x="8" y="40" width="48" height="5" rx="1" fill="${C.wood}" ${st(1.4)}/><path d="M12 45 L12 54 M52 45 L52 54" stroke="${C.woodD}" stroke-width="2.4"/>` +
      scales(20, 40, .95) + silverBowl(38, 37, .9) + silverBowl(50, 38, .7) + `
      <path d="M36 56 Q36 50 42 50 Q48 50 48 56Z" fill="${C.stoneD}" ${st(1.2)}/>` + flame(42, 52, .55) +
      `<path d="M38 50 L46 50 L45 47 L39 47Z" fill="${IRN}" ${st(1)}/>`,

    // Склад амфор: каменный дом с окованной дверью, амфоры в ряд
    store4: shadow(30) + wallA(18, 14, 42, 34) + `<rect x="16" y="10" width="46" height="5" fill="${C.woodD}" ${st()}/>
      <rect x="32" y="30" width="13" height="18" fill="${C.wood}" ${st(1.3)}/><path d="M32 35 L45 35 M32 43 L45 43" stroke="${IRN}" stroke-width="2"/>
      <circle cx="42" cy="39" r="1.2" fill="${IRND}"/>` +
      [8, 15, 22].map((x, i) => amphoraShape(x, 46 - (i % 2) * 2, .42, i === 1 ? '#b85d33' : '#c9693a')).join('') + amphoraShape(55, 51, .38) + pithos(12, 32, .4),
    // Царская кладовая: портик с колоннами, сундук с серебром, слитки и амфоры
    store5: shadow(31) + wallA(10, 16, 46, 38) + `<rect x="8" y="12" width="50" height="5" fill="${C.woodD}" ${st()}/>
      <path d="M8 12 L33 3 L58 12Z" fill="${C.terra}" ${st(1.5)}/>
      <rect x="27" y="34" width="12" height="20" fill="${C.dark}" ${st(1.3)}/><rect x="16" y="24" width="34" height="3" fill="${C.plaster}" ${st(1.1)}/>` +
      aeolic(20, 32, 22, .8) + aeolic(46, 32, 22, .8) + `
      <rect x="2" y="46" width="14" height="9" rx="1" fill="${C.wood}" ${st(1.3)}/><path d="M2 49 L16 49" stroke="${IRN}" stroke-width="1.6"/>` +
      silverBowl(9, 45, .55) + amphoraShape(58, 50, .42) + ironBars(52, 58, 2),

    // Рудник с галереями: две штольни, лестница, чёрный шлаковый отвал
    mine3: shadow(30) + `
      <path d="M2 54 Q10 14 30 10 Q50 14 56 54Z" fill="${C.stoneD}" ${st()}/>
      <path d="M10 54 L10 42 Q16 36 22 42 L22 54Z" fill="${C.dark}" ${st(1.4)}/><path d="M8 54 L8 40 M24 54 L24 40 M6 40 L26 40" stroke="${C.wood}" stroke-width="2.8" stroke-linecap="round"/>
      <path d="M30 30 L30 22 Q35 17 40 22 L40 30Z" fill="${C.dark}" ${st(1.3)}/><path d="M28 30 L28 20 M42 30 L42 20 M26 20 L44 20" stroke="${C.wood}" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M27 32 L23 54 M33 32 L29 54" stroke="${C.wood}" stroke-width="1.6"/>${[36, 41, 46, 51].map(y => `<path d="M${25.6 - (y - 32) * .18 + 1} ${y} L${31.6 - (y - 32) * .18 + 1} ${y}" stroke="${C.wood}" stroke-width="1.4"/>`).join('')}
      <circle cx="16" cy="30" r="1.8" fill="#4fa58d"/><circle cx="46" cy="40" r="1.8" fill="${C.copper}"/>` + slag(52, 52, .95) + smoke(54, 38),
    // Рудник с плавильней: печь с мехами, отвал шлака, стопка слитков
    mine4: shadow(31) + `
      <path d="M2 46 Q8 14 24 10 Q40 14 44 46Z" fill="${C.stoneD}" ${st()}/>
      <path d="M12 46 L12 34 Q18 28 24 34 L24 46Z" fill="${C.dark}" ${st(1.3)}/><path d="M10 46 L10 32 M26 46 L26 32 M8 32 L28 32" stroke="${C.wood}" stroke-width="2.6" stroke-linecap="round"/>
      <path d="M40 56 L42 26 Q48 20 54 26 L56 56Z" fill="${C.mudD}" ${st()}/><path d="M44 56 Q44 46 48 46 Q52 46 52 56Z" fill="${C.dark}"/>` + flame(48, 52, .7) + smoke(48, 20) + `
      <path d="M56 50 Q64 46 62 40 Q58 38 56 44Z" fill="#a9825a" ${st(1.2)}/>` + slag(14, 54, .7) + ingotShape(30, 54, .5) + ingotShape(30, 49, .5) + `<circle cx="34" cy="20" r="1.8" fill="#4fa58d"/>`,

    // Гавань с каменным молом: финикийский «гаулос» и амфоры на причале
    port3: `
      <path d="M2 44 Q16 40 32 44 Q48 48 62 44 L62 60 L2 60Z" fill="${C.water}" ${st(1.4)}/>
      <path d="M10 52 q4 -2 8 0 M44 56 q4 -2 8 0" stroke="${C.sky}" stroke-width="1.6" fill="none"/>
      <path d="M40 44 L62 40 L62 50 L44 52Z" fill="#d6ccb3" ${st(1.5)}/><path d="M46 44 L46 51 M53 42.6 L53 50.6 M59 41.5 L59 49.4" stroke="${C.stoneD}" stroke-width="1.1"/>` +
      gaulos(22, 46, .9) + amphoraShape(50, 38, .38) + amphoraShape(56, 37, .36, '#b85d33'),
    // Военная гавань Китиона: корабельный сарай на колоннах и боевой корабль с тараном
    port4: `
      <path d="M2 46 Q16 42 32 46 Q48 50 62 46 L62 60 L2 60Z" fill="${C.water}" ${st(1.4)}/>
      <path d="M8 54 q4 -2 8 0" stroke="${C.sky}" stroke-width="1.6" fill="none"/>
      <path d="M30 46 L62 40 L62 50 L34 52Z" fill="#d6ccb3" ${st(1.4)}/>
      <path d="M32 14 L62 6 L62 12 L32 20Z" fill="${C.terra}" ${st(1.5)}/>${[36, 46, 56].map(x => `<rect x="${x}" y="${19 - (x - 32) * .27}" width="3.4" height="${27 + (x - 32) * .1}" fill="${C.plaster}" ${st(1.1)}/>`).join('')}
      <path d="M36 36 L60 30 L60 34 Q48 40 38 40Z" fill="${C.woodD}" ${st(1.3)}/>
      <path d="M4 46 L36 46 Q34 52 28 52 L10 52 Q6 50 4 46Z" fill="${C.woodD}" ${st(1.5)}/>` + ram(4, 47, 1.1) + eyeShip(10, 48, .9) + `
      ${[14, 19, 24, 29].map(x => `<path d="M${x} 51 L${x - 3} 58" stroke="${C.wood}" stroke-width="1.5"/>`).join('')}
      <path d="M20 46 L20 24" stroke="${C.dark}" stroke-width="2"/><path d="M12 26 L28 26 L27 40 L13 40Z" fill="#efe6d2" ${st(1.3)}/><path d="M12.5 33 L27.5 33" stroke="${PUR}" stroke-width="2"/>`,

    // Царский архив: каменный дом с колоннами, бронзовая табличка на стене
    scribe3: shadow(30) + wallA(8, 18, 48, 36) + `<rect x="6" y="14" width="52" height="5" fill="${C.woodD}" ${st()}/>
      <rect x="27" y="36" width="10" height="18" fill="${C.dark}" ${st(1.3)}/><rect x="17" y="27" width="30" height="3" fill="${C.plaster}" ${st(1.1)}/>` +
      aeolic(21, 34, 20, .75) + aeolic(43, 34, 20, .75) + `
      <rect x="11" y="20" width="9" height="6" rx="1" fill="${C.bronze}" ${st(1.1)}/><path d="M13 22 l2 1.5 l2 -1.5 M13 24.5 l4 0" stroke="${C.bronzeD}" stroke-width=".9" fill="none"/>` + tablet(52, 44, .58),
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

  // ---------- спецстроения ----------
  const S = {
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
    // амфоры: вино и масло
    amphora: amphoraShape(28, 34, 1.55) + grapes(48, 46, .7) + `<path d="M44 14 Q54 10 58 18 Q50 20 44 14Z" fill="#8d9b5c" ${st(1.3)}/><circle cx="52" cy="22" r="2.4" fill="#3c4a2a"/>`,
  };

  // ---------- местность и звери ----------
  const T = {
    tree: pine(22, 40, 1.15) + pine(42, 44, 1.3),
    hill: `<path d="M4 54 Q18 20 34 24 Q48 26 60 54Z" fill="#9f7b4d" ${st(1.6)} opacity=".75"/>
      <path d="M20 32 L26 40 M38 30 L44 40" stroke="#6f532f" stroke-width="1.6" opacity=".6"/>`,
    goat: goat(30, 40, 1.6, C.white),
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
      ${[16, 24, 40, 48].map(x => `<ellipse cx="${x}" cy="${x < 32 ? 26 + (x - 16) * -0.6 : 26 - (48 - x) * 0.6 + 0}" rx="3" ry="1.6" fill="${C.green}"/>`).join('')}` + goat(30, 44, 1.2, C.white),
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
    r_vintage: rdisc + grapes(32, 30, 1.25) + `<circle cx="16" cy="44" r="7" fill="${C.thatch}" ${st(1.4)}/><circle cx="16" cy="44" r="3.4" fill="none" stroke="${C.thatchD}" stroke-width="1.2"/>
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
  };

  const ALL = Object.assign({}, B, S, T, M);
  const wrap = (inner, cls) => `<svg class="ico ${cls || ''}" viewBox="0 0 64 64" aria-hidden="true">${inner}</svg>`;

  return {
    has: k => !!ALL[k],
    svg: (k, cls) => ALL[k] ? wrap(ALL[k], cls) : '',
    res: (k, cls) => R[k] ? wrap(R[k], 'res-ico ' + (cls || '')) : (k === 'logos' ? '<b class="lg">λ</b>' : ''),
  };
})();
