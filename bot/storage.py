"""Give slide images a public URL so Instagram can fetch them.

Instagram's API only accepts images by URL. Two backends:

- GitHub (default): the repo is public, so files committed under drafts/ are
  served by raw.githubusercontent.com. Uncommitted images are committed and
  pushed first, then the URL is pinned to that exact commit.
- Cloudinary: used when CLOUDINARY_URL=cloudinary://<key>:<secret>@<cloud> is set.
"""
from __future__ import annotations

import hashlib
import os
import subprocess
import time
from pathlib import Path
from urllib.parse import urlparse

import requests

ROOT = Path(__file__).resolve().parent.parent


def upload(paths: list[Path], folder: str, session=None) -> list[str]:
    if os.environ.get("CLOUDINARY_URL") and not any(p.suffix == ".mp4" for p in paths):
        return cloudinary_upload(paths, folder, session)
    return github_urls(paths, session)


# --- GitHub raw URLs -------------------------------------------------------

def _git(*args: str) -> str:
    return subprocess.run(["git", *args], cwd=ROOT, check=True, capture_output=True, text=True).stdout.strip()


def _ensure_committed(paths: list[Path], git=_git) -> str:
    rels = [str(p.resolve().relative_to(ROOT)) for p in paths]
    git("add", "--", *rels)
    if git("diff", "--cached", "--name-only", "--", *rels):
        git("-c", "user.name=otbozor-bot", "-c", "user.email=otbozor-bot@users.noreply.github.com",
            "commit", "-m", "publish: add slide images", "--", *rels)
        git("push")
    return git("rev-parse", "HEAD")


def public_url(repo: str, sha: str, rel: str) -> str:
    # raw.githubusercontent.com serves videos as application/octet-stream, which
    # Instagram may refuse; jsDelivr serves the same commit with video/mp4.
    if rel.endswith(".mp4"):
        return f"https://cdn.jsdelivr.net/gh/{repo}@{sha}/{rel}"
    return f"https://raw.githubusercontent.com/{repo}/{sha}/{rel}"


def github_urls(paths: list[Path], session=None, git=_git, sleep=time.sleep) -> list[str]:
    repo = os.environ.get("GITHUB_REPOSITORY")
    if not repo:
        raise RuntimeError("GITHUB_REPOSITORY yo'q: rasm URL'ini yasab bo'lmadi (CLOUDINARY_URL ham yo'q).")
    sha = _ensure_committed(paths, git)
    urls = [public_url(repo, sha, p.resolve().relative_to(ROOT).as_posix()) for p in paths]
    http = session or requests.Session()
    for url in urls:
        for attempt in range(5):
            status = http.head(url, timeout=30, allow_redirects=True).status_code
            if status == 200:
                break
            if status == 404 and attempt == 4:
                raise RuntimeError("Rasm GitHub'da ochiq emas (404). Repo'ni public qiling: "
                                   "Settings → General → Danger Zone → Change visibility → Public.")
            sleep(5)
        else:
            raise RuntimeError(f"Rasm URL ochilmadi: {url} (HTTP {status})")
    return urls


# --- Cloudinary ------------------------------------------------------------

def _creds() -> tuple[str, str, str]:
    u = urlparse(os.environ["CLOUDINARY_URL"])
    return u.username, u.password, u.hostname


def sign(params: dict, secret: str) -> str:
    to_sign = "&".join(f"{k}={params[k]}" for k in sorted(params))
    return hashlib.sha1((to_sign + secret).encode()).hexdigest()


def cloudinary_upload(paths: list[Path], folder: str, session=None) -> list[str]:
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
