"""Render Reels (9:16 MP4) in the Otbozor design.

Four formats rotate: quiz, myth (afsona va haqiqat), fact (bilasizmi) and
mistakes (3 ta xato). Each format is an HTML template in templates/reels/ that
builds itself from JSON data. All animations are paused and seeked frame by
frame, so the output is deterministic, then ffmpeg encodes the frames.
"""
from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TEMPLATES = ROOT / "templates" / "reels"
FORMATS = ("quiz", "myth", "fact", "mistakes")
FPS = 30


def build_html(kind: str, data: dict) -> str:
    if kind not in FORMATS:
        raise ValueError(f"Noma'lum Reels formati: {kind}")
    payload = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
    return (TEMPLATES / f"{kind}.html").read_text(encoding="utf-8").replace("__DATA__", payload)


def render(kind: str, data: dict, out: Path, music: Path | None = None, cover: Path | None = None) -> Path:
    """Write the Reel to `out`. If `cover` is given, also save a JPEG cover frame there."""
    from playwright.sync_api import sync_playwright

    out.parent.mkdir(parents=True, exist_ok=True)
    page_file = TEMPLATES / "_render.html"
    page_file.write_text(build_html(kind, data), encoding="utf-8")
    audio = (["-stream_loop", "-1", "-i", str(music)] if music
             else ["-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo"])
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(channel=os.environ.get("PW_CHANNEL") or None,
                                        executable_path=os.environ.get("PW_EXECUTABLE") or None)
            try:
                page = browser.new_page(viewport={"width": 1080, "height": 1920})
                page.goto(page_file.as_uri())
                page.wait_for_selector("body[data-reel='1']", timeout=30_000)
                overflow = page.eval_on_selector_all(".fit[data-fitted='overflow']",
                                                     "els => els.map(e => e.innerText.slice(0, 50))")
                if overflow:
                    raise RuntimeError(f"Reels: matn sig'madi: {overflow}")
                total = page.evaluate("window.REEL_TOTAL")
                frames = int(total * FPS / 1000) + 1
                fade = f"afade=t=in:d=0.5,afade=t=out:st={max(0, total / 1000 - 1.5):.2f}:d=1.5"
                ff = subprocess.Popen(
                    ["ffmpeg", "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", str(FPS), "-i", "-",
                     *audio, "-map", "0:v", "-map", "1:a", "-af", fade, "-t", f"{total / 1000:.2f}",
                     "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
                     "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", str(out)],
                    stdin=subprocess.PIPE)
                for i in range(frames):
                    page.evaluate(f"seek({i * 1000 / FPS})")
                    shot = page.screenshot(type="jpeg", quality=92)
                    ff.stdin.write(shot)
                    if cover and i == int(1.6 * FPS):  # everything on the first scene is visible by now
                        cover.write_bytes(shot)
                ff.stdin.close()
                if ff.wait():
                    raise RuntimeError("ffmpeg xato bilan tugadi")
            finally:
                browser.close()
    finally:
        page_file.unlink(missing_ok=True)
    return out
