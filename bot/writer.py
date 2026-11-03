"""Write a post's slide texts and caption with an LLM that can search the web.

Provider is chosen by which key is set: GEMINI_API_KEY (free tier) or
ANTHROPIC_API_KEY. LLM_PROVIDER=gemini|claude forces one.
"""
from __future__ import annotations

import json
import os
import re

SYSTEM = """Sen Otbozor (otbozor.uz) Instagram sahifasi uchun kontent muallifisan.
Otbozor - O'zbekistondagi ot savdosi platformasi: ot e'lonlari, ot jihozlari, ko'pkari, ot parvarishi haqida maqolalar.
Auditoriya: ot sotuvchi va oluvchilar, ko'pkarichilar, naslchilik bilan shug'ullanuvchilar.

Qoidalar:
- Faqat o'zbek tilida, lotin yozuvida yoz (o', g', sh, ch). Rus yoki ingliz so'zlarini aralashtirma.
- Ohang: samimiy, ishonchli, aniq. Reklama ohangi va bo'rttirishlardan qoch.
- Faktlarni internetdan tekshir. Ishonchli manbalardan foydalan (veterinariya, otchilik tashkilotlari, ilmiy maqolalar).
  Shubhali yoki tekshirib bo'lmaydigan raqam yozma.
- Sog'liq bo'yicha maslahatda jiddiy holatlarda veterinarga murojaat qilishni eslat.
- Emoji ishlatma (caption ichida ham).
- Asosiy CTA - Telegram bot @otbozor_bot, ikkinchi o'rinda sayt otbozor.uz. CTA matnini caption'ga o'zing qo'shma, uni dastur qo'shadi.
"""

FORMAT = """Javobni FAQAT bitta ```json ... ``` blokida, quyidagi tuzilishda ber:
{
  "label": "slaydlar pastidagi qisqa yorliq, 2-4 so'z (masalan: Xaridorlar uchun qo'llanma)",
  "cover": {
    "line1": "ilmoq-savol yoki qisqa ibora, 2-3 so'z, <=22 belgi",
    "highlight": "yashil fonda ajratiladigan 1-3 so'z, <=14 belgi",
    "line3": "yakunlovchi 1-2 so'z, <=16 belgi",
    "card_bold": "kartochkadagi qalin qism, <=30 belgi",
    "card_text": "kartochka davomi, <=70 belgi"
  },
  "slides": [ {"title": "<=45 belgi", "body": "<=170 belgi, 1-2 gap"} ],
  "cta": {"title": "<=40 belgi, botga chaqiruvchi sarlavha", "body": "<=120 belgi"},
  "caption": "Instagram matni: ilmoq, 3-6 qisqa band yoki gap, 600-1200 belgi. Hashtag va CTA qo'shma.",
  "hashtags": ["#otbozor", "... jami 8-12 ta"],
  "sources": ["foydalangan manbalaring URL manzillari"]
}
slides soni 3 tadan 6 tagacha. line1 + highlight + line3 birga bitta tabiiy jumla bo'lib o'qilsin
(masalan: "Ot olmoqchimisiz?" / "Avval buni" / "tekshiring.")."""

LIMITS = {
    ("cover", "line1"): 22, ("cover", "highlight"): 14, ("cover", "line3"): 16,
    ("cover", "card_bold"): 30, ("cover", "card_text"): 70,
    ("cta", "title"): 40, ("cta", "body"): 120,
}


def build_prompt(post: dict, feedback: str | None = None) -> str:
    lines = [
        f"Post mavzusi: {post['topic']}",
        f"Asosiy g'oya: {post['idea']}",
        f"CTA yo'nalishi: {post['cta']}",
        "",
        FORMAT,
    ]
    if feedback:
        lines += ["", "Oldingi variantga egasining izohi (albatta hisobga ol):", feedback]
    return "\n".join(lines)


def extract_json(text: str) -> dict:
    m = re.search(r"```json\s*(\{.*?\})\s*```", text, re.S)
    raw = m.group(1) if m else text[text.find("{"): text.rfind("}") + 1]
    return json.loads(raw)


def validate(c: dict) -> list[str]:
    errs: list[str] = []
    try:
        for (sec, key), limit in LIMITS.items():
            val = c[sec][key]
            if not isinstance(val, str) or not val.strip():
                errs.append(f"{sec}.{key} bo'sh")
            elif len(val) > limit:
                errs.append(f"{sec}.{key} {len(val)} belgi, ko'pi bilan {limit}")
        slides = c["slides"]
        if not 3 <= len(slides) <= 6:
            errs.append(f"slides soni {len(slides)}, 3-6 bo'lishi kerak")
        for i, s in enumerate(slides, 1):
            if len(s.get("title", "")) > 45:
                errs.append(f"slides[{i}].title juda uzun")
            if len(s.get("body", "")) > 170:
                errs.append(f"slides[{i}].body juda uzun")
            if not s.get("title") or not s.get("body"):
                errs.append(f"slides[{i}] bo'sh")
        if not 200 <= len(c["caption"]) <= 1600:
            errs.append(f"caption {len(c['caption'])} belgi, 600-1200 atrofida bo'lishi kerak")
        if not isinstance(c.get("hashtags"), list) or not c["hashtags"]:
            errs.append("hashtags yo'q")
    except (KeyError, TypeError) as e:
        errs.append(f"tuzilish noto'g'ri: {e}")
    return errs


def full_caption(c: dict) -> str:
    tags = " ".join(t if t.startswith("#") else f"#{t}" for t in c["hashtags"])
    return (
        f"{c['caption'].strip()}\n\n"
        "Yangi e'lonlar va maslahatlar Telegram botimizda: @otbozor_bot\n"
        "Saytimiz: otbozor.uz\n\n"
        f"{tags}"
    )


# ---------- providers ----------

GEMINI_MODELS = ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"]


def _gemini(prompt: str) -> str:
    """Gemini, trying several free-tier models.

    Search grounding is not on the free tier for Gemini 3+ models (429/400), so each
    model is asked once with Search and once without. A busy or rate-limited model
    (429/5xx) moves on to the next one.
    """
    from google import genai
    from google.genai import errors, types

    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"],
                          http_options=types.HttpOptions(timeout=240_000))
    models = [m.strip() for m in (os.environ.get("GEMINI_MODEL") or "").split(",") if m.strip()] or GEMINI_MODELS
    search = os.environ.get("GEMINI_SEARCH", "auto").lower() != "off"

    def ask(model: str, with_search: bool) -> str:
        tools = [types.Tool(google_search=types.GoogleSearch())] if with_search else None
        thinking = None if "lite" in model else types.ThinkingConfig(
            thinking_level=os.environ.get("GEMINI_THINKING") or "low")
        resp = client.models.generate_content(
            model=model, contents=prompt,
            config=types.GenerateContentConfig(system_instruction=SYSTEM, tools=tools,
                                               thinking_config=thinking),
        )
        return resp.text or ""

    last = None
    for model in models:
        for with_search in ([True, False] if search else [False]):
            try:
                return ask(model, with_search)
            except errors.ClientError as e:
                last = e
                print(f"Gemini {model} search={with_search}: {e.code}", flush=True)
                if e.code not in (400, 403, 404, 429):
                    raise
                if e.code == 404:
                    break
            except errors.ServerError as e:
                last = e
                print(f"Gemini {model} busy: {e.code}", flush=True)
                break
    raise last


def _claude(prompt: str) -> str:
    import anthropic

    client = anthropic.Anthropic()
    messages = [{"role": "user", "content": prompt}]
    for _ in range(5):
        resp = client.beta.messages.create(
            model=os.environ.get("CLAUDE_MODEL") or "claude-opus-5-5",
            max_tokens=16000,
            system=SYSTEM,
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            output_config={"effort": "medium"},
            tools=[{"type": "web_search_20260209", "name": "web_search", "max_uses": 5}],
            messages=messages,
        )
        if resp.stop_reason == "pause_turn":
            # Server-side search loop paused; send the turn back to let it continue.
            messages = [messages[0], {"role": "assistant", "content": resp.content}]
            continue
        if resp.stop_reason == "refusal":
            raise RuntimeError("Claude so'rovni rad etdi")
        return "".join(b.text for b in resp.content if b.type == "text")
    raise RuntimeError("Claude javobi tugallanmadi (pause_turn)")


def provider() -> str:
    forced = os.environ.get("LLM_PROVIDER", "").lower()
    if forced in ("gemini", "claude"):
        return forced
    if os.environ.get("GEMINI_API_KEY"):
        return "gemini"
    if os.environ.get("ANTHROPIC_API_KEY"):
        return "claude"
    raise RuntimeError("GEMINI_API_KEY yoki ANTHROPIC_API_KEY sozlanmagan")


def write_post(post: dict, feedback: str | None = None, call=None) -> dict:
    """Return validated content for a post. `call` overrides the LLM (for tests)."""
    call = call or (_gemini if provider() == "gemini" else _claude)
    prompt = build_prompt(post, feedback)
    last_errs: list[str] = []
    for _ in range(3):
        text = call(prompt)
        try:
            content = extract_json(text)
        except (ValueError, json.JSONDecodeError):
            last_errs = ["JSON topilmadi yoki buzilgan"]
        else:
            last_errs = validate(content)
            if not last_errs:
                return content
        prompt = build_prompt(post, feedback) + (
            "\n\nOldingi javobingda xatolar bor edi, tuzatib qayta yoz:\n- " + "\n- ".join(last_errs)
        )
    raise RuntimeError("Matn talablarga mos kelmadi: " + "; ".join(last_errs))
