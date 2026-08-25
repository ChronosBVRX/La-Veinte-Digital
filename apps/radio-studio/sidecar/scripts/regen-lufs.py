"""Regenerar turnos con LUFS bajo usando Qwen Base multi-take LUFS selection."""
import torch, os, json, subprocess, gc, re, shutil, time
import numpy as np
import soundfile as sf

REPO = "/home/chronos/Escritorio/La Veinte"
OUT_DIR = os.path.join(REPO, "data/tts/production/episode")
CASTING = os.path.join(REPO, "data/tts/casting")
MODEL_DIR = os.path.join(REPO, "data/tts/models/qwen-tts-base")
EDUARDO_REF = os.path.join(CASTING, "final-qwen-clips", "t001.wav")

VOICES = {
    "EDUARDO": {"ref_audio": EDUARDO_REF, "text": "Buenos días. Esto es La Veinte Radio."},
    "ANDREA": {"ref_audio": os.path.join(CASTING,"andrea","candidate-01","common.wav"), "text": "Espera, porque ahí tengo una duda. Si solamente me lo dijeron por teléfono, ¿eso realmente significa que mi horario ya cambió? Porque una cosa es recibir una indicación y otra saber qué documento existe."},
    "JAVIER": {"ref_audio": os.path.join(CASTING,"javier","candidate-01","common.wav"), "text": "Buenos días. Esto es La Veinte Radio. Hay algo que necesitamos aclarar: si hoy te cambian el horario por teléfono, ¿qué documento debería existir? Espera, porque ahí está el detalle. Una cosa es una indicación verbal y otra una modificación formal."},
    "RODRIGO": {"ref_audio": os.path.join(CASTING,"rodrigo","candidate-01","common.wav"), "text": "Revisé el procedimiento y encontré dos documentos que aquí importan mucho: la solicitud y el oficio con el que notifican la decisión."},
}
VOICES["NARRADOR"] = VOICES["JAVIER"]

REGEN = ["t001","t004","t005","t006","t008","t009","t011","t013","t016","t018"]
guion = json.load(open(os.path.join(REPO,"data/tts/episodes/ep-horario-1787599336487/guion-final.json")))
turns_map = {t["id"]: t for t in guion["turns"]}

from qwen_tts import Qwen3TTSModel

model = Qwen3TTSModel.from_pretrained(MODEL_DIR, device_map="cuda:0", dtype=torch.bfloat16)
prompts = {}
for spk in set(turns_map[tid]["speaker"] for tid in REGEN):
    v = VOICES[spk]
    prompts[spk] = model.create_voice_clone_prompt(
        ref_audio=os.path.abspath(v["ref_audio"]), ref_text=v["text"])

for tid in REGEN:
    turn = turns_map[tid]; spk = turn["speaker"]
    best_path = None; best_diff = 999
    
    for take in range(3):
        torch.manual_seed(hash(tid + str(take)) % 100000)
        try:
            wavs, sr = model.generate_voice_clone(
                text=turn["text"], language="Spanish",
                voice_clone_prompt=prompts[spk])
            audio = np.array(wavs[0]).astype(np.float32)
            
            tmp_path = f"/tmp/{tid}-take{take}.wav"
            sf.write(tmp_path, audio, sr)
            
            r = subprocess.run(["ffmpeg","-hide_banner","-nostats","-i",tmp_path,
                "-af","ebur128","-f","null","-"], capture_output=True, text=True, timeout=30)
            idx = r.stderr.rfind("Summary:")
            m = re.search(r"I:\s*(-?[\d.]+)\s*LUFS", r.stderr[idx:])
            lufs = float(m.group(1)) if m else -20
            
            diff = abs(lufs - (-19))
            print(f"  {tid} take{take}: LUFS={lufs} diff={diff:.1f}")
            
            if diff < best_diff:
                best_diff = diff; best_path = tmp_path
        except Exception as e:
            print(f"  {tid} take{take}: {e}")
    
    if best_path:
        dest = os.path.join(OUT_DIR, f"{tid}.wav")
        shutil.copy2(best_path, dest)
        print(f"  {tid} → mejor toma (diff={best_diff:.1f})")

del model; gc.collect(); torch.cuda.empty_cache()
print("\n✓ regeneración LUFS completada")
