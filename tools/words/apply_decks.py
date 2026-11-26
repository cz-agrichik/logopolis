#!/usr/bin/env python3
"""Вносит файл добавлений в встроенные колоды (content/ru/words.js) и проверяет их.

    python3 tools/words/apply_decks.py tools/words/additions_v5.py           # только проверить
    python3 tools/words/apply_decks.py tools/words/additions_v5.py --write   # проверить и записать

Файл добавлений — модуль Python с NEW, ADD, SPLIT, RENAME, MOVE, EDIT (см. additions_v4.py, additions_v5.py).
Порядок по умолчанию: SPLIT → RENAME → ADD → NEW → MOVE → EDIT; свой — списком ORDER (в v5: MOVE → ADD → NEW → SPLIT → RENAME → EDIT,
чтобы новые слова легли в колоду до деления по алфавиту).
  MOVE — перенести слово в другую колоду (и уровень): { слово: id колоды }; None — убрать слово из колод (повтор, вариант написания);
  EDIT — поправить карточку: { слово: (перевод, подсказка) }, None — оставить как есть;
  SPLIT — делит пополам по алфавиту; диапазон «: α–ζ» в старом названии заменяется новым;
  LAYOUT — пересобрать уровень целиком: { 'a1': [(id, название, [слово | (греч., перевод, подсказка)…]), …] } — колоды уровня
    заменяются новыми; слово берётся с карточкой (перевод, подсказка) из любой колоды, кортеж — новая карточка. Все слова
    прежних колод уровня должны попасть в новые колоды или уйти раньше через MOVE — иначе ошибка (в v10 так пересобран A1).
Проверки (при ошибке ничего не пишется):
  - греческое слово встречается в колодах A1–B1 один раз (варианты глагола -άω/-ώ — одно слово);
  - перевод внутри уровня не повторяется;
  - предупреждения (не ошибки): слово есть в стартовом наборе; смысл перевода совпадает с другим словом уровня
    («работать» у λειτουργώ и εργάζομαι) — такие пары лучше развести, чтобы в «Что это значит?» не было двух верных ответов.
При записи WORD_DECKS_VERSION растёт на 1: сохранения обновят колоды, прогресс пойдёт за словом (Decks.ensureBuiltins).
Новые колоды A2/B1 приходят выключенными ("off": true), A1 — включёнными. После записи: npm test.
"""
import importlib.util, json, os, re, subprocess, sys, unicodedata

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
W = os.path.join(ROOT, 'content/ru/words.js')
if len(sys.argv) < 2: sys.exit(__doc__)
spec = importlib.util.spec_from_file_location('additions', sys.argv[1]); A = importlib.util.module_from_spec(spec); spec.loader.exec_module(A)
for k in ('NEW', 'ADD', 'SPLIT', 'RENAME', 'MOVE', 'EDIT', 'LAYOUT'):
    if not hasattr(A, k): setattr(A, k, [] if k == 'NEW' else {})
ORDER = getattr(A, 'ORDER', ['SPLIT', 'RENAME', 'ADD', 'NEW', 'MOVE', 'EDIT'])

src = open(W, encoding='utf-8').read()
code = "const fs=require('fs');const s=fs.readFileSync(process.argv[1],'utf8');const r=new Function(s+';return {D:WORD_DECKS,S:SAMPLE_DECK,V:WORD_DECKS_VERSION};')();console.log(JSON.stringify(r))"
data = json.loads(subprocess.run(['node', '-e', code, W], capture_output=True, text=True, check=True).stdout)
D, S, V = data['D'], data['S'], data['V']

def strip(s): return ''.join(c for c in unicodedata.normalize('NFD', s.lower()) if unicodedata.category(c) != 'Mn')
def vkey(w): return re.sub(r'άω$', 'ώ', unicodedata.normalize('NFC', w.lower()))   # αγαπάω и αγαπώ — одно слово
def akey(w): return re.sub(r'αω$', 'ω', strip(w))   # без ударений: πότε / ποτέ — разные слова, но стоит взглянуть
lvl = lambda id: id.split('-')[0]
byid = {d['id']: d for d in D}

def find(w):
    for d in D:
        for c in d['cards']:
            if vkey(c[0]) == vkey(w): return d, c
    sys.exit(f'нет слова {w}')
def op_split():
    for old, (nid, nname) in A.SPLIT.items():
        d = byid[old]; cards = sorted(d['cards'], key=lambda c: strip(c[0]))
        h = len(cards) // 2
        while h < len(cards) and strip(cards[h][0])[0] == strip(cards[h - 1][0])[0]: h += 1   # одна буква — в одной колоде
        a, b = cards[:h], cards[h:]
        rng = lambda L: strip(L[0][0])[0] + '–' + strip(L[-1][0])[0]
        name = re.sub(r': \S+–\S+$', '', d['name'])   # прежний диапазон букв уходит
        base = nname.rsplit(' ', 1)[0] if nname else name
        d['cards'] = a; d['name'] = f"{name}: {rng(a)}"
        nd = {'id': nid, 'name': f"{base}: {rng(b)}", 'cards': b}
        if d.get('off'): nd['off'] = True
        D.insert(D.index(d) + 1, nd); byid[nid] = nd
def op_rename():
    for k, v in A.RENAME.items(): byid[k]['name'] = v
def op_add():
    for k, cards in A.ADD.items(): byid[k]['cards'].extend([list(c) for c in cards])
def op_new():
    for nid, name, after, cards in A.NEW:
        nd = {'id': nid, 'name': name, 'cards': [list(c) for c in cards]}
        if not nid.startswith('a1'): nd['off'] = True
        D.insert(D.index(byid[after]) + 1, nd); byid[nid] = nd
def op_move():
    for w, to in A.MOVE.items():
        d, c = find(w); d['cards'].remove(c)
        if to: byid[to]['cards'].append(c)
def op_edit():
    for w, (tr, hint) in A.EDIT.items():
        d, c = find(w)
        if tr is not None: c[1] = tr
        if hint is not None: c[2] = hint
LAYOUT_ERR = []
def op_layout():
    global byid
    for L, decks in A.LAYOUT.items():
        old = [d for d in D if lvl(d['id']) == L]
        pos = D.index(old[0])
        new, placed = [], set()
        for nid, name, items in decks:
            cards = []
            for it in items:
                if isinstance(it, str):
                    if vkey(it) in placed: LAYOUT_ERR.append(f'{it}: дважды в раскладке'); continue
                    d, c = find(it); d['cards'].remove(c); cards.append(c)
                else: cards.append(list(it))
                placed.add(vkey(cards[-1][0]))
            new.append({'id': nid, 'name': name, 'cards': cards})
        left = [c[0] for d in old for c in d['cards']]
        if left: LAYOUT_ERR.append(f'{L}: не разложены {len(left)}: ' + ', '.join(left))
        for d in old: D.remove(d)
        D[pos:pos] = new
    byid = {d['id']: d for d in D}
OPS = {'LAYOUT': op_layout, 'SPLIT': op_split, 'RENAME': op_rename, 'ADD': op_add, 'NEW': op_new, 'MOVE': op_move, 'EDIT': op_edit}
for k in ORDER: OPS[k]()

bad, seen, seenA = len(LAYOUT_ERR), {}, {}
for e in LAYOUT_ERR: print('ОШИБКА: раскладка', e)
for d in D:
    for c in d['cards']:
        k = vkey(c[0])
        if k in seen: print('ОШИБКА: слово дважды', c[0], seen[k], d['id']); bad += 1
        elif akey(c[0]) in seenA: print('заметка: отличаются только ударением', c[0], '/', seenA[akey(c[0])])
        seen[k] = d['id']; seenA.setdefault(akey(c[0]), c[0])
starter = {vkey(c[0]) for c in S['cards']}
for d in D:
    for c in d['cards']:
        if vkey(c[0]) in starter: print('заметка: есть в стартовом наборе', c[0], d['id'])
for L in ('a1', 'a2', 'b1'):
    tr, senses = {}, {}
    for d in D:
        if lvl(d['id']) != L: continue
        for c in d['cards']:
            t = c[1].strip()
            if t in tr: print('ОШИБКА: перевод дважды', L, t, tr[t], c[0]); bad += 1
            tr[t] = c[0]
            for s in re.split(r'[;,]', re.sub(r'\([^)]*\)', '', t)):
                s = s.strip()
                if s and s in senses and senses[s] != c[0]: print('заметка: общий смысл', L, repr(s), senses[s], '/', c[0])
                if s: senses.setdefault(s, c[0])
tot = {}
for d in D: tot[lvl(d['id'])] = tot.get(lvl(d['id']), 0) + len(d['cards'])
print('слов по уровням:', tot, '· ошибок:', bad)
for d in D: print(f"  {d['id']:<12} {len(d['cards']):>3} {d['name']}")

if '--write' in sys.argv:
    if bad: sys.exit('есть ошибки — ничего не записано')
    i = src.index('const WORD_DECKS = ['); j = src.index('\n];', i)
    lines = []
    for d in D:
        head = {'id': d['id'], 'name': d['name']}
        if d.get('off'): head['off'] = True
        lines.append(json.dumps(head, ensure_ascii=False)[:-1] + ', "cards": [')
        lines.append(',\n'.join(json.dumps(c, ensure_ascii=False) for c in d['cards']) + ']},')
    out = src[:i] + 'const WORD_DECKS = [\n' + '\n'.join(lines) + src[j:]
    out = out.replace(f'const WORD_DECKS_VERSION = {V};', f'const WORD_DECKS_VERSION = {V + 1};')
    open(W, 'w', encoding='utf-8').write(out)
    print(f'записано: content/ru/words.js, WORD_DECKS_VERSION {V} → {V + 1}')
