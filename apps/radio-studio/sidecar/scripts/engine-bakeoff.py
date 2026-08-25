"""Bake-off 2x2: Chatterbox vs Qwen Base clone, turno completo vs dividido.
Motor A/B para J01 t004. Solo texto + audio de prueba, sin episodio."""
import torch, time, os, json, gc, subprocess
import numpy as np
import soundfile as sf

REPO = "/home/chronos/Escritorio/La Veinte"
OUT_DIR = os.path.join(REPO, "data", "tts", "casting", "engine-bakeoff")
os.makedirs(OUT_DIR, exist_ok=True)

# ── Texto original t004 ──
T004_FULL = "Hay que separar la indicación verbal de la modificación formal. No son automáticamente equivalentes; primero hay que comprobar qué procedimiento se siguió."
T004_SENTENCES = [
    "Hay que separar la indicación verbal de la modificación formal.",
    "No son automáticamente equivalentes; primero hay que comprobar qué procedimiento se siguió."
]

# Referencia J01
REF_WAV = os.path.join(REPO, "data/tts/casting/javier/candidate-01/common.wav")
REF_TEXT = "Buenos días. Esto es La Veinte Radio. Hay algo que necesitamos aclarar: si hoy te cambian el horario por teléfono, ¿qué documento debería existir? Espera, porque ahí está el detalle. Una cosa es una indicación verbal y otra una modificación formal."

results = {}

def save_wav(audio, sr, name):
    p = os.path.join(OUT_DIR, f"javier-t004-{name}.wav")
    if isinstance(audio, torch.Tensor):
        torchaudio.save(p, audio.cpu().unsqueeze(0) if audio.dim() == 1 else audio.cpu(), sr)
    else:
        sf.write(p, audio, sr)
    dur = float(subprocess.run(["ffprobe","-v","error","-show_entries","format=duration",
        "-of","default=noprint_wrappers=1:nokey=1",p], capture_output=True, text=True).stdout.strip())
    print(f"  ✓ {name}: {dur:.1f}s → {p}")
    return {"path": p, "duration_s": round(dur,2)}

def gpu_mb():
    r = subprocess.run(["nvidia-smi","--query-gpu=memory.used","--format=csv,noheader,nounits"], capture_output=True, text=True)
    return int(r.stdout.strip()) if r.returncode == 0 else -1

# ══════════════════════════════════════════════════════
# FASE 1: CHATTERBOX (A + B)
# ══════════════════════════════════════════════════════
print("═══ FASE 1: CHATTERBOX ═══\n")
import torchaudio
from chatterbox.tts import ChatterboxTTS

t0 = time.time()
model = ChatterboxTTS.from_pretrained(device="cuda")
print(f"cargado {time.time()-t0:.1f}s | GPU: {gpu_mb()}MB")

torch.manual_seed(42)

# A: turno completo
print("\nA. Chatterbox — turno completo")
t1 = time.time()
wav_a = model.generate(T004_FULL, audio_prompt_path=REF_WAV, exaggeration=0.50, cfg_weight=0.50, temperature=0.80)
gen_a = time.time() - t1
audio_a = wav_a.squeeze(0).detach().cpu().numpy()
results["A_chatterbox_full"] = {**save_wav(wav_a, model.sr, "A-chatterbox-full"), "gen_s": round(gen_a,1), "engine": "chatterbox"}
del wav_a; torch.cuda.empty_cache()

# B: dividido por oraciones
print("\nB. Chatterbox — dividido por oraciones")
parts_b = []
t1 = time.time()
for i, sent in enumerate(T004_SENTENCES):
    torch.manual_seed(42 + i)
    w = model.generate(sent, audio_prompt_path=REF_WAV, exaggeration=0.50, cfg_weight=0.50, temperature=0.80)
    a = w.squeeze(0).detach().cpu().numpy()
    parts_b.append(a)
    gap = np.zeros(int(model.sr * (0.15 if i == 0 else 0.18)), dtype=np.float32)
    parts_b.append(gap)
gen_b = time.time() - t1
audio_b = np.concatenate(parts_b)
results["B_chatterbox_split"] = save_wav(audio_b, model.sr, "B-chatterbox-split")
results["B_chatterbox_split"]["gen_s"] = round(gen_b,1)
results["B_chatterbox_split"]["engine"] = "chatterbox"
del model; gc.collect(); torch.cuda.empty_cache()

# ══════════════════════════════════════════════════════
# FASE 2: QWEN BASE VOICE CLONE (C + D)
# ══════════════════════════════════════════════════════
print("\n═══ FASE 2: QWEN BASE VOICE CLONE ═══\n")
time.sleep(5)
from qwen_tts import Qwen3TTSModel
MODEL_BASE_DIR = os.path.join(REPO, "data/tts/models/qwen-tts-base")

t0 = time.time()
model_q = Qwen3TTSModel.from_pretrained(MODEL_BASE_DIR, device_map="cuda:0", dtype=torch.bfloat16)
print(f"cargado {time.time()-t0:.1f}s | GPU: {gpu_mb()}MB")

# crear voice_clone_prompt UNA VEZ
voice_clone_prompt = model_q.create_voice_clone_prompt(
    ref_audio=REF_WAV,
    ref_text=REF_TEXT,
)
print("voice_clone_prompt creado ✓")

# C: turno completo
print("\nC. Qwen Base — turno completo")
t1 = time.time()
wavs_c, sr_c = model_q.generate_voice_clone(
    text=T004_FULL,
    language="Spanish",
    voice_clone_prompt=voice_clone_prompt,
)
gen_c = time.time() - t1
audio_c = np.array(wavs_c[0]) if not isinstance(wavs_c[0], np.ndarray) else wavs_c[0]
results["C_qwen_full"] = save_wav(audio_c, sr_c, "C-qwen-full")
results["C_qwen_full"].update({"gen_s": round(gen_c,1), "engine": "qwen-base-clone"})
del wavs_c; gc.collect(); torch.cuda.empty_cache()

# D: dividido por oraciones
print("\nD. Qwen Base — dividido por oraciones")
parts_d = []
t1 = time.time()
for i, sent in enumerate(T004_SENTENCES):
    wavs_d, sr_d = model_q.generate_voice_clone(
        text=sent,
        language="Spanish",
        voice_clone_prompt=voice_clone_prompt,
    )
    a = np.array(wavs_d[0]) if not isinstance(wavs_d[0], np.ndarray) else wavs_d[0]
    parts_d.append(a)
    gap = np.zeros(int(sr_d * 0.15), dtype=np.float64 if a.dtype==np.float64 else np.float32)
    parts_d.append(gap)
gen_d = time.time() - t1
sr_final = sr_d
audio_d = np.concatenate(parts_d).astype(np.float32)
results["D_qwen_split"] = save_wav(audio_d.astype(np.float32), sr_final, "D-qwen-split")
results["D_qwen_split"].update({"gen_s": round(gen_d,1), "engine": "qwen-base-clone"})

del model_q; gc.collect(); torch.cuda.empty_cache()

# ══════════════════════════════════════════════════════
# COMPARISON WAV
# ══════════════════════════════════════════════════════
print("\n═══ COMPARISON ═══\n")
labels = ["A-Chatterbox-full", "B-Chatterbox-split", "C-Qwen-clone-full", "D-Qwen-clone-split"]
audio_parts = []
sr_ref = None

for label in labels:
    key = {"A":"A_chatterbox_full","B":"B_chatterbox_split","C":"C_qwen_full","D":"D_qwen_split"}[label.split("-")[0]]
    p = results[key]["path"]
    a, s = sf.read(p)
    audio_parts.append(a); sr_ref = s
    # etiqueta hablada entre versiones
    gap = np.zeros(int(s * 1.2), dtype=np.float32)
    audio_parts.append(gap)

combined = np.concatenate(audio_parts)
comp_path = os.path.join(OUT_DIR, "javier-t004-2x2.wav")
sf.write(comp_path, combined, sr_ref)
total_dur = len(combined) / sr_ref
print(f"comparison: {comp_path} ({total_dur:.1f}s)")

# guardar reporte
report = {
    "texto_original": T004_FULL,
    "texto_dividido": T004_SENTENCES,
    "referencia": REF_WAV,
    "ref_text": REF_TEXT[:80] + "...",
    "resultados": results,
    "comparison_path": comp_path,
    "comparison_duration_s": round(total_dur, 1),
}
with open(os.path.join(OUT_DIR, "bakeoff-report.json"), "w") as f:
    json.dump(report, f, indent=1, ensure_ascii=False)

print("\narchivos:")
for f in sorted(os.listdir(OUT_DIR)):
    sz = os.path.getsize(os.path.join(OUT_DIR, f))
    print(f"  {f} ({sz//1024}KB)")
