'use strict';
// ============================================================
//  Облик: какой рисунок из assets/art.js показывать для здания,
//  знания или обряда. Общее для всех HTML-интерфейсов.
// ============================================================

const Looks = {
  /** Префикс рисунков здания: рисунки называются <префикс>0..3. */
  ART: {
    house: 'house', field: 'field', goatpen: 'goatpen', lumber: 'lumber', quarry: 'quarry',
    workshop: 'workshop', storehouse: 'store', mine: 'mine', port: 'port', foundry: 'foundry', scribe: 'scribe',
  },

  /** Стадия облика: меняется на «λ-уровнях» 4, 6, 8, 10. */
  stage(level) { return level >= 10 ? 4 : level >= 8 ? 3 : level >= 6 ? 2 : level >= 4 ? 1 : 0; },

  /**
   * Ключи рисунков здания. Облик резко меняется с ЭПОХОЙ (хижина → дом из сырцового кирпича)
   * и заметно — на 4-м уровне; на 8-м и 10-м рядом вырастают ещё постройки.
   */
  icons(type, level = 1, epoch = Game.state.epoch) {
    const B = BUILDINGS[type];
    if (B.special) return [type];
    const p = this.ART[type];
    if (!p) return [];
    let main, minor;
    if (B.epoch === 0 && epoch >= 1) { main = p + (level >= 4 ? '3' : '2'); minor = p + '2'; }   // бронзовый век
    else if (B.epoch === 0) { main = p + (level >= 4 ? '1' : '0'); minor = p + '0'; } // медный век
    else { main = p + (level >= 10 ? '2' : level >= 6 ? '1' : '0'); minor = p + '0'; } // здания бронзового века
    const n = level >= 10 ? 3 : level >= 8 ? 2 : 1;
    return [main, minor, minor].slice(0, n);
  },
  /** Сменился ли облик при переходе на level. */
  newLook(type, level, epoch = Game.state.epoch) {
    return this.icons(type, level, epoch).join() !== this.icons(type, level - 1, epoch).join();
  },

  /** Медальон знания и обряда. */
  techIcon(T) { return Art.svg('t_' + T.id); },
  riteIcon(R) { const k = 'r_' + R.id; return Art.has(k) ? Art.svg(k) : Lex.rite[R.id].icon; },
};
