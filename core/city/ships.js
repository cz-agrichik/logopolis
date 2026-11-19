'use strict';
// ============================================================
//  Корабли (эллинский Кипр): после знания «Корабли в Пирей» в гавань приходит купеческий корабль —
//  через BALANCE.ships.every секунд после того, как ушёл прежний (Новый Пафос, Сараи Китиона и «Помпей и пираты» — каждый на минуту раньше;
//  время идёт и без игрока).
//  Корабль ждёт сколько угодно. Он просит один пакет груза (Гавань Нового Пафоса и Корабельные сараи Китиона — ещё по грузу на выбор);
//  за пакет даёт 10 папируса, те же 10 папируса можно купить за монеты (с Дворцом Вуни — дешевле). Сделок за стоянку —
//  до BALANCE.ships.deals (с чудесами — больше); последняя сделка — и корабль отчаливает сам, раньше — по кнопке «Отправление».
//  Числа — BALANCE.ships; тексты — content/ru.
//  state.ship: null | { pack, want: { ресурс: сколько }, alts?: [{ pack, want }], give, deals } — корабль у причала
//  (alts — ещё грузы на выбор; в старых сохранениях — alt, один; deals — сколько сделок уже сделано);
//  state.timers.ship — сколько секунд до следующего.
// ============================================================

Object.assign(Game, {
  /** Ходят ли корабли: знание изучено и есть хоть одна гавань. */
  shipsOpen() { return this.hasTech('piraeus') && this.state.buildings.some(b => b.type === 'port'); },
  /** Правила стоянки: { every, deals, choice, buy } — через сколько секунд приходит корабль, сколько сделок, из скольких грузов
   *  выбрать и сколько стоят 10 листов монетами (чудеса с effect.ships: срок и цена — свои, сделки и грузы — сверх базовых). */
  shipRules() {
    const S = BALANCE.ships, w = (this.fx || this.effects()).ships || {};
    return { every: Math.max(60, Math.min(S.every, w.every || Infinity) - (w.faster || 0)), deals: S.deals + (w.deals || 0), choice: Math.min(S.packs.length, 1 + (w.choice || 0)),
      buy: w.buy ? { silver: Math.min(S.buy.silver, w.buy) } : S.buy };
  },
  /** Все грузы стоянки: [{ pack, want }] — первый и те, что на выбор. */
  shipOffers(ship = this.state.ship) {
    if (!ship) return [];
    return [{ pack: ship.pack, want: ship.want }, ...(ship.alts || (ship.alt ? [ship.alt] : []))];
  },
  nextShipIn() { return this.shipRules().every; },

  /** Корабль приходит: один случайный груз, а при выборе — несколько разных. */
  shipArrive() {
    const s = this.state, R = this.shipRules(), packs = BALANCE.ships.packs.slice();
    const pick = () => packs.splice(Math.floor(Math.random() * packs.length), 1)[0];
    const P = pick(), more = Array.from({ length: R.choice - 1 }, pick);
    s.ship = { pack: P.id, want: this.liveCost(P.want), give: { ...BALANCE.ships.give }, deals: 0 };
    if (more.length) s.ship.alts = more.map(Q => ({ pack: Q.id, want: this.liveCost(Q.want) }));
    s.timers.ship = null;
    this.log('shipCame', { pack: P.id, want: s.ship.want, give: s.ship.give, alt: more.map(Q => Q.id) });
    Bus.emit('ship', s.ship);
  },
  /** Такт кораблей (из events и catchUp): корабль у причала ждёт, следующий — приходит в срок. Возвращает true, если что-то поменялось на карте. */
  shipTick(dt) {
    const s = this.state;
    if (!this.shipsOpen()) { if (s.ship) { s.ship = null; return true; } return false; }
    if (s.ship) return false;
    if (s.timers.ship == null) s.timers.ship = this.nextShipIn();
    s.timers.ship -= dt;
    if (s.timers.ship > 0) return false;
    this.shipArrive();
    return true;
  },

  /** Корабль у причала: { ship, deals: { done, max, left }, offers: [{ pack, want, ok, reason }] (первый — главный груз),
   *  ok, reason (главный груз: чего не хватает для отгрузки), any (хоть одна сделка возможна), buy: { cost, ok, reason } } или null. */
  shipStatus() {
    const s = this.state, ship = s.ship;
    if (!ship) return null;
    const R = this.shipRules(), max = R.deals, deals = { done: ship.deals || 0, max, left: Math.max(0, max - (ship.deals || 0)) };
    const full = Object.keys(ship.give).every(k => (s.res[k] || 0) >= this.storageCap()) ? { code: 'shipFull' } : null;
    const why = cost => full || this.lackReason(cost, 0);
    const offers = this.shipOffers(ship).map(o => { const reason = why(o.want); return { pack: o.pack, want: o.want, ok: !reason, reason }; });
    const cost = this.liveCost(R.buy), buyReason = why(cost);
    return { ship, deals, offers, ok: offers[0].ok, reason: offers[0].reason, any: offers.some(o => o.ok) || !buyReason, buy: { cost, ok: !buyReason, reason: buyReason } };
  },
  /** Сделка: заплатить грузом или монетами, получить папирус. Последняя сделка — корабль отчаливает сам. */
  shipDeal(how, cost, pack) {
    const s = this.state, ship = s.ship, cap = this.storageCap(), got = [];
    this.pay(cost, 0);
    for (const [k, v] of Object.entries(ship.give)) { const g = Math.floor(Math.min(v, cap - (s.res[k] || 0))); s.res[k] = (s.res[k] || 0) + g; got.push([k, g]); }
    ship.deals = (ship.deals || 0) + 1;
    s.stats.ships = (s.stats.ships || 0) + 1;
    this.log('shipLoaded', { pack, how, got });
    const left = this.shipRules().deals - ship.deals, sailed = left <= 0;
    if (sailed) this.shipDepart();
    else this.save();
    return { how, got, pack, left: Math.max(0, left), sailed };
  },
  /** Отгрузить груз i (0 — главный, 1… — на выбор; true — второй): товар уходит, папирус приходит. */
  shipLoad(i = 0) {
    const st = this.shipStatus(), o = st && st.offers[+i];
    return o && o.ok ? this.shipDeal('load', o.want, o.pack) : null;
  },
  /** Купить папирус у кормчего за монеты. */
  shipBuy() {
    const st = this.shipStatus();
    return st && st.buy.ok ? this.shipDeal('buy', st.buy.cost, st.ship.pack) : null;
  },
  /** «Отправление»: корабль уходит (без сделок — без штрафа), следующий придёт через shipRules().every. */
  shipDepart() {
    const s = this.state;
    if (!s.ship) return false;
    const deals = s.ship.deals || 0;
    this.log(deals ? 'shipSailed' : 'shipGone', { pack: s.ship.pack, deals });
    s.ship = null; s.timers.ship = this.nextShipIn();
    this.save();
    return true;
  },
  /** Где на карте стоит корабль: клетка моря рядом с гаванью (или с морским чудом — Гаванью Нового Пафоса, Сараями Китиона), или null. */
  shipSpot() {
    if (!this.state.ship) return null;
    for (const b of this.state.buildings) {
      const B = BUILDINGS[b.type];
      if (b.type !== 'port' && !(B.coast && (B.effect || {}).ships)) continue;
      for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        const t = this.tile(b.x + dx, b.y + dy);
        if (t && t.t === 'sea') return { x: t.x, y: t.y };
      }
    }
    return null;
  },
  /** Через сколько секунд придёт следующий корабль; null — корабли не ходят или корабль уже у причала. */
  shipIn() { const s = this.state; return this.shipsOpen() && !s.ship && s.timers.ship != null ? Math.max(0, s.timers.ship) : null; },
});
