"""Prueba conjunta 4 voces con Qwen Base voice clone. Schema limpio."""
import torch, time, os, json, gc
import numpy as np
import soundfile as sf
from pathlib import Path

REPO = "/home/chronos/Escritorio/La Veinte"
CASTING = os.path.join(REPO, "data", "tts", "casting")
OUT = os.path.join(CASTING, "final-cast-conversation-qwen-base.wav")
MODEL_DIR = os.path.join(REPO, "data", "tts", "models", "qwen-tts-base")

EDUARDO_REF = os.path.join(REPO, "data", "tts", "cache", "cast.wav")

VOICES = {
    "EDUARDO": {
        "ref_audio": EDUARDO_REF,
        "ref_text": "Buenos días. Esto es La Veinte Radio.",
    },
    "ANDREA": {
        "ref_audio": os.path.join(CASTING, "andrea", "candidate-01", "common.wav"),
        "ref_text": "Espera, porque ahí tengo una duda. Si solamente me lo dijeron por teléfono, ¿eso realmente significa que mi horario ya cambió? Porque una cosa es recibir una indicación y otra saber qué documento existe.",
    },
    "JAVIER": {
        "ref_audio": os.path.join(CASTING, "javier", "candidate-01", "common.wav"),
        "ref_text": "Buenos días. Esto es La Veinte Radio. Hay algo que necesitamos aclarar: si hoy te cambian el horario por teléfono, ¿qué documento debería existir? Espera, porque ahí está el detalle. Una cosa es una indicación verbal y otra una modificación formal.",
    },
    "RODRIGO": {
        "ref_audio": os.path.join(CASTING, "rodrigo", "candidate-01", "common.wav"),
        "ref_text": "Revisé el procedimiento y encontré dos documentos que aquí importan mucho: la solicitud y el oficio con el que notifican la decisión.",
    },
}

TURNS = [
    {"id":"t001","speaker":"EDUARDO",
     "text":"Buenos días. Esto es La Veinte Radio. Hoy quiero partir de algo muy sencillo: te llaman y te dicen que mañana entras a otra hora."},
    {"id":"t002","speaker":"ANDREA",
     "text":"Pero espera. ¿Así nada más? Porque una llamada un domingo y un cambio de horario para el lunes no parecen exactamente lo mismo que una modificación formal."},
    {"id":"t003","speaker":"EDUARDO",
     "text":"Ahí está la pregunta. Javier, ¿qué diferencia hay entre esas dos cosas?"},
    {"id":"t004","speaker":"JAVIER",
     "text":"Hay que separar la indicación verbal de la modificación formal. No son automáticamente equivalentes; primero hay que comprobar qué procedimiento se siguió."},
    {"id":"t005","speaker":"ANDREA",
     "text":"Entonces una llamada por sí sola no me cuenta toda la historia."},
    {"id":"t006","speaker":"JAVIER",
     "text":"Exactamente... bueno, mejor dicho: te da una instrucción, pero todavía necesitamos saber si existe el documento que formaliza el cambio."},
    {"id":"t007","speaker":"RODRIGO",
     "text":"Y ahí encontré algo útil. El procedimiento habla de una solicitud y de un oficio con el que finalmente se notifica la decisión."},
    {"id":"t008","speaker":"EDUARDO",
     "text":"Eso ya nos da algo concreto. Antes de asumir que tu horario cambió, pregunta qué documento existe y cuándo te lo notificaron."},
    {"id":"t009","speaker":"ANDREA",
     "text":"Y ojo, porque sin ese papel firmado, tu horario original sigue siendo el válido.",
     "intent":"interrupt_correction", "overlapPreviousMs":180, "pauseBeforeMs":0},
    {"id":"t010","speaker":"EDUARDO",
     "text":"Exacto. Documento primero, comentarios después."},
]

def precheck():
    print("── PRECHECK ──")
    for speaker, voice in VOICES.items():
        assert isinstance(voice, dict), f"{speaker}: no es dict"
        assert isinstance(voice["ref_audio"], str), f"{speaker}: ref_audio no es string"
        assert isinstance(voice["ref_text"], str), f"{speaker}: ref_text no es string"
        assert voice["ref_text"].strip(), f"{speaker}: ref_text vacío"
        assert Path(voice["ref_audio"]).is_file(), f"{speaker}: {voice['ref_audio']} no existe"
        print(f"  {speaker} REF_OK {Path(voice['ref_audio']).name} ({len(voice['ref_text'])} chars)")
    for turn in TURNS:
        spk = turn["speaker"]
        if spk not in VOICES:
            raise RuntimeError(f"VOICE_REFERENCE_MISSING:{spk}")
        print(f"  {turn['id']} {spk} → VOICE_OK")
    print("  ALL_TURNS_RESOLVED\n")

def main():
    precheck()

    from qwen_tts import Qwen3TTSModel

    t0 = time.time()
    model = Qwen3TTSModel.from_pretrained(MODEL_DIR, device_map="cuda:0", dtype=torch.bfloat16)
    print(f"Qwen Base cargado {time.time()-t0:.1f}s | VRAM: {torch.cuda.max_memory_allocated()//(1024*1024)}MB\n")

    # crear prompts UNA VEZ por personaje
    voice_clone_prompts = {}
    for speaker, voice in VOICES.items():
        voice_clone_prompts[speaker] = model.create_voice_clone_prompt(
            ref_audio=voice["ref_audio"],
            ref_text=voice["ref_text"],
        )
        print(f"prompt {speaker} ✓")

    # generar cada turno (resumible)
    clips = []
    total_gen_s = 0

    for i, turn in enumerate(TURNS):
        tid = turn["id"]
        spk = turn["speaker"]
        cache_path = os.path.join(CASTING, "final-qwen-clips", f"{tid}.wav")

        # REUSE si ya existe
        if os.path.exists(cache_path) and os.path.getsize(cache_path) > 5000:
            audio, sr = sf.read(cache_path)
            print(f"  {tid} REUSE ({len(audio)/sr:.1f}s)")
            clips.append({"audio": np.array(audio, dtype=np.float32), "sr": sr, **{k:v for k,v in turn.items()}})
            continue

        prompt = voice_clone_prompts[spk]
        torch.manual_seed(hash(tid) % 100000)

        t1 = time.time()
        wavs, sr = model.generate_voice_clone(
            text=turn["text"],
            language="Spanish",
            voice_clone_prompt=prompt,
        )
        gen_t = time.time() - t1; total_gen_s += gen_t

        audio = np.array(wavs[0], dtype=np.float32)
        os.makedirs(os.path.dirname(cache_path), exist_ok=True)
        sf.write(cache_path, audio, sr)
        print(f"  {tid} GENERATE ({len(audio)/sr:.1f}s, {gen_t:.1f}s gen)")

        clips.append({"audio": audio, "sr": sr, **{k:v for k,v in turn.items()}})

    # unload modelo antes de mezclar
    del model; gc.collect(); torch.cuda.empty_cache(); time.sleep(2)

    # ── TIMELINE VAD ──
    sr_out = clips[0]["sr"]
    cursor_ms = 0
    for i, c in enumerate(clips):
        # detectar boundaries
        win = int(0.02 * sr_out)
        nw = len(c["audio"]) // win
        energies = [float(np.sqrt(np.mean(c["audio"][w*win:(w+1)*win]**2))) for w in range(nw)]
        thresh = max(energies) * 0.05 if max(energies) > 0 else 0.001
        fw = next((w for w,e in enumerate(energies) if e > thresh), 0)
        lw = next((w for w in range(nw-1,-1,-1) if energies[w] > thresh), nw-1)
        c["speechStartMs"] = int(fw * win / sr_out * 1000)
        c["speechEndMs"] = int((lw+1)*win/sr_out*1000)
        c["totalMs"] = int(len(c["audio"]) / sr_out * 1000)

        overlap = c.get("overlapPreviousMs", 0)
        if overlap and overlap > 0 and i > 0:
            prev_end = clips[i-1]["timelineEnd"] if "timelineEnd" in clips[i-1] else 0
            start = prev_end - overlap
        else:
            pb = c.get("pauseBeforeMs", 250)
            seed = hash(c["id"]) % 170
            jittered = max(180, min(350, pb + seed - 85)) if pb > 100 else pb
            start = cursor_ms + jittered

        ts = max(start - c["speechStartMs"], 0)
        te = ts + c["totalMs"]
        c["timelineStart"] = ts; c["timelineEnd"] = te
        cursor_ms = te

        prev_se = clips[i-1]["timelineStart"] + clips[i-1].get("speechEndMs",0) if i > 0 else 0
        rg = ts + c["speechStartMs"] - prev_se
        flag = " ⚡ OVERLAP" if overlap else ""
        print(f"  {c['id']} {c['speaker']:8} gap={rg/1000:.3f}s{flag}")

    total_ms = max(c["timelineEnd"] for c in clips) + 500

    # ── MEZCLA ──
    mixed = np.zeros(int(total_ms/1000*sr_out), dtype=np.float32)
    for c in clips:
        s = int(c["timelineStart"]/1000*sr_out)
        e = min(s+len(c["audio"]), len(mixed))
        mixed[s:e] += c["audio"][:e-s]
    pk = np.max(np.abs(mixed))
    if pk > 0.95: mixed *= 0.95/pk

    sf.write(OUT, mixed, sr_out)
    dur = len(mixed)/sr_out
    print(f"\n✓ guardado: {OUT}")
    print(f"duración: {dur:.1f}s | generación total: {total_gen_s:.0f}s")

    manifest = {"archivo": OUT, "duracion_s": round(dur,1), "turnos": len(clips),
                "engine": "Qwen/Qwen3-TTS-12Hz-1.7B-Base generate_voice_clone", "sin_musica": True}
    json.dump(manifest, open(os.path.join(CASTING,"final-qwen-base-manifest.json"),"w"), indent=1, ensure_ascii=False)
    print(f"manifest: {CASTING}/final-qwen-base-manifest.json")

if __name__ == "__main__":
    main()
