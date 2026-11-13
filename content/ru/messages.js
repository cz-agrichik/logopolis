'use strict';
// ============================================================
//  Русские шаблоны сообщений. Ядро сообщает коды и параметры
//  (причины «нельзя», записи летописи, итоги обрядов, требования эпохи),
//  а здесь они превращаются в текст — одинаково для всех интерфейсов.
// ============================================================

/** Русское множественное число: plural(5, 'слово', 'слова', 'слов'). */
const plural = (n, one, few, many) => { const a = Math.abs(n) % 100, b = a % 10; return a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many; };

/** «5 мин», «3 ч», «2 дн». */
function fmtDur(ms) {
  const m = Math.round(ms / 60000);
  if (m < 60) return `${Math.max(1, m)} мин`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} ч`;
  return `${Math.round(h / 24)} дн`;
}

/** Сколько ждать: «45 с», «12 мин», «3 ч 20 мин». */
function fmtWait(sec) {
  sec = Math.ceil(sec);
  if (sec < 60) return `${sec} с`;
  const m = Math.ceil(sec / 60);
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60), mm = m % 60;
  return mm ? `${h} ч ${mm} мин` : `${h} ч`;
}

const Msg = {
  /** Название облика здания в эпохе (если облика для эпохи нет — ближайший предыдущий). */
  formName(type, epoch) {
    const B = Lex.bld[type], f = B.forms;
    if (!f) return B.name;
    for (let e = Math.min(epoch, f.length - 1); e >= 0; e--) if (f[e]) return f[e].name;
    return f.find(Boolean).name;
  },
  /** Дань железного века одной строкой: итог Game.raid или запись летописи. list = false — без списка потерь (его покажут фишками). */
  tributeLine(p, list = true) {
    const L = Lex.lords[p.lord || 'assyria'], tail = list && p.lost && p.lost.length ? ': ' + this.resList(p.lost, '−') : '';
    if (p.due == null) return `${L.icon} Сборщики дани ${L.of} забрали ${Math.round(p.pct * 100)}% запасов${p.halved ? ' (стены уменьшили дань вдвое)' : ''}${tail}`;
    if (!p.short) return `${L.icon} Дань ${L.to} уплачена: ${Lex.res.silver.icon} −${p.paid}`;
    if (p.lord === 'egypt') return `${L.icon} Дань ${L.to}: серебра не хватило (${p.paid} из ${p.due}) — недостающее добрали грабежом, ${Math.round(p.pct * 100)}% запасов${p.halved ? ' (стены — вдвое)' : ''}${tail}`;
    return `${L.icon} Дань ${L.to}: не хватило ${p.short} серебра — недоимку взяли запасами по ценнику${tail}`;
  },
  /** [[ресурс, сколько]] → «🌾 +30 🪵 +12». */
  resList(list, sign = '+') { return (list || []).map(([k, v]) => `${Lex.res[k].icon} ${sign}${v}`).join(' '); },

  /** Почему нельзя (построить, изучить, провести обряд, улучшить). */
  reason(r) {
    if (!r) return '';
    if (typeof r === 'string') return r;
    switch (r.code) {
      case 'needTech': return `Нужно знание «${Lex.tech[r.tech].name}»`;
      case 'builtAlready': return 'Уже построено';
      case 'maxCount': return `Не больше ${r.max}`;
      case 'overStorage': return `Цена ${r.res.map(k => Lex.res[k].icon).join('')} больше вместимости складов (${r.cap}) — постройте или улучшите склад`;
      case 'lack': return `Не хватает: ${r.items.map(([k, d]) => `${Lex.res[k].icon} ${d}`).concat(r.logos ? [`λ ${r.logos}`] : []).join(', ')}`;
      case 'levelCap': return r.next != null ? `Предел ${r.max}-го уровня в этой эпохе. В эпоху «${Lex.epochs[r.next].name}» — до ${r.nextMax}-го.` : `Максимальный уровень — ${r.max}.`;
      case 'needFirst': return 'Сначала: ' + r.techs.map(id => `«${Lex.tech[id].name}»`).join(', ');
      case 'needBuilding': return `Нужно: ${Lex.bld[r.type].name}`;
      case 'cooldown': return `Можно снова через ${fmtWait(r.sec)}`;
      case 'buffsFull': return `Одновременно — не больше ${r.max} благословений`;
    }
    return r.code;
  },

  /** Итог обряда: прибавка ресурсов, жители или сколько минут длится благословение. */
  riteResult(res) {
    if (!res) return '';
    if (res.gains) return this.resList(res.gains) || 'склады полны';
    if (res.pop != null) return `👥 +${res.pop}`;
    if (res.minutes != null) return `${res.minutes} мин`;
    return '';
  },
  goatLine(roll) { return Lex.goatLines[Math.floor(roll * Lex.goatLines.length)]; },
  maenadLine(roll) { return Lex.maenadLines[Math.floor(roll * Lex.maenadLines.length)]; },
  /** Предупреждение о чуде эпохи: во что оно превратится. r — BUILDINGS[тип].retire. */
  retireNote(r) {
    return `Чудо эпохи: в эпоху «${Lex.epochs[r.epoch].name}» оно станет обычным зданием — «${this.formName(r.into, r.epoch)}» ${r.level}-го уровня. Бонус чуда тогда пропадёт.`;
  },
  /** Что стало с чудом эпохи: «Большой круглый дом Лембы» → дом из сырцового кирпича 5-го уровня. */
  retiredLine(from, into, level, epoch) { return `«${Lex.bld[from].name}» теперь — ${this.formName(into, epoch).toLowerCase()} ${level}-го уровня`; },

  /** Запись летописи. ctx.newLook(type, level, epoch) — интерфейс подсказывает, сменился ли облик;
   *  ctx.name(type, level, epoch) — название облика на этом уровне (без него — по эпохе). */
  log(e, ctx = {}) {
    if (e.msg != null) return e.msg;   // записи из старых сохранений — готовым текстом
    const p = e.p || {};
    const nm = (type, level, epoch) => ctx.name && level ? ctx.name(type, level, epoch) : this.formName(type, epoch);
    switch (e.k) {
      case 'built': return `Построено: ${nm(p.type, 1, p.epoch)}`;
      case 'wonderBuilt': return `✨ Возведено чудо Кипра: ${Lex.bld[p.type].name}!`;
      case 'stashBack': return `✨ ${Lex.bld[p.type].name}: снова в городе`;
      case 'stashed': return `📦 ${Lex.bld[p.type].name}: убрано на склад`;
      case 'upgraded': return `${ctx.newLook && ctx.newLook(p.type, p.level, p.epoch) ? '✨ Новый облик! ' : ''}Улучшено: ${nm(p.type, p.level - 1, p.epoch)} → ур. ${p.level}`;
      case 'demolished': return `Снесено: ${nm(p.type, p.level, p.epoch)}`;
      case 'tech': { const T = Lex.tech[p.id]; return `📜 Новое знание: ${T.name}${T.paths ? ' — ' + T.paths[p.mode][0] : ''}`; }
      case 'rite': { const R = Lex.rite[p.id]; return `${R.icon} ${R.name}: ${this.riteResult(p.result)}`; }
      case 'epoch': return `⏳ Наступает новая эпоха: ${Lex.epochs[p.epoch].name}`;
      case 'retired': return `🏛️ ${this.retiredLine(p.from, p.into, p.level, p.epoch)}`;
      case 'starve': return '⚠️ Голод: житель покинул поселение';
      case 'goatGone': return p.kind === 'maenad' ? '🍇 Вакханки ушли с песнями в холмы…' : '🐐 Коза ушла в горы Троодоса…';
      case 'goat': return p.kind === 'maenad' ? `🍇 ${this.maenadLine(p.roll)} ${this.resList(p.gains) || 'склады полны'}` : `🐐 ${this.goatLine(p.roll)} ${this.resList(p.gains) || 'склады полны'}`;
      case 'wonderUpgraded': return `✨ «${Lex.bld[p.from].name}» теперь — ${Lex.bld[p.into].name}!`;
      case 'raidShield': return '🧱 Циклопические стены отразили набег «народов моря»!';
      case 'tribute': return this.tributeLine(p);
      case 'resRetired': return p.amount ? `🔄 ${Lex.res[p.from].name} → ${Lex.res[p.into].name.toLowerCase()}: ${Lex.res[p.from].icon} ${p.have} → ${Lex.res[p.into].icon} ${p.amount}`
        : `🔄 ${Lex.res[p.from].name}: запасы ${Lex.res[p.from].icon} ${p.have} пропали — ресурс ушёл из хозяйства`;
      case 'rebuilt': return `🔄 Перестроено: ${nm(p.from, p.level, p.epoch)} → ${nm(p.into, p.level, p.epoch)} ${p.level}-го уровня`;
      case 'sold': return `💰 Продано: ${nm(p.type, p.level, p.epoch)} ${p.level}-го уровня${p.logos ? ` — вернулось λ ${p.logos}` : ''}`;
      case 'raid': return `⚔️ Набег «народов моря»! ${p.pct ? `Унесли ${Math.round(p.pct * 100)}% запасов: ` : 'Потеряно: '}${this.resList(p.lost, '−')}`;
      case 'decksAdded': return `📚 Добавлены встроенные колоды: ${p.n}. Включить их можно в «📚 Обучении» → «Колоды»`;
      case 'deckImported': return `Новая колода: «${p.name}» (${p.n})`;
      case 'hintGather': return 'Кликайте по лесу, холмам и равнине, чтобы собирать ресурсы.';
      case 'hintLogos': return 'λ Логос даётся только за карточки — кнопка «📜 Учиться».';
      case 'newGameKept': return '📚 Новая игра: выученные слова и колоды остались с вами.';
    }
    return String(e.k);
  },

  /** Требование перехода эпохи → { label, have }. */
  req(it) {
    switch (it.kind) {
      case 'pop': return { label: `👥 Население ${it.need}`, have: it.have };
      case 'special': return { label: `✨ ${Lex.bld[it.type].name}`, have: { built: 'есть', stashed: 'на складе', none: 'нет' }[it.have] };
      case 'techs': return { label: `📜 Все знания эпохи (${it.need})`, have: `${it.have}/${it.need}` };
      case 'res': return { label: `${Lex.res[it.res].icon} ${Lex.res[it.res].name} ${it.need}`, have: it.have };
      case 'logos': return { label: `λ Логос ${it.need}`, have: it.have };
    }
    return { label: it.kind, have: it.have };
  },

  /** Ошибки ядра по коду. */
  error(err) { return ({ notBackup: 'это не копия обучения «Λόγος»' })[err && err.code] || (err && err.message) || ''; },

  /** Слова статусов карточки и заголовки таблицы слов (экспорт .tsv). */
  status: { new: 'новое', learning: 'учится', learned: 'выучено' },
  tsvHead: ['Греческий', 'Перевод', 'Подсказка', 'Колода', 'Статус', 'Верно', 'Ошибок', 'Следующий повтор'],
};
