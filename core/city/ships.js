'use strict';
// ============================================================
//  Корабли (эллинский Кипр): после знания «Корабли в Пирей» в гавань время от времени приходит корабль.
//  Он просит пакет товаров и даёт за него папирус; то же можно купить за монеты — впятеро дороже.
//  Не отгрузили — корабль уходит без штрафа. Числа — BALANCE.ships; тексты — content/ru.
//  state.ship: null | { pack, want: { ресурс: сколько }, give, left } — корабль у причала и сколько секунд он ещё ждёт;
//  state.timers.ship — сколько секунд игры до следующего корабля.
// ============================================================

Object.assign(Game, {
  /** Ходят ли корабли: знание изучено и есть хоть одна гавань. */
  shipsOpen() { return this.hasTech('piraeus') && this.state.buildings.some(b => b.type === 'port'); },
  nextShipIn() { const [a, b] = BALANCE.ships.every; return rand(a, b); },

  /** Такт кораблей (из events): корабль ждёт и уходит, следующий — приходит. Возвращает true, если что-то поменялось на карте. */
  shipTick(dt) {
    const s = this.state;
    if (!this.shipsOpen()) { if (s.ship) { s.ship = null; return true; } return false; }
    if (s.ship) {
      s.ship.left -= dt;
      if (s.ship.left > 0) return false;
      this.log('shipGone', { pack: s.ship.pack });
      s.ship = null; s.timers.ship = this.nextShipIn();
      return true;
    }
    if (s.timers.ship == null) s.timers.ship = this.nextShipIn();
    s.timers.ship -= dt;
    if (s.timers.ship > 0) return false;
    const packs = BALANCE.ships.packs, P = packs[Math.floor(Math.random() * packs.length)];
    s.ship = { pack: P.id, want: this.liveCost(P.want), give: { ...BALANCE.ships.give }, left: BALANCE.ships.wait };
    s.timers.ship = null;
    this.log('shipCame', { pack: P.id, want: s.ship.want, give: s.ship.give });
    Bus.emit('ship', s.ship);
    return true;
  },

  /** Корабль у причала: { ship, ok, reason (чего не хватает для отгрузки), buy: { cost, ok, reason } } или null. */
  shipStatus() {
    const ship = this.state.ship;
    if (!ship) return null;
    const reason = this.lackReason(ship.want, 0), cost = this.liveCost(BALANCE.ships.buy), buyReason = this.lackReason(cost, 0);
    return { ship, ok: !reason, reason, buy: { cost, ok: !buyReason, reason: buyReason } };
  },
  /** Корабль ушёл с товаром или с монетами: привезённое — на склад, следующий — через nextShipIn. */
  shipDone(how, cost) {
    const s = this.state, ship = s.ship, cap = this.storageCap(), got = [];
    this.pay(cost, 0);
    for (const [k, v] of Object.entries(ship.give)) { const g = Math.floor(Math.min(v, cap - (s.res[k] || 0))); s.res[k] = (s.res[k] || 0) + g; got.push([k, g]); }
    s.stats.ships = (s.stats.ships || 0) + 1;
    this.log('shipLoaded', { pack: ship.pack, how, got });
    s.ship = null; s.timers.ship = this.nextShipIn();
    this.save();
    return { how, got };
  },
  /** Отгрузить пакет: товар уходит, папирус приходит. */
  shipLoad() {
    const st = this.shipStatus();
    return st && st.ok ? this.shipDone('load', st.ship.want) : null;
  },
  /** Купить привезённое за монеты (впятеро дороже, чем товаром). */
  shipBuy() {
    const st = this.shipStatus();
    return st && st.buy.ok ? this.shipDone('buy', st.buy.cost) : null;
  },
  /** Отпустить корабль без груза: без штрафа, следующий придёт как обычно. */
  shipDismiss() {
    const s = this.state;
    if (!s.ship) return false;
    this.log('shipGone', { pack: s.ship.pack });
    s.ship = null; s.timers.ship = this.nextShipIn();
    this.save();
    return true;
  },
  /** Где на карте стоит корабль: клетка моря рядом с первой гаванью (или null). */
  shipSpot() {
    if (!this.state.ship) return null;
    for (const b of this.state.buildings) {
      if (b.type !== 'port') continue;
      for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        const t = this.tile(b.x + dx, b.y + dy);
        if (t && t.t === 'sea') return { x: t.x, y: t.y };
      }
    }
    return null;
  },
  /** Сколько секунд корабль ещё ждёт (null — корабля нет). */
  shipLeft() { return this.state.ship ? Math.max(0, this.state.ship.left) : null; },
});
