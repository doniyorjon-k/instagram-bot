"""Turn a post's content into a 9:16 animated Reel (MP4) in the Otbozor design.

Reuses the carousel slides as scenes: each slide sits in a 1080x1920 frame,
its elements rise in one after another, and scenes cross-fade. Frames are
rendered deterministically (all animations paused and seeked per frame), then
encoded with ffmpeg.
"""
from __future__ import annotations

import os
import subprocess
from pathlib import Path

from . import render as slides

ROOT = slides.ROOT
FPS = 30
COVER_MS, INNER_MS, CTA_MS, FADE_MS = 3200, 3800, 4200, 450

REEL_CSS = """
<style>
body{background:#000;width:1080px;height:1920px;overflow:hidden}
#stage{position:relative;width:1080px;height:1920px;overflow:hidden}
.scene{position:absolute;inset:0;opacity:0;background:#fff}
.scene.cover-bg{background:var(--mist)}
.scene.cta-bg{background:var(--deep)}
.scene .s{position:absolute;left:0;top:250px}
.swipe,.pg{visibility:hidden}
#stage{background:var(--mist)}
</style>
"""

REEL_JS = """
<script>
document.body.addEventListener('ready-reel', () => {});
(function waitFit(){
  if (document.body.dataset.ready !== '1') return setTimeout(waitFit, 20);
  const T = window.REEL;
  const stage = document.createElement('div'); stage.id = 'stage';
  document.body.prepend(stage);
  const slides = [...document.querySelectorAll('.s')];
  let t = 0;
  slides.forEach((s, i) => {
    const scene = document.createElement('div');
    scene.className = 'scene' + (s.classList.contains('cover') ? ' cover-bg' : s.classList.contains('cta') ? ' cta-bg' : '');
    stage.appendChild(scene); scene.appendChild(s);
    const dur = s.classList.contains('cover') ? T.cover : s.classList.contains('cta') ? T.cta : T.inner;
    const f = T.fade / (dur + T.fade);
    // Each scene fades in over the previous one, so there is never a dark gap.
    if (i) scene.animate([{opacity: 0}, {opacity: 1, offset: f}, {opacity: 1}],
                         {delay: t - T.fade, duration: dur + T.fade, fill: 'both'});
    else scene.style.opacity = 1;
    const parts = s.querySelectorAll('.q,.card,.num,.h,.rule,.b,.btn,.alt,.hdr,.foot');
    parts.forEach((el, k) => {
      const from = el.classList.contains('rule') ? {transform: 'scaleX(0)', transformOrigin: 'left'} : {opacity: 0, transform: 'translateY(46px)'};
      const to = el.classList.contains('rule') ? {transform: 'scaleX(1)', transformOrigin: 'left'} : {opacity: 1, transform: 'none'};
      el.animate([from, to], {delay: t + 150 + k * 110, duration: 650, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both'});
    });
    s.querySelectorAll('.mark').forEach(el => el.animate(
      [{clipPath: 'inset(0 100% 0 0 round .14em)'}, {clipPath: 'inset(0 0 0 0 round .14em)'}],
      {delay: t + 700, duration: 600, easing: 'cubic-bezier(.6,0,.2,1)', fill: 'both'}));
    s.querySelectorAll('.btn').forEach(el => el.animate(
      [{transform: 'scale(1)'}, {transform: 'scale(1.06)'}, {transform: 'scale(1)'}],
      {delay: t + 1600, duration: 900, iterations: 3, easing: 'ease-in-out'}));
    t += dur;
  });
  document.getAnimations().forEach(a => a.pause());
  window.seek = ms => document.getAnimations().forEach(a => { a.currentTime = ms; });
  window.REEL_TOTAL = t;
  document.body.dataset.reel = '1';
})();
</script>
"""


def build_html(content: dict) -> str:
    page = slides.build_html(content)
    timing = (f"<script>window.REEL={{cover:{COVER_MS},inner:{INNER_MS},cta:{CTA_MS},fade:{FADE_MS}}};</script>")
    return page.replace("</head>", REEL_CSS + timing + "</head>").replace("</body>", REEL_JS + "</body>")


QUIZ_TEMPLATE = ROOT / "templates" / "reel-quiz.html"


def build_quiz_html(quiz: dict) -> str:
    """quiz: q1, qmark, q2, a, b, right ("A"/"B"), why (may hold <b>), cta_title, cta_body."""
    e = slides._e
    right = quiz["right"].upper()
    vals = {"Q1": e(quiz["q1"]), "QMARK": e(quiz["qmark"]), "Q2": e(quiz.get("q2", "")),
            "A": e(quiz["a"]), "B": e(quiz["b"]), "RIGHT": right, "WRONG": "B" if right == "A" else "A",
            "WHY": f"<b>{e(quiz['answer'])}</b> {e(quiz['why'])}",
            "CTA_TITLE": e(quiz["cta_title"]), "CTA_BODY": e(quiz["cta_body"])}
    out = QUIZ_TEMPLATE.read_text(encoding="utf-8")
    for k, v in vals.items():
        out = out.replace("{{" + k + "}}", v)
    return out


def render_reel(content: dict, out: Path, music: Path | None = None) -> Path:
    return record(build_html(content), out, music)


def render_quiz(quiz: dict, out: Path, music: Path | None = None) -> Path:
    return record(build_quiz_html(quiz), out, music)


def record(html_text: str, out: Path, music: Path | None = None) -> Path:
    from playwright.sync_api import sync_playwright

    out.parent.mkdir(parents=True, exist_ok=True)
    page_file = ROOT / "templates" / "_reel.html"
    page_file.write_text(html_text, encoding="utf-8")
    audio = (["-i", str(music)] if music else ["-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo"])
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(channel=os.environ.get("PW_CHANNEL") or None,
                                        executable_path=os.environ.get("PW_EXECUTABLE") or None)
            page = browser.new_page(viewport={"width": 1080, "height": 1920})
            page.goto(page_file.as_uri())
            page.wait_for_selector("body[data-reel='1']", timeout=30_000)
            if page.eval_on_selector_all(".fit[data-fitted='overflow']", "els => els.length"):
                raise RuntimeError("Reels: matn sig'madi")
            total = page.evaluate("window.REEL_TOTAL")
            ff = subprocess.Popen(
                ["ffmpeg", "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", str(FPS), "-i", "-",
                 *audio, "-map", "0:v", "-map", "1:a", "-shortest",
                 "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
                 "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", str(out)],
                stdin=subprocess.PIPE)
            for i in range(int(total * FPS / 1000) + 1):
                page.evaluate(f"seek({i * 1000 / FPS})")
                ff.stdin.write(page.screenshot(type="jpeg", quality=92))
            ff.stdin.close()
            if ff.wait():
                raise RuntimeError("ffmpeg xato bilan tugadi")
            browser.close()
    finally:
        page_file.unlink(missing_ok=True)
    return out
