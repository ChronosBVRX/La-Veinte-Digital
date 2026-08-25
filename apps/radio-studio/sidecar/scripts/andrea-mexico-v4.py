"""Andrea México v4 — voz madura grave + acento mexicano FUERTE (no gringo)."""
import torch, os, time
import numpy as np, soundfile as sf

REPO = "/home/chronos/Escritorio/La Veinte"
MODEL_DIR = os.path.join(REPO, "data/tts/models/qwen-voice-design")
OUT_DIR = os.path.join(REPO, "data/tts/casting/andrea-mexico-v4")
os.makedirs(OUT_DIR, exist_ok=True)

CANDIDATAS = [
    {"cid": "andrea-madura-mx-a", "seed": 95001,
     "instruct": """A Mexican woman from Mexico City in her late thirties. Deep, resonant female speaking voice in the low-medium range for a woman. Her Spanish is unmistakably Mexican — you can hear the central Mexican vowel sounds, the characteristic rhythm of educated Mexico City speech, the natural melody of someone who grew up speaking this language every day of her life. She sounds like a respected journalist or producer who has worked in Mexican media for years. Warm but direct, intelligent without being academic. She speaks at a natural pace with the relaxed confidence of someone who knows exactly what she's talking about. Every word is clearly pronounced with authentic Mexican consonants and vowels.
Avoid: American English accent trying to speak Spanish, gringo Spanish, neutral Latin American dubbing voice, Castilian Spain pronunciation, high-pitched girly tone, breathy performance, virtual assistant, commercial announcer, audiobook narrator."""},
    {"cid": "andrea-madura-mx-b", "seed": 95002,
     "instruct": """A Mexican woman born and raised in Morelia, Michoacán, now living in Mexico City. Late thirties. Low-pitched female voice with natural Mexican warmth and texture. You can hear she's Mexican immediately from her intonation patterns, her vowel pronunciation and the way phrases flow naturally in contemporary Mexican Spanish. Not performing Mexican-ness — just genuinely speaking as a Mexican professional woman having a real conversation. Direct, warm, slightly dry sense of humor. The kind of voice that commands respect in a newsroom without raising its volume.
Avoid: foreign accent, gringo Spanish, neutral pan-Latin dubbing voice, Castilian pronunciation, high pitch, girly tone, virtual assistant, commercial announcer, breathy delivery."""},
    {"cid": "andrea-madura-mx-c", "seed": 95003,
     "instruct": """A Mexican woman in her late thirties from Guadalajara, Jalisco. Deep female speaking voice, naturally low-pitched. Her Spanish carries the unmistakable musicality of western central Mexico — clear consonants, full vowels, the specific melodic contours of Jalisco speech softened by years of professional experience. Educated but grounded, warm but precise. She sounds like your most trusted colleague: the one everyone goes to when they need the truth about something complicated.
Avoid: American accent, gringo pronunciation of Spanish words, neutral Latin dubbing voice, Castilian Spanish, Caribbean rhythm, Rioplatense intonation, high-pitched voice, girly quality, virtual assistant smoothness, commercial announcer energy."""},
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
    print(f"\n✓ v4 listas en {OUT_DIR}")

if __name__ == "__main__":
    main()
