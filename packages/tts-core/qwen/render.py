"""render.py — UNA SOLA generación Qwen por invocación (proceso desechable).
Carga Qwen, carga una voz, genera UNA pieza de texto, escribe --output, valida
básico, escribe metadata y sale. NO controla timeouts (el launcher lo mata).

Si Qwen se cuelga, este proceso puede quedarse congelado: está diseñado así.
El launcher lo mata desde afuera (SIGKILL al process group).
"""
import os
import sys
import json
import argparse
import hashlib

import numpy as np
import soundfile as sf
import torch

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from voice import load_registry, validate_registry

MODEL_DIR = os.environ.get(
    "QWEN_BASE_MODEL_DIR",
    "/home/chronos/Escritorio/La Veinte/data/tts/models/qwen-tts-base",
)
QWEN_CONFIG = {"language": "Spanish", "non_streaming_mode": True}


def sha_file(p):
    return hashlib.sha256(open(p, "rb").read()).hexdigest()


def qa_gates(audio, sr, text):
    words = len(text.split())
    dur = len(audio) / sr
    res = {"pass": True, "reason": "ok", "duration_s": round(dur, 2)}
    # duración
    if words > 10 and dur < 2.0:
        res = {"pass": False, "reason": f"duration {dur:.1f}s / {words}w", "duration_s": round(dur, 2)}
        return res
    if words > 5 and dur < 1.0:
        res = {"pass": False, "reason": f"duration {dur:.1f}s", "duration_s": round(dur, 2)}
        return res
    if dur > 30:
        res = {"pass": False, "reason": f"duration {dur:.1f}s > 30s", "duration_s": round(dur, 2)}
        return res
    # onset degeneración: basura/silencio inicial prolongado seguido de voz súbita
    win = int(0.1 * sr)
    n = len(audio) // win
    if n >= 5:
        rms = [float(np.sqrt(np.mean(audio[w * win:(w + 1) * win] ** 2))) for w in range(n)]
        rms_db = [20 * np.log10(r + 1e-10) for r in rms]
        # Criterio principal: bloque inicial de basura/near-silencio (>1s, < -50dB)
        # seguido de voz sostenida (>=3 ventanas > -20dB). Pausas naturales (~-45dB,
        # breves) NO cuentan como degeneración.
        for i in range(0, n - 6):
            pre = rms_db[i:i + 6]
            post = rms_db[i + 6:i + 9]
            if all(v < -50 for v in pre) and all(j > -20 for j in post):
                return {"pass": False, "reason": f"onset_garbage_{i*0.1:.1f}s", "duration_s": round(dur, 2)}
    return res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--speaker", required=True)
    ap.add_argument("--text", required=True)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--output", required=True)  # incluye ruta del .tmp
    ap.add_argument("--model", default=MODEL_DIR)
    ap.add_argument("--voice-version", default=None)
    args = ap.parse_args()

    registry = load_registry()
    vcheck = validate_registry(registry, [args.speaker])
    if not vcheck["valid"]:
        sys.stderr.write("VOICE_REFERENCE_INVALID:" + ";".join(vcheck["problems"]) + "\n")
        sys.exit(1)
    voice = registry[args.speaker]

    from qwen_tts import Qwen3TTSModel
    model = Qwen3TTSModel.from_pretrained(args.model, device_map="cuda:0", dtype=torch.bfloat16)
    prompt = model.create_voice_clone_prompt(
        ref_audio=os.path.abspath(voice["ref_audio"]),
        ref_text=voice["ref_text"],
    )

    torch.manual_seed(args.seed)
    wavs, sr = model.generate_voice_clone(
        text=args.text,
        language=QWEN_CONFIG["language"],
        voice_clone_prompt=prompt,
        non_streaming_mode=QWEN_CONFIG["non_streaming_mode"],
    )
    audio = np.array(wavs[0]).astype(np.float32)
    qa = qa_gates(audio, sr, args.text)

    # output temporal (el launcher renombra al val ó final)
    sf.write(args.output, audio, sr)

    meta = {
        "speaker": args.speaker,
        "voiceVersion": voice["version"] or args.voice_version,
        "engine": "qwen-base-clone",
        "referenceHash": voice["sha256"],
        "textHash": hashlib.sha256(args.text.encode()).hexdigest()[:16],
        "seed": args.seed,
        "duration_s": qa["duration_s"],
        "qa": qa,
        "status": "PASS" if qa["pass"] else "QA_FAIL",
    }
    with open(args.output + ".meta.json", "w") as f:
        json.dump(meta, f, indent=2)

    if not qa["pass"]:
        sys.stderr.write("QA_FAIL:" + qa["reason"] + "\n")

    del model
    try:
        sys.stdout.flush()
        sys.stderr.flush()
    except Exception:
        pass
    os._exit(0 if qa["pass"] else 1)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        sys.stderr.write(str(e) + "\n")
        sys.exit(1)
