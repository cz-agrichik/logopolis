#!/usr/bin/env python3
"""Сравнение двух прогонов tests/golden.js: снимки побайтно/попиксельно и тексты построчно.
python3 tests/compare.py <эталон> <результат>"""
import sys, os, json, difflib
from PIL import Image, ImageChops

a, b = sys.argv[1], sys.argv[2]
NOISE = 40
bad = 0
pa = sorted(f for f in os.listdir(a) if f.endswith('.png') and not f.startswith('DIFF_'))
pb = sorted(f for f in os.listdir(b) if f.endswith('.png') and not f.startswith('DIFF_'))
for f in sorted(set(pa) | set(pb)):
    if f not in pa or f not in pb:
        print('нет пары:', f); bad += 1; continue
    ia, ib = Image.open(os.path.join(a, f)).convert('RGB'), Image.open(os.path.join(b, f)).convert('RGB')
    if ia.size != ib.size:
        print('размер:', f, ia.size, ib.size); bad += 1; continue
    # шум сглаживания шрифтов (разница каналов до ~30) не считаем
    d = ImageChops.difference(ia, ib).point(lambda v: 255 if v > NOISE else 0)
    box = d.getbbox()
    if box:
        n = sum(1 for px in (d.get_flattened_data() if hasattr(d, 'get_flattened_data') else d.getdata()) if px != (0, 0, 0))
        print(f'снимок отличается: {f}  пикселей {n}  область {box}'); bad += 1
        d.save(os.path.join(b, 'DIFF_' + f))
ta = json.load(open(os.path.join(a, 'texts.json')))
tb = json.load(open(os.path.join(b, 'texts.json')))
for k in sorted(set(ta) | set(tb)):
    if ta.get(k) != tb.get(k):
        bad += 1
        print('текст отличается:', k)
        for line in list(difflib.unified_diff(str(ta.get(k)).splitlines(), str(tb.get(k)).splitlines(), lineterm='', n=0))[:12]:
            print('   ', line[:200])
ea = open(os.path.join(b, 'errors.txt')).read().strip()
if ea:
    bad += 1; print('ошибки JS в результате:\n', ea[:2000])
print('ИТОГ:', 'совпадает' if not bad else f'различий: {bad}')
sys.exit(1 if bad else 0)
