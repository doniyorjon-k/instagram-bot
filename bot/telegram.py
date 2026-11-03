"""Minimal Telegram Bot API client (long polling via getUpdates, no webhook)."""
from __future__ import annotations

import json
import os
from pathlib import Path

import requests


class Telegram:
    def __init__(self, token: str | None = None, session: requests.Session | None = None):
        self.token = token or os.environ["TELEGRAM_BOT_TOKEN"]
        self.http = session or requests.Session()

    def _url(self, method: str) -> str:
        return f"https://api.telegram.org/bot{self.token}/{method}"

    def call(self, method: str, files=None, **params):
        if files:
            data = {k: (json.dumps(v) if isinstance(v, (dict, list)) else v) for k, v in params.items()}
            r = self.http.post(self._url(method), data=data, files=files, timeout=120)
        else:
            r = self.http.post(self._url(method), json=params, timeout=60)
        body = r.json()
        if not body.get("ok"):
            raise RuntimeError(f"Telegram {method}: {body.get('description')}")
        return body["result"]

    def updates(self, offset: int | None) -> list[dict]:
        params = {"timeout": 0, "allowed_updates": ["message", "callback_query"]}
        if offset is not None:
            params["offset"] = offset
        return self.call("getUpdates", **params)

    def send(self, chat_id, text: str, buttons: list[list[dict]] | None = None, reply_to: int | None = None):
        params = {"chat_id": chat_id, "text": text, "disable_web_page_preview": True}
        if buttons:
            params["reply_markup"] = {"inline_keyboard": buttons}
        if reply_to:
            params["reply_parameters"] = {"message_id": reply_to}
        return self.call("sendMessage", **params)

    def send_album(self, chat_id, images: list[Path]) -> list[dict]:
        media, files = [], {}
        for i, path in enumerate(images[:10]):
            key = f"f{i}"
            media.append({"type": "photo", "media": f"attach://{key}"})
            files[key] = (path.name, path.read_bytes(), "image/jpeg")
        return self.call("sendMediaGroup", files=files, chat_id=chat_id, media=media)

    def send_video(self, chat_id, video: Path, cover: Path | None = None) -> dict:
        files = {"video": (video.name, video.read_bytes(), "video/mp4")}
        params = {"chat_id": chat_id, "supports_streaming": "true", "width": 1080, "height": 1920}
        if cover:
            files["cover"] = (cover.name, cover.read_bytes(), "image/jpeg")
            params["cover"] = "attach://cover"
        return self.call("sendVideo", files=files, **params)

    def answer(self, callback_id: str, text: str):
        return self.call("answerCallbackQuery", callback_query_id=callback_id, text=text)

    def clear_buttons(self, chat_id, message_id: int):
        try:
            self.call("editMessageReplyMarkup", chat_id=chat_id, message_id=message_id,
                      reply_markup={"inline_keyboard": []})
        except RuntimeError:
            pass  # message too old or already edited
