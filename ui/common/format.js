'use strict';
// ============================================================
//  Общее для всех HTML-интерфейсов: DOM-хелперы, числа, мелкие куски разметки
// ============================================================

const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => n >= 10000 ? (n / 1000).toFixed(1) + 'k' : Math.floor(n).toString();
const fmtRate = n => (n >= 0 ? '+' : '−') + Math.abs(n).toFixed(1);
const num = (n, d = 2) => (+n.toFixed(d)).toString();

/** Привести содержимое el к разметке html, не пересоздавая совпадающие узлы: меняются только текст и атрибуты.
 *  Для того, что перерисовывается каждую секунду (таймеры, запасы): узел под мышью остаётся тем же — подсказка (title)
 *  не гаснет и не всплывает заново; её текст (title) у узла под мышью обновится, когда мышь уйдёт.
 *  Если устройство разметки поменялось — узел просто заменяется. */
function morph(el, html) {
  const t = document.createElement('div');
  t.innerHTML = html;
  morphKids(el, t);
}
function morphKids(a, b) {
  const an = [...a.childNodes], bn = [...b.childNodes];
  bn.forEach((y, i) => {
    const x = an[i];
    if (!x) { a.appendChild(y); return; }
    if (x.nodeType !== y.nodeType || x.nodeName !== y.nodeName) { a.replaceChild(y, x); return; }
    if (x.nodeType !== 1) { if (x.nodeValue !== y.nodeValue) x.nodeValue = y.nodeValue; return; }
    for (const { name } of [...x.attributes]) if (!y.hasAttribute(name)) x.removeAttribute(name);
    for (const { name, value } of [...y.attributes]) {
      if (x.getAttribute(name) === value) continue;
      if (name === 'title' && x.matches(':hover')) continue;   // подсказку под мышью не трогаем: обновится, когда мышь уйдёт
      x.setAttribute(name, value);
    }
    morphKids(x, y);
  });
  for (let i = an.length - 1; i >= bn.length; i--) a.removeChild(an[i]);
}


/** Короткое описание прогресса карточки (её слова) для таблиц (HTML). */
function progressHtml(state, card) {
  const p = Decks.prog(state, card);
  if (!p) return '<span class="dim">новая</span>';
  if (Decks.isLearned(p)) {
    const left = p.due - Date.now();
    return `<span class="learned-mark">✓ выучено</span> <span class="dim">${left > 0 ? 'повтор через ' + fmtDur(left) : 'пора повторить'}</span>`;
  }
  const L = Decks.settings(state).learnSteps;
  return `<span class="steps" title="Шагов пройдено: ${Math.min(p.step, L)} из ${L}">${'●'.repeat(Math.min(p.step, L))}${'○'.repeat(Math.max(0, L - p.step))}</span>${p.built ? ' <span class="dim" title="Слово уже набирали">✍</span>' : ''}`;
}
