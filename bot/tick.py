"""One scheduler tick: read Telegram replies, write due drafts, publish approved posts.

Runs every 30 minutes from GitHub Actions. All state lives in data/state.json,
which the workflow commits back to the repo after each run.

Post statuses: (none) -> draft_sent -> approved -> published
                                    \\-> regen (rewrite requested) -> draft_sent
                                    \\-> rejected
Any step that fails 3 times in a row moves the post to "error" and notifies the admin.
"""
from __future__ import annotations

import json
import os
import traceback
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from . import render as render_mod
from . import storage, writer
from .instagram import Instagram
from .telegram import Telegram

ROOT = Path(__file__).resolve().parent.parent
PLAN = ROOT / "plan.json"
STATE = ROOT / "data" / "state.json"
DRAFTS = ROOT / "drafts"
MAX_ATTEMPTS = 3

STATUS_UZ = {
    None: "navbatda", "draft_sent": "tasdiq kutilmoqda", "regen": "qayta yozilmoqda",
    "approved": "tasdiqlangan", "published": "joylandi", "rejected": "rad etilgan", "error": "xato",
    "skipped": "o'tkazib yuborildi",
}


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def save(path: Path, data: dict):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


class Bot:
    def __init__(self, plan: dict, state: dict, tg: Telegram, ig_factory=None,
                 write=writer.write_post, render=render_mod.render, upload=storage.upload,
                 now: datetime | None = None, drafts_dir: Path = DRAFTS):
        self.plan, self.state, self.tg = plan, state, tg
        self.ig_factory = ig_factory or Instagram
        self.write, self.render, self.upload = write, render, upload
        self.tz = ZoneInfo(plan.get("timezone", "Asia/Tashkent"))
        self.now = now or datetime.now(self.tz)
        self.drafts = drafts_dir
        self.admin = os.environ.get("TELEGRAM_ADMIN_ID")

    # ---------- helpers ----------
    def st(self, pid: str) -> dict:
        return self.state["posts"].setdefault(pid, {"status": None, "attempts": 0})

    def publish_at(self, post: dict) -> datetime:
        hh, mm = map(int, self.plan.get("publish_time", "19:00").split(":"))
        d = datetime.fromisoformat(post["date"])
        return d.replace(hour=hh, minute=mm, tzinfo=self.tz)

    def post(self, pid: str) -> dict | None:
        return next((p for p in self.plan["posts"] if p["id"] == pid), None)

    def notify(self, text: str, **kw):
        if self.admin:
            return self.tg.send(self.admin, text, **kw)

    def fail(self, pid: str, step: str, err: Exception):
        s = self.st(pid)
        s["attempts"] = s.get("attempts", 0) + 1
        s["last_error"] = f"{step}: {err}"
        traceback.print_exc()
        if s["attempts"] >= MAX_ATTEMPTS:
            s["status"] = "error"
            self.notify(f"#{pid} postda xato ({step}), {MAX_ATTEMPTS} marta urinildi:\n{err}\n\n"
                        f"Qayta urinish uchun: /qayta {pid}")

    # ---------- telegram ----------
    def handle_updates(self):
        updates = self.tg.updates(self.state.get("tg_offset"))
        for u in updates:
            self.state["tg_offset"] = u["update_id"] + 1
            try:
                if "callback_query" in u:
                    self.on_button(u["callback_query"])
                elif "message" in u:
                    self.on_message(u["message"])
            except Exception as e:  # one bad update must not block the rest
                traceback.print_exc()
                self.notify(f"Xabarni qayta ishlashda xato: {e}")

    def is_admin(self, chat_id) -> bool:
        return self.admin is not None and str(chat_id) == str(self.admin)

    def on_message(self, msg: dict):
        chat = msg["chat"]["id"]
        text = (msg.get("text") or "").strip()
        if not self.is_admin(chat):
            if not self.admin:
                # First-time setup: tell the owner which id to put in TELEGRAM_ADMIN_ID.
                self.tg.send(chat, f"Sizning chat ID raqamingiz: {chat}\n"
                                   "Uni GitHub'da TELEGRAM_ADMIN_ID secret sifatida saqlang.")
            return
        if text.startswith("/start") or text.startswith("/holat"):
            self.tg.send(chat, self.status_text())
            return
        if text.startswith("/qayta"):
            pid = text.split()[-1].zfill(2) if len(text.split()) > 1 else ""
            if self.post(pid):
                s = self.st(pid)
                s.update(status="regen", attempts=0, feedback=None)
                self.tg.send(chat, f"#{pid} post qayta tayyorlanadi.")
            else:
                self.tg.send(chat, "Foydalanish: /qayta 03")
            return
        reply = msg.get("reply_to_message", {}).get("message_id")
        pid = self.find_by_message(reply) if reply else None
        if pid and text:
            s = self.st(pid)
            if s["status"] == "published":
                self.tg.send(chat, f"#{pid} allaqachon joylangan.")
                return
            s.update(status="regen", attempts=0, feedback=text)
            self.tg.send(chat, f"Izoh qabul qilindi. #{pid} post shu izoh bilan qayta yoziladi.")
        elif text:
            self.tg.send(chat, "Izoh qoldirish uchun post xabariga javob (reply) qiling.\n"
                               "Buyruqlar: /holat, /qayta <raqam>")

    def find_by_message(self, message_id: int) -> str | None:
        for pid, s in self.state["posts"].items():
            if message_id in s.get("tg_messages", []):
                return pid
        return None

    def on_button(self, cq: dict):
        chat = cq["message"]["chat"]["id"]
        if not self.is_admin(chat):
            self.tg.answer(cq["id"], "Ruxsat yo'q")
            return
        action, _, pid = cq.get("data", "").partition(":")
        s = self.st(pid)
        if s["status"] not in ("draft_sent",):
            self.tg.answer(cq["id"], f"Bu post holati: {STATUS_UZ.get(s['status'], s['status'])}")
            return
        self.tg.clear_buttons(chat, cq["message"]["message_id"])
        if action == "ok":
            s["status"] = "approved"
            when = max(self.publish_at(self.post(pid)), self.now)
            self.tg.answer(cq["id"], "Tasdiqlandi")
            self.tg.send(chat, f"#{pid} tasdiqlandi. {when:%d.%m %H:%M} da joylanadi.")
        elif action == "re":
            s.update(status="regen", attempts=0, feedback=None)
            self.tg.answer(cq["id"], "Qayta yoziladi")
            self.tg.send(chat, f"#{pid} qayta yoziladi. Izoh qo'shmoqchi bo'lsangiz, post xabariga reply qiling.")
        elif action == "no":
            s["status"] = "rejected"
            self.tg.answer(cq["id"], "Rad etildi")
            self.tg.send(chat, f"#{pid} rad etildi va joylanmaydi. Qaytarish uchun: /qayta {pid}")

    def status_text(self) -> str:
        lines = ["Post rejasi:"]
        for p in self.plan["posts"]:
            s = self.state["posts"].get(p["id"], {})
            lines.append(f"#{p['id']} {p['date'][5:]} {p['topic']}: {STATUS_UZ.get(s.get('status'), s.get('status'))}")
        return "\n".join(lines)

    # ---------- drafts ----------
    def make_drafts(self):
        lead = timedelta(hours=self.plan.get("draft_lead_hours", 33))
        for p in self.plan["posts"]:
            s = self.st(p["id"])
            due = self.now >= self.publish_at(p) - lead
            if s["status"] is None and self.now > self.publish_at(p) + timedelta(hours=24):
                # Too late to be useful (e.g. the bot was set up after this date).
                s["status"] = "skipped"
                continue
            if s["status"] == "regen" or (s["status"] is None and due):
                try:
                    self.draft(p, s.get("feedback"))
                except Exception as e:
                    self.fail(p["id"], "matn/rasm", e)

    def draft(self, p: dict, feedback: str | None):
        pid = p["id"]
        content = self.write(p, feedback)
        out = self.drafts / pid
        for old in out.glob("*.jpg") if out.exists() else []:
            old.unlink()
        images = self.render(content, out)
        caption = writer.full_caption(content)
        save(out / "content.json", {**content, "full_caption": caption})
        if not self.admin:
            raise RuntimeError("TELEGRAM_ADMIN_ID sozlanmagan")
        album = self.tg.send_album(self.admin, images)
        sources = "\n".join(content.get("sources", [])[:5])
        when = max(self.publish_at(p), self.now)
        text = (f"#{pid} | {p['date']} | {p['topic']}\n"
                f"Joylanish vaqti: {when:%d.%m %H:%M}\n\n{caption}"
                + (f"\n\nManbalar:\n{sources}" if sources else "")
                + "\n\nO'zgartirish kerak bo'lsa, shu xabarga javob (reply) qilib izoh yozing.")
        msg = self.tg.send(self.admin, text[:4096], buttons=[[
            {"text": "Tasdiqlash", "callback_data": f"ok:{pid}"},
            {"text": "Qayta yozish", "callback_data": f"re:{pid}"},
            {"text": "Rad etish", "callback_data": f"no:{pid}"},
        ]])
        s = self.st(pid)
        s.update(status="draft_sent", attempts=0, feedback=None, last_error=None,
                 drafted_at=self.now.isoformat(),
                 tg_messages=[m["message_id"] for m in album] + [msg["message_id"]])

    # ---------- publishing ----------
    def publish_due(self):
        for p in self.plan["posts"]:
            s = self.st(p["id"])
            if s["status"] == "approved" and self.now >= self.publish_at(p):
                try:
                    self.publish(p)
                except Exception as e:
                    self.fail(p["id"], "Instagram'ga joylash", e)

    def publish(self, p: dict):
        pid = p["id"]
        out = self.drafts / pid
        content = load(out / "content.json")
        images = sorted(out.glob("*.jpg"))
        urls = self.upload(images, folder=f"otbozor/{pid}-{self.now:%Y%m%d%H%M}")
        result = self.ig_factory().publish_carousel(urls, content["full_caption"])
        s = self.st(pid)
        s.update(status="published", attempts=0, published_at=self.now.isoformat(),
                 ig_media_id=result["id"], permalink=result.get("permalink"))
        self.notify(f"#{pid} Instagram'ga joylandi: {result.get('permalink') or result['id']}")

    def check_plan_end(self):
        last = max(self.publish_at(p) for p in self.plan["posts"])
        if self.now > last and not self.state.get("plan_end_notified"):
            self.state["plan_end_notified"] = True
            self.notify("30 kunlik reja tugadi. Keyingi oy uchun yangi reja kerak.")

    def run(self):
        self.handle_updates()
        self.make_drafts()
        self.publish_due()
        self.check_plan_end()


def main():
    plan, state = load(PLAN), load(STATE)
    bot = Bot(plan, state, Telegram())
    try:
        bot.run()
    finally:
        save(STATE, state)


if __name__ == "__main__":
    main()
