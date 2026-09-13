"""VideoEncoderDetector: NVENC con prueba real, fallback libx264."""
from __future__ import annotations

import shutil
import subprocess
import time
from pathlib import Path


def _has(encoder: str) -> bool:
    if shutil.which("ffmpeg") is None:
        return False
    r = subprocess.run(["ffmpeg", "-hide_banner", "-h", f"encoder={encoder}"],
                       capture_output=True, timeout=30)
    return r.returncode == 0


def _bench(encoder: str, tmp: Path, w: int = 640, h: int = 360,
           frames: int = 150) -> dict | None:
    try:
        t0 = time.time()
        cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
               "-f", "lavfi", "-i", f"testsrc=size={w}x{h}:rate=30:duration=5",
               "-frames:v", str(frames)]
        if encoder == "h264_nvenc":
            cmd += ["-c:v", "h264_nvenc", "-preset", "p4", "-cq", "23"]
        else:
            cmd += ["-c:v", "libx264", "-preset", "veryfast", "-crf", "23"]
        out = tmp / f"enc-{encoder}.mp4"
        cmd += [str(out)]
        r = subprocess.run(cmd, capture_output=True, timeout=180)
        if r.returncode != 0 or not out.exists():
            return None
        return {"encoder": encoder, "tiempo_s": round(time.time() - t0, 1),
                "bytes": out.stat().st_size}
    except Exception:
        return None


def detect_encoder(tmp: str | Path) -> dict:
    """Devuelve {elegido, nvenc_ok, libx264_ok, detalle}. Sin Chatterbox."""
    tmp = Path(tmp)
    tmp.mkdir(parents=True, exist_ok=True)
    nv = _has("h264_nvenc")
    lx = _has("libx264")
    det: dict = {"nvenc_ok": False, "libx264_ok": lx, "detalle": {}}
    if nv:
        b = _bench("h264_nvenc", tmp)
        if b:
            det["nvenc_ok"] = True
            det["detalle"]["h264_nvenc"] = b
    if lx:
        b = _bench("libx264", tmp)
        if b:
            det["detalle"]["libx264"] = b
    det["elegido"] = ("h264_nvenc" if det["nvenc_ok"] else
                      "libx264" if det["libx264_ok"] else None)
    return det
