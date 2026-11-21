"""Проверка конвертера без Stanza и без модели: подменяем разбор и ответы модели.
   python tools/library/test_converter.py
Собирает во временной папке публичную и личную книгу, проверяет обороты в книге, каталоги
и словарь сайта (без имён собственных, без предложений), защиту публичной книги без license."""
import json
import re
import shutil
import sys
import tempfile
from pathlib import Path
from types import SimpleNamespace as NS

sys.path.insert(0, str(Path(__file__).resolve().parent))
import bookconverter as bc  # noqa: E402

LEMMA = {"έριξε": ("ρίχνω", "VERB"), "μια": ("ένας", "DET"), "γρήγορη": ("γρήγορος", "ADJ"),
         "ματιά": ("ματιά", "NOUN"), "καμιά": ("καμιά", "DET"), "φορά": ("φορά", "NOUN"),
         "ο": ("ο", "DET"), "νίκος": ("Νίκος", "PROPN"), "πίνει": ("πίνω", "VERB"), "καφέ": ("καφές", "NOUN")}


class FakeNLP:
    """Слова — по пробелам, предложения — по точке; леммы из LEMMA."""
    def __call__(self, text):
        sentences = []
        for m in re.finditer(r"[^.]+\.?", text):
            tokens = []
            for t in re.finditer(r"[^\s.]+|\.", m.group(0)):
                form = t.group(0)
                lemma, upos = LEMMA.get(form.lower(), (form.lower(), "X"))
                start = m.start() + t.start()
                tokens.append(NS(start_char=start, end_char=start + len(form),
                                 words=[NS(lemma=lemma, upos=upos, feats="")]))
            if tokens:
                sentences.append(NS(tokens=tokens))
        return NS(sentences=sentences)


class FakeClient:
    offline = False
    calls = 0
    level_prompts = []
    bad = 0
    form_prompts = []
    lemma_prompts = []

    def chat_json(self, system, user):
        FakeClient.calls += 1
        nums = {int(n): w for n, w in re.findall(r"(\d+)=([^\s|]+)", user)}
        if system is bc.PHRASE_SYSTEM:
            find = lambda w: [n for n, x in nums.items() if x.lower() == w]
            out = []
            if find("έριξε") and find("ματιά"):
                out.append([[find("έριξε")[0], find("μια")[0], find("ματιά")[0]], "ρίχνω μια ματιά", "взглянуть"])
                out.append([[find("έριξε")[0], find("ματιά")[0], 999], "мусор", "x"])            # 999 — нет такого слова
            if find("καμιά"):
                out.append([[find("καμιά")[0], find("φορά")[0]], "καμιά φορά", "иногда"])
            if find("νίκος"):
                out.append([[find("ο")[0], find("νίκος")[0]], "ο Νίκος", "Никос"])              # имя — не берём
            return {"phrases": out}
        if system is bc.FORM_SYSTEM:
            FakeClient.form_prompts.append(user)
            known = {"έριξε": ["неправильный аорист, 3 л. ед. ч.", "бросил", "Α2"], "πίνει": ["наст. вр., 3 л. ед. ч.", "пьёт", "A1"]}
            items = re.findall(r"^(\d+)\. (\S+) ← ", user, re.M)
            return {"forms": [[n, *known.get(f, ["форма", "βλα", "?"])] for n, f in items]}   # «βλα» — перевод не по-русски
        if system is bc.LEVEL_SYSTEM:
            FakeClient.level_prompts.append(user)
            answer = {"ματιά": "Β1", "καμιά φορά": "Α2-Β1", "ρίχνω μια ματιά": "?", "πίνω": "A1-B2"}
            items = re.findall(r"^(\d+)\. (.+?)(?: — .*)?$", user, re.M)
            return {"levels": [[n, answer.get(h, "A2")] for n, h in items]}   # номера строкой — как иногда отвечает Gemini
        if system is bc.LEMMA_SYSTEM:
            FakeClient.lemma_prompts.append(user)
            items = re.findall(r"^(\d+)\. (\S+)", user, re.M)
            return {"lemmas": [[n, h, "рус:" + h, "en:" + h, "имя собств." if h == "Νίκος" else "сл."] for n, h in items]}
        sents = re.findall(r"^S(\d+):", user, re.M)
        if len(sents) > 1:   # пачку из нескольких предложений модель «не может» разобрать — как на 2-й главе «Поттера»
            FakeClient.bad += 1
            raise bc.BadReply("не удалось разобрать ответ: тест")
        return {"sentences": [[int(s), "перевод " + s] for s in sents],
                "words": [[n, LEMMA.get(w.lower(), (w.lower(),))[0], "≈" + w] for n, w in nums.items()]}


def main():
    tmp = Path(tempfile.mkdtemp())
    try:
        for name in ("TEXTS_DIR", "PRIVATE_DIR", "LIB_DIR", "CACHE_DIR", "OUT_DIR"):
            setattr(bc, name, tmp / name.lower())
        bc.REPO_DIR = tmp
        bc.CONFIG_PATH = tmp / "none.json"
        pub, priv = bc.TEXTS_DIR / "story", bc.PRIVATE_DIR / "secret"
        pub.mkdir(parents=True)
        priv.mkdir(parents=True)
        (pub / "01.txt").write_text("Ο Νίκος έριξε μια γρήγορη ματιά. Καμιά φορά πίνει καφέ.", encoding="utf-8")
        (pub / "book.json").write_text('// комментарий\n{"title": "Ιστορία", "level": "A2"}', encoding="utf-8")
        (priv / "glava1.txt").write_text("Καμιά φορά πίνει καφέ.", encoding="utf-8")
        (priv / "book.json").write_text('{"title": "Тайная"}', encoding="utf-8")
        # колоды игры: «καφές» — A1 по учебнику, модель о нём не спрашиваем
        (tmp / "content" / "ru").mkdir(parents=True)
        (tmp / "content" / "ru" / "words.js").write_text(
            'const WORD_DECKS = [\n{"id": "a1-food", "cards": [["καφές", "кофе", "ο καφές"]]},\n];\n', encoding="utf-8")
        args = ["--translator", "gemini", "--api-key", "x"]

        # публичная книга без license — отказ
        try:
            bc.main(["story", *args], nlp=FakeNLP(), client=FakeClient())
            raise AssertionError("публичная книга без license собралась")
        except SystemExit as exc:
            assert "license" in str(exc), exc
        (pub / "book.json").write_text('{"title": "Ιστορία", "level": "A2", "license": "свой текст"}', encoding="utf-8")

        bc.main(["--all", *args], nlp=FakeNLP(), client=FakeClient())
        book = bc.read_book_data(bc.LIB_DIR / "books" / "story.js")
        assert book["version"] == 3, book["version"]
        forms = lambda idx: [book["text"][book["words"][i]["start"]:book["words"][i]["end"]] for i in idx]
        heads = {p[1]: forms(p[0]) for p in book["phrases"]}
        assert heads == {"ρίχνω μια ματιά": ["έριξε", "μια", "ματιά"], "καμιά φορά": ["Καμιά", "φορά"]}, heads
        assert book["meta"]["phrases"] is True and book["sentences"][0][2] == "перевод 1"
        # уровни: из колоды, точный, на границе, «?», ответ не по правилам — нет поля
        lv = {k: v.get("level") for k, v in book["lemmas"].items()}
        assert lv["καφές"] == "A1" and lv["ματιά"] == "B1" and lv["πίνω"] is None and lv["ρίχνω"] == "A2", lv
        assert not any("καφές" in p for p in FakeClient.level_prompts), "слово из колоды ушло модели"
        plv = {p[1]: p[3] for p in book["phrases"]}
        assert plv == {"ρίχνω μια ματιά": "?", "καμιά φορά": "A2–B1"}, plv
        assert book["meta"]["levels"] is True
        # формы: изменённые — с грамматикой, переводом формы и уровнем; словарные (ματιά = ματιά) — не спрашиваются
        assert book["forms"]["έριξε|ρίχνω"] == ["неправильный аорист, 3 л. ед. ч.", "бросил", "A2"], book["forms"]
        assert book["forms"]["πίνει|πίνω"] == ["наст. вр., 3 л. ед. ч.", "пьёт", "A1"]
        assert not any("ματιά ←" in p for p in FakeClient.form_prompts), "словарная форма ушла модели"
        assert all(v[1] != "βλα" for v in book["forms"].values()), "перевод формы греческими буквами"
        assert book["meta"]["forms"] is True
        assert (bc.LIB_DIR / "local" / "books" / "secret.js").is_file()

        cat = json.loads((bc.LIB_DIR / "catalog.js").read_text(encoding="utf-8").split(" = ", 1)[1].rstrip(";\n"))
        assert [b["id"] for b in cat["books"]] == ["story"] and cat["books"][0]["phrases"] == 2, cat
        local = (bc.LIB_DIR / "local" / "catalog.js").read_text(encoding="utf-8")
        assert '"secret"' in local and "GREEK_LIBRARY_LOCAL" in local

        d = json.loads((bc.LIB_DIR / "dict.js").read_text(encoding="utf-8").split(" = ", 1)[1].rstrip(";\n"))
        assert "νίκοσ" not in d["forms"] and "νίκος" not in d["forms"], "имя собственное попало в словарь"
        assert d["forms"]["έριξε"][0] == "ρίχνω" and d["forms"]["καμιά"][0] == "καμιά"
        assert sorted(p[1] for p in d["phrases"]) == ["καμιά φορά", "ρίχνω μια ματιά"], d["phrases"]
        assert ["ρίχνω", "ένας", "ματιά"] in [p[0] for p in d["phrases"]]   # μια есть в словарной форме — ключ остаётся
        assert {p[1]: p[3] for p in d["phrases"]} == {"καμιά φορά": "A2–B1", "ρίχνω μια ματιά": "?"}
        assert d["lemmas"]["καφές"]["level"] == "A1" and "level" not in d["lemmas"]["πίνω"]
        assert d["forms"]["έριξε"][4:] == ["неправильный аорист, 3 л. ед. ч.", "бросил", "A2"], d["forms"]["έριξε"]
        assert len(d["forms"]["ματιά"]) == 4, "у словарной формы нет грамматики"
        flat = json.dumps(d, ensure_ascii=False)
        assert "перевод 1" not in flat and "Ο Νίκος έριξε" not in flat, "в словаре сайта — предложения"
        assert cat["dict"] == {"forms": len(d["forms"]), "lemmas": len(d["lemmas"]), "phrases": 2}

        # проверка оборотов от модели: опечатки, смесь алфавитов, чужие слова, одни служебные
        m = lambda *ws: [{"form": f, "lemma": l, "upos": u} for f, l, u in ws]
        riche = m(("έριξε", "ρίχνω", "VERB"), ("μια", "ένας", "DET"), ("ματιά", "η ματιά", "NOUN"))
        assert bc.check_phrase("ρίχνω μια ματιά", "взглянуть", riche) == "ρίχνω μια ματιά"
        assert bc.check_phrase("ρίνω μια ματιά", "взглянуть", riche) is None, "опечатка в глаголе"
        assert bc.check_phrase("ρίχνω μια ματιά", "βζγλενυτκα", riche) is None, "перевод греческими буквами"
        assert bc.check_phrase("ρίχνω μια ματιά", "γδεсь", riche) is None, "смесь алфавитов в переводе"
        assert bc.check_phrase("kάνω λάθος", "ошибаться", m(("έκανε", "κάνω", "VERB"), ("λάθος", "το λάθος", "NOUN"))) is None
        assert bc.check_phrase("ανοιγώ την τηλεόραση", "включать телевизор",
                               m(("άνοιξε", "ανοίγω", "VERB"), ("την", "ο", "DET"), ("τηλεόραση", "η τηλεόραση", "NOUN"))) == "ανοίγω την τηλεόραση"
        assert bc.check_phrase("παρίστανε πως", "делать вид", m(("παρίστανε", "παριστάνω", "VERB"), ("πως", "πως", "SCONJ"))) == "παριστάνω πως"
        assert bc.check_phrase("τι γίνεται", "что происходит", m(("Τι", "τι", "PRON"), ("γίνεται", "γίνομαι", "VERB"))) == "τι γίνεται"
        assert bc.check_phrase("για κάτι", "о чём-то", m(("γι", "για", "ADP"), ("αυτό", "αυτός", "PRON"))) is None, "одни служебные"
        assert bc.check_phrase("χαμηλώνω το κεφάλι", "склонить голову", m(("Ο", "ο", "DET"), ("κεφάλι", "το κεφάλι", "NOUN"))) is None
        assert bc.check_phrase("καθόλου", "совсем", m(("Δεν", "δεν", "PART"), ("καθόλου", "καθόλου", "ADV"))) is None
        assert bc.lemma_key("ξυπνάω") == bc.lemma_key("ξυπνώ") == "ξυπνώ" and bc.lemma_key("το αγόρι") == "αγόρι"
        assert not bc.pure_greek("τίποта") and not bc.pure_greek("то μυστήριο") and bc.pure_greek("σε + ο")
        assert [bc.normalize_level(x) for x in ("B1", "Β1", "a2-b1", "Γ1", "?", "A1-B2", "C3", "")] == \
            ["B1", "B1", "A2–B1", "C1", "?", None, None, None]
        # политоника → монотоника: одно слово — один ключ
        assert [bc.monotonic(x) for x in ("ἀλλάζω", "ἀποκτῶ", "τῆς", "ἤ", "μιᾶς", "ήταν")] == \
            ["αλλάζω", "αποκτώ", "της", "ή", "μιας", "ήταν"]
        assert bc.lemma_key("ἀλλάζω") == "αλλάζω"
        # сверка словарных форм с известными словами
        words = [{"lemma": k, "head": k} for k in ("μπορούσα", "μπορώ", "λλάζω", "μεγαλώνω", "θέρω", "ξέρω", "ποτέ", "ποτε", "γάτα")]
        info = {"μπορούσα": {"head": "μπορώ"}, "μπορώ": {"head": "μπορώ", "ru": "мочь"}, "λλάζω": {"head": "αλλάζω"},
                "μεγαλώνω": {"head": "μεγαλώνον"}, "θέρω": {"head": "ξερω"}, "ξέρω": {"head": "ξέρω"},
                "ποτέ": {"head": "ποτε"}, "ποτε": {"head": "ποτε"}, "γάτα": {"head": "η γάτα"}}
        merged, reverted = bc.settle_lemmas([{"words": words}], info, {"αλλάζω", "μεγαλώνω", "ποτέ", "πότε"})
        assert (merged, reverted) == (3, 2), (merged, reverted)
        assert [bc.lemma_key(w["head"]) for w in words] == \
            ["μπορώ", "μπορώ", "αλλάζω", "μεγαλώνω", "ξέρω", "ξέρω", "ποτέ", "ποτε", "γάτα"]
        assert info["μπορώ"]["ru"] == "мочь" and info["μεγαλώνω"]["head"] == "μεγαλώνω" and info["ποτέ"]["head"] == "ποτέ"
        assert "μπορούσα" not in info and "λλάζω" not in info and info["αλλάζω"]["head"] == "αλλάζω"
        # уровень формы сверяется с той же грамматикой в книге
        aor = "Aspect=Perf|Mood=Ind|Number=Sing|Person=3|Tense=Past|VerbForm=Fin|Voice=Act"
        items = {f"f{i}": (f"f{i}", "x", "y", "VERB", aor, "") for i in range(10)}
        items["k"] = ("k", "x", "y", "ADJ", "Case=Gen|Number=Sing", "")
        forms = {f"f{i}": ["аорист", "", "A2"] for i in range(10)}
        forms["f8"] = ["аорист", "", "B1"]; forms["f9"] = ["аорист", "", "C1"]; forms["k"] = ["род. п.", "", "B1"]
        kept = forms["f8"]
        assert bc.calibrate_form_levels(forms, items) == 1
        assert forms["f8"][2] == "A2" and kept[2] == "B1" and forms["f9"][2] == "C1" and forms["k"][2] == "B1"

        assert FakeClient.bad == 1, "негодная пачка — один раз"
        assert book["sentences"][1][2] == "перевод 1", "после негодной пачки — по одному предложению"
        # второй запуск — всё из кеша
        before = FakeClient.calls
        bc.main(["story", *args], nlp=FakeNLP(), client=FakeClient())
        assert FakeClient.calls == before, "повторная сборка снова спрашивала модель"

        # новое слово в начале главы сдвигает все пачки лемм — но кеш по одной лемме: спрашивается только новое
        (pub / "01.txt").write_text("Ο Νίκος σήμερα έριξε μια γρήγορη ματιά. Καμιά φορά πίνει καφέ.", encoding="utf-8")
        FakeClient.lemma_prompts.clear()
        bc.main(["story", *args], nlp=FakeNLP(), client=FakeClient())
        assert len(FakeClient.lemma_prompts) == 1 and FakeClient.lemma_prompts[0].count("\n") == 0 \
            and "σήμερα" in FakeClient.lemma_prompts[0], FakeClient.lemma_prompts
        print("tools/library: конвертер — всё в порядке")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    main()
