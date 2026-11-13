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
    forge: 'foundry',   // кузница пока в облике литейни — свои рисунки железного века впереди
  },

  /** Стадия облика: меняется на уровнях мудрости 3, 5, 7, 9. */
  stage(level) { return level >= 9 ? 4 : level >= 7 ? 3 : level >= 5 ? 2 : level >= 3 ? 1 : 0; },

  /** Рисунки здания в эпохе: простой, нарядный и лучший. */
  arts(type, epoch = Game.state.epoch) {
    const B = BUILDINGS[type], p = this.ART[type];
    if (B.epoch === 0) return epoch >= 1 ? [p + '2', p + '3', p + '3'] : [p + '0', p + '1', p + '1'];
    return [p + '0', p + '1', p + '2'];   // здания бронзового и железного века (железный век пока в облике бронзового)
  },

  /**
   * Ключи рисунков здания. Облик резко меняется с ЭПОХОЙ (хижина → дом из сырцового кирпича),
   * а внутри эпохи — на КАЖДОМ уровне мудрости:
   *   1–2: простой (поменьше) · 3: нарядный · 5: рядом вторая постройка · 7: третья · 9: всё лучшее.
   */
  icons(type, level = 1, epoch = Game.state.epoch) {
    const B = BUILDINGS[type];
    if (B.special) return [type];
    if (!this.ART[type]) return [];
    const [base, fancy, top] = this.arts(type, epoch);
    if (level >= 9) return [top, fancy, fancy];
    if (level >= 7) return [fancy, base, base];
    if (level >= 5) return [fancy, base];
    if (level >= 3) return [fancy];
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
