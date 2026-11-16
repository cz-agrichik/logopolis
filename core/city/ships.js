'use strict';
// ============================================================
//  Корабли (эллинский Кипр): после знания «Корабли в Пирей» в гавань время от времени приходит корабль.
//  Он просит пакет товаров и даёт за него папирус; то же можно купить за монеты — впятеро дороже.
//  Не отгрузили — корабль уходит без штрафа. Числа — BALANCE.ships; тексты — content/ru.
//  Чаще корабли ходят к гаваням 13-го уровня (BALANCE.ships.portLevel) и при чуде с effect.ships
//  (Гавань Нового Пафоса: вдвое чаще, ждут дольше, выбор из двух грузов).
//  state.ship: null | { pack, want: { ресурс: сколько }, alt?: { pack, want }, give, left } — корабль у причала
//  (alt — второй груз на выбор) и сколько секунд он ещё ждёт; state.timers.ship — сколько секунд игры до следующего.
// ============================================================

Object.assign(Game, {
  /** Ходят ли корабли: знание изучено и есть хоть одна гавань. */
  shipsOpen() { return this.hasTech('piraeus') && this.state.buildings.some(b => b.type === 'port'); },
  /** Корабли чудес: { every, wait, choice } — множитель промежутка, сколько ждут, из скольких грузов выбрать. */
  shipRules() {
    const S = BALANCE.ships, w = (this.fx || this.effects()).ships || {};
    const ports = this.state.buildings.filter(b => b.type === 'port' && b.level >= S.portLevel).length;
    const portMult = Math.max(S.portMin, 1 - S.portCut * ports);
    return { every: portMult * (w.every || 1), wait: w.wait || S.wait, choice: w.choice || 1, ports, portMult };
  },
  nextShipIn() { const [a, b] = BALANCE.ships.every; return rand(a, b) * this.shipRules().every; },

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
    // грузы: один случайный, а при выборе — два разных
    const R = this.shipRules(), packs = BALANCE.ships.packs.slice(), pick = () => packs.splice(Math.floor(Math.random() * packs.length), 1)[0];
    const P = pick(), Q = R.choice > 1 ? pick() : null;
    s.ship = { pack: P.id, want: this.liveCost(P.want), give: { ...BALANCE.ships.give }, left: R.wait };
    if (Q) s.ship.alt = { pack: Q.id, want: this.liveCost(Q.want) };
    s.timers.ship = null;
    this.log('shipCame', { pack: P.id, want: s.ship.want, give: s.ship.give, alt: Q ? Q.id : null });
    Bus.emit('ship', s.ship);
    return true;
  },

  /** Корабль у причала: { ship, ok, reason (чего не хватает для отгрузки), alt: { ok, reason } | null, buy: { cost, ok, reason } } или null. */
  shipStatus() {
    const ship = this.state.ship;
    if (!ship) return null;
    const reason = this.lackReason(ship.want, 0), cost = this.liveCost(BALANCE.ships.buy), buyReason = this.lackReason(cost, 0);
    const altReason = ship.alt ? this.lackReason(ship.alt.want, 0) : null;
    return { ship, ok: !reason, reason, alt: ship.alt ? { ok: !altReason, reason: altReason } : null, buy: { cost, ok: !buyReason, reason: buyReason } };
  },
  /** Корабль ушёл с товаром или с монетами: привезённое — на склад, следующий — через nextShipIn. */
  shipDone(how, cost, pack) {
    const s = this.state, ship = s.ship, cap = this.storageCap(), got = [];
    this.pay(cost, 0);
    for (const [k, v] of Object.entries(ship.give)) { const g = Math.floor(Math.min(v, cap - (s.res[k] || 0))); s.res[k] = (s.res[k] || 0) + g; got.push([k, g]); }
    s.stats.ships = (s.stats.ships || 0) + 1;
    this.log('shipLoaded', { pack, how, got });
    s.ship = null; s.timers.ship = this.nextShipIn();
    this.save();
    return { how, got, pack };
  },
  /** Отгрузить груз (alt — второй, если корабль дал выбор): товар уходит, папирус приходит. */
  shipLoad(alt = false) {
    const st = this.shipStatus();
    if (!st) return null;
    if (alt) return st.alt && st.alt.ok ? this.shipDone('load', st.ship.alt.want, st.ship.alt.pack) : null;
    return st.ok ? this.shipDone('load', st.ship.want, st.ship.pack) : null;
  },
  /** Купить привезённое за монеты (впятеро дороже, чем товаром). */
  shipBuy() {
    const st = this.shipStatus();
    return st && st.buy.ok ? this.shipDone('buy', st.buy.cost, st.ship.pack) : null;
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
  /** Где на карте стоит корабль: клетка моря рядом с гаванью (или с Гаванью Нового Пафоса), или null. */
  shipSpot() {
    if (!this.state.ship) return null;
    for (const b of this.state.buildings) {
      if (b.type !== 'port' && !(BUILDINGS[b.type].effect || {}).ships) continue;
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
