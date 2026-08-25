"""Casting femenino: Andrea + Valeria con Qwen3-TTS VoiceDesign. Resumible."""
import torch, time, os, json, hashlib, gc, subprocess

REPO = "/home/chronos/Escritorio/La Veinte"
CASTING = os.path.join(REPO, "data", "tts", "casting")
MODEL_DIR = os.path.join(REPO, "data", "tts", "models", "qwen-voice-design")

MEXICAN = """Native Mexican Spanish speaker from central Mexico. Natural contemporary Mexican Spanish prosody and vowel/consonant timing. Everyday educated Mexican speech, similar to a professional conversation in Mexico City, Morelia or Querétaro. Neutral enough for national radio, but unmistakably Mexican in rhythm and intonation. Avoid Castilian Spanish pronunciation, avoid Caribbean cadence, avoid Rioplatense or Argentinian intonation, avoid exaggerated regionalisms, avoid generic dubbing-style Latin neutral delivery."""

CANDIDATAS = [
  {"char":"andrea","cid":"candidate-01","seed":31001,
   "instruct":f"Native Mexican Spanish female speaker from central Mexico, approximately 32 years old. Warm natural medium-pitched female voice, witty, relaxed, naturally expressive. Intelligent, spontaneous, curious and assertive. Conversational delivery with colleagues around a table. Quick realistic reactions, subtle natural smile and genuine changes of intention. {MEXICAN} Avoid virtual assistant voice, commercial announcer, seductive voice, breathy performance, childish high pitch, exaggerated cheerfulness, news presenter, corporate training voice, generic Latin American dubbing cadence.",
   "texts":{"common":"Espera, porque ahí tengo una duda. Si solamente me lo dijeron por teléfono, ¿eso realmente significa que mi horario ya cambió? Porque una cosa es recibir una indicación y otra saber qué documento existe.","disagreement":"No, espera. Ahí no estoy de acuerdo contigo. Si el procedimiento exige algo por escrito, entonces justamente eso es lo primero que tenemos que buscar."}},
  {"char":"andrea","cid":"candidate-02","seed":31002,
   "instruct":f"Native Mexican Spanish female speaker from central Mexico, approximately 29 years old. Slightly brighter, quicker and more energetic than typical. Curious, spontaneous, naturally expressive. Medium-high female pitch but not childish. Conversational with quick realistic reactions. {MEXICAN} Avoid virtual assistant voice, commercial announcer, seductive voice, breathy performance, childish high pitch, exaggerated cheerfulness, news presenter, corporate training voice.",
   "texts":{"common":"Espera, porque ahí tengo una duda. Si solamente me lo dijeron por teléfono, ¿eso realmente significa que mi horario ya cambió? Porque una cosa es recibir una indicación y otra saber qué documento existe.","disagreement":"No, espera. Ahí no estoy de acuerdo contigo. Si el procedimiento exige algo por escrito, entonces justamente eso es lo primero que tenemos que buscar."}},
  {"char":"andrea","cid":"candidate-03","seed":31003,
   "instruct":f"Native Mexican Spanish female speaker from central Mexico, approximately 35 years old. Confident, slightly textured voice. Mature, assertive, calm but expressive. Medium female pitch with natural warmth. Not overly polished — real person conversing. {MEXICAN} Avoid virtual assistant voice, commercial announcer, seductive voice, childish high pitch, news presenter, corporate training voice.",
   "texts":{"common":"Espera, porque ahí tengo una duda. Si solamente me lo dijeron por teléfono, ¿eso realmente significa que mi horario ya cambió? Porque una cosa es recibir una indicación y otra saber qué documento existe.","disagreement":"No, espera. Ahí no estoy de acuerdo contigo. Si el procedimiento exige algo por escrito, entonces justamente eso es lo primero que tenemos que buscar."}},
  {"char":"valeria","cid":"candidate-01","seed":51001,
   "instruct":f"Native Mexican Spanish female speaker, approximately 34 years old. Warm, elegant voice in medium-low female register. Premium quality, restrained, polished. Confident and friendly with subtle professional smile. Smooth delivery with excellent clarity while remaining recognizably human. {MEXICAN} Avoid virtual assistant voice, childish tone, seductive or excessively breathy delivery, aggressive sales pitch, infomercial style, exaggerated advertising enthusiasm.",
   "texts":{"common":"La Veinte Radio presenta información y herramientas pensadas para acompañarte todos los días.","premium":"Este espacio llega a ti con una comunicación clara, cercana y pensada para quienes hacen posible el Instituto todos los días."}},
  {"char":"valeria","cid":"candidate-02","seed":51002,
   "instruct":f"Native Mexican Spanish female speaker, approximately 29 years old. Brighter, modern, polished voice. Friendly, clean articulation. Contemporary Mexican professional sound with controlled energy. {MEXICAN} Avoid virtual assistant voice, childish tone, aggressive sales pitch, infomercial style, cartoon performance.",
   "texts":{"common":"La Veinte Radio presenta información y herramientas pensadas para acompañarte todos los días.","premium":"Este espacio llega a ti con una comunicación clara, cercana y pensada para quienes hacen posible el Instituto todos los días."}},
  {"char":"valeria","cid":"candidate-03","seed":51003,
   "instruct":f"Native Mexican Spanish female speaker, approximately 37 years old. Mature, smooth, sophisticated voice. Controlled, calm delivery with authority and warmth. Medium-low register. {MEXICAN} Avoid virtual assistant voice, childish tone, seductive delivery, aggressive sales pitch, cartoon performance.",
   "texts":{"common":"La Veinte Radio presenta información y herramientas pensadas para acompañarte todos los días.","premium":"Este espacio llega a ti con una comunicación clara, cercana y pensada para quienes hacen posible el Instituto todos los días."}},
]

def is_reusable(wav_path):
    if not os.path.exists(wav_path) or os.path.getsize(wav_path) < 10000: return False
    try:
        r = subprocess.run(["ffprobe","-v","error","-show_entries","format=duration",
            "-of","default=noprint_wrappers=1:nokey=1",wav_path], capture_output=True, text=True, timeout=5000)
        dur = float(r.stdout.strip())
        return 2 < dur < 30
    except: return False

def main():
    import soundfile as sf
    import numpy as np
    from qwen_tts import Qwen3TTSModel
    
    print("cargando VoiceDesign...")
    model = Qwen3TTSModel.from_pretrained(MODEL_DIR, device_map="cuda:0", dtype=torch.bfloat16)
    print("✓ cargado")
    
    for cand in CANDIDATAS:
        cdir = os.path.join(CASTING, cand["char"], cand["cid"])
        os.makedirs(cdir, exist_ok=True)
        print(f"\n── {cand['char']}/{cand['cid']} (seed {cand['seed']}) ──")
        
        for label, text in cand["texts"].items():
            wav_path = os.path.join(cdir, f"{label}.wav")
            if is_reusable(wav_path):
                print(f"  {label}: REUSE ({os.path.getsize(wav_path)}b)")
                continue
            torch.manual_seed(cand["seed"])
            try:
                wavs, sr = model.generate_voice_design(text=text, language="Spanish", instruct=cand["instruct"])
                audio = wavs[0] if isinstance(wavs[0], np.ndarray) else np.array(wavs[0])
                sf.write(wav_path, audio, sr)
                print(f"  {label}: ✓ ({os.path.getsize(wav_path)}b)")
            except Exception as e:
                print(f"  {label}: ✗ {e}")
        
        meta = {
            "candidateId": cand["cid"], "characterId": cand["char"], "seed": cand["seed"],
            "model": "Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign",
            "method": "generate_voice_design",
            "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "identityClass": "qwen_voicedesign_synthetic",
            "eligibleForPromotion": True, "mexicanAccentFit": None, "status": "candidate"
        }
        with open(os.path.join(cdir, "meta.json"), "w") as f:
            json.dump(meta, f, indent=1)

    # unload
    del model; gc.collect(); torch.cuda.empty_cache(); time.sleep(2)
    gpu = subprocess.run(["nvidia-smi","--query-gpu=memory.used","--format=csv,noheader"], capture_output=True, text=True).stdout.strip()
    print(f"\n✓ FASE A completa | VRAM tras unload: {gpu}")

if __name__ == "__main__":
    main()
