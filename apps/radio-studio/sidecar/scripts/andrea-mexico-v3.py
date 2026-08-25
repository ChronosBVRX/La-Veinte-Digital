"""Andrea México v3 — voz femenina mexicana MADURA, pitch bajo-medio."""
import torch, os, time
import numpy as np, soundfile as sf

REPO = "/home/chronos/Escritorio/La Veinte"
MODEL_DIR = os.path.join(REPO, "data/tts/models/qwen-voice-design")
OUT_DIR = os.path.join(REPO, "data/tts/casting/andrea-mexico-v3")
os.makedirs(OUT_DIR, exist_ok=True)

MEXICAN = """Native woman from central Mexico. Natural contemporary Mexican Spanish. Conversational educated speech from Mexico City or Morelia. Relaxed Mexican rhythm and intonation. Not an announcer. Not voice-over. Not audiobook. Not dubbing Spanish. Not pan-Latin neutral."""

CANDIDATAS = [
    {"cid": "andrea-madura-a", "seed": 91001,
     "instruct": f"""A Mexican woman in her mid-thirties with a naturally low-pitched female voice. Her speaking voice sits in the lower register for a woman — warm, grounded and substantial. She has the kind of voice that carries authority without raising itself: measured, intelligent, direct. She speaks at a comfortable pace with natural weight behind each word. Think of a seasoned professional who has earned respect through competence, not through volume. {MEXICAN} Avoid: high-pitched voice, girly tone, youthful brightness, breathy softness, virtual assistant, commercial announcer, exaggerated expressiveness, dubbing-style delivery, audiobook narrator."""},
    {"cid": "andrea-madura-b", "seed": 91002,
     "instruct": f"""A Mexican woman around thirty-five years old with a rich, slightly husky female voice in the low-medium range. Her voice has natural texture and warmth that makes people lean in to listen. She speaks like someone sharing a genuine observation with a friend — not performing, not announcing. Direct but kind. Confident but approachable. {MEXICAN} Avoid: high-pitched voice, girly tone, youthful brightness, commercial polish, virtual assistant smoothness, news anchor formality, dubbing-style pan-Latin delivery, breathy whisper."""},
    {"cid": "andrea-madura-c", "seed": 91003,
     "instruct": f"""A Mexican woman in her late thirties with a deep, resonant female speaking voice. Low-medium pitch for a woman. She sounds experienced, calm and grounded — the voice of someone who has seen things and speaks from real understanding. Conversational but substantive. Every word carries weight without being dramatic. {MEXICAN} Avoid: high-pitched voice, girly tone, bright chirpy quality, youthful sound, virtual assistant, commercial announcer, breathy performance, exaggerated emotion, dubbing-style Latin neutral accent."""},
]

TEXT = """Espera, porque ahí tengo una duda que no me cuadra. Si solamente me lo dijeron por teléfono, ¿eso realmente significa que mi horario ya cambió? Porque yo entiendo que una cosa es recibir una indicación verbal del jefe y otra muy diferente es tener un documento oficial donde esté firmado ese cambio. Y si no existe ese papel, entonces ¿qué pasa con mi horario original? Porque eso es lo que me preocupa realmente."""

def main():
    from qwen_tts import Qwen3TTSModel
    model = Qwen3TTSModel.from_pretrained(MODEL_DIR, device_map="cuda:0", dtype=torch.bfloat16)
    print("cargado ✓")
    
    for cand in CANDIDATAS:
        cid = cand["cid"]; seed = cand["seed"]
        torch.manual_seed(seed)
        wav_path = os.path.join(OUT_DIR, f"{cid}.wav")
        
        print(f"\n{cid} (seed={seed})...", end=" ")
        t1 = time.time()
        wavs, sr = model.generate_voice_design(text=TEXT, language="Spanish", instruct=cand["instruct"])
        audio = np.array(wavs[0]).astype(np.float32)
        sf.write(wav_path, audio, sr)
        dur = len(audio) / sr
        print(f"✓ {dur:.1f}s | gen={time.time()-t1:.1f}s")
    
    del model; import gc; gc.collect(); torch.cuda.empty_cache()
    print(f"\n✓ v3 listas en {OUT_DIR}")

if __name__ == "__main__":
    main()
