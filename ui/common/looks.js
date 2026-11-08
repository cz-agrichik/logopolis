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

  /** Рисунки здания в эпохе: простой, нарядный и лучший. */
  arts(type, epoch = Game.state.epoch) {
    const B = BUILDINGS[type], p = this.ART[type];
    if (B.epoch === 0) return epoch >= 1 ? [p + '2', p + '3', p + '3'] : [p + '0', p + '1', p + '1'];
    return [p + '0', p + '1', p + '2'];
  },

  /**
   * Ключи рисунков здания. Облик резко меняется с ЭПОХОЙ (хижина → дом из сырцового кирпича),
   * а внутри эпохи — на КАЖДОМ уровне мудрости:
   *   1–3: простой (поменьше) · 4: нарядный · 6: рядом вторая постройка · 8: третья · 10: всё лучшее.
   */
  icons(type, level = 1, epoch = Game.state.epoch) {
    const B = BUILDINGS[type];
    if (B.special) return [type];
    if (!this.ART[type]) return [];
    const [base, fancy, top] = this.arts(type, epoch);
    if (level >= 10) return [top, fancy, fancy];
    if (level >= 8) return [fancy, base, base];
    if (level >= 6) return [fancy, base];
    if (level >= 4) return [fancy];
    return [base];
  },
  /** Сменился ли облик при переходе на level. */
  newLook(type, level, epoch = Game.state.epoch) {
    return this.icons(type, level, epoch).join() !== this.icons(type, level - 1, epoch).join();
  },

  /** Медальон знания и обряда. */
  techIcon(T) { return Art.svg('t_' + T.id); },
  riteIcon(R) { const k = 'r_' + R.id; return Art.has(k) ? Art.svg(k) : Lex.rite[R.id].icon; },
};
