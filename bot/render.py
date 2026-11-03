"""Turn a post's content into 1080x1350 JPEG slides using the HTML template."""
from __future__ import annotations

import html
import os
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
TEMPLATE = ROOT / "templates" / "slides.html"
LOGO = "../assets/logo.svg"
BOT_HANDLE = "@otbozor_bot"
SITE = "otbozor.uz"


def _e(text: str) -> str:
    return html.escape(text or "", quote=True)


def _header(page: int, total: int) -> str:
    return (
        f'<div class="hdr"><div class="brand"><img src="{LOGO}">Otbozor</div>'
        f'<div class="pg">{page:02d} / {total:02d}</div></div>'
    )


def build_html(content: dict) -> str:
    cover, slides, cta = content["cover"], content["slides"], content["cta"]
    total = len(slides) + 2
    parts = [
        f'<div class="s cover">{_header(1, total)}'
        f'<div class="q fit" data-min="80">{_e(cover["line1"])}<br>'
        f'<span class="mark">{_e(cover["highlight"])}</span><br>{_e(cover["line3"])}</div>'
        f'<div class="card"><div class="t fit" data-min="26"><span><b>{_e(cover["card_bold"])}</b> '
        f'{_e(cover["card_text"])}</span></div><div class="arrow">&rarr;</div></div>'
        f'<div class="foot"><div class="swipe">Varaqlang &rarr;</div><div>{SITE}</div></div></div>'
    ]
    for i, sl in enumerate(slides, start=1):
        parts.append(
            f'<div class="s inner">{_header(i + 1, total)}'
            f'<div class="num">{i:02d}</div>'
            f'<div class="h fit" data-min="52"><span>{_e(sl["title"])}</span></div>'
            f'<div class="rule"></div>'
            f'<div class="b fit" data-min="28">{_e(sl["body"])}</div>'
            f'<div class="foot"><div class="label"><span class="dot"></span>{_e(content.get("label", "Otbozor maslahati"))}</div>'
            f'<div>{SITE}</div></div></div>'
        )
    parts.append(
        f'<div class="s cta"><div class="ring"></div><div class="ring2"></div>{_header(total, total)}'
        f'<div class="h fit" data-min="60"><span>{_e(cta["title"])}</span></div>'
        f'<div class="b fit" data-min="28">{_e(cta["body"])}</div>'
        f'<div class="btn">{BOT_HANDLE} <span style="font-weight:400">&rarr;</span></div>'
        f'<div class="alt">yoki saytda: <b>{SITE}</b></div></div>'
    )
    return TEMPLATE.read_text(encoding="utf-8").replace("<!--SLIDES-->", "\n".join(parts))


def render(content: dict, out_dir: Path) -> list[Path]:
    """Render slides to out_dir as 01.jpg, 02.jpg, ... and return their paths.

    Raises RuntimeError if any text box still overflows at its minimum font size.
    """
    from playwright.sync_api import sync_playwright

    out_dir.mkdir(parents=True, exist_ok=True)
    # The page lives in templates/ so relative font and logo paths resolve.
    page_file = ROOT / "templates" / "_render.html"
    page_file.write_text(build_html(content), encoding="utf-8")
    paths: list[Path] = []
    try:
        with sync_playwright() as p:
            # On GitHub runners we use the preinstalled Chrome (PW_CHANNEL=chrome),
            # so no browser download is needed on each run.
            browser = p.chromium.launch(
                channel=os.environ.get("PW_CHANNEL") or None,
                executable_path=os.environ.get("PW_EXECUTABLE") or None,
            )
            page = browser.new_page(viewport={"width": 1080, "height": 1350})
            page.goto(page_file.as_uri())
            page.wait_for_selector("body[data-ready='1']", timeout=30_000)
            overflow = page.eval_on_selector_all(
                ".fit[data-fitted='overflow']", "els => els.map(e => e.innerText.slice(0, 60))"
            )
            if overflow:
                browser.close()
                raise RuntimeError(f"Matn slaydga sig'madi: {overflow}")
            for i, el in enumerate(page.query_selector_all(".s"), start=1):
                png = out_dir / f"{i:02d}.png"
                el.screenshot(path=str(png))
                jpg = out_dir / f"{i:02d}.jpg"
                Image.open(png).convert("RGB").save(jpg, "JPEG", quality=92, optimize=True)
                png.unlink()
                paths.append(jpg)
            browser.close()
    finally:
        page_file.unlink(missing_ok=True)
    return paths
