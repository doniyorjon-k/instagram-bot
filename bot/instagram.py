"""Publish a carousel with the Instagram API (Instagram Login, graph.instagram.com)."""
from __future__ import annotations

import os
import time

import requests


class Instagram:
    def __init__(self, token: str | None = None, user_id: str | None = None,
                 session: requests.Session | None = None, sleep=time.sleep):
        self.token = token or os.environ["IG_ACCESS_TOKEN"]
        self.user_id = user_id or os.environ.get("IG_USER_ID") or None
        self.version = os.environ.get("IG_API_VERSION", "v23.0")
        self.http = session or requests.Session()
        self.sleep = sleep

    def _req(self, method: str, path: str, **params):
        params["access_token"] = self.token
        url = f"https://graph.instagram.com/{self.version}/{path}"
        r = self.http.request(method, url, params=params if method == "GET" else None,
                              data=params if method == "POST" else None, timeout=60)
        body = r.json()
        if "error" in body:
            raise RuntimeError(f"Instagram {path}: {body['error'].get('message')}")
        return body

    def me(self) -> str:
        if not self.user_id:
            self.user_id = str(self._req("GET", "me", fields="user_id,username")["user_id"])
        return self.user_id

    def _wait_ready(self, container_id: str, tries: int = 20):
        for _ in range(tries):
            status = self._req("GET", container_id, fields="status_code").get("status_code")
            if status == "FINISHED":
                return
            if status in ("ERROR", "EXPIRED"):
                raise RuntimeError(f"Instagram konteyner holati: {status}")
            self.sleep(5)
        raise RuntimeError("Instagram konteyneri tayyor bo'lmadi")

    def publish_carousel(self, image_urls: list[str], caption: str) -> dict:
        uid = self.me()
        children = []
        for url in image_urls[:10]:
            child = self._req("POST", f"{uid}/media", image_url=url, is_carousel_item="true")
            children.append(child["id"])
        for cid in children:
            self._wait_ready(cid)
        parent = self._req("POST", f"{uid}/media", media_type="CAROUSEL",
                           children=",".join(children), caption=caption)
        self._wait_ready(parent["id"])
        media = self._req("POST", f"{uid}/media_publish", creation_id=parent["id"])
        # The post is live now; a failed permalink lookup must not trigger a re-publish.
        try:
            link = self._req("GET", media["id"], fields="permalink").get("permalink")
        except Exception:
            link = None
        return {"id": media["id"], "permalink": link}

    def refresh_token(self) -> str:
        r = self.http.get("https://graph.instagram.com/refresh_access_token",
                          params={"grant_type": "ig_refresh_token", "access_token": self.token}, timeout=60)
        body = r.json()
        if "access_token" not in body:
            raise RuntimeError(f"Token yangilanmadi: {body}")
        return body["access_token"]
