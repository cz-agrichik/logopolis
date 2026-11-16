'use strict';
// ============================================================
//  Каталог для интерфейсов: числа из core/defs.js + тексты из content/ru/lexicon.js.
//  Интерфейс читает отсюда всё сразу (Cat.bld.house.name и Cat.bld.house.cost),
//  а ядро работает только с числами и ничего не знает о текстах.
// ============================================================

const Cat = (() => {
  const m = (a, b) => Object.assign({}, a, b);
  const res = {};
  for (const k of RES_KEYS) res[k] = m(RES[k], Lex.res[k]);
  const terrain = {};
  for (const k of Object.keys(TERRAIN)) terrain[k] = m(TERRAIN[k], Lex.terrain[k]);
  const epochs = EPOCHS.map((E, i) => m(E, Lex.epochs[i]));
  const bld = {};
  for (const [id, B] of Object.entries(BUILDINGS)) {
    const T = Lex.bld[id], b = m(B, T);
    if (B.forms) b.forms = B.forms.map((f, i) => f ? m(f, T.forms[i]) : null);
    bld[id] = b;
  }
  const techs = TECHS.map(t => m(t, Lex.tech[t.id]));
  const rites = RITUALS.map(r => m(r, Lex.rite[r.id]));
  // «Своя монета»: серебро зовётся монетами, значок — монета с лежащим бараном. Ключ ресурса прежний (silver):
  // запасы, цены и дань не меняются, меняется только то, как ресурс называется и рисуется.
  const coined = () => !!(typeof Game !== 'undefined' && Game.state && Game.hasTech(BALANCE.coinTech));
  for (const o of [Lex.res.silver, res.silver]) {
    const base = { name: o.name, icon: o.icon };
    for (const f of ['name', 'icon']) Object.defineProperty(o, f, { get: () => (coined() ? Lex.res.silver.coin : base)[f], enumerable: true, configurable: true });
  }
  Art.resKey = k => k === 'silver' && coined() ? 'coin' : k;
  const byId = list => Object.fromEntries(list.map(x => [x.id, x]));
  const merge = (nums, texts) => Object.fromEntries(Object.entries(nums).map(([k, v]) => [k, m(v, texts[k])]));
  return {
    res, terrain, epochs, bld, techs, tech: byId(techs), rites, rite: byId(rites),
    appetites: merge(APPETITES, Lex.appetite),
    tasks: merge(TASK_REWARDS, Lex.task),
    plans: merge(LEARN_PLANS, Lex.plan),
    lords: Lex.lords,
    ship: Lex.ship,
    /** Облик здания в эпохе: { name, icon, capBonus }. */
    form(type, epoch = Game.state.epoch) {
      const B = bld[type];
      if (B.special) return { name: B.name, icon: B.icon };
      for (let e = Math.min(epoch, B.forms.length - 1); e >= 0; e--) if (B.forms[e]) return B.forms[e];
      return B.forms.find(Boolean);
    },
  };
})();
