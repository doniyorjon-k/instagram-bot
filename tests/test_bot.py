import json
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest

from bot import storage, writer
from bot.instagram import Instagram
from bot.tick import Bot

FIX = Path(__file__).parent / "fixtures" / "sample_content.json"
TZ = ZoneInfo("Asia/Tashkent")
PLAN = {
    "publish_time": "19:00", "timezone": "Asia/Tashkent", "draft_lead_hours": 33,
    "posts": [
        {"id": "01", "date": "2026-11-05", "topic": "A", "idea": "a", "cta": "bot"},
        {"id": "02", "date": "2026-11-07", "topic": "B", "idea": "b", "cta": "bot"},
    ],
}


class FakeTG:
    def __init__(self, updates=None):
        self.sent, self.albums, self._updates, self._id = [], [], updates or [], 100

    def _msg(self):
        self._id += 1
        return {"message_id": self._id}

    def updates(self, offset):
        out, self._updates = self._updates, []
        return out

    def send(self, chat, text, buttons=None, reply_to=None):
        self.sent.append((chat, text, buttons))
        return self._msg()

    def send_album(self, chat, images):
        self.albums.append(images)
        return [self._msg() for _ in images]

    def answer(self, cid, text):
        pass

    def clear_buttons(self, chat, mid):
        pass


class FakeIG:
    published = []

    def publish_carousel(self, urls, caption):
        FakeIG.published.append((urls, caption))
        return {"id": "m1", "permalink": "https://instagram.com/p/x"}


def fake_render(content, out):
    out.mkdir(parents=True, exist_ok=True)
    paths = []
    for i in range(len(content["slides"]) + 2):
        p = out / f"{i + 1:02d}.jpg"
        p.write_bytes(b"jpg")
        paths.append(p)
    return paths


@pytest.fixture
def content():
    return json.loads(FIX.read_text())


@pytest.fixture(autouse=True)
def admin(monkeypatch):
    monkeypatch.setenv("TELEGRAM_ADMIN_ID", "42")


def make_bot(tmp_path, content, now, state=None, tg=None):
    return Bot(PLAN, state or {"tg_offset": None, "posts": {}}, tg or FakeTG(), ig_factory=FakeIG,
               write=lambda p, fb=None: content, render=fake_render,
               upload=lambda paths, folder: [f"https://cdn/{p.name}" for p in paths],
               now=now, drafts_dir=tmp_path)


def cb(data, mid=999, chat=42):
    return {"update_id": 1, "callback_query": {"id": "c", "data": data,
            "message": {"message_id": mid, "chat": {"id": chat}}}}


def test_sample_content_is_valid(content):
    assert writer.validate(content) == []


def test_validate_catches_long_fields(content):
    content["cover"]["highlight"] = "x" * 30
    content["slides"] = content["slides"][:2]
    errs = writer.validate(content)
    assert any("highlight" in e for e in errs) and any("slides soni" in e for e in errs)


def test_extract_json_from_fenced_block(content):
    text = "Mana:\n```json\n" + json.dumps(content) + "\n```\nTayyor."
    assert writer.extract_json(text)["cover"]["line1"] == "Ot olmoqchimisiz?"


def test_write_post_retries_until_valid(content):
    bad = dict(content, slides=[])
    replies = iter(["no json here", "```json\n" + json.dumps(bad) + "\n```", "```json\n" + json.dumps(content) + "\n```"])
    prompts = []

    def call(prompt):
        prompts.append(prompt)
        return next(replies)

    assert writer.write_post(PLAN["posts"][0], call=call) == content
    assert "xatolar" in prompts[-1]


def test_full_caption_puts_bot_before_site(content):
    cap = writer.full_caption(content)
    assert cap.index("@otbozor_bot") < cap.index("otbozor.uz") and cap.endswith("#kopkari")


def test_no_draft_before_lead_time(tmp_path, content):
    bot = make_bot(tmp_path, content, datetime(2026, 11, 4, 9, 0, tzinfo=TZ))
    bot.run()
    assert bot.tg.albums == [] and bot.state["posts"]["01"]["status"] is None


def test_draft_sent_day_before_then_approve_then_publish(tmp_path, content):
    tg = FakeTG()
    bot = make_bot(tmp_path, content, datetime(2026, 11, 4, 10, 0, tzinfo=TZ), tg=tg)
    bot.run()
    s = bot.state["posts"]["01"]
    assert s["status"] == "draft_sent" and len(tg.albums) == 1
    assert tg.sent[-1][2][0][0]["callback_data"] == "ok:01"

    # approve before publish time: stays approved, not published yet
    tg._updates = [cb("ok:01")]
    bot.now = datetime(2026, 11, 4, 12, 0, tzinfo=TZ)
    bot.run()
    assert s["status"] == "approved"

    FakeIG.published.clear()
    bot.now = datetime(2026, 11, 5, 19, 5, tzinfo=TZ)
    bot.run()
    assert s["status"] == "published" and s["permalink"].startswith("https://")
    urls, caption = FakeIG.published[0]
    assert urls[0] == "https://cdn/01.jpg" and "@otbozor_bot" in caption


def test_reply_feedback_triggers_rewrite(tmp_path, content):
    tg = FakeTG()
    seen = []
    bot = make_bot(tmp_path, content, datetime(2026, 11, 4, 10, 0, tzinfo=TZ), tg=tg)
    bot.run()
    caption_msg = bot.state["posts"]["01"]["tg_messages"][-1]
    bot.write = lambda p, fb=None: seen.append(fb) or content
    tg._updates = [{"update_id": 5, "message": {"chat": {"id": 42}, "text": "Qisqaroq yoz",
                                                "reply_to_message": {"message_id": caption_msg}}}]
    bot.run()
    assert seen == ["Qisqaroq yoz"] and bot.state["posts"]["01"]["status"] == "draft_sent"
    assert bot.state["tg_offset"] == 6


def test_buttons_from_strangers_are_ignored(tmp_path, content):
    tg = FakeTG()
    bot = make_bot(tmp_path, content, datetime(2026, 11, 4, 10, 0, tzinfo=TZ), tg=tg)
    bot.run()
    tg._updates = [cb("ok:01", chat=7)]
    bot.run()
    assert bot.state["posts"]["01"]["status"] == "draft_sent"


def test_reject(tmp_path, content):
    bot = make_bot(tmp_path, content, datetime(2026, 11, 4, 10, 0, tzinfo=TZ))
    bot.run()
    bot.tg._updates = [cb("no:01")]
    bot.now = datetime(2026, 11, 5, 20, 0, tzinfo=TZ)
    bot.run()
    assert bot.state["posts"]["01"]["status"] == "rejected"


def test_stale_posts_are_skipped(tmp_path, content):
    bot = make_bot(tmp_path, content, datetime(2026, 11, 7, 10, 0, tzinfo=TZ))
    bot.run()
    assert bot.state["posts"]["01"]["status"] == "skipped"
    assert bot.state["posts"]["02"]["status"] == "draft_sent"


def test_failures_stop_after_three_attempts(tmp_path, content):
    bot = make_bot(tmp_path, content, datetime(2026, 11, 4, 10, 0, tzinfo=TZ))

    def boom(p, fb=None):
        raise RuntimeError("LLM down")

    bot.write = boom
    for _ in range(3):
        bot.run()
    s = bot.state["posts"]["01"]
    assert s["status"] == "error" and s["attempts"] == 3
    assert "LLM down" in bot.tg.sent[-1][1]


def test_unknown_user_gets_chat_id_when_admin_unset(tmp_path, content, monkeypatch):
    monkeypatch.delenv("TELEGRAM_ADMIN_ID")
    tg = FakeTG([{"update_id": 1, "message": {"chat": {"id": 555}, "text": "/start"}}])
    bot = make_bot(tmp_path, content, datetime(2026, 11, 3, 10, 0, tzinfo=TZ), tg=tg)
    bot.run()
    assert "555" in tg.sent[0][1]


def test_cloudinary_signature_matches_documented_example():
    # Example from Cloudinary's "Generating authentication signatures" docs.
    params = {"eager": "w_400,h_300,c_pad|w_260,h_200,c_crop", "public_id": "sample_image",
              "timestamp": "1315060510"}
    assert storage.sign(params, "abcd") == "bfd09f95f331f558cbd1320e67aa8d488770583e"


class FakeHTTP:
    def __init__(self, responses):
        self.responses, self.calls = list(responses), []

    def request(self, method, url, params=None, data=None, timeout=None):
        self.calls.append((method, url, params or data))
        r = self.responses.pop(0)
        return type("R", (), {"json": lambda self: r})()


def test_instagram_carousel_flow():
    http = FakeHTTP([
        {"id": "c1"}, {"id": "c2"},
        {"status_code": "FINISHED"}, {"status_code": "FINISHED"},
        {"id": "parent"}, {"status_code": "IN_PROGRESS"}, {"status_code": "FINISHED"},
        {"id": "media9"}, {"permalink": "https://instagram.com/p/abc"},
    ])
    ig = Instagram(token="t", user_id="u1", session=http, sleep=lambda s: None)
    out = ig.publish_carousel(["https://a/1.jpg", "https://a/2.jpg"], "cap")
    assert out == {"id": "media9", "permalink": "https://instagram.com/p/abc"}
    parent_call = http.calls[4]
    assert parent_call[2]["children"] == "c1,c2" and parent_call[2]["media_type"] == "CAROUSEL"
    assert http.calls[7][1].endswith("/u1/media_publish")


def test_facebook_token_uses_graph_facebook_and_finds_account():
    http = FakeHTTP([
        {"data": [{"id": "page1"}, {"id": "page2", "instagram_business_account": {"id": "1784", "username": "otbozor.uz"}}]},
        {"id": "c1"}, {"status_code": "FINISHED"},
        {"id": "parent"}, {"status_code": "FINISHED"},
        {"id": "media9"}, {"permalink": "https://instagram.com/p/abc"},
    ])
    ig = Instagram(token="EAAtest", session=http, sleep=lambda s: None)
    ig.user_id = None
    ig.publish_carousel(["https://a/1.jpg"], "cap")
    assert http.calls[0][1].startswith("https://graph.facebook.com/") and http.calls[0][1].endswith("/me/accounts")
    assert http.calls[1][1].endswith("/1784/media")


class FakeHead:
    def __init__(self, codes):
        self.codes, self.urls = list(codes), []

    def head(self, url, timeout=None, allow_redirects=None):
        self.urls.append(url)
        return type("R", (), {"status_code": self.codes.pop(0)})()


def _draft_files(n=2):
    out = storage.ROOT / "drafts" / "99"
    return [out / f"{i + 1:02d}.jpg" for i in range(n)]


def test_github_urls_pin_commit_and_check_public(monkeypatch):
    monkeypatch.delenv("CLOUDINARY_URL", raising=False)
    monkeypatch.setenv("GITHUB_REPOSITORY", "otbozor/instagram-bot")
    calls = []

    def git(*args):
        calls.append(args[0] if args[0] != "-c" else "commit")
        return {"diff": "drafts/99/01.jpg", "rev-parse": "abc123"}.get(args[0], "")

    http = FakeHead([200, 404, 200])
    urls = storage.github_urls(_draft_files(), session=http, git=git, sleep=lambda s: None)
    assert urls == ["https://raw.githubusercontent.com/otbozor/instagram-bot/abc123/drafts/99/01.jpg",
                    "https://raw.githubusercontent.com/otbozor/instagram-bot/abc123/drafts/99/02.jpg"]
    assert calls == ["add", "diff", "commit", "push", "rev-parse"]


def test_github_urls_explain_private_repo(monkeypatch):
    monkeypatch.setenv("GITHUB_REPOSITORY", "otbozor/instagram-bot")
    git = lambda *a: "abc" if a[0] == "rev-parse" else ""
    with pytest.raises(RuntimeError, match="public"):
        storage.github_urls(_draft_files(1), session=FakeHead([404] * 5), git=git, sleep=lambda s: None)


def test_late_approvals_publish_one_per_day_at_publish_time(tmp_path, content):
    bot = make_bot(tmp_path, content, datetime(2026, 11, 6, 10, 0, tzinfo=TZ))
    bot.run()  # drafts 01 (still within 24h) and 02
    assert bot.state["posts"]["01"]["status"] == "draft_sent"
    assert bot.state["posts"]["02"]["status"] == "draft_sent"
    FakeIG.published.clear()
    bot.now = datetime(2026, 11, 8, 12, 0, tzinfo=TZ)
    bot.tg._updates = [cb("ok:01"), cb("ok:02")]
    bot.run()
    assert FakeIG.published == []  # before 19:00
    bot.now = datetime(2026, 11, 8, 19, 0, tzinfo=TZ)
    bot.run()
    bot.now = datetime(2026, 11, 8, 19, 30, tzinfo=TZ)
    bot.run()
    assert len(FakeIG.published) == 1 and bot.state["posts"]["01"]["status"] == "published"
    bot.now = datetime(2026, 11, 9, 19, 0, tzinfo=TZ)
    bot.run()
    assert len(FakeIG.published) == 2 and bot.state["posts"]["02"]["status"] == "published"


REELS = json.loads((Path(__file__).parent / "fixtures" / "sample_reels.json").read_text())


def test_sample_reels_are_valid():
    for kind, data in REELS.items():
        data = dict(data, caption="x" * 400, hashtags=["#otbozor"])
        assert writer.validate_reel(kind, data) == [], kind


def test_reel_validation_catches_bad_answer_and_number():
    q = dict(REELS["quiz"], right="C", caption="x" * 400, hashtags=["#a"])
    f = dict(REELS["fact"], number="ko'p", caption="x" * 400, hashtags=["#a"])
    assert any("right" in e for e in writer.validate_reel("quiz", q))
    assert any("number" in e for e in writer.validate_reel("fact", f))


class FakeReelTG(FakeTG):
    def __init__(self):
        super().__init__()
        self.videos = []

    def send_video(self, chat, video, cover=None):
        self.videos.append(video)
        return self._msg()


class FakeReelIG(FakeIG):
    reels = []

    def publish_reel(self, url, caption):
        FakeReelIG.reels.append((url, caption))
        return {"id": "r1", "permalink": "https://instagram.com/reel/x"}


def test_reel_draft_approve_publish(tmp_path, content):
    plan = dict(PLAN, posts=[{"id": "R01", "type": "reel", "format": "quiz", "date": "2026-11-06",
                              "topic": "Uyqu", "idea": "i", "cta": "bot"}])
    reel = dict(REELS["quiz"], caption="x" * 400, hashtags=["#otbozor"])
    rendered = []

    def render_reel(kind, c, out, cover):
        rendered.append(kind)
        out.write_bytes(b"mp4")
        cover.write_bytes(b"jpg")

    tg = FakeReelTG()
    bot = Bot(plan, {"tg_offset": None, "posts": {}}, tg, ig_factory=FakeReelIG,
              write_reel=lambda p, fb=None: reel, render_reel=render_reel,
              upload=lambda paths, folder: [f"https://cdn/{p.name}" for p in paths],
              now=datetime(2026, 11, 5, 10, 0, tzinfo=TZ), drafts_dir=tmp_path)
    bot.run()
    assert rendered == ["quiz"] and len(tg.videos) == 1
    assert "Reels (viktorina)" in tg.sent[-1][1]
    tg._updates = [cb("ok:R01")]
    bot.now = datetime(2026, 11, 6, 19, 0, tzinfo=TZ)
    bot.run()
    assert bot.state["posts"]["R01"]["status"] == "published"
    assert FakeReelIG.reels[-1][0] == "https://cdn/reel.mp4"


def test_qayta_accepts_reel_ids(tmp_path, content):
    plan = dict(PLAN, posts=PLAN["posts"] + [{"id": "R01", "type": "reel", "format": "myth",
                                               "date": "2026-11-06", "topic": "t", "idea": "i", "cta": "bot"}])
    tg = FakeTG([{"update_id": 1, "message": {"chat": {"id": 42}, "text": "/qayta r01"}}])
    bot = Bot(plan, {"tg_offset": None, "posts": {}}, tg, now=datetime(2026, 11, 1, 10, 0, tzinfo=TZ),
              drafts_dir=tmp_path, write_reel=lambda p, fb=None: (_ for _ in ()).throw(RuntimeError("x")))
    bot.handle_updates()
    assert bot.state["posts"]["R01"]["status"] == "regen"


def test_videos_use_jsdelivr():
    assert storage.public_url("o/r", "abc", "drafts/R01/reel.mp4") == "https://cdn.jsdelivr.net/gh/o/r@abc/drafts/R01/reel.mp4"
    assert storage.public_url("o/r", "abc", "drafts/01/01.jpg").startswith("https://raw.githubusercontent.com/")


def test_instagram_reel_flow():
    http = FakeHTTP([{"id": "c1"}, {"status_code": "IN_PROGRESS"}, {"status_code": "FINISHED"},
                     {"id": "m1"}, {"permalink": "https://instagram.com/reel/a"}])
    ig = Instagram(token="t", user_id="u1", session=http, sleep=lambda s: None)
    assert ig.publish_reel("https://v/reel.mp4", "cap")["permalink"].endswith("/a")
    assert http.calls[0][2]["media_type"] == "REELS" and http.calls[0][2]["video_url"] == "https://v/reel.mp4"
