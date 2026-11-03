"""Synthesize the background music used in Reels (run once, output is committed).

Everything here is generated from scratch (additive pads, Karplus-Strong plucks,
synthesized percussion), so the tracks carry no third-party licence.

    pip install numpy && python tools/make_music.py
"""
from __future__ import annotations

import subprocess
import wave
from pathlib import Path

import numpy as np

SR = 44100
OUT = Path(__file__).resolve().parent.parent / "assets" / "music"
NOTES = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}


def hz(name: str, octave: int) -> float:
    return 440.0 * 2 ** ((NOTES[name] + 12 * (octave + 1) - 69) / 12)


def chord(root: str, minor: bool, octave: int = 3) -> list[float]:
    r = NOTES[root] + 12 * (octave + 1)
    third = 3 if minor else 4
    return [440.0 * 2 ** ((m - 69) / 12) for m in (r, r + third, r + 7, r + 12)]


def env(n: int, attack: float, release: float) -> np.ndarray:
    e = np.ones(n)
    a, r = int(attack * SR), int(release * SR)
    e[:a] = np.linspace(0, 1, a)
    e[-r:] *= np.linspace(1, 0, r)
    return e


def pad(freqs, dur) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for f in freqs:
        for det in (-0.12, 0.0, 0.12):  # slight detune for width
            ff = f * 2 ** (det / 12)
            out += np.sin(2 * np.pi * ff * t) + 0.25 * np.sin(4 * np.pi * ff * t) + 0.08 * np.sin(6 * np.pi * ff * t)
    trem = 1 + 0.06 * np.sin(2 * np.pi * 0.25 * t)
    return out * trem * env(n, 0.6, 0.8) / (len(freqs) * 3)


def pluck(f, dur, decay=0.996) -> np.ndarray:
    n = int(dur * SR)
    period = max(2, int(SR / f))
    rng = np.random.default_rng(int(f * 100))
    buf = np.convolve(rng.uniform(-1, 1, period), np.ones(4) / 4, mode="same")  # darker attack
    out = np.zeros(n)
    for i in range(n):
        out[i] = buf[i % period]
        buf[i % period] = decay * 0.5 * (buf[i % period] + buf[(i + 1) % period])
    return out * env(n, 0.002, 0.05)


def kick(dur=0.35) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 110 * np.exp(-t * 18) + 45
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)


def shaker(dur=0.08) -> np.ndarray:
    n = int(dur * SR)
    rng = np.random.default_rng(7)
    x = rng.uniform(-1, 1, n)
    x = np.diff(np.concatenate([[0], x]))  # crude high-pass
    return x * np.exp(-np.arange(n) / SR * 60)


def add(track, sig, at, gain):
    i = int(at * SR)
    if i >= len(track):
        return
    j = min(len(track), i + len(sig))
    track[i:j] += gain * sig[: j - i]


def reverb(x: np.ndarray) -> np.ndarray:
    out = x.copy()
    for delay, g in ((0.029, .35), (0.037, .3), (0.053, .25), (0.071, .2), (0.113, .15), (0.157, .1)):
        d = int(delay * SR)
        out[d:] += g * x[:-d]
    return out


def song(progression, bpm, length, drums, arp_octave=5) -> np.ndarray:
    beat = 60 / bpm
    bar = 4 * beat
    track = np.zeros(int((length + 2) * SR))
    t, k = 0.0, 0
    while t < length:
        root, minor = progression[k % len(progression)]
        freqs = chord(root, minor)
        add(track, pad(freqs, bar + 0.6), t, 0.55)
        add(track, pad([freqs[0] / 2], bar + 0.4), t, 0.35)  # bass
        tones = chord(root, minor, arp_octave - 1)
        pattern = [0, 1, 2, 3, 2, 1, 2, 3]
        for s, idx in enumerate(pattern):
            add(track, pluck(tones[idx], beat), t + s * beat / 2, 0.18)
        if drums:
            for b in range(4):
                if b in (0, 2):
                    add(track, kick(), t + b * beat, 0.5)
                add(track, shaker(), t + b * beat + beat / 2, 0.12)
        t += bar
        k += 1
    track = reverb(track)[: int(length * SR)]
    track /= np.max(np.abs(track)) / 0.6
    return track


def save(name: str, x: np.ndarray):
    OUT.mkdir(parents=True, exist_ok=True)
    wav = OUT / f"{name}.wav"
    stereo = np.stack([x, np.roll(x, int(0.012 * SR))], axis=1)  # tiny Haas widening
    with wave.open(str(wav), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((stereo * 32767).astype("<i2").tobytes())
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-af", "lowpass=f=5000,highpass=f=40", "-c:a", "aac", "-b:a", "160k",
                    str(OUT / f"{name}.m4a")], check=True)
    wav.unlink()


if __name__ == "__main__":
    save("yengil", song([("A", True), ("F", False), ("C", False), ("G", False)], 100, 24, drums=True))
    save("sokin", song([("C", False), ("A", True), ("F", False), ("G", False)], 76, 24, drums=False))
    save("iliq", song([("D", True), ("A#", False), ("F", False), ("C", False)], 88, 24, drums=True))
    print("ok", sorted(p.name for p in OUT.glob("*.m4a")))
