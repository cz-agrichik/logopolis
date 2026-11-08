'use strict';
// ============================================================
//  Греческое письмо: ударения, слоги, похожие на слух написания
// ============================================================

const stripAccents = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const GREEK_LETTERS = 'αβγδεζηθικλμνξοπρστυφχψω';

// ------------------------------------------------------------
//  Деление греческого слова на слоги (упрощённые правила новогреческого)
// ------------------------------------------------------------
const Syl = {
  VOWELS: 'αεηιουω',
  DIPH: ['αι', 'ει', 'οι', 'υι', 'ου', 'αυ', 'ευ', 'ηυ'],
  ONSETS: new Set(('βγ βδ βλ βρ γδ γκ γλ γν γρ γγ δρ θλ θν θρ κλ κν κρ κτ μν μπ ντ πλ πν πρ πτ σβ σγ σθ σκ σλ σμ σν σπ στ σφ σχ ' +
    'τζ τμ τρ τσ φθ φλ φρ φτ χθ χλ χν χρ σκλ σκρ σπλ σπρ στρ σφρ σχν μπρ μπλ ντρ γκρ γκλ').split(' ')),
  base(ch) { return stripAccents(ch); },
  isV(ch) { return this.VOWELS.includes(this.base(ch)); },
  accented(ch) { return /[\u0301\u0308]/.test(ch.normalize('NFD')); },
  split(word) {
    const ch = [...word], n = ch.length, nuc = [];
    for (let i = 0; i < n; i++) {
      if (!this.isV(ch[i])) continue;
      let end = i + 1;
      const pair = this.base(ch[i]) + (ch[i + 1] ? this.base(ch[i + 1]) : '');
      const second = ch[i + 1] || '';
      if (i + 1 < n && this.isV(second) && !this.accented(ch[i]) && !/\u0308/.test(second.normalize('NFD'))) {
        if (this.DIPH.includes(pair)) end = i + 2;
        // «ια», «ιο», «ιου» после согласной без ударения на ι читаются слитно: γιος, ελιά
        else if (this.base(ch[i]) === 'ι' && i > 0 && !this.isV(ch[i - 1]) &&
                 !this.DIPH.includes(this.base(ch[i + 1]) + this.base(ch[i + 2] || ''))) end = i + 2 + (pair === 'ιο' && this.base(ch[i + 2] || '') === 'υ' ? 1 : 0);
      }
      nuc.push([i, end]); i = end - 1;
    }
    if (nuc.length <= 1) return [word];
    const cuts = [];
    for (let k = 0; k < nuc.length - 1; k++) {
      const a = nuc[k][1], b = nuc[k + 1][0];
      const cl = ch.slice(a, b).map(c => this.base(c)).join('');
      let cut = b;
      if (cl.length === 1) cut = a;
      else if (cl.length >= 2) {
        cut = b - 1;
        for (let len = Math.min(3, cl.length); len >= 2; len--) if (this.ONSETS.has(cl.slice(-len))) { cut = b - len; break; }
      }
      cuts.push(cut);
    }
    const out = []; let start = 0;
    for (const c of cuts) { out.push(ch.slice(start, c).join('')); start = c; }
    out.push(ch.slice(start).join(''));
    return out.filter(Boolean);
  },
  /** Куски для сборки: буквы, если слово короткое, иначе слоги (не больше max). */
  pieces(word, max = 6) {
    if ([...word].length <= max) return [...word];
    const syl = this.split(word);
    while (syl.length > max) {
      let best = 0;
      for (let i = 1; i < syl.length - 1; i++) if (syl[i].length + syl[i + 1].length < syl[best].length + syl[best + 1].length) best = i;
      syl.splice(best, 2, syl[best] + syl[best + 1]);
    }
    return syl;
  },
};

const GREEK_RE = /[Ͱ-Ͽἀ-῿]/;


// ------------------------------------------------------------
//  Обманки: похожие на слух написания (η/ι/υ/ει/οι, ο/ω, ε/αι, σ/ς)
// ------------------------------------------------------------
const CONFUSE = [
  ['ει', ['ι', 'οι', 'η']], ['εί', ['ί', 'οί', 'ή']], ['οι', ['ι', 'ει', 'η']], ['οί', ['ί', 'εί', 'ή']],
  ['αι', ['ε']], ['αί', ['έ']], ['η', ['ι', 'ει', 'υ']], ['ή', ['ί', 'εί', 'ύ']], ['ι', ['η', 'ει', 'οι']], ['ί', ['ή', 'εί', 'οί']],
  ['υ', ['ι', 'η']], ['ύ', ['ί', 'ή']], ['ο', ['ω']], ['ό', ['ώ']], ['ω', ['ο']], ['ώ', ['ό']], ['ε', ['αι']], ['έ', ['αί']],
  ['σ', ['ς']], ['ς', ['σ']],
];
/** Все «похожие, но неверные» варианты строки (одна замена в каждом). */
function confusions(str) {
  const out = new Set();
  for (const [from, tos] of CONFUSE) {
    let i = str.indexOf(from);
    while (i >= 0) {
      // не подменяем часть дифтонга одиночной буквой (ει → «ηι» звучит иначе, это не обманка)
      const prev = str[i - 1] || '', next = str[i + from.length] || '';
      const inDiph = from.length === 1 && (
        (/[ιίυύ]/.test(from) && /[αεοηάέόή]/.test(prev)) ||      // вторая буква дифтонга
        (/[αεοάέό]/.test(from) && /[ιίυύ]/.test(next)));          // первая буква дифтонга
      if (!inDiph) for (const to of tos) {
        let v = str.slice(0, i) + to + str.slice(i + from.length);
        if (to === 'σ' && !next) continue;            // σ в конце слова — явная ошибка, слишком просто
        if (to === 'ς' && next) v = v;                  // ς в середине — классическая обманка
        if (v !== str) out.add(v);
      }
      i = str.indexOf(from, i + 1);
    }
  }
  return [...out];
}

/** Места в слове для задания «Какая буква?»: гласные, которые звучат одинаково, а пишутся по-разному.
 *  Возвращает [{ i, from, opts }], где opts — верный вариант и обманки. σ/ς не берём: там правило, а не память. */
function spellSpots(word) {
  const spots = [];
  const keys = CONFUSE.filter(([f]) => !/[σς]/.test(f)).sort((a, b) => b[0].length - a[0].length);
  for (const [from, tos] of keys) {
    let i = word.indexOf(from);
    while (i >= 0) {
      const prev = word[i - 1] || '', next = word[i + from.length] || '';
      const inDiph = from.length === 1 && (
        (/[ιίυύ]/.test(from) && /[αεοηάέόή]/.test(prev)) || (/[αεοάέό]/.test(from) && /[ιίυύ]/.test(next)));
      const covered = spots.some(s => i < s.i + s.from.length && s.i < i + from.length);
      if (!inDiph && !covered) spots.push({ i, from, opts: [from, ...tos.filter(t => t !== from)] });
      i = word.indexOf(from, i + 1);
    }
  }
  return spots.sort((a, b) => a.i - b.i);
}

/** Сравнение набранного с правильным по кускам: наибольшая общая подпоследовательность. */
function diffPieces(typed, target) {
  const n = typed.length, m = target.length;
  const L = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    L[i][j] = typed[i] === target[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const tOk = new Array(n).fill(false), gOk = new Array(m).fill(false);
  for (let i = 0, j = 0; i < n && j < m;) {
    if (typed[i] === target[j]) { tOk[i] = gOk[j] = true; i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++;
  }
  return { tOk, gOk, common: L[0][0] };
}
