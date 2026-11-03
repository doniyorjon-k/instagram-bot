"""Upload slide images to Cloudinary so Instagram can fetch them by public URL.

Instagram's API only accepts images by URL; the repo is private, so the files
need a public home. Set CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>.
"""
from __future__ import annotations

import hashlib
import os
import time
from pathlib import Path
from urllib.parse import urlparse

import requests


def _creds() -> tuple[str, str, str]:
    u = urlparse(os.environ["CLOUDINARY_URL"])
    return u.username, u.password, u.hostname


def sign(params: dict, secret: str) -> str:
    to_sign = "&".join(f"{k}={params[k]}" for k in sorted(params))
    return hashlib.sha1((to_sign + secret).encode()).hexdigest()


def upload(paths: list[Path], folder: str, session: requests.Session | None = None) -> list[str]:
    key, secret, cloud = _creds()
    http = session or requests.Session()
    urls = []
    for path in paths:
        params = {"folder": folder, "public_id": path.stem, "overwrite": "true",
                  "timestamp": str(int(time.time()))}
        params["signature"] = sign(params, secret)
        params["api_key"] = key
        r = http.post(f"https://api.cloudinary.com/v1_1/{cloud}/image/upload",
                      data=params, files={"file": (path.name, path.read_bytes(), "image/jpeg")}, timeout=120)
        body = r.json()
        if "secure_url" not in body:
            raise RuntimeError(f"Cloudinary: {body.get('error', body)}")
        urls.append(body["secure_url"])
    return urls
