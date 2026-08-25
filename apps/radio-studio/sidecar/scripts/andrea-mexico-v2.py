"""Andrea México v2 — voces más maduras, ~30 años, no niñas."""
import torch, os, time
import numpy as np, soundfile as sf

REPO = "/home/chronos/Escritorio/La Veinte"
MODEL_DIR = os.path.join(REPO, "data/tts/models/qwen-voice-design")
OUT_DIR = os.path.join(REPO, "data/tts/casting/andrea-mexico-v2")
os.makedirs(OUT_DIR, exist_ok=True)

MEXICAN = """Native woman from central Mexico. Natural contemporary Mexican Spanish. Conversational educated speech from Morelia or Querétaro or Mexico City. Warm, intelligent coworker speaking naturally across a table. Relaxed Mexican rhythm and intonation. Not an announcer. Not voice-over. Not audiobook. Not dubbing Spanish. Not pan-Latin neutral. Not Castilian Spanish. Not Caribbean. Not Rioplatense. No exaggerated regional slang."""

CANDIDATAS = [
    {"cid": "andrea-mex-30a", "seed": 81001,
     "instruct": f"""A Mexican woman in her early thirties speaking naturally. Her voice is warm and grounded with a medium-low female pitch that conveys maturity and confidence without being harsh. She speaks like someone who has real opinions and shares them comfortably with coworkers she trusts. Her delivery is unhurried but engaged, with natural pauses where she thinks. She sounds like the kind of person who asks sharp questions because she genuinely wants to understand. {MEXICAN} Avoid: high-pitched girly voice, youthful brightness, virtual assistant tone, commercial announcer energy, breathy performance, exaggerated cheerfulness, news presenter cadence, dubbing-style Latin neutral delivery."""},
    {"cid": "andrea-mex-30b", "seed": 81002,
     "instruct": f"""A Mexican woman around thirty years old from central Mexico. Her voice has a natural medium pitch that sits comfortably in the lower-middle range for a female speaker, giving her an air of quiet confidence and intelligence. She sounds like a professional having a genuine conversation during a coffee break — relaxed but sharp, with moments of dry humor and directness. She does not perform or announce; she talks. {MEXICAN} Avoid: high-pitched girly quality, youthful chirpiness, virtual assistant smoothness, commercial polish, breathy softness, exaggerated expressiveness, news anchor formality, dubbing-style pan-Latin delivery."""},
    {"cid": "andrea-mex-30c", "seed": 81003,
     "instruct": f"""A thirty-year-old Mexican woman whose voice carries the warmth of someone who genuinely cares about getting things right. Medium-low female pitch with a natural slight rasp that adds character without sounding harsh. She speaks at a measured pace with deliberate word choices, like someone who thinks before responding but responds quickly once she knows what to say. {MEXICAN} Avoid: young girl voice, bright chirpy tone, virtual assistant, commercial announcer, breathy performance, exaggerated enthusiasm, news presenter, audiobook narrator, dubbing-style Latin American neutral accent."""},
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
        
        print(f"\n{cid} (seed={seed})...")
        t1 = time.time()
        wavs, sr = model.generate_voice_design(text=TEXT, language="Spanish", instruct=cand["instruct"])
        audio = np.array(wavs[0]).astype(np.float32)
        sf.write(wav_path, audio, sr)
        
        dur = len(audio) / sr
        rms = float(np.sqrt(np.mean(audio**2)))
        print(f"  ✓ {dur:.1f}s | RMS={rms:.4f} | gen={time.time()-t1:.1f}s")
    
    del model; import gc; gc.collect(); torch.cuda.empty_cache()
    print(f"\n✓ 3 candidatas v2 listas en {OUT_DIR}")

if __name__ == "__main__":
    main()
