'use strict';
// ============================================================
//  Общее для всех HTML-интерфейсов: DOM-хелперы, числа, мелкие куски разметки
// ============================================================

const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => n >= 10000 ? (n / 1000).toFixed(1) + 'k' : Math.floor(n).toString();
const fmtRate = n => (n >= 0 ? '+' : '−') + Math.abs(n).toFixed(1);
const num = (n, d = 2) => (+n.toFixed(d)).toString();


/** Короткое описание прогресса карточки для таблиц (HTML). */
function progressHtml(state, id) {
  const p = Decks.prog(state, id);
  if (!p) return '<span class="dim">новая</span>';
  if (Decks.isLearned(p)) {
    const left = p.due - Date.now();
    return `<span class="learned-mark">✓ выучено</span> <span class="dim">${left > 0 ? 'повтор через ' + fmtDur(left) : 'пора повторить'}</span>`;
  }
  const L = Decks.settings(state).learnSteps;
  return `<span class="steps" title="Шагов пройдено: ${Math.min(p.step, L)} из ${L}">${'●'.repeat(Math.min(p.step, L))}${'○'.repeat(Math.max(0, L - p.step))}</span>${p.built ? ' <span class="dim" title="Слово уже набирали">✍</span>' : ''}`;
}
