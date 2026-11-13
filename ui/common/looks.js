'use strict';
// ============================================================
//  Облик: какой рисунок из assets/art.js показывать для здания,
//  знания или обряда. Общее для всех HTML-интерфейсов.
// ============================================================

const Looks = {
  /** Префикс рисунков здания: рисунки называются <префикс>0, 1, 2… в порядке появления. */
  ART: {
    house: 'house', field: 'field', goatpen: 'goatpen', lumber: 'lumber', quarry: 'quarry',
    workshop: 'workshop', storehouse: 'store', mine: 'mine', port: 'port', foundry: 'foundry', scribe: 'scribe',
    vineyard: 'vineyard', olivegrove: 'olivegrove', forge: 'forge',
  },

  /** Стадия облика для цвета значка уровня: 3, 5, 7, 9. */
  stage(level) { return level >= 9 ? 4 : level >= 7 ? 3 : level >= 5 ? 2 : level >= 3 ? 1 : 0; },

  /**
   * Облики здания в эпохе: [{ from, icons, form }] — с какого уровня, какие рисунки (первый — главный,
   * второй — поменьше рядом), облик какой эпохи (form: от неё и название).
   * Каждая эпоха рисует только свои верхние уровни, нижние берёт у прошлых:
   *   здание медного века — 1, 3: медный облик; 5: в медном веке оба медных рисунка, позже — бронзовый;
   *     7: бронзовый нарядный; 9: в бронзовом веке оба бронзовых, в железном — железный; 11: оба железных;
   *   здание бронзового века — 1, 3, 5 (оба), 7, 9 (оба); в железном веке 9 и 11 — железные;
   *   здание железного века — 1, 5, 9 и 11 (оба последних).
   * Нет рисунков следующей эпохи (козий загон уходит с «Виноградарством») — остаётся лучший прошлый облик.
   */
  looks(type, epoch = Game.state.epoch) {
    const B = BUILDINGS[type], p = this.ART[type], k = i => p + i, has = i => Art.has(k(i));
    const L = (from, icons, form) => ({ from, icons: icons.map(k), form });
    if (B.epoch === 0) {
      const out = [L(1, [0], 0), L(3, [1], 0)];
      if (epoch === 0) return out.concat(L(5, [1, 0], 0));
      out.push(L(5, [2], 1), L(7, [3], 1));
      return out.concat(epoch >= 2 && has(4) ? [L(9, [4], 2), L(11, [5, 4], 2)] : [L(9, [3, 2], 1)]);
    }
    if (B.epoch === 1) {
      const out = [L(1, [0], 1), L(3, [1], 1), L(5, [1, 0], 1), L(7, [2], 1)];
      return out.concat(epoch >= 2 && has(3) ? [L(9, [3], 2), L(11, [4, 3], 2)] : [L(9, [2, 1], 1)]);
    }
    return [L(1, [0], 2), L(5, [1], 2), L(9, [2], 2), L(11, [2, 1], 2)];
  },
  /** Облик здания на уровне: { from, icons, form }. */
  look(type, level = 1, epoch = Game.state.epoch) {
    const L = this.looks(type, epoch);
    return L.filter(x => x.from <= level).pop() || L[0];
  },
  /** Ключи рисунков здания на уровне (у чуда — его рисунок). */
  icons(type, level = 1, epoch = Game.state.epoch) {
    const B = BUILDINGS[type];
    if (B.special) return [type];
    if (!this.ART[type]) return [];
    return this.look(type, level, epoch).icons;
  },
  /** Смена обликов по всем открытым эпохам: [{ form, from, epoch }] — с какого уровня и в какой эпохе впервые появляется
   *  облик (а с ним и название) эпохи form. Для справки: «Круглая хижина — сначала; Дом из сырцового кирпича — с 5-го…». */
  formsByLevel(type) {
    const B = Cat.bld[type], open = Cat.epochs.filter(E => !E.locked).length, seen = new Set(), out = [];
    if (B.special || !B.forms || !this.ART[type]) return out;
    for (let e = B.epoch; e < open; e++) for (const x of this.looks(type, e)) {
      if (!B.forms[x.form] || seen.has(x.form) || x.from > Cat.epochs[e].maxLevel) continue;
      seen.add(x.form);
      out.push({ form: x.form, from: x.from, epoch: e });
    }
    return out;
  },
  /** Название здания на уровне — по облику: у хижины 1-го уровня и в бронзовом веке медное имя. */
  name(type, level = 1, epoch = Game.state.epoch) {
    const B = Cat.bld[type];
    if (B.special || !B.forms || !this.ART[type]) return Cat.form(type, epoch).name;
    const f = B.forms[this.look(type, level, epoch).form];
    return f ? f.name : Cat.form(type, epoch).name;
  },
  /** Сменился ли облик при переходе на level. */
  newLook(type, level, epoch = Game.state.epoch) {
    return this.icons(type, level, epoch).join() !== this.icons(type, level - 1, epoch).join();
  },

  /** Медальон знания и обряда. */
  techIcon(T) { return Art.svg('t_' + T.id); },
  riteIcon(R) { const k = 'r_' + R.id; return Art.has(k) ? Art.svg(k) : Lex.rite[R.id].icon; },
};
