'use strict';
// ============================================================
//  Обучение игре — первые шаги: какие шаги, когда шаг пройден, награда.
//  Тексты шагов — в content/ru/lexicon.js (Lex.tutorial), стрелки и карточка задания — в ui/desktop/tutorial.js.
//
//  Game.state.tutorial:
//    { offer: true }                           — новая игра: обучение предложат (старые сохранения — без поля, им не предлагаем)
//    { on: true, done: [...], g0, r0, ri0, t0 } — идёт; g0 — сколько чего собрано руками ({ food, wood, stone }),
//                                                 r0/ri0/t0 — сколько было раундов, обрядов и знаний на старте
//    { on: false, skipped | finished, done }   — пропущено или пройдено
//    { on: false, veteran: true, done: [] }    — новая игра поверх прежней: игру уже знают, обучение не предлагаем
//  Шаг можно пройти и раньше очереди (например, сначала знание, потом поле) — он засчитается, когда до него дойдёт проверка.
// ============================================================

/** Шаги по порядку. each — собрать руками каждый из ресурсов; info — пояснение без задания (закрывает игрок, без награды);
 *  build — здание, count — сколько их нужно в городе; round — сколько заданий в раунде карточек этого шага (короткий первый раунд). */
const TUTORIAL_STEPS = [
  { id: 'gather', each: ['wood', 'stone', 'food'] },
  { id: 'res', info: true },
  { id: 'field', build: 'field' },
  { id: 'flow', info: true, res: 'food' },   // поле построено — смотрим, как зерно прибывает само
  { id: 'lumber', build: 'lumber' },
  { id: 'quarry', build: 'quarry' },
  { id: 'house', build: 'house', count: 2 },   // зданиям не хватает рук — сначала хижина, потом учёба
  { id: 'study', round: 4 },
  { id: 'rite', rite: 'elders' },
  { id: 'tech' },
];

Object.assign(Game, {
  /** Шаг по id. */
  tutorialStep(id) { return TUTORIAL_STEPS.find(S => S.id === id); },
  /** Обучение идёт сейчас. */
  tutorialOn() { const t = this.state.tutorial; return !!(t && t.on); },
  /** Награда за шаг в λ (пояснения — без награды). */
  tutorialReward(S) { return S.info ? 0 : BALANCE.tutorialReward; },

  /** Начать обучение. rounds — сколько раундов карточек пройдено к этому моменту (обучение хранится отдельно от города). */
  tutorialStart(rounds = 0) {
    const s = this.state, prev = s.tutorial || {};
    // заново после «Пропустить» — пройденные шаги остаются пройденными: награда за шаг одна на игру
    s.tutorial = { on: true, done: prev.done || [], g0: Object.assign({}, s.stats.gathered), r0: rounds, ri0: s.stats.rites || 0, t0: s.techs.length };
    this.save();
  },
  /** Пропустить: больше не предлагать и не показывать. */
  tutorialSkip() {
    const t = this.state.tutorial || {};
    this.state.tutorial = { on: false, skipped: true, done: t.done || [] };
    this.save();
  },
  /** Игрок прочитал пояснение (шаг info) — только текущее: «Ресурсы идут сами» нельзя закрыть, пока нет поля. rounds — как в tutorialCheck. */
  tutorialAck(id, rounds = 0) {
    const t = this.state.tutorial, S = this.tutorialStep(id);
    if (!t || !t.on || !S || !S.info || this.tutorialCurrent() !== S) return [];
    t.ack = t.ack || [];
    if (!t.ack.includes(id)) t.ack.push(id);
    return this.tutorialCheck(rounds);
  },

  /** Ресурсы шага «собрать руками каждый», которые уже собраны после старта обучения. */
  tutorialGathered(S) {
    const got = this.state.stats.gathered || {}, g0 = (this.state.tutorial || {}).g0 || {};
    return S.each.filter(k => (got[k] || 0) > (g0[k] || 0));
  },
  /** Сколько сделано для шага-счётчика (сбор руками, здания): { have, need } или null. */
  tutorialCount(S) {
    if (S.each) return { have: this.tutorialGathered(S).length, need: S.each.length };
    if (S.build) return { have: Math.min(S.count || 1, this.count(S.build)), need: S.count || 1 };
    return null;
  },
  /** Выполнено ли условие шага прямо сейчас. */
  tutorialMet(S, rounds = 0) {
    const s = this.state, t = s.tutorial;
    if (S.info) return (t.ack || []).includes(S.id);
    if (S.each) return this.tutorialGathered(S).length >= S.each.length;
    if (S.build) return this.count(S.build) >= (S.count || 1);
    if (S.id === 'study') return rounds > t.r0;
    if (S.rite) return (s.stats.rites || 0) > t.ri0;
    if (S.id === 'tech') return s.techs.length > t.t0;
    return false;
  },
  /** Текущий шаг — первый не пройденный (или null). */
  tutorialCurrent() {
    const t = this.state.tutorial;
    if (!t || !t.on) return null;
    return TUTORIAL_STEPS.find(S => !t.done.includes(S.id)) || null;
  },

  /**
   * Проверить шаги: пройденные отметить и наградить (BALANCE.tutorialReward λ за шаг).
   * Возвращает [{ id, logos }] — что пройдено сейчас; когда пройдены все, обучение заканчивается (state.tutorial.finished).
   */
  tutorialCheck(rounds = 0) {
    const t = this.state.tutorial;
    if (!t || !t.on) return [];
    const got = [];
    for (const S of TUTORIAL_STEPS) {
      if (t.done.includes(S.id) || !this.tutorialMet(S, rounds)) continue;
      t.done.push(S.id);
      const logos = this.tutorialReward(S);
      if (logos) this.addLogos(logos);
      got.push({ id: S.id, logos });
      if (logos) this.log('tutorialStep', { id: S.id, logos });
    }
    if (got.length && TUTORIAL_STEPS.every(S => t.done.includes(S.id))) {
      const logos = TUTORIAL_STEPS.reduce((a, S) => a + this.tutorialReward(S), 0);
      this.state.tutorial = { on: false, finished: true, done: t.done };
      this.log('tutorialDone', { logos });
    }
    if (got.length) this.save();
    return got;
  },
});
