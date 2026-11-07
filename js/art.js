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

  // ---------- спецстроения ----------
  const S = {
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
  };

  // ---------- местность и звери ----------
  const T = {
    tree: pine(22, 40, 1.15) + pine(42, 44, 1.3),
    hill: `<path d="M4 54 Q18 20 34 24 Q48 26 60 54Z" fill="#9f7b4d" ${st(1.6)} opacity=".75"/>
      <path d="M20 32 L26 40 M38 30 L44 40" stroke="#6f532f" stroke-width="1.6" opacity=".6"/>`,
    goat: goat(30, 40, 1.6, C.white),
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
  };

  const ALL = Object.assign({}, B, S, T, M);
  const wrap = (inner, cls) => `<svg class="ico ${cls || ''}" viewBox="0 0 64 64" aria-hidden="true">${inner}</svg>`;

  return {
    has: k => !!ALL[k],
    svg: (k, cls) => ALL[k] ? wrap(ALL[k], cls) : '',
    res: (k, cls) => R[k] ? wrap(R[k], 'res-ico ' + (cls || '')) : (k === 'logos' ? '<b class="lg">λ</b>' : ''),
  };
})();
