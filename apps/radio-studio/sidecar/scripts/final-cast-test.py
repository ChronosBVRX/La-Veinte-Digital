"""Prueba editorial 60-90s con el reparto ganador.
Eduardo (voice A builtin) + Andrea A01 + Javier J01 + Rodrigo R01.
Sin música, sin efectos. VAD timeline con gaps variables."""
import torch, os, time, json, gc
import numpy as np
import soundfile as sf
from chatterbox.tts import ChatterboxTTS

REPO = "/home/chronos/Escritorio/La Veinte"
CASTING = os.path.join(REPO, "data", "tts", "casting")
OUT = os.path.join(CASTING, "final-cast-conversation-test.wav")

# ── Guion de prueba — 10 turnos ──
SCRIPT_TURNS = [
    {"id":"t001","speaker":"EDUARDO",
     "text":"Buenos días. Esto es La Veinte Radio. Hoy quiero partir de algo muy sencillo: te llaman y te dicen que mañana entras a otra hora.",
     "intent":"statement", "pauseBeforeMs":0, "pauseAfterMs":300,
     "ref": None},  # builtin voice A

    {"id":"t002","speaker":"ANDREA",
     "text":"Pero espera. ¿Así nada más? Porque una llamada un domingo y un cambio de horario para el lunes no parecen exactamente lo mismo que una modificación formal.",
     "intent":"question", "pauseBeforeMs":250, "pauseAfterMs":250,
     "ref": os.path.join(CASTING,"andrea","candidate-01","common.wav")},

    {"id":"t003","speaker":"EDUARDO",
     "text":"Ahí está la pregunta. Javier, ¿qué diferencia hay entre esas dos cosas?",
     "intent":"handoff", "pauseBeforeMs":200, "pauseAfterMs":200,
     "ref": None},

    {"id":"t004","speaker":"JAVIER",
     "text":"Hay que separar la indicación verbal de la modificación formal. No son automáticamente equivalentes; primero hay que comprobar qué procedimiento se siguió.",
     "intent":"normative_answer", "pauseBeforeMs":220, "pauseAfterMs":280,
     "ref": os.path.join(CASTING,"javier","candidate-01","common.wav")},

    {"id":"t005","speaker":"ANDREA",
     "text":"Entonces una llamada por sí sola no me cuenta toda la historia.",
     "intent":"reaction", "pauseBeforeMs":180, "pauseAfterMs":150,
     "ref": os.path.join(CASTING,"andrea","candidate-01","common.wav")},

    {"id":"t006","speaker":"JAVIER",
     "text":"Exactamente... bueno, mejor dicho: te da una instrucción, pero todavía necesitamos saber si existe el documento que formaliza el cambio.",
     "intent":"clarification", "pauseBeforeMs":150, "pauseAfterMs":280,
     "ref": os.path.join(CASTING,"javier","candidate-01","common.wav")},

    {"id":"t007","speaker":"RODRIGO",
     "text":"Y ahí encontré algo útil. El procedimiento habla de una solicitud y de un oficio con el que finalmente se notifica la decisión.",
     "intent":"field_report", "pauseBeforeMs":250, "pauseAfterMs":250,
     "ref": os.path.join(CASTING,"rodrigo","candidate-01","common.wav")},

    {"id":"t008","speaker":"EDUARDO",
     "text":"Eso ya nos da algo concreto. Antes de asumir que tu horario cambió, pregunta qué documento existe y cuándo te lo notificaron.",
     "intent":"summary", "pauseBeforeMs":200, "pauseAfterMs":200,
     "ref": None},

    # interrupción natural
    {"id":"t009","speaker":"ANDREA",
     "text":"Y ojo, porque sin ese papel firmado, tu horario original sigue siendo el válido.",
     "intent":"interrupt_correction", "pauseBeforeMs":0, "pauseAfterMs":150,
     "overlapPreviousMs":180,
     "ref": os.path.join(CASTING,"andrea","candidate-01","common.wav")},

    {"id":"t010","speaker":"EDUARDO",
     "text":"Exacto. Documento primero, comentarios después.",
     "intent":"summary", "pauseBeforeMs":150, "pauseAfterMs":0,
     "ref": None},
]

def main():
    print("cargando Chatterbox es-mx-latam...")
    model = ChatterboxTTS.from_pretrained(device="cuda")
    print("✓ cargado")

    clips = []  # (audio_np, sr, speech_start_ms, speech_end_ms)
    
    for t in SCRIPT_TURNS:
        ref = t.get("ref")
        torch.manual_seed(hash(t["id"]) % 100000)
        
        if ref and os.path.exists(ref):
            wav = model.generate(
                t["text"],
                audio_prompt_path=ref,
                exaggeration=0.50,
                cfg_weight=0.50,
                temperature=0.80,
            )
        else:
            # Eduardo: builtin voice A (sin referencia)
            wav = model.generate(
                t["text"],
                exaggeration=0.50,
                cfg_weight=0.50,
                temperature=0.80,
            )
        
        audio = wav.squeeze(0).detach().cpu().numpy() if hasattr(wav, 'squeeze') else np.array(wav).flatten()
        
        # detectar speech boundaries con energía
        window = int(0.02 * model.sr)  # 20ms windows
        n_windows = len(audio) // window
        energies = []
        for w in range(n_windows):
            chunk = audio[w*window:(w+1)*window]
            rms = np.sqrt(np.mean(chunk**2))
            energies.append(rms)
        
        threshold = max(energies) * 0.05  # 5% del pico
        speech_first_win = next((w for w, e in enumerate(energies) if e > threshold), 0)
        speech_last_win = next((w for w in range(n_windows-1, -1, -1) if energies[w] > threshold), n_windows-1)
        
        speech_start_ms = int(speech_first_win * window / model.sr * 1000)
        speech_end_ms = int((speech_last_win + 1) * window / model.sr * 1000)
        total_ms = int(len(audio) / model.sr * 1000)
        
        head_silence = speech_start_ms
        tail_silence = total_ms - speech_end_ms
        
        clips.append({
            "audio": audio, "sr": model.sr,
            "speechStartMs": speech_start_ms,
            "speechEndMs": speech_end_ms,
            "totalMs": total_ms,
            "headSilenceMs": head_silence,
            "tailSilenceMs": tail_silence,
            **t,
        })
        
        print(f"✓ {t['id']} {t['speaker']:8} {total_ms}ms | head={head_silence}ms tail={tail_silence}ms")

    # descargar modelo antes de mezclar
    del model; gc.collect(); torch.cuda.empty_cache(); time.sleep(2)

    # ── TIMELINE con VAD ──
    print("\n── timeline ──")
    timeline = []
    cursor_ms = 0
    
    for i, c in enumerate(clips):
        overlap = c.get("overlapPreviousMs", 0)
        if overlap and overlap > 0 and i > 0:
            prev = clips[i-1]
            start = prev["timelineEnd"] - overlap
        else:
            gap_before = c["pauseBeforeMs"]
            start = cursor_ms + gap_before
        
        # ajustar por head silence del clip actual (empezar en speech, no en silencio físico)
        timeline_start = start - c["speechStartMs"]
        if timeline_start < 0: timeline_start = start
        
        timeline_end = timeline_start + c["totalMs"]
        c["timelineStart"] = timeline_start
        c["timelineEnd"] = timeline_end
        
        # gap real percibido (fonema a fonema)
        prev_speech_end = clips[i-1]["timelineStart"] + clips[i-1]["speechEndMs"] if i > 0 else 0
        real_gap = timeline_start + c["speechStartMs"] - prev_speech_end
        
        flag = " ⚡ OVERLAP" if overlap else ""
        print(f"  {c['id']} {c['speaker']:8} start={start/1000:.2f}s gap_real={real_gap/1000:.3f}s{flag}")
        
        cursor_ms = timeline_end

    total_ms = max(c["timelineEnd"] for c in clips) + 500  # margen final
    print(f"total: {total_ms/1000:.1f}s")

    # ── MEZCLA ──
    sr = clips[0]["sr"]
    mixed = np.zeros(int(total_ms / 1000 * sr), dtype=np.float32)
    
    for c in clips:
        start_sample = int(c["timelineStart"] / 1000 * sr)
        end_sample = min(start_sample + len(c["audio"]), len(mixed))
        mixed[start_sample:end_sample] += c["audio"][:end_sample-start_sample]

    # normalizar suave
    peak = np.max(np.abs(mixed))
    if peak > 0.95:
        mixed *= 0.95 / peak

    sf.write(OUT, mixed, sr)
    dur_final = len(mixed) / sr
    print(f"\n✓ guardado: {OUT}")
    print(f"duración final: {dur_final:.1f}s")

    # guardar manifest
    manifest = {
        "archivo": OUT,
        "duracion_s": round(dur_final, 1),
        "turnos": len(clips),
        "sin_musica": True,
        "reparto": {
            "EDUARDO": "voice A builtin (KEEP_FOR_NOW)",
            "ANDREA": "A01 VoiceDesign → Chatterbox clone reference",
            "JAVIER": "J01 VoiceDesign → Chatterbox clone reference",
            "RODRIGO": "R01 VoiceDesign → Chatterbox clone reference",
        },
        "turnos_detalle": [
            {k: v for k, v in c.items() if k != "audio"} for c in clips
        ],
    }
    mf_path = os.path.join(CASTING, "final-cast-conversation-manifest.json")
    with open(mf_path, "w") as f:
        json.dump(manifest, f, indent=1, ensure_ascii=False)
    print(f"manifest: {mf_path}")

if __name__ == "__main__":
    main()
