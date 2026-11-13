#!/usr/bin/env python3
"""Пулы кандидатов в колоды: слова учебника «Κλικ στα ελληνικά», которых ещё нет в игре, по уровням и частям речи.

    python3 tools/words/pools.py <папка с данными> [<папка для пулов>]

В папке с данными — выгрузки пользователя:
  output.csv                         слова учебника: greek, english, level (A1/A2/B1), original («λόγος, ο»), pos, subclass;
                                     столбец english — машинный перевод, только ориентир (переводы в колодах — свои, ручные);
  greek_frequency_lemmas_levels.csv  леммы по частотности (lemma, level) — порядок строк = ранг;
  top_words_with_levels.csv          запасной список частотности (word, lemma, rank, level).

Правило уровня — гибридное (README, «Встроенные колоды и уровни»): уровень учебника, но слово из B1, которое
по частотности A1/A2, идёт в пул A2. Самые базовые слова уровня A2 по учебнику, но A1 по частотности, при отборе
можно вручную поднять в A1 (так в версии 4 сделали с καλός, παλιός, ζεστός, έξω, καλά).

На выходе: pool.json (всё) и по файлу на уровень и часть речи — <уровень>_<часть>.txt: «ранг ⇥ слово ⇥ форма из учебника ⇥
уровень учебника/частотности ⇥ машинный перевод», по возрастанию ранга (сначала частые). Из них слова отбираются вручную
в файл добавлений (пример — additions_v4.py) и вносятся в игру скриптом apply_decks.py.
"""
import csv, json, os, re, sys, collections

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
data = sys.argv[1] if len(sys.argv) > 1 else sys.exit(__doc__)
out_dir = sys.argv[2] if len(sys.argv) > 2 else 'pools'
os.makedirs(out_dir, exist_ok=True)

rows = list(csv.DictReader(open(os.path.join(data, 'output.csv'), encoding='utf-8')))
src = open(os.path.join(ROOT, 'content/ru/words.js'), encoding='utf-8').read()
game = set(m.group(1) for m in re.finditer(r'^\["([^"]+)"', src, re.M)) | set(m.group(1) for m in re.finditer(r"\['([^']+)'", src))

freq = {}
for i, r in enumerate(csv.DictReader(open(os.path.join(data, 'greek_frequency_lemmas_levels.csv'), encoding='utf-8'))):
    freq.setdefault(r['lemma'], (i, r['level']))
top = {}
for r in csv.DictReader(open(os.path.join(data, 'top_words_with_levels.csv'), encoding='utf-8')):
    for k in (r['word'], r['lemma']):
        top.setdefault(k, (int(r['rank']), r['level']))

def zrank(w):
    if w in freq: return freq[w]
    if w in top: return 3000 + top[w][0], top[w][1]
    return 99999, '-'

def cat(r):
    """Часть речи для колоды: masc/fem/neut — существительные по артиклю, omega/contr/mid — глаголы, adj, adv, plur, phrase, other."""
    o, p, s = r['original'], r['pos'], r['subclass']
    if s == 'personal' or r['greek'][:1].isupper(): return None   # имена и названия
    if ', ο' in o and p == 'noun': return 'masc'
    if ', η' in o and p == 'noun': return 'fem'
    if ', το' in o and p == 'noun': return 'neut'
    if p == 'verb':
        if s.startswith('gamma'): return 'mid'
        if 'contracted' in s: return 'contr'
        return 'omega'
    if p == 'adjective': return 'adj'
    if p == 'adverb': return 'adv'
    if ', οι' in o or ', τα' in o: return 'plur'
    if ' ' in r['greek']: return 'phrase'
    return 'other'

seen, out = set(), []
for r in rows:
    w = r['greek']
    if w in seen or w in game: continue
    seen.add(w)
    c = cat(r)
    if not c: continue
    zr, zl = zrank(w)
    pool = 'A1' if r['level'] == 'A1' else 'A2' if r['level'] == 'A2' or zl in ('A1', 'A2') else 'B1'
    out.append(dict(w=w, o=r['original'], ru=r['english'], tl=r['level'], zl=zl, zr=zr, cat=c, pool=pool))
out.sort(key=lambda x: x['zr'])
json.dump(out, open(os.path.join(out_dir, 'pool.json'), 'w', encoding='utf-8'), ensure_ascii=False)
groups = collections.defaultdict(list)
for x in out: groups[(x['pool'], x['cat'])].append(x)
for (pool, c), L in groups.items():
    with open(os.path.join(out_dir, f'{pool}_{c}.txt'), 'w', encoding='utf-8') as f:
        for x in L: f.write(f"{x['zr']}\t{x['w']}\t{x['o']}\t{x['tl']}/{x['zl']}\t{x['ru']}\n")
print('в игре слов:', len(game), '· кандидатов:', len(out))
for k, v in sorted(collections.Counter(x['pool'] for x in out).items()): print(' ', k, v)
