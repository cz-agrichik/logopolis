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
    fire: '#f08a24', fireL: '#ffd35a', dark: '#3b2a1c', white: '#f7f2e6', red: '#a8402a', sky: '#bfe0ee',
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

  // ---------- здания: стадии 0 (ур. 1–3), 1 (4–5), 2 (6+) ----------
  const B = {
    house0: shadow(20) + roundHut(32, 36, 1),
    house1: shadow(22) + smoke(40, 12) + roundHut(32, 36, 1.05, { base: true, wall: C.plaster, knob: true }),
    house2: shadow(24) + `
      <rect x="10" y="26" width="30" height="27" fill="${C.mud}" ${st()}/>
      <rect x="38" y="34" width="17" height="19" fill="${C.mudD}" ${st()}/>
      <rect x="8" y="21" width="34" height="6" fill="${C.woodD}" ${st()}/>
      <rect x="36" y="30" width="21" height="5" fill="${C.woodD}" ${st()}/>
      <path d="M12 27 l0 -3 M20 27 l0 -3 M28 27 l0 -3 M36 27 l0 -3" stroke="${O}" stroke-width="1.2"/>
      <rect x="21" y="38" width="9" height="15" rx="1" fill="${C.dark}" ${st(1.4)}/>
      <rect x="13" y="32" width="5" height="5" fill="${C.dark}" ${st(1.2)}/>
      <rect x="44" y="40" width="5" height="5" fill="${C.dark}" ${st(1.2)}/>
      <path d="M10 49 L40 49" stroke="${C.stoneD}" stroke-width="2"/>`,

    field0: shadow(26) + furrows() + sprout(20, 42) + sprout(32, 40) + sprout(44, 42) + sprout(27, 47) + sprout(40, 47),
    field1: shadow(26) + furrows(true) + [16, 23, 30, 37, 44, 51].map((x, i) => stalk(x, 46 - (i % 2) * 3, 12)).join(''),
    field2: shadow(26) + furrows(true) + [14, 20, 26, 38, 44, 50].map((x, i) => stalk(x, 46 - (i % 2) * 3, 16, true)).join('') + `
      <g><path d="M27 52 L32 26 L37 52Z" fill="${C.wheat}" ${st(1.4)}/>
      <path d="M26 40 L38 40" stroke="${C.terra}" stroke-width="2.4"/>
      <path d="M32 26 l-4 -4 M32 26 l4 -4 M32 26 l0 -5" stroke="${C.wheatD}" stroke-width="1.6"/></g>`,

    goatpen0: shadow(26) + fence(40) + goat(30, 42, 1.25, C.white),
    goatpen1: shadow(26) + fence(40) + goat(22, 42, 1.05, C.mudD) + goat(42, 44, 1.15, C.white, true),
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
    lumber1: shadow(24) + logEnds(30, 48) + logEnds(24, 38) + logEnds(36, 38) + logEnds(30, 28, .95) + `
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

    workshop0: shadow(22) + `
      <rect x="10" y="38" width="44" height="6" rx="1" fill="${C.wood}" ${st()}/>
      <path d="M14 44 L14 54 M50 44 L50 54" stroke="${C.woodD}" stroke-width="3"/>` +
      idol(26, 32, .82) + `
      <path d="M40 36 L52 26" stroke="${C.woodD}" stroke-width="2.6" stroke-linecap="round"/>
      <path d="M50 24 L55 21 L56 25 L53 28Z" fill="${C.stone}" ${st(1.2)}/>
      <ellipse cx="44" cy="37" rx="4" ry="1.6" fill="${C.picD}"/>`,
    workshop1: shadow(24) + `
      <path d="M22 16 L34 16 L35 21 Q46 28 44 40 Q42 50 36 53 L20 53 Q14 50 12 40 Q10 28 21 21Z" fill="${C.white}" ${st()}/>
      <path d="M14 30 Q28 36 42 30 M13 40 Q28 46 43 40" fill="none" stroke="${C.red}" stroke-width="2.2"/>
      <path d="M18 34 l3 3 l3 -3 l3 3 l3 -3 l3 3 l3 -3" fill="none" stroke="${C.red}" stroke-width="1.6"/>
      <path d="M22 16 Q28 12 34 16" fill="none" ${st(1.6)}/>` + idol(50, 40, .62),
    workshop2: shadow(28) + `
      <path d="M30 52 Q30 26 46 24 Q62 26 62 52Z" fill="${C.mudD}" ${st()}/>
      <path d="M40 52 Q40 40 46 40 Q52 40 52 52Z" fill="${C.dark}" ${st(1.4)}/>` + flame(46, 47, .9) + smoke(46, 20) +
      pithos(16, 40, .78, C.white) + `<path d="M8 40 Q16 43 24 40" fill="none" stroke="${C.red}" stroke-width="1.6"/>` + idol(28, 44, .45),

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
      <circle cx="46" cy="55" r="2.4" fill="${C.dark}"/><circle cx="56" cy="55" r="2.4" fill="${C.dark}"/>`,
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
    scribe1: shadow(24) + tablet(22, 36, 1) + tablet(40, 38, 1.05) + `
      <rect x="48" y="44" width="8" height="12" rx="3" fill="${C.stone}" ${st(1.3)}/>
      <path d="M50 47 l4 0 M50 51 l4 0" stroke="${C.stoneD}" stroke-width="1.2"/>`,
    scribe2: shadow(28) + `
      <rect x="8" y="20" width="36" height="34" fill="${C.plaster}" ${st()}/>
      <rect x="6" y="15" width="40" height="6" fill="${C.woodD}" ${st()}/>
      <rect x="20" y="38" width="10" height="16" fill="${C.dark}" ${st(1.3)}/>
      <rect x="12" y="26" width="7" height="7" fill="${C.dark}" ${st(1.2)}/><rect x="31" y="26" width="7" height="7" fill="${C.dark}" ${st(1.2)}/>` +
      tablet(52, 42, .8),
  };

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
    sp_souskiou: shadow(18) + `<rect x="18" y="44" width="28" height="10" fill="${C.stone}" ${st()}/>` + idol(32, 30, 1.2),
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
    cheese: `<path d="M8 30 L40 14 L58 26 L58 44 L24 58 L8 46Z" fill="${C.white}" ${st(2)}/>
      <path d="M8 30 L24 40 L58 26 M24 40 L24 58" fill="none" ${st(2)}/>
      <path d="M30 34 l14 -7 M34 40 l12 -6" stroke="#c9b48c" stroke-width="2.4"/>`,
    goods: `<path d="M24 8 L40 8 L41 14 Q54 22 52 38 Q50 52 40 58 L24 58 Q14 52 12 38 Q10 22 23 14Z" fill="${C.white}" ${st(2)}/>
      <path d="M14 28 Q32 36 50 28 M13 42 Q32 50 51 42" fill="none" stroke="${C.red}" stroke-width="3"/>`,
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

  const ALL = Object.assign({}, B, S, T);
  const wrap = (inner, cls) => `<svg class="ico ${cls || ''}" viewBox="0 0 64 64" aria-hidden="true">${inner}</svg>`;

  return {
    has: k => !!ALL[k],
    svg: (k, cls) => ALL[k] ? wrap(ALL[k], cls) : '',
    res: (k, cls) => R[k] ? wrap(R[k], 'res-ico ' + (cls || '')) : (k === 'logos' ? '<b class="lg">λ</b>' : ''),
  };
})();
