"""Andrea México: 3 nuevas referencias VoiceDesign, 20-30s conversacionales."""
import torch, os, time, json
import numpy as np, soundfile as sf

REPO = "/home/chronos/Escritorio/La Veinte"
MODEL_DIR = os.path.join(REPO, "data/tts/models/qwen-voice-design")
OUT_DIR = os.path.join(REPO, "data/tts/casting/andrea-mexico")
os.makedirs(OUT_DIR, exist_ok=True)

MEXICAN = """Native woman from central Mexico. Natural contemporary Mexican Spanish. Conversational educated speech from Morelia or Querétaro or Mexico City. Warm, intelligent coworker speaking naturally across a table. Relaxed Mexican rhythm and intonation. Not an announcer. Not voice-over. Not audiobook. Not dubbing Spanish. Not pan-Latin neutral. Not Castilian Spanish. Not Caribbean. Not Rioplatense. No exaggerated regional slang."""

CANDIDATAS = [
    {"cid": "andrea-mexico-01", "seed": 71001,
     "instruct": f"Native Mexican Spanish female speaker, approximately 32 years old. Warm medium-pitched female voice, naturally expressive, witty and relaxed. Intelligent, spontaneous, curious. Conversational delivery as if chatting with colleagues around a table. Quick genuine reactions and subtle natural smile in her voice. {MEXICAN} Avoid virtual assistant, commercial announcer, seductive, breathy, childish high pitch, exaggerated cheerfulness, news presenter, corporate training, dubbing cadence."},
    {"cid": "andrea-mexico-02", "seed": 71002,
     "instruct": f"Native Mexican Spanish female speaker, approximately 29 years old. Slightly brighter and quicker than typical. Medium-high female pitch but not childish. Curious, spontaneous, energetic without being hyperactive. Natural conversational rhythm with quick realistic reactions. {MEXICAN} Avoid virtual assistant, commercial announcer, seductive, breathy performance, childish high pitch, exaggerated cheerfulness, news presenter, dubbing cadence."},
    {"cid": "andrea-mexico-03", "seed": 71003,
     "instruct": f"Native Mexican Spanish female speaker, approximately 35 years old. Confident, slightly textured voice. Mature, assertive, calm but expressive. Medium female pitch with natural warmth. Real person conversing, not performing. {MEXICAN} Avoid virtual assistant, commercial announcer, seductive voice, childish high pitch, news presenter, corporate training voice."},
]

# Texto largo conversacional (~25 segundos hablados)
CASTING_TEXT = """Espera, porque ahí tengo una duda que no me cuadra. Si solamente me lo dijeron por teléfono, ¿eso realmente significa que mi horario ya cambió? Porque yo entiendo que una cosa es recibir una indicación verbal del jefe y otra muy diferente es tener un documento oficial donde esté firmado ese cambio. Y si no existe ese papel, entonces ¿qué pasa con mi horario original? Porque eso es lo que me preocupa realmente."""

def main():
    from qwen_tts import Qwen3TTSModel
    
    model = Qwen3TTSModel.from_pretrained(MODEL_DIR, device_map="cuda:0", dtype=torch.bfloat16)
    print("VoiceDesign cargado ✓")
    
    for cand in CANDIDATAS:
        cid = cand["cid"]; seed = cand["seed"]
        torch.manual_seed(seed)
        
        wav_path = os.path.join(OUT_DIR, f"{cid}.wav")
        print(f"\n{cid} (seed={seed})...")
        t1 = time.time()
        
        wavs, sr = model.generate_voice_design(
            text=CASTING_TEXT,
            language="Spanish",
            instruct=cand["instruct"],
        )
        audio = np.array(wavs[0]).astype(np.float32)
        sf.write(wav_path, audio, sr)
        
        dur = len(audio) / sr
        gen_t = time.time() - t1
        
        # métricas básicas
        rms = float(np.sqrt(np.mean(audio**2)))
        peak_amp = float(np.max(np.abs(audio)))
        
        print(f"  ✓ {dur:.1f}s | RMS={rms:.4f} | peak={peak_amp:.4f} | gen={gen_t:.1f}s")

    del model; import gc; gc.collect(); torch.cuda.empty_cache()
    print("\n✓ 3 candidatas Andrea México listas")
    for f in sorted(os.listdir(OUT_DIR)):
        sz = os.path.getsize(os.path.join(OUT_DIR,f))
        print(f"  {f} ({sz//1024}KB)")

if __name__ == "__main__":
    main()
