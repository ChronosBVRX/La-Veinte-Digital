"""Genera UN turno específico de Qwen Base en proceso aislado.
Uso: python regen-one.py <turn_id> t003|t004|t010|t018"""
import torch, os, sys, json, subprocess, gc
import numpy as np
import soundfile as sf

TID = sys.argv[1] if len(sys.argv) > 1 else "t003"
REPO = "/home/chronos/Escritorio/La Veinte"
OUT_DIR = os.path.join(REPO, "data/tts/production/episode")
MODEL_DIR = os.path.join(REPO, "data/tts/models/qwen-tts-base")
CASTING = os.path.join(REPO, "data/tts/casting")

guion = json.load(open(os.path.join(REPO, "data/tts/episodes/ep-horario-1787599336487/guion-final.json")))
turns_map = {t["id"]: t for t in guion["turns"]}

# Añadir 500ms de silencio a la referencia para evitar contaminar onset
def pad_ref(ref_path):
    padded = ref_path + ".padded.wav"
    if os.path.exists(padded) and os.path.getmtime(padded) > os.path.getmtime(ref_path):
        return padded
    audio, sr = sf.read(ref_path)
    silence = np.zeros(int(sr * 0.5), dtype=audio.dtype)
    padded_audio = np.concatenate([audio, silence]) if audio.ndim == 1 else np.concatenate([audio, np.zeros((int(sr * 0.5), audio.shape[1]), dtype=audio.dtype)])
    sf.write(padded, padded_audio, sr)
    return padded

# Referencias por voz (todas con padding)
VOICES_RAW = {
    "EDUARDO": (os.path.join(CASTING, "final-qwen-clips", "t001.wav"),
                "Buenos días. Esto es La Veinte Radio. Yo soy Eduardo y quiero abrir con algo que veo a diario: la idea de que el jefe inmediato tiene un poder absoluto sobre cuándo empiezas, cuándo terminas o qué haces dentro de tu horario."),
    "ANDREA": (os.path.join(CASTING, "andrea", "candidate-01", "common.wav"),
               "Espera, porque ahí tengo una duda. Si solamente me lo dijeron por teléfono, ¿eso realmente significa que mi horario ya cambió? Porque una cosa es recibir una indicación y otra saber qué documento existe."),
    "JAVIER": (os.path.join(CASTING, "javier", "candidate-01", "common.wav"),
               "Buenos días. Esto es La Veinte Radio. Hay algo que necesitamos aclarar: si hoy te cambian el horario por teléfono, ¿qué documento debería existir? Espera, porque ahí está el detalle. Una cosa es una indicación verbal y otra una modificación formal."),
    "RODRIGO": (os.path.join(CASTING, "rodrigo", "candidate-01", "common.wav"),
                "Revisé el procedimiento y encontré dos documentos que aquí importan mucho: la solicitud y el oficio con el que notifican la decisión."),
}
VOICES = {k: {"ref_audio": pad_ref(v[0]), "ref_text": v[1]} for k, v in VOICES_RAW.items()}
VOICES["NARRADOR"] = VOICES["JAVIER"]

def duration_check(dur_s, words):
    if words > 10 and dur_s < 2.0: return False
    if words > 5 and dur_s < 1.0: return False
    return True

def onset_gate(audio, sr):
    """Detecta silencio inicial >1s o salto >10dB tras inicio de voz."""
    win = int(0.1 * sr); n = len(audio) // win
    if n < 5: return {"pass": True, "reason": "corto"}
    rms = [float(np.sqrt(np.mean(audio[w*win:(w+1)*win]**2 + 1e-10))) for w in range(n)]
    rms_db = [20 * np.log10(r + 1e-10) for r in rms]
    # silencio inicial
    silent = 0
    for db in rms_db:
        if db < -40: silent += 1
        else: break
    if silent * 0.1 > 1.0:
        return {"pass": False, "reason": f"silencio_inicial_{silent*0.1:.1f}s"}
    # salto tras inicio
    first = next((w for w, db in enumerate(rms_db) if db > -30), None)
    if first is not None and first + 2 < len(rms_db):
        pre = rms_db[first]
        for w in range(first + 1, min(first + 6, len(rms_db))):
            if rms_db[w] - pre > 10:
                return {"pass": False, "reason": f"salto_{rms_db[w]-pre:.1f}dB_en_{w*0.1:.1f}s"}
    return {"pass": True, "reason": "ok"}

def main():
    from qwen_tts import Qwen3TTSModel
    turn = turns_map[TID]
    text = turn["text"]
    speaker = turn["speaker"]
    words = len(text.split())
    exp = words / 2.6

    # Cargar modelo UNA vez para este proceso (con kwarg consistente)
    model = Qwen3TTSModel.from_pretrained(MODEL_DIR, device_map="cuda:0", dtype=torch.bfloat16)
    prompt = model.create_voice_clone_prompt(
        ref_audio=os.path.abspath(VOICES[speaker]["ref_audio"]),
        ref_text=VOICES[speaker]["ref_text"],
    )

    best_audio = None
    best_diff = 999
    best_seed = None

    for take in range(3):
        seed = hash(TID + str(take)) % 100000
        torch.manual_seed(seed)
        wavs, sr = model.generate_voice_clone(
            text=text,
            language="Spanish",
            voice_clone_prompt=prompt,
            non_streaming_mode=True,
        )
        audio = np.array(wavs[0]).astype(np.float32)
        dur = len(audio) / sr
        print(f"take{take}: {dur:.1f}s (exp {exp:.1f}s)", flush=True)

        # gates
        if not duration_check(dur, words):
            print(f"  ✗ duration fail", flush=True)
            continue
        gate = onset_gate(audio, sr)
        if not gate["pass"]:
            print(f"  ✗ onset: {gate['reason']}", flush=True)
            continue

        diff = abs(dur - exp)
        if diff < best_diff:
            best_diff = diff
            best_audio = audio
            best_sr = sr
            best_seed = seed

    if best_audio is not None:
        out_path = os.path.join(OUT_DIR, f"{TID}.wav")
        sf.write(out_path, best_audio, best_sr)
        # metadata
        meta = {
            "speaker": speaker,
            "qa": "PASS",
            "duration_s": round(float(len(best_audio) / best_sr), 2),
            "words": words,
            "seed": best_seed,
            "regen": True,
        }
        with open(os.path.join(OUT_DIR, f"{TID}.json"), "w") as f:
            json.dump(meta, f, indent=1)
        print(f"{TID} → guardado {len(best_audio)/best_sr:.1f}s (seed {best_seed})", flush=True)
    else:
        print(f"{TID} → HUMAN_REVIEW_REQUIRED (ningún take pasó gates)", flush=True)

    del model
    gc.collect()
    torch.cuda.empty_cache()
    time.sleep(3)

if __name__ == "__main__":
    import time
    main()
