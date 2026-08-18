"""
Motor TTS local persistente — Chatterbox Multilingual es-mx-latam (CUDA).
Protocolo: JSONL por stdin/stdout.
Comandos:
  {"op":"status"}                       -> info de hardware/modelo
  {"op":"warmup"}                       -> carga modelo + generación de prueba
  {"op":"generate","id":"...","text":"...","voice":"A"|"B"|"N"|"C"|"P"} -> WAV + métricas
  {"op":"shutdown"}
Respuestas:
  {"op":"status"|"warmup"|"result","id":...,"ok":true|false,...}
Reglas: concurrency=1, modelo cargado UNA vez, OOM -> liberar + UN reintento.
"""
import copy
import gc
import json
import os
import subprocess
import sys
import time
import traceback
from pathlib import Path

# Protocolo JSONL en UTF-8 explícito (Windows usa cp1252 por defecto en stdin).
try:
    sys.stdin.reconfigure(encoding="utf-8", errors="strict")
    sys.stdout.reconfigure(encoding="utf-8", errors="strict")
except Exception:
    pass

import psutil
import torch

BASE = Path(r"C:\Users\Axel Rosete\Desktop\La Veinte Digital\data\tts")
MODEL_DIR = BASE / "models" / "latam"
REF_DIR = BASE / "ref"
CACHE_DIR = BASE / "cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

os.environ.setdefault("HF_HOME", str(BASE / "hf-cache"))
os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
os.environ.setdefault("TRANSFORMERS_NO_ADVISORY_WARNINGS", "1")

VOICE_REFS = {
    "A": REF_DIR / "eduardo.wav",
    "B": REF_DIR / "mariana.wav",
    "N": REF_DIR / "narrador.wav",
    "C": REF_DIR / "rodrigo.wav",
    "P": REF_DIR / "valeria.wav",
}
# A = builtin: usa la voz integrada del modelo (sin clonar referencia).
# B/N/C/P = reference: clona la referencia indicada; cada rol debe tener archivo propio.
VOICE_MODE = {"A": "builtin", "B": "reference", "N": "reference", "C": "reference", "P": "reference"}

_model = None
_loaded_conds = None
_builtin_conds = None
_last_error = None
_sessions_generated = 0
_peak_vram_mb = 0.0
_temp_start = None
_temp_peak = None


def emit(obj):
    sys.stdout.write(json.dumps(obj, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def gpu_temp_c():
    try:
        out = subprocess.run(
            ["nvidia-smi", "--query-gpu=temperature.gpu", "--format=csv,noheader"],
            capture_output=True, text=True, timeout=10,
        ).stdout.strip()
        return int(out.splitlines()[0])
    except Exception:
        return None


def vram_used_mb():
    try:
        return round(torch.cuda.memory_allocated() / 1e6, 1)
    except Exception:
        return 0.0


def ram_used_gb():
    p = psutil.Process()
    return round(p.memory_info().rss / 1e9, 2)


def load_model(device="cuda"):
    global _model, _builtin_conds
    from chatterbox.mtl_tts import ChatterboxMultilingualTTS
    from safetensors.torch import load_file

    t0 = time.time()
    _model = ChatterboxMultilingualTTS.from_pretrained(device)
    # Snapshot de la voz integrada: las referencias (B/N) REEMPLAZAN _model.conds
    # y hay que restaurarlo cuando se vuelve a la voz builtin (A).
    if _model.conds is not None:
        _builtin_conds = copy.deepcopy(_model.conds)
    t3_path = MODEL_DIR / "t3_es_mx_latam.safetensors"
    if t3_path.exists():
        st = load_file(str(t3_path))
        st = st["model"][0] if "model" in st else st
        _model.t3.load_state_dict(st)
    return round(time.time() - t0, 1)


def prepare_voice(voice: str):
    global _loaded_conds
    from chatterbox.mtl_tts import Conditionals
    mode = VOICE_MODE.get(voice, "reference")
    if mode == "builtin":
        # Voz integrada del modelo: sin clonar referencia. Asegura conds cargadas.
        if _model.conds is None:
            raise ValueError("el modelo no tiene voz integrada (conds.pt)")
        # Restaura la voz integrada si quedó reemplazada por una referencia (B/N).
        if _builtin_conds is not None:
            _model.conds = copy.deepcopy(_builtin_conds)
        _loaded_conds = "builtin"
        return
    if _loaded_conds == voice and _model.conds is not None:
        return
    ref = VOICE_REFS.get(voice)
    if ref is None or not ref.exists():
        raise ValueError(f"referencia de voz {voice} no existe: {ref}")
    t0 = time.time()
    _model.prepare_conditionals(str(ref))
    _loaded_conds = voice


def generate_block(text, voice, job_id):
    global _peak_vram_mb, _sessions_generated
    from chatterbox.mtl_tts import T3Cond

    prepare_voice(voice)

    vram_before = vram_used_mb()
    t0 = time.time()
    try:
        wav = _model.generate(text, language_id="es")
    except torch.cuda.OutOfMemoryError:
        emit({"op": "log", "id": job_id, "msg": "OOM detectado — liberando y reintentando UNA vez"})
        gc.collect()
        torch.cuda.empty_cache()
        try:
            wav = _model.generate(text, language_id="es")
        except torch.cuda.OutOfMemoryError as e2:
            raise RuntimeError("GPU_LOW_VRAM: segundo OOM consecutivo") from e2

    gen_s = round(time.time() - t0, 2)
    wav = wav.squeeze(0).cpu()
    if wav.ndim == 1:
        wav = wav.unsqueeze(0)
    dur_s = round(float(wav.shape[-1]) / _model.sr, 2)

    import torchaudio
    out = CACHE_DIR / f"{job_id}.wav"
    torchaudio.save(str(out), wav, _model.sr)

    vram_after = vram_used_mb()
    _peak_vram_mb = max(_peak_vram_mb, vram_after)
    _sessions_generated += 1
    torch.cuda.empty_cache()

    t = gpu_temp_c()
    if t is not None:
        global _temp_start, _temp_peak
        if _temp_start is None:
            _temp_start = t
        _temp_peak = max(_temp_peak or 0, t)

    return {
        "path": str(out),
        "gen_s": gen_s,
        "dur_s": dur_s,
        "rtf": round(gen_s / dur_s, 3) if dur_s else None,
        "vram_before_mb": vram_before,
        "vram_after_mb": vram_after,
        "vram_peak_mb": round(_peak_vram_mb, 1),
        "ram_used_gb": ram_used_gb(),
        "gpu_temp_c": t,
        "temp_start": _temp_start,
        "temp_peak": _temp_peak,
    }


def cmd_status():
    return {
        "op": "status",
        "ok": True,
        "provider": "chatterbox-local",
        "model": "ResembleAI/Chatterbox-Multilingual-es-mx-latam",
        "device": str(getattr(_model, "device", "n/a")) if _model else "n/a",
        "loaded": _model is not None,
        "cuda": torch.cuda.is_available(),
        "gpu": torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
        "vram_total_mb": round(torch.cuda.get_device_properties(0).total_memory / 1e6) if torch.cuda.is_available() else None,
        "torch": torch.__version__,
        "python": sys.version.split()[0],
        "last_error": _last_error,
        "sessions_generated": _sessions_generated,
        "peak_vram_mb": round(_peak_vram_mb, 1),
        "ram_used_gb": ram_used_gb(),
        "gpu_temp_c": gpu_temp_c(),
    }


def main():
    global _model, _last_error
    for raw in sys.stdin:
        raw = raw.strip()
        if not raw:
            continue
        try:
            req = json.loads(raw)
        except json.JSONDecodeError:
            emit({"op": "error", "msg": "json inválido"})
            continue

        op = req.get("op")
        if op == "shutdown":
            emit({"op": "bye"})
            break

        if op == "status":
            emit(cmd_status())
            continue

        if op == "warmup":
            t0 = time.time()
            try:
                if _model is None:
                    load_s = load_model("cuda")
                    emit({"op": "log", "msg": f"modelo cargado en {load_s}s (cuda)"})
                prepare_voice("A")
                r = generate_block("Prueba de voz.", "A", "warmup")
                (CACHE_DIR / "warmup.wav").unlink(missing_ok=True)
                emit({"op": "warmup", "ok": True, "load_s": load_s, "warmup_s": round(time.time() - t0, 1), **r})
            except Exception as e:
                _last_error = str(e)
                emit({"op": "warmup", "ok": False, "error": str(e)[:300]})
            continue

        if op == "generate":
            job_id = str(req.get("id", f"job-{int(time.time()*1000)}"))
            text = str(req.get("text", "")).strip()
            voice = str(req.get("voice", "A")).upper()
            if not text:
                emit({"op": "result", "id": job_id, "ok": False, "error": "texto vacío"})
                continue
            try:
                r = generate_block(text, voice, job_id)
                emit({"op": "result", "id": job_id, "ok": True, "voice": voice, **r})
            except Exception as e:
                _last_error = str(e)
                tb = traceback.format_exc(limit=6)[-1200:]
                emit({"op": "result", "id": job_id, "ok": False, "error": str(e)[:300],
                      "gpu_low_vram": "GPU_LOW_VRAM" in str(e), "trace": tb})
            continue

        emit({"op": "error", "msg": f"op desconocido: {op}"})


if __name__ == "__main__":
    main()
