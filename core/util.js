'use strict';
// ============================================================
//  Общие мелочи ядра: случайность, перемешивание, ключ дня, события
// ============================================================

const rand = (a, b) => a + Math.random() * (b - a);

/** Ключ дня по местному времени: 2026-11-06 */
function dayKey(t = Date.now()) {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * События ядра. Ядро ничего не знает об интерфейсе: оно сообщает «что случилось»,
 * а каждый интерфейс сам решает, как это показать.
 *   log   — новая запись в летописи города      { entry }
 *   raid  — набег «народов моря»                { shielded, bonus, lost }
 */
const Bus = {
  handlers: {},
  on(evt, fn) { (this.handlers[evt] = this.handlers[evt] || []).push(fn); return () => this.off(evt, fn); },
  off(evt, fn) { this.handlers[evt] = (this.handlers[evt] || []).filter(f => f !== fn); },
  emit(evt, data) { for (const fn of this.handlers[evt] || []) fn(data); },
};
