"""Конвертер библиотеки: греческий текст -> книга для читалки сайта (library/).

Конвейер:
  1. Stanza: предложения, слова, леммы, грамматика (локально, бесплатно).
  2. Языковая модель (настраивается в config.json; gemini / groq / openrouter / ollama / custom):
       • перевод предложения и значение каждого слова в контексте, словарная форма с артиклем;
       • словарные значения лемм (рус. и англ.) и часть речи;
       • обороты — устойчивые выражения из нескольких слов (ρίχνω μια ματιά — «взглянуть»).
     argos — старый офлайн-переводчик; none — только морфология.
  3. Каждый ответ модели кешируется в cache/. Упёрлись в дневной лимит — запусти ещё раз позже,
     конвертер продолжит с того же места.

Книги лежат папками, в каждой — book.json (название, автор, уровень…) и главы *.txt:
  texts/<id>/    — публичные: книга попадёт на сайт (library/books/<id>.js). Только тексты,
                   которые можно выкладывать: свои, общественное достояние, с разрешения.
  private/<id>/  — личные (в .gitignore): library/local/books/<id>.js, видны только при запуске с диска.
После каждой сборки обновляются каталоги (library/catalog.js, library/local/catalog.js) и словарь
сайта library/dict.js — формы, леммы и обороты из ВСЕХ книг, без предложений и текстов.

Примеры:
  python bookconverter.py                    # какие книги есть
  python bookconverter.py demo               # собрать книгу texts/demo (или private/demo)
  python bookconverter.py --all              # все книги
  python bookconverter.py potter --offline   # только из кеша, без запросов к модели
  python bookconverter.py potter --limit 5   # только 5 предложений в главе (проверить качество)
  python bookconverter.py potter --html      # ещё и один самодостаточный файл out/potter.html
  python bookconverter.py --dict             # только пересобрать каталоги и словарь из готовых книг
  python bookconverter.py --list-models      # какие модели доступны у провайдера
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent          # tools/library
REPO_DIR = BASE_DIR.parent.parent
LIB_DIR = REPO_DIR / "library"                      # страницы библиотеки на сайте
TEXTS_DIR = BASE_DIR / "texts"                      # публичные книги (в git, попадают на сайт)
PRIVATE_DIR = BASE_DIR / "private"                  # личные книги (в .gitignore)
OUT_DIR = BASE_DIR / "out"                          # самодостаточные html (--html, в .gitignore)
CONFIG_PATH = BASE_DIR / "config.json"              # ключ API — только локально (.gitignore)
CACHE_DIR = BASE_DIR / "cache"
DATA_VERSION = 3   # 3: + обороты (phrases)
PROMPT_VERSION = "2"  # меняется при правке промптов -> кеш не смешивается
LEMMA_PROMPT_VERSION = "3"  # отдельно: правка словаря не сбрасывает дорогой контекстный перевод
PHRASE_PROMPT_VERSION = "1"  # обороты — свой проход и свой кеш: старые ответы остаются в силе
BOOK_ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]*$")

# Бесплатные провайдеры с OpenAI-совместимым API.
# model можно переопределить в config.json; список моделей: --list-models.
PRESETS = {
    "gemini": {
        "base_url": "https://generativelanguage.googleapis.com/v1beta/openai",
        "model": "gemini-flash-lite-latest",
        "key_env": "GEMINI_API_KEY",
        "interval": 4.5,  # бесплатно ~15 запросов в минуту
        "batch_words": 80,
    },
    "groq": {
        "base_url": "https://api.groq.com/openai/v1",
        "model": "openai/gpt-oss-120b",
        "key_env": "GROQ_API_KEY",
        "interval": 2.5,
        "batch_words": 45,  # у Groq маленький лимит токенов в минуту
        "extra": {"reasoning_effort": "low"},
    },
    "openrouter": {
        "base_url": "https://openrouter.ai/api/v1",
        "model": "openrouter/free",
        "key_env": "OPENROUTER_API_KEY",
        "interval": 3.5,
        "batch_words": 80,
    },
    "ollama": {
        "base_url": "http://localhost:11434/v1",
        "model": "gemma3:12b",
        "key_env": "",
        "interval": 0,
        "batch_words": 40,  # локальным моделям проще с короткими пачками
    },
    "custom": {
        "base_url": "",
        "model": "",
        "key_env": "LLM_API_KEY",
        "interval": 1,
        "batch_words": 60,
    },
}

DEFAULT_CONFIG = {
    "provider": "gemini",
    "model": "",
    "api_key": "",
    "base_url": "",
    "batch_words": 0,
    "interval": None,
}

ARTICLE_RE = re.compile(r"^(?:ο|η|το|οι|τα|ένας|μία|μια|ένα)\s+", re.IGNORECASE)


# ─────────────────────────── утилиты ───────────────────────────

def log(message: str = "") -> None:
    print(message, flush=True)


def bare_lemma(head: str) -> str:
    """'το αγόρι' -> 'αγόρι'. Ключ карточки не зависит от артикля."""
    head = unicodedata.normalize("NFC", head.strip())
    stripped = ARTICLE_RE.sub("", head)
    return stripped or head


def lemma_key(head: str) -> str:
    return bare_lemma(head).lower()


def has_letters(text: str) -> bool:
    return any(ch.isalpha() for ch in text)


def has_greek(text: str) -> bool:
    return any("\u0370" <= ch <= "\u03ff" or "\u1f00" <= ch <= "\u1fff" for ch in text)


def pure_greek(text: str) -> bool:
    """Все буквы — греческие. Модель (особенно лёгкая) иногда вставляет в греческое слово кириллицу или
    латиницу: «τίποта», «то μυστήριο», «enas» — такие формы не берём."""
    return has_greek(text) and all(not ch.isalpha() or "\u0370" <= ch <= "\u03ff" or "\u1f00" <= ch <= "\u1fff"
                                   for ch in text)


class QuotaExhausted(Exception):
    """Провайдер исчерпал лимит; продолжим при следующем запуске."""


class BadReply(Exception):
    """Модель не дала годного ответа на этот кусок (фильтр, пустой ответ, мусор).
    Кусок пропускаем, остальное переводим дальше."""


# ─────────────────────────── конфигурация ───────────────────────────

def read_jsonc(path: Path) -> dict:
    """JSON, где строки с // в начале — комментарии (обычный JSON их не допускает)."""
    lines = path.read_text(encoding="utf-8-sig").splitlines()
    clean = "\n".join(line for line in lines if not line.lstrip().startswith("//"))
    try:
        loaded = json.loads(clean)
    except json.JSONDecodeError as exc:
        raise SystemExit(f"{path.name} содержит ошибку: {exc}") from exc
    if not isinstance(loaded, dict):
        raise SystemExit(f"{path.name}: ожидался объект {{…}}")
    return loaded


def load_config(args: argparse.Namespace) -> dict:
    """Настройки переводчика: config.json (локальный, с ключом) + аргументы командной строки.
    Что переводить, теперь решают папки книг (texts/, private/), а не config.json."""
    config = dict(DEFAULT_CONFIG)
    if CONFIG_PATH.is_file():
        loaded = read_jsonc(CONFIG_PATH)
        # "translator" — новое имя поля, "provider" — старое; понимаем оба.
        if "translator" in loaded:
            loaded["provider"] = loaded.pop("translator")
        config.update({k: v for k, v in loaded.items() if k in DEFAULT_CONFIG})
    for name in ("provider", "model", "api_key", "base_url"):
        value = getattr(args, name, None)
        if value:
            config[name] = value
    if args.batch_words:
        config["batch_words"] = args.batch_words

    provider = config["provider"]
    if provider in PRESETS:
        preset = PRESETS[provider]
        config["base_url"] = config.get("base_url") or preset["base_url"]
        config["model"] = config.get("model") or preset["model"]
        config["batch_words"] = config.get("batch_words") or preset["batch_words"]
        if config.get("interval") is None:
            config["interval"] = preset["interval"]
        config["extra"] = preset.get("extra", {})
        if not config.get("api_key") and preset["key_env"]:
            config["api_key"] = os.environ.get(preset["key_env"], "")
        config["key_env"] = preset["key_env"]
    elif provider not in ("argos", "none"):
        raise SystemExit(
            f"Неизвестный provider '{provider}'. Варианты: "
            + ", ".join([*PRESETS, "argos", "none"])
        )
    return config


# ─────────────────────────── 1. Stanza ───────────────────────────

def analyze_text(text: str, nlp) -> tuple[list[dict], list[dict]]:
    """Возвращает (sentences, words) с позициями в Unicode-символах."""
    doc = nlp(text)
    sentences: list[dict] = []
    words: list[dict] = []
    previous_end = 0

    for sentence in doc.sentences:
        tokens = list(sentence.tokens)
        if not tokens:
            continue
        s_index = len(sentences)
        sentences.append({"start": tokens[0].start_char, "end": tokens[-1].end_char})

        for token in tokens:
            start, end = token.start_char, token.end_char
            if not (isinstance(start, int) and isinstance(end, int)
                    and previous_end <= start < end <= len(text)):
                raise ValueError(f"Некорректные позиции токена: {start!r}, {end!r}")
            previous_end = end
            form = text[start:end]
            # Пунктуация, числа, ссылки и латиница остаются обычным текстом.
            if not has_greek(form):
                continue

            parts = list(token.words) or []
            # Слитные формы (στο = σε + το) Stanza делит на несколько слов.
            lemma = " + ".join(w.lemma or "" for w in parts if w.lemma) or form
            upos = "+".join(w.upos or "" for w in parts if w.upos)
            feats = (parts[-1].feats or "") if parts else ""
            words.append({
                "start": start,
                "end": end,
                "s": s_index,
                "form": form,
                "lemma": lemma,
                "upos": upos,
                "feats": feats,
            })
    return sentences, words


def load_stanza():
    try:
        import stanza
    except ImportError as exc:
        raise SystemExit("Нужна библиотека stanza: pip install stanza") from exc
    return stanza.Pipeline(
        "el", processors="tokenize,mwt,pos,lemma", verbose=False
    )


# ─────────────────────────── кеш ───────────────────────────

class Cache:
    """Все ответы модели, ключ — хеш промпта. Один файл на все книги и главы:
    одинаковый кусок текста никогда не переводится дважды."""

    def __init__(self, path: Path):
        self.path = path
        self.data: dict = {}
        # Старые версии писали отдельный файл на книгу (cache/textinput_prod.json) —
        # подхватываем их, чтобы не платить за уже полученные ответы.
        for file in sorted(path.parent.glob("*.json")) if path.parent.is_dir() else []:
            try:
                loaded = json.loads(file.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                log(f"Кеш {file.name} повреждён — пропускаю.")
                continue
            if isinstance(loaded, dict):
                for key, value in loaded.items():
                    self.data.setdefault(key, value)

    def get(self, key: str):
        return self.data.get(key)

    def put(self, key: str, value) -> None:
        self.data[key] = value
        self.path.parent.mkdir(exist_ok=True)
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps(self.data, ensure_ascii=False), encoding="utf-8")
        tmp.replace(self.path)


def digest(*parts: str) -> str:
    return hashlib.sha1("\x1f".join(parts).encode("utf-8")).hexdigest()[:20]


# ─────────────────────────── 2a. LLM-клиент ───────────────────────────

class LLMClient:
    def __init__(self, config: dict):
        self.base_url = config["base_url"].rstrip("/")
        self.model = config["model"]
        self.api_key = config.get("api_key", "")
        self.interval = float(config.get("interval") or 0)
        self.extra = dict(config.get("extra") or {})
        self.json_mode = True
        self.last_call = 0.0
        # offline: лимит исчерпан или запуск с --offline — берём только из кеша.
        self.offline = bool(config.get("offline"))
        if not self.base_url or not self.model:
            raise SystemExit("Для провайдера нужно указать base_url и model в config.json.")

    def _request(self, path: str, payload: dict | None = None, timeout: int = 240):
        url = f"{self.base_url}{path}"
        data = json.dumps(payload).encode("utf-8") if payload is not None else None
        request = urllib.request.Request(url, data=data, method="POST" if data else "GET")
        request.add_header("Content-Type", "application/json")
        if self.api_key:
            request.add_header("Authorization", f"Bearer {self.api_key}")
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))

    def list_models(self) -> list[str]:
        result = self._request("/models")
        return sorted(item.get("id", "") for item in result.get("data", []))

    def chat_json(self, system: str, user: str) -> dict:
        attempt = 0
        while True:
            attempt += 1
            wait = self.interval - (time.monotonic() - self.last_call)
            if wait > 0:
                time.sleep(wait)
            payload = {
                "model": self.model,
                "temperature": 0.2,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                **self.extra,
            }
            if self.json_mode:
                payload["response_format"] = {"type": "json_object"}
            self.last_call = time.monotonic()
            try:
                result = self._request("/chat/completions", payload)
                choice = (result.get("choices") or [{}])[0]
                message = choice.get("message") or {}
                content = message.get("content") or ""
                if not content.strip():
                    # Пустой ответ: обычно сработал фильтр модели (у Gemini —
                    # RECITATION/SAFETY на известных книгах). Повтор не поможет.
                    reason = choice.get("finish_reason") or result.get("promptFeedback") or "пустой ответ"
                    raise BadReply(f"модель ничего не вернула ({reason})")
                return parse_json_reply(content)
            except urllib.error.HTTPError as exc:
                body = exc.read().decode("utf-8", "replace")[:800]
                if exc.code == 400 and (self.json_mode or self.extra):
                    # Некоторые модели не понимают json-режим или доп. параметры.
                    self.json_mode = False
                    self.extra = {}
                    continue
                if exc.code in (401, 403):
                    raise SystemExit(
                        f"Провайдер отказал в доступе ({exc.code}). Проверь api_key.\n{body}"
                    ) from exc
                if exc.code == 404:
                    raise SystemExit(
                        f"Модель или адрес не найдены (404): {self.model}\n"
                        "Список моделей: python bookconverter.py --list-models\n" + body
                    ) from exc
                if exc.code == 429:
                    delay = retry_delay(exc, body)
                    if delay is None or delay > 180 or attempt > 8:
                        raise QuotaExhausted(body) from exc
                    log(f"   лимит запросов, жду {delay:.0f} с…")
                    time.sleep(delay)
                    continue
                if exc.code >= 500 and attempt <= 4:
                    time.sleep(5 * attempt)
                    continue
                raise RuntimeError(f"HTTP {exc.code}: {body}") from exc
            except (urllib.error.URLError, TimeoutError, ConnectionError) as exc:
                if attempt <= 3:
                    log(f"   сеть: {exc}; повтор…")
                    time.sleep(5 * attempt)
                    continue
                raise RuntimeError(f"Нет связи с {self.base_url}: {exc}") from exc
            except (ValueError, KeyError, IndexError, TypeError) as exc:
                if attempt <= 2:
                    log("   модель вернула не-JSON, повторяю…")
                    continue
                raise BadReply(f"не удалось разобрать ответ: {exc}") from exc


def retry_delay(exc: urllib.error.HTTPError, body: str) -> float | None:
    lowered = body.lower()
    if any(marker in lowered for marker in ("per day", "perday", "requests per day", "rpd", "daily")):
        return None
    header = exc.headers.get("Retry-After") if exc.headers else None
    if header:
        try:
            return float(header) + 1
        except ValueError:
            pass
    match = re.search(r"(?:retry|try again)[^0-9]{0,40}?(\d+(?:\.\d+)?)\s*(ms|s)", lowered)
    if match:
        value = float(match.group(1))
        return (value / 1000 if match.group(2) == "ms" else value) + 1
    return 20.0


def parse_json_reply(content: str) -> dict:
    content = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL).strip()
    content = re.sub(r"^```(?:json)?\s*|\s*```$", "", content).strip()
    start, end = content.find("{"), content.rfind("}")
    if start < 0 or end <= start:
        raise ValueError("в ответе нет JSON-объекта")
    return json.loads(content[start:end + 1])



class Progress:
    """Красивый прогресс в консоли: полоска, % , кеш, оценка оставшегося времени."""

    def __init__(self, title: str, total: int, unit: str):
        self.title, self.total, self.unit = title, max(total, 1), unit
        self.done = self.cached = self.fresh = 0
        self.fresh_seconds = 0.0
        self.started = time.monotonic()
        log(f"\n{title}")

    def step(self, amount: int, from_cache: bool, seconds: float = 0.0, sample: str = "") -> None:
        self.done += amount
        if from_cache:
            self.cached += 1
        else:
            self.fresh += 1
            self.fresh_seconds += seconds
        share = min(1.0, self.done / self.total)
        bar = "█" * round(share * 24) + "░" * (24 - round(share * 24))
        line = f"   {bar} {share * 100:5.1f}%  {self.done}/{self.total} {self.unit}"
        if self.cached:
            line += f" · из кеша {self.cached}"
        if self.fresh and share < 1:
            per_unit = self.fresh_seconds / max(1, self.done)
            line += f" · осталось ~{format_duration(per_unit * (self.total - self.done))}"
        log(line)
        if sample:
            log(f"      {sample}")

    def finish(self) -> None:
        log(f"   готово за {format_duration(time.monotonic() - self.started)}"
            f" · запросов к модели: {self.fresh} · из кеша: {self.cached}")


def format_duration(seconds: float) -> str:
    seconds = int(seconds)
    if seconds < 60:
        return f"{seconds} с"
    return f"{seconds // 60} мин {seconds % 60:02d} с"


def sample_glosses(w_map: dict, limit: int = 3) -> str:
    """Пара примеров из только что переведённой пачки — чтобы было видно, что происходит."""
    unique = {w["form"].lower(): w for w in w_map.values()}
    content = [w for w in unique.values()
               if w.get("ru") and not w["ru"].startswith("(") and len(w["form"]) > 4]
    content.sort(key=lambda w: -len(w["form"]))
    picked = sorted(content[:limit], key=lambda w: w["start"])
    return " · ".join(f"{w['form']} → {w['ru']}" for w in picked)

# ─────────────────────────── 2b. Промпты ───────────────────────────

CONTEXT_SYSTEM = """You are an expert in Modern Greek and a professional Greek→Russian translator.
You help a Russian-speaking learner read a Greek book word by word.

Input: numbered sentences (S1, S2, …). After each sentence comes the list of its words as "number=word".

Return ONLY one JSON object, no markdown:
{"sentences": [[1, "Russian translation of S1"], ...],
 "words": [[word_number, "dictionary form", "Russian meaning here"], ...]}

Rules:
1. Include EVERY sentence number and EVERY word number exactly once, in order.
2. Sentence translation: natural, faithful literary Russian.
3. Dictionary form (Modern Greek, monotonic accents):
   - nouns: nominative singular WITH article: "ο κύριος", "η ζωή", "το αγόρι" (plural-only nouns: plural with article);
   - adjectives, participles, pronouns, articles: masculine nominative singular ("φυσιολογικός", "αυτός", "ο");
   - verbs: 1st person singular present ("μένω"; deponents: "έρχομαι");
   - contractions/elisions: full forms joined with " + " ("στο" → "σε + ο", "σ'" → "σε", "απ'" → "από");
   - proper names: nominative, as in the text.
4. Russian meaning: 1–4 words — what THIS form means in THIS sentence, in a matching Russian form
   (έμεναν → "жили", ανθρώπους → "людей"). Names: Russian transliteration.
   Function words: short role in brackets, e.g. "(артикль)", "να" → "чтобы" or "(частица: сослагат.)", "θα" → "(частица буд. вр.)".
5. Never mix alphabets: Greek words in Greek letters only (no Cyrillic or Latin letters inside them),
   Russian in Cyrillic only.
"""

LEMMA_SYSTEM = """You are a Modern Greek lexicographer writing a Greek→Russian learner's dictionary (flashcards).
Input: numbered Greek headwords produced by an automatic tagger, each with a Russian hint in brackets
showing how the word was used in the book. The headword may be wrong (wrong lemma, missing accent,
inflected form instead of the dictionary form).

Return ONLY one JSON object, no markdown:
{"lemmas": [[number, "correct headword", "Russian", "English", "part of speech"], ...]}

Rules:
- Include EVERY number exactly once.
- Correct headword: the proper Modern Greek dictionary form with accents. Nouns WITH article
  ("το βήμα"); adjectives masculine nominative singular ("όλος", not "ολος"); verbs 1st person
  singular present ("κάθομαι", not "καθόταν"). If the input is already correct, repeat it unchanged.
- Russian: 1–3 meanings in DICTIONARY FORM ONLY, separated by "; ", the sense used in the book first:
  verbs as infinitives ("останавливаться", never "остановился"), adjectives masculine nominative
  ("широкий", never "широкая"), nouns nominative singular. The hint is only for choosing the sense —
  never copy its inflected form.
- English: 1–3 meanings, dictionary form ("to stop", "wide").
- Part of speech, short Russian label: "сущ., м. р." / "сущ., ж. р." / "сущ., ср. р." / "гл." / "прил." /
  "нареч." / "мест." / "предл." / "союз" / "част." / "числ." / "арт." / "межд." / "имя собств.".
- Never mix alphabets: the Greek headword in Greek letters only (no Cyrillic or Latin letters inside it),
  Russian in Cyrillic only.
"""


def make_batches(sentences: list[dict], words: list[dict], limit_words: int) -> list[list[int]]:
    per_sentence: dict[int, int] = {}
    for word in words:
        per_sentence[word["s"]] = per_sentence.get(word["s"], 0) + 1
    batches: list[list[int]] = []
    current: list[int] = []
    count = 0
    for s_index in range(len(sentences)):
        n = per_sentence.get(s_index, 0)
        if n == 0:
            continue
        if current and count + n > limit_words:
            batches.append(current)
            current, count = [], 0
        current.append(s_index)
        count += n
    if current:
        batches.append(current)
    return batches


def context_prompt(text: str, sentences: list[dict], by_sentence: dict[int, list[dict]],
                   batch: list[int]) -> tuple[str, dict, dict]:
    lines: list[str] = []
    s_map: dict[int, int] = {}
    w_map: dict[int, dict] = {}
    n = 0
    for local_s, s_index in enumerate(batch, start=1):
        s_map[local_s] = s_index
        sentence = sentences[s_index]
        sentence_text = " ".join(text[sentence["start"]:sentence["end"]].split())
        lines.append(f"S{local_s}: {sentence_text}")
        items = []
        for word in by_sentence[s_index]:
            n += 1
            w_map[n] = word
            items.append(f"{n}={word['form']}")
        lines.append("   " + " | ".join(items))
    return "\n".join(lines), s_map, w_map


def ask(client: LLMClient, cache: Cache, key: str, system: str, prompt: str,
        what: str) -> tuple[dict | None, bool]:
    """Ответ из кеша или от модели.
    Возвращает (ответ, из_кеша). None — ответа нет и сейчас не будет (лимит или --offline);
    {} — модель не дала годного ответа на этот кусок."""
    reply = cache.get(key)
    if reply is not None:
        return reply, True
    if client.offline:
        return None, False
    try:
        reply = client.chat_json(system, prompt)
    except QuotaExhausted as exc:
        client.offline = True
        log("\n⚠ Провайдер исчерпал лимит запросов. Дальше беру только то, что уже есть в кеше.\n"
            "   Запусти скрипт позже (или с другим translator) — он продолжит с этого места.\n"
            f"   Ответ сервера: {str(exc)[:300]}\n")
        return None, False
    except BadReply as exc:
        log(f"   ! {what}: {exc}")
        return {}, False
    cache.put(key, reply)
    return reply, False


def run_llm(text: str, sentences: list[dict], words: list[dict], config: dict,
            cache: Cache, client: LLMClient) -> bool:
    """Заполняет sentences[i]['ru'] и words[i]['head'/'ru']. Возвращает True, если всё переведено."""
    by_sentence: dict[int, list[dict]] = {}
    for word in words:
        by_sentence.setdefault(word["s"], []).append(word)

    batches = make_batches(sentences, words, int(config["batch_words"]))
    complete = True
    total_words = sum(len(by_sentence[s]) for batch in batches for s in batch)
    progress = Progress(f"Перевод в контексте · {config['model']} · ~{len(batches)} запросов",
                        total_words, "слов")

    def apply(batch: list[int], reply: dict, s_map: dict, w_map: dict) -> set[int]:
        for item in reply.get("sentences", []):
            if isinstance(item, list) and len(item) >= 2 and item[0] in s_map:
                sentences[s_map[item[0]]]["ru"] = str(item[1]).strip()
        for item in reply.get("words", []):
            if isinstance(item, list) and len(item) >= 3 and item[0] in w_map:
                word = w_map[item[0]]
                head = unicodedata.normalize("NFC", str(item[1]).strip())
                if head and pure_greek(head):
                    word["head"] = head
                word["ru"] = str(item[2]).strip()
        missing = {w["s"] for w in w_map.values() if "ru" not in w}
        missing |= {s for s in batch if "ru" not in sentences[s]}
        return missing

    retry: list[int] = []
    for number, batch in enumerate(batches, start=1):
        prompt, s_map, w_map = context_prompt(text, sentences, by_sentence, batch)
        key = digest("ctx", PROMPT_VERSION, config["model"], prompt)
        began = time.monotonic()
        reply, from_cache = ask(client, cache, key, CONTEXT_SYSTEM, prompt,
                                f"пачка {number} — переспрошу по предложениям")
        if reply is None:
            complete = False
        else:
            retry.extend(sorted(apply(batch, reply, s_map, w_map)))
        progress.step(len(w_map), from_cache, time.monotonic() - began,
                      "" if from_cache or not reply else sample_glosses(w_map))
    progress.finish()

    if retry and not client.offline:
        log(f"   дозапрос {len(retry)} предложений, которые модель пропустила")
    for s_index in retry:
        prompt, s_map, w_map = context_prompt(text, sentences, by_sentence, [s_index])
        key = digest("ctx", PROMPT_VERSION, config["model"], prompt)
        reply, _ = ask(client, cache, key, CONTEXT_SYSTEM, prompt,
                       f"предложение {s_index + 1} пропущено")
        if reply is None:
            complete = False
        elif reply and apply([s_index], reply, s_map, w_map):
            log(f"   ! предложение {s_index + 1} разобрано не полностью")
    return complete


def lemma_entries(words: list[dict]) -> list[tuple[str, str, str]]:
    """Уникальные леммы: (key, head, пример значения в книге)."""
    seen: dict[str, tuple[str, str, str]] = {}
    for word in words:
        head = word.get("head") or word["lemma"]
        key = lemma_key(head)
        if key not in seen:
            seen[key] = (key, head, word.get("ru", ""))
    return list(seen.values())


LEMMA_BATCH = 60


def lemma_batches(words: list[dict], known: dict | None = None):
    entries = [e for e in lemma_entries(words) if not known or e[0] not in known]
    for i in range(0, len(entries), LEMMA_BATCH):
        chunk = entries[i:i + LEMMA_BATCH]
        prompt = "\n".join(
            f"{n}. {head}" + (f"  [{hint}]" if hint else "")
            for n, (_, head, hint) in enumerate(chunk, start=1)
        )
        yield chunk, prompt


def apply_lemma_reply(chunk, reply: dict, info: dict) -> None:
    for item in reply.get("lemmas", []):
        if not (isinstance(item, list) and item and isinstance(item[0], int)
                and 1 <= item[0] <= len(chunk)):
            continue
        key, head, _ = chunk[item[0] - 1]
        if len(item) >= 5:      # [n, исправленная форма, ru, en, pos]
            fixed = unicodedata.normalize("NFC", str(item[1]).strip())
            head = fixed if pure_greek(fixed) else head
            ru, en, pos = item[2], item[3], item[4]
        elif len(item) == 4:    # старый формат без исправленной формы
            ru, en, pos = item[1], item[2], item[3]
        else:
            continue
        info[key] = {"head": head, "ru": str(ru).strip(), "en": str(en).strip(), "pos": str(pos).strip()}


def run_lemmas(words: list[dict], client: LLMClient, config: dict, cache: Cache,
               info: dict) -> bool:
    """Дописывает в info словарные значения новых лемм (уже известные по прошлым главам
    не запрашиваются). Возвращает True, если все получены."""
    batches = list(lemma_batches(words, info))
    if not batches:
        log("\nСловарные значения: все леммы уже известны по прошлым главам")
        return True
    complete = True
    progress = Progress(f"Словарные значения · ~{len(batches)} запросов",
                        sum(len(c) for c, _ in batches), "лемм")
    for chunk, prompt in batches:
        key = digest("lemma", LEMMA_PROMPT_VERSION, config["model"], prompt)
        began = time.monotonic()
        reply, from_cache = ask(client, cache, key, LEMMA_SYSTEM, prompt,
                                f"{len(chunk)} лемм пропущено")
        if reply is None:
            complete = False
            reply = {}
        apply_lemma_reply(chunk, reply, info)
        sample = ""
        if reply and not from_cache:
            shown = [info[k] for k, _, _ in chunk if k in info and len(k) > 4][:2]
            sample = " · ".join(f"{e['head']} — {e['ru']}" for e in shown)
        progress.step(len(chunk), from_cache, time.monotonic() - began, sample)
    progress.finish()
    return complete


# ─────────────────────────── 2c. Обороты ───────────────────────────
# Отдельный проход: модель отмечает в пачке предложений устойчивые выражения из нескольких слов.
# В книгу оборот идёт с номерами своих слов, в словарь сайта — только словарная форма, леммы и перевод.

PHRASE_SYSTEM = """You are a Modern Greek lexicographer. You help a Russian-speaking learner who reads a Greek
text word by word and gets SET EXPRESSIONS wrong when each word is translated separately.

Input: numbered sentences (S1, S2, …). After each sentence comes the list of its words as "number=word".

Find set expressions — multi-word units that a good dictionary lists as one entry:
- verb collocations and idioms: "ρίχνω μια ματιά" (взглянуть), "παίρνω μέρος" (участвовать),
  "κάνω μπάνιο" (купаться), "βάζω μπροστά" (заводить мотор), "έχω δίκιο" (быть правым), "κάνω πως" (делать вид);
- adverbial and prepositional phrases: "καμιά φορά" (иногда), "σε λίγο" (вскоре), "για πρώτη φορά" (впервые),
  "στο κάτω κάτω" (в конце концов), "σύμφωνα με" (согласно), "εξαιτίας" + gen. (из-за);
- fixed phrases and formulas: "τι να κάνουμε" (что поделаешь), "δεν πειράζει" (ничего страшного).
Skip free combinations whose meaning is simply the sum of the words (article + noun, adjective + noun,
"μεγάλο σπίτι", "πίνω καφέ") and skip proper names.

Return ONLY one JSON object, no markdown:
{"phrases": [[[word numbers], "dictionary form", "Russian meaning"], ...]}

Rules:
1. Word numbers: ALL words of the expression as they stand in the text, 2–5 words from ONE sentence;
   they may be non-adjacent ("έριξε μια γρήγορη ματιά" → the numbers of έριξε, μια, ματιά).
2. Dictionary form: the expression as a dictionary lists it, verbs in 1st person singular present
   ("ρίχνω μια ματιά", not "έριξε μια ματιά"); a variable slot as "κάποιον" / "κάτι" ("έχω σχέση με κάτι").
3. Russian meaning: 1–4 words in dictionary form ("взглянуть; бросить взгляд").
4. No set expressions in the input — return {"phrases": []}.
5. Never mix alphabets: the Greek dictionary form in Greek letters only, the Russian meaning in Cyrillic only.
"""

PHRASE_MAX_WORDS = 5     # слов текста в обороте
PHRASE_MAX_HEAD = 6      # слов в словарной форме (с «κάτι», «κάποιον»)
# Служебные слова и «места» (κάτι, κάποιον) могут стоять в словарной форме, даже если в тексте их нет
# или они другие (έριξε μιαν ματιά → ρίχνω μια ματιά). Все остальные слова словарной формы должны быть
# в тексте оборота — формой или леммой.
PHRASE_FREE = ("ο η το οι τα τον την τη του της των τους στο στη στην στον στα στις στους σε σ με μ για γι από απ "
               "ένας μια μιαν ένα έναν μου σου μας σας να θα δεν δε μη μην και κι ή πως ότι που").split()
PHRASE_SLOTS = "κάτι κάποιον κάποια κάποιο κάποιου κάποιας κάποιοι κάποιους".split()
GREEK_TOKEN_RE = re.compile(r"^[\u0370-\u03ff\u1f00-\u1fff'’]+$")
CYRILLIC_RE = re.compile(r"[\u0400-\u04ff]")


def check_phrase(head: str, ru: str, members: list[dict]) -> str | None:
    """Проверка оборота от модели. members — его слова в тексте: {"form", "lemma", "upos"}.
    Возвращает словарную форму (глагол, записанный формой из текста, заменён леммой:
    «παρίστανε πως» → «παριστάνω πως») или None — оборот отбросить: опечатка или выдумка в словарной
    форме, перевод не по-русски, слова не те, что в тексте, одни служебные слова."""
    tokens = head.split()
    if not 2 <= len(tokens) <= PHRASE_MAX_HEAD or not all(GREEK_TOKEN_RE.match(t) for t in tokens):
        return None
    if not CYRILLIC_RE.search(ru) or has_greek(ru):
        return None
    norm = lambda x: fold(x).strip("'")
    free = {norm(x) for x in PHRASE_FREE + PHRASE_SLOTS}
    forms = {norm(m["form"]) for m in members}
    lemmas = {norm(bare_lemma(m["lemma"])) for m in members}
    verbs = [m for m in members if "VERB" in m.get("upos", "")
             or ("AUX" in m.get("upos", "") and norm(m["lemma"]) in ("είμαι", "έχω"))]
    unaccent = lambda x: "".join(ch for ch in unicodedata.normalize("NFD", x) if not unicodedata.combining(ch))
    for verb in verbs:
        lemma = bare_lemma(verb["lemma"])
        folded = [norm(t) for t in tokens]
        if norm(lemma) in folded:
            continue
        # опечатка модели в глаголе словарной формы (ανοιγώ, παιρνώ, σηκώνομαι при лемме σηκώνω) — берём лемму,
        # если она с ударением; если ударения нет у леммы (βαζω) — оставляем слово модели
        a = unaccent(norm(lemma))
        for i, t in enumerate(folded):
            b = unaccent(t)
            common = next((k for k, (x, y) in enumerate(zip(a, b)) if x != y), min(len(a), len(b)))
            if a == b or common >= max(5, len(a) - 3):
                if unaccent(norm(lemma)) != norm(lemma) or len(a) <= 3:
                    tokens[i] = lemma
                    folded[i] = norm(lemma)
                break
        else:
            # глагол записан формой из текста — так и оставляем: «τι γίνεται», «κάτι τρέχει» — безличные обороты
            if norm(verb["form"]) not in folded:
                return None
    folded = [norm(t) for t in tokens]
    known = forms | lemmas | {unaccent(x) for x in forms | lemmas}
    if any(t not in free and t not in known and unaccent(t) not in known for t in folded):
        return None
    if all(t in free for t in folded):
        return None
    return " ".join(tokens)


def dictionary_head(word: dict, lemma_info: dict) -> str:
    """Словарная форма слова: исправленная проходом лемм (если без смеси алфавитов), иначе — из перевода в контексте."""
    head = word.get("head") or word["lemma"]
    fixed = (lemma_info.get(lemma_key(head)) or {}).get("head", "")
    return fixed if pure_greek(fixed) else head


def apply_phrase_reply(reply: dict, w_map: dict, index_of: dict, found: dict, lemma_info: dict | None = None) -> None:
    for item in reply.get("phrases", []) if isinstance(reply, dict) else []:
        if not (isinstance(item, list) and len(item) >= 3 and isinstance(item[0], list)):
            continue
        numbers = sorted({n for n in item[0] if isinstance(n, int) and n in w_map})
        if not 2 <= len(numbers) <= PHRASE_MAX_WORDS:
            continue
        members = [w_map[n] for n in numbers]
        if len({w["s"] for w in members}) != 1 or any("PROPN" in w.get("upos", "") for w in members):
            continue
        ru = " ".join(str(item[2]).split())
        head = check_phrase(unicodedata.normalize("NFC", " ".join(str(item[1]).split())), ru,
                            [{"form": w["form"], "lemma": dictionary_head(w, lemma_info or {}), "upos": w.get("upos", "")}
                             for w in members])
        if not head:
            continue
        indices = tuple(index_of[id(w)] for w in members)
        found.setdefault(indices, {"w": list(indices), "head": head, "ru": ru})


def run_phrases(text: str, sentences: list[dict], words: list[dict], config: dict,
                cache: Cache, client: LLMClient, lemma_info: dict | None = None) -> tuple[bool, list[dict]]:
    """Обороты главы: [{"w": [номера слов главы], "head": словарная форма, "ru": перевод}].
    Возвращает (всё ли получено, обороты)."""
    by_sentence: dict[int, list[dict]] = {}
    for word in words:
        by_sentence.setdefault(word["s"], []).append(word)
    index_of = {id(w): i for i, w in enumerate(words)}
    # ответ короткий — пачки вдвое крупнее, чем для перевода
    batches = make_batches(sentences, words, max(120, 2 * int(config["batch_words"])))
    progress = Progress(f"Обороты · {config['model']} · ~{len(batches)} запросов",
                        sum(len(by_sentence[s]) for b in batches for s in b), "слов")
    complete, found = True, {}
    for number, batch in enumerate(batches, start=1):
        prompt, _, w_map = context_prompt(text, sentences, by_sentence, batch)
        key = digest("phr", PHRASE_PROMPT_VERSION, config["model"], prompt)
        began = time.monotonic()
        reply, from_cache = ask(client, cache, key, PHRASE_SYSTEM, prompt, f"обороты, пачка {number}")
        before = len(found)
        if reply is None:
            complete = False
        else:
            apply_phrase_reply(reply, w_map, index_of, found, lemma_info)
        fresh = list(found.values())[before:]
        sample = "" if from_cache else " · ".join(f"{p['head']} — {p['ru']}" for p in fresh[:2])
        progress.step(len(w_map), from_cache, time.monotonic() - began, sample)
    progress.finish()
    phrases = sorted(found.values(), key=lambda p: p["w"])
    log(f"   оборотов в главе: {len(phrases)}")
    return complete, phrases


# ─────────────────────────── 2d. Argos (офлайн) ───────────────────────────

def run_argos(text: str, sentences: list[dict], words: list[dict]) -> dict:
    import argostranslate.translate

    languages = {lang.code: lang for lang in argostranslate.translate.get_installed_languages()}
    if {"el", "en", "ru"} - languages.keys():
        raise SystemExit("В Argos Translate нужны модели el -> en и en -> ru.")
    el_en = languages["el"].get_translation(languages["en"])
    en_ru = languages["en"].get_translation(languages["ru"])
    memo: dict[str, tuple[str, str]] = {}

    def translate(value: str) -> tuple[str, str]:
        if value not in memo:
            english = el_en.translate(value)
            memo[value] = (english, en_ru.translate(english) if english else "")
        return memo[value]

    log(f"2/3 Argos: {len(sentences)} предложений")
    for sentence in sentences:
        sentence["ru"] = translate(text[sentence["start"]:sentence["end"]])[1]
    info: dict = {}
    log("3/3 Argos: леммы")
    for word in words:
        key = lemma_key(word["lemma"])
        if key not in info:
            english, russian = translate(word["lemma"])
            info[key] = {"head": word["lemma"], "ru": russian, "en": english, "pos": ""}
        word["ru"] = translate(word["form"])[1]
    return info


# ─────────────────────────── 3. Сохранение ───────────────────────────

CHAPTER_SEPARATOR = "\n\n\n"


def build_book(chapters: list[dict], title: str, lemma_info: dict, meta: dict) -> dict:
    """Склеивает главы в одну книгу: общий текст, сквозные позиции, разметка глав."""
    text_parts: list[str] = []
    out_sentences: list[list] = []
    out_words: list[dict] = []
    out_chapters: list[dict] = []
    out_phrases: list[list] = []
    offset = 0
    for number, chapter in enumerate(chapters):
        if number:
            text_parts.append(CHAPTER_SEPARATOR)
            offset += len(CHAPTER_SEPARATOR)
        s_offset = len(out_sentences)
        text_parts.append(chapter["text"])
        out_chapters.append({"title": chapter["title"], "start": offset,
                             "end": offset + len(chapter["text"])})
        for sentence in chapter["sentences"]:
            out_sentences.append([sentence["start"] + offset, sentence["end"] + offset,
                                  sentence.get("ru", "")])
        w_offset = len(out_words)
        for phrase in chapter.get("phrases", []):
            out_phrases.append([[i + w_offset for i in phrase["w"]], phrase["head"], phrase["ru"]])
        for word in chapter["words"]:
            head = word.get("head") or word["lemma"]
            item = {
                "start": word["start"] + offset,
                "end": word["end"] + offset,
                "s": word["s"] + s_offset,
                "lemma": head,
                "key": lemma_key(head),
                "upos": word.get("upos", ""),
                "feats": word.get("feats", ""),
            }
            if word.get("ru"):
                item["ru"] = word["ru"]
            out_words.append(item)
        offset += len(chapter["text"])

    used = {w["key"] for w in out_words}
    return {
        "version": DATA_VERSION,
        "title": title,
        "text": "".join(text_parts),
        "chapters": out_chapters,
        "sentences": out_sentences,
        "lemmas": {k: v for k, v in lemma_info.items() if k in used},
        "words": out_words,
        "phrases": out_phrases,
        "meta": meta,
    }


def encode_data(data: dict) -> str:
    encoded = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    return encoded.replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")


def save_book_html(data: dict, path: Path) -> None:
    """Один самодостаточный HTML: шаблон standalone.html + library/reader.css + reader.js + данные внутри."""
    template_path = BASE_DIR / "standalone.html"
    parts = {name: LIB_DIR / name for name in ("reader.css", "reader.js")}
    missing = [str(p) for p in (template_path, *parts.values()) if not p.is_file()]
    if missing:
        raise SystemExit("Для --html нужны файлы: " + ", ".join(missing))

    page = template_path.read_text(encoding="utf-8")
    css = parts["reader.css"].read_text(encoding="utf-8")
    js = parts["reader.js"].read_text(encoding="utf-8")
    safe = lambda code: code.replace("</script", "<\\/script").replace("</style", "<\\/style")
    data_js = "window.GREEK_BOOK_DATA = " + encode_data(data).replace("</", "<\\/") + ";"

    replacements = [
        (re.compile(r'<link rel="stylesheet" href="reader\.css">'), f"<style>\n{safe(css)}\n</style>"),
        (re.compile(r'\s*<script src="book_content\.js" defer></script>'), ""),
        (re.compile(r'\s*<script src="reader\.js" defer></script>'), ""),
    ]
    for pattern, value in replacements:
        if not pattern.search(page):
            raise SystemExit(f"Не нашёл в standalone.html строку для замены: {pattern.pattern}")
        page = pattern.sub(lambda _m, v=value: v, page, count=1)
    # Скрипты — в конец body: inline-скрипты не умеют defer, а читалке нужен готовый DOM.
    scripts = f"<script>\n{data_js}\n</script>\n<script>\n{safe(js)}\n</script>\n"
    page = page.replace("</body>", scripts + "</body>", 1)
    page = re.sub(r"<title>.*?</title>", lambda _m: f"<title>{html_escape(data['title'])}</title>", page, count=1)
    page = page.replace('<html lang="ru">',
                        '<html lang="ru">\n<!-- Собрано bookconverter.py: книга целиком в одном файле. -->', 1)
    path.write_text(page, encoding="utf-8")


def html_escape(value: str) -> str:
    return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def save_book_data(data: dict, path: Path) -> None:
    encoded = encode_data(data)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        "// Автоматически создан tools/library/bookconverter.py. Только данные, без HTML.\n"
        f"window.GREEK_BOOK_DATA = {encoded};\n",
        encoding="utf-8",
    )


def read_book_data(path: Path) -> dict:
    """Обратно: данные книги из library/…/books/<id>.js."""
    content = path.read_text(encoding="utf-8")
    start, end = content.find("{"), content.rstrip().rstrip(";").rfind("}")
    if start < 0 or end <= start:
        raise ValueError(f"{path.name}: нет данных книги")
    return json.loads(content[start:end + 1])


def guess_title(text: str, input_path: Path) -> str:
    for line in text.splitlines():
        line = line.strip()
        if line and has_letters(line) and not line.startswith(("http://", "https://")):
            return line[:120]
    return input_path.stem


# ─────────────────────────── 4. Книги, каталог, словарь сайта ───────────────────────────
# book.json книги:
#   {"title": "Ένα ήσυχο πρωί", "author": "…", "level": "A2", "about": "о чём, одной строкой",
#    "chapters": "*.txt", "license": "свой текст"}
# chapters — маска или список файлов глав по порядку (по умолчанию все *.txt, glava2 раньше glava10).
# license — откуда право выложить текст; у публичной книги (texts/) обязательно.

def natural_key(path: Path):
    """glava2 идёт раньше glava10."""
    return [int(part) if part.isdigit() else part.lower() for part in re.split(r"(\d+)", path.name)]


def find_books() -> list[dict]:
    books: list[dict] = []
    for root, public in ((TEXTS_DIR, True), (PRIVATE_DIR, False)):
        if not root.is_dir():
            continue
        for folder in sorted(root.iterdir(), key=natural_key):
            if not (folder / "book.json").is_file():
                continue
            if not BOOK_ID_RE.match(folder.name):
                log(f"⚠ Папка {folder}: имя книги — латиница в нижнем регистре, цифры и дефис. Пропускаю.")
                continue
            info = read_jsonc(folder / "book.json")
            info.update(id=folder.name, dir=folder, public=public)
            books.append(info)
    ids = [b["id"] for b in books]
    for dup in sorted({i for i in ids if ids.count(i) > 1}):
        raise SystemExit(f"Книга «{dup}» есть и в texts/, и в private/ — оставь одну.")
    return books


def book_output(book: dict) -> Path:
    return LIB_DIR / ("books" if book["public"] else "local/books") / f"{book['id']}.js"


def resolve_chapters(book: dict) -> list[Path]:
    spec = book.get("chapters") or "*.txt"
    patterns = spec if isinstance(spec, list) else [spec]
    files: list[Path] = []
    for pattern in patterns:
        if any(ch in pattern for ch in "*?["):
            files.extend(sorted(book["dir"].glob(pattern), key=natural_key))
        else:
            path = (book["dir"] / pattern).resolve()
            if not path.is_file():
                raise SystemExit(f"Книга {book['id']}: нет файла {pattern}.")
            files.append(path)
    unique: list[Path] = []
    for file in files:
        if file.resolve() not in unique:
            unique.append(file.resolve())
    if not unique:
        raise SystemExit(f"Книга {book['id']}: в {book['dir']} нет глав ({spec}).")
    return unique


def fold(form: str) -> str:
    """Ключ формы в словаре сайта. Так же считает library/owntext.js: NFC, строчные, ς → σ, ’ → '."""
    return unicodedata.normalize("NFC", form).lower().replace("ς", "σ").replace("\u2019", "'")


def clean_key(key: str, form: str) -> str:
    """Ключ леммы для словаря: модель иногда кладёт в словарную форму пометку («(частица)», «+ όνομα»)."""
    key = re.sub(r"^[+\s]+|[+\s]+$", "", str(key or ""))
    return key if pure_greek(key) and not key.startswith("(") else form


def build_site_dict(books: list[tuple[dict, dict]]) -> dict:
    """Словарь сайта из всех собранных книг (и публичных, и личных) — только словарные данные:
    форма → [лемма, часть речи, грамматика, частый перевод формы]; лемма → значения;
    обороты → [леммы по порядку, словарная форма, перевод]. Ни предложений, ни порядка слов текста;
    имена собственные не берём."""
    analyses: dict[str, dict[tuple, int]] = {}
    glosses: dict[tuple, dict[str, int]] = {}
    lemmas: dict[str, dict] = {}
    phrases: dict[str, dict] = {}
    for _, data in books:
        text, words, info = data.get("text", ""), data.get("words", []), data.get("lemmas", {})
        proper = lambda w: "PROPN" in w.get("upos", "") or str(info.get(w["key"], {}).get("pos", "")).startswith("имя собств")
        for w in words:
            if proper(w):
                continue
            form = fold(text[w["start"]:w["end"]])
            if not has_greek(form):
                continue
            key = clean_key(w["key"], form)
            sig = (key, w.get("upos", ""), w.get("feats", ""))
            bucket = analyses.setdefault(form, {})
            bucket[sig] = bucket.get(sig, 0) + 1
            if w.get("ru"):
                g = glosses.setdefault((form, key), {})
                g[w["ru"]] = g.get(w["ru"], 0) + 1
            entry = info.get(w["key"]) or {}
            head = next((h for h in (entry.get("head"), w.get("lemma")) if h and pure_greek(h)), key)
            old = lemmas.get(key)
            if old is None or (not old.get("ru") and entry.get("ru")):
                lemmas[key] = {"head": head, **{k: entry[k] for k in ("ru", "en", "pos") if entry.get(k)}}
        for item in data.get("phrases", []):
            idx, head, ru = item[0], item[1], item[2]
            members = [words[i] for i in idx if 0 <= i < len(words)]
            if len(members) != len(idx) or not 2 <= len(members) <= PHRASE_MAX_WORDS:
                continue
            if any(proper(w) for w in members):
                continue
            lemma_of = lambda w: next((h for h in ((info.get(w["key"]) or {}).get("head"), w.get("lemma"))
                                       if h and pure_greek(h)), w["key"])
            head = check_phrase(head, ru, [{"form": text[w["start"]:w["end"]], "lemma": lemma_of(w),
                                            "upos": w.get("upos", "")} for w in members])
            if not head:
                continue
            # ключи оборота — только слова, которые есть в его словарной форме: «δεν τα κατάφερε» → τα + καταφέρω,
            # «έριξε μιαν ματιά» → ρίχνω + ματιά (μιαν ≠ μια). Свой текст ищет оборот по этим леммам с промежутками.
            plain = lambda x: "".join(ch for ch in unicodedata.normalize("NFD", fold(x).strip("'")) if not unicodedata.combining(ch))
            in_head = {plain(t) for t in head.split()}
            keys = [clean_key(w["key"], fold(text[w["start"]:w["end"]])) for w in members
                    if plain(text[w["start"]:w["end"]]) in in_head or plain(bare_lemma(lemma_of(w))) in in_head]
            if len(keys) < 2:
                continue
            p = phrases.setdefault(fold(head), {"keys": keys, "head": head, "ru": ru, "n": 0})
            p["n"] += 1
    forms = {}
    for form in sorted(analyses):
        sig = max(analyses[form].items(), key=lambda kv: (kv[1], kv[0]))[0]
        g = glosses.get((form, sig[0]), {})
        # как форму переводили в книгах: до трёх вариантов, частые первыми (при равенстве — как встретились)
        seen = sorted(g.items(), key=lambda kv: -kv[1])[:3]
        forms[form] = [sig[0], sig[1], sig[2], "; ".join(v for v, _ in seen)]
    return {
        "version": 1,
        "forms": forms,
        "lemmas": {k: lemmas[k] for k in sorted(lemmas)},
        "phrases": [[p["keys"], p["head"], p["ru"]] for _, p in sorted(phrases.items())],
    }


def catalog_entry(book: dict, data: dict) -> dict:
    entry = {"id": book["id"], "title": book.get("title") or data.get("title") or book["id"]}
    for field in ("author", "level", "about", "license"):
        if book.get(field):
            entry[field] = book[field]
    entry.update({
        "chapters": len(data.get("chapters") or [1]),
        "words": len(data.get("words", [])),
        "lemmas": len(data.get("lemmas", {})),
        "phrases": len(data.get("phrases", [])),
        "complete": bool((data.get("meta") or {}).get("complete", True)),
        "updated": str((data.get("meta") or {}).get("created", ""))[:10],
    })
    return entry


def write_js(path: Path, comment: str, name: str, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(f"// {comment}\nwindow.{name} = {encode_data(value)};\n", encoding="utf-8")


def rebuild_site(books: list[dict]) -> None:
    """Каталоги и словарь сайта — из всех уже собранных книг."""
    built: list[tuple[dict, dict]] = []
    for book in books:
        path = book_output(book)
        if path.is_file():
            try:
                built.append((book, read_book_data(path)))
            except (ValueError, json.JSONDecodeError) as exc:
                log(f"⚠ {path}: {exc} — пропускаю")
    site_dict = build_site_dict(built)
    stats = {k: len(site_dict[k]) for k in ("forms", "lemmas", "phrases")}
    public = [catalog_entry(b, d) for b, d in built if b["public"]]
    private = [catalog_entry(b, d) for b, d in built if not b["public"]]
    write_js(LIB_DIR / "catalog.js", "Каталог библиотеки. Создаётся tools/library/bookconverter.py.",
             "GREEK_LIBRARY", {"books": public, "dict": stats})
    local = LIB_DIR / "local" / "catalog.js"
    if private:
        write_js(local, "Личная полка: только на этом компьютере (library/local/ в .gitignore).",
                 "GREEK_LIBRARY_LOCAL", {"books": private})
    elif local.is_file():
        local.unlink()
    write_js(LIB_DIR / "dict.js",
             "Словарь сайта для «Своего текста». Создаётся tools/library/bookconverter.py из всех разобранных книг: "
             "формы, леммы, обороты — без предложений и текстов книг.", "GREEK_DICT", site_dict)
    log(f"\nКаталог: книг на сайте {len(public)}, на личной полке {len(private)}."
        f" Словарь сайта: форм {stats['forms']}, лемм {stats['lemmas']}, оборотов {stats['phrases']}.")


# ─────────────────────────── main ───────────────────────────

def parse_args(argv=None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Греческие тексты -> книги библиотеки сайта (library/)")
    parser.add_argument("books", nargs="*", metavar="ID", help="какие книги собрать (папки в texts/ или private/)")
    parser.add_argument("--all", action="store_true", help="собрать все книги")
    parser.add_argument("--dict", action="store_true", help="только пересобрать каталоги и словарь сайта")
    parser.add_argument("--offline", action="store_true",
                        help="ничего не запрашивать у модели, собрать из кеша")
    parser.add_argument("--no-phrases", dest="no_phrases", action="store_true", help="без прохода оборотов")
    parser.add_argument("--html", action="store_true", help="ещё и один самодостаточный файл out/<id>.html")
    parser.add_argument("--translator", "--provider", dest="provider", help="gemini | groq | openrouter | ollama | custom | argos | none")
    parser.add_argument("--model", help="имя модели у провайдера")
    parser.add_argument("--api-key", dest="api_key", help="ключ API (лучше хранить в config.json)")
    parser.add_argument("--base-url", dest="base_url", help="адрес OpenAI-совместимого API")
    parser.add_argument("--batch-words", dest="batch_words", type=int, help="слов в одном запросе")
    parser.add_argument("--limit", type=int, help="в каждой главе только первые N предложений")
    parser.add_argument("--list-models", action="store_true", help="показать модели провайдера и выйти")
    return parser.parse_args(argv)


def chapters_word(n: int) -> str:
    if n % 10 == 1 and n % 100 != 11:
        return f"{n} глава"
    if 2 <= n % 10 <= 4 and not 12 <= n % 100 <= 14:
        return f"{n} главы"
    return f"{n} глав"


def build_one(book: dict, config: dict, args: argparse.Namespace, nlp, client, cache) -> None:
    provider = config["provider"]
    if book["public"] and not book.get("license"):
        raise SystemExit(
            f"Книга {book['id']} лежит в texts/ — она попадёт на сайт. Укажи в book.json поле \"license\""
            " (свой текст, общественное достояние, разрешение автора…) или перенеси папку в private/.")
    chapter_files = resolve_chapters(book)
    where = "на сайт" if book["public"] else "личная полка"
    log(f"\n═══ {book['id']} ({where}): {chapters_word(len(chapter_files))} — "
        + ", ".join(f.name for f in chapter_files))
    lemma_info: dict = {}
    complete = phrases_done = True
    chapters: list[dict] = []
    for number, path in enumerate(chapter_files, start=1):
        text = path.read_text(encoding="utf-8-sig").replace("\r\n", "\n").strip("\n")
        chapter_title = guess_title(text, path)
        log(f"\n━━━ Глава {number}/{len(chapter_files)} · {path.name} · {chapter_title} ━━━")
        if args.limit:
            probe, _ = analyze_text(text, nlp)
            if args.limit < len(probe):
                text = text[:probe[args.limit - 1]["end"]]
        sentences, words = analyze_text(text, nlp)
        log(f"Морфология: {len(sentences)} предложений, {len(words)} слов")
        phrases: list[dict] = []
        if client:
            complete &= run_llm(text, sentences, words, config, cache, client)
            complete &= run_lemmas(words, client, config, cache, lemma_info)
            if not args.no_phrases:
                ok, phrases = run_phrases(text, sentences, words, config, cache, client, lemma_info)
                phrases_done &= ok
        elif provider == "argos":
            for key, value in run_argos(text, sentences, words).items():
                lemma_info.setdefault(key, value)
        chapters.append({"title": chapter_title, "text": text, "sentences": sentences,
                         "words": words, "phrases": phrases})

    title = book.get("title") or (chapters[0]["title"] if len(chapters) == 1 else book["id"])
    meta = {
        "provider": provider,
        "model": config["model"] if client else ("argos" if provider == "argos" else ""),
        "created": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        "complete": complete,
        "phrases": bool(client) and not args.no_phrases and phrases_done,
    }
    data = build_book(chapters, title, lemma_info, meta)
    out = book_output(book)
    save_book_data(data, out)
    log(f"\nГотово: «{title}» — {chapters_word(len(chapters))}, {len(data['words'])} слов, "
        f"переведено {sum(1 for w in data['words'] if w.get('ru'))}, лемм {len(data['lemmas'])}, "
        f"оборотов {len(data['phrases'])}.\n   → {out.relative_to(REPO_DIR)}")
    if args.html:
        html_path = OUT_DIR / f"{book['id']}.html"
        OUT_DIR.mkdir(exist_ok=True)
        save_book_html(data, html_path)
        log(f"   → {html_path.relative_to(REPO_DIR)} — один файл, {html_path.stat().st_size / 1048576:.1f} МБ")
    if not complete:
        log("Перевод неполный — запусти ещё раз, когда лимит обновится.")
    elif meta["phrases"] is False and client and not args.no_phrases:
        log("Обороты получены не все — запусти ещё раз, когда лимит обновится.")


def print_books(books: list[dict]) -> None:
    if not books:
        log("Книг пока нет. Создай папку texts/<id>/ (на сайт) или private/<id>/ (только у себя)"
            " с book.json и главами *.txt — см. README.md.")
        return
    log("Книги:")
    for book in books:
        built = "собрана" if book_output(book).is_file() else "ещё не собрана"
        where = "сайт" if book["public"] else "личная"
        log(f"   {book['id']:<16} {where:<8} {built:<15} {book.get('title', '')}")
    log("\nСобрать: python bookconverter.py <id>   ·   все: --all   ·   только словарь и каталог: --dict")


def main(argv=None, nlp=None, client=None) -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    args = parse_args(argv)
    config = load_config(args)
    config["offline"] = args.offline
    provider = config["provider"]

    if args.list_models:
        if provider not in PRESETS:
            raise SystemExit("--list-models работает только для LLM-провайдеров.")
        for model in LLMClient(config).list_models():
            print(model)
        return

    books = find_books()
    if args.dict:
        rebuild_site(books)
        return
    chosen = books if args.all else [b for b in books if b["id"] in args.books]
    unknown = sorted(set(args.books) - {b["id"] for b in books})
    if unknown:
        raise SystemExit(f"Нет книг: {', '.join(unknown)}. Есть: {', '.join(b['id'] for b in books) or '—'}.")
    if not chosen:
        print_books(books)
        return

    if (provider in ("gemini", "groq", "openrouter") and not config.get("api_key")
            and not args.offline and client is None):
        raise SystemExit(
            f"Нет API-ключа для '{provider}'. Скопируй config.example.json в config.json и впиши ключ"
            f" (поле api_key) или задай переменную окружения {config.get('key_env')}. Как получить — см. README.md."
        )
    if args.offline:
        log("Режим --offline: к модели не обращаюсь, беру только из кеша.")
    log("Загружаю Stanza…")
    nlp = nlp or load_stanza()
    if client is None and provider in PRESETS:
        client = LLMClient(config)
    cache = Cache(CACHE_DIR / "cache.json") if client else None
    for book in chosen:
        build_one(book, config, args, nlp, client, cache)
    rebuild_site(books)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        log("\nПрервано. Уже полученные ответы сохранены в cache/ — следующий запуск продолжит.")
