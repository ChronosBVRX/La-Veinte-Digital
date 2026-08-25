"""A/B Chatterbox directo — carga el modelo una vez y clona los 8 finalistas.
NO modifica el engine de producción. Usa la librería chatterbox directamente."""
import torch, time, os, json, gc, subprocess, hashlib, sys, shutil

REPO = "/home/chronos/Escritorio/La Veinte"
CASTING = os.path.join(REPO, "data", "tts", "casting")

FINALISTAS = [
    {"char":"javier","cid":"candidate-01","label":"J01"},
    {"char":"javier","cid":"candidate-04","label":"J04"},
    {"char":"rodrigo","cid":"candidate-01","label":"R01"},
    {"char":"rodrigo","cid":"candidate-02","label":"R02"},
    {"char":"andrea","cid":"candidate-03","label":"A03"},
    {"char":"andrea","cid":"candidate-01","label":"A01"},
    {"char":"valeria","cid":"candidate-01","label":"V01"},
    {"char":"valeria","cid":"candidate-03","label":"V03"},
]

TEST_TEXT = "Hay que separar dos cosas: una es tu jornada registrada y otra una indicación verbal del jefe. No son automáticamente lo mismo."

def main():
    import soundfile as sf
    import numpy as np
    
    # cargar Chatterbox directamente
    print("cargando Chatterbox es-mx-latam...")
    from chatterbox.tts import ChatterboxTTS
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = ChatterboxTTS.from_pretrained(device=device)
    print(f"✓ cargado | VRAM: {torch.cuda.max_memory_allocated()//(1024*1024)}MB")
    
    results = []
    t0 = time.time()
    
    for f in FINALISTAS:
        ref_wav = os.path.join(CASTING, f["char"], f["cid"], "common.wav")
        if not os.path.exists(ref_wav) or os.path.getsize(ref_wav) < 10000:
            print(f"⚠ {f['label']}: referencia inválida")
            continue
        
        torch.manual_seed(42)
        t1 = time.time()
        try:
            wav = model.generate(
                TEST_TEXT,
                audio_prompt_path=ref_wav,
                exaggeration=0.50,
                cfg_weight=0.50,
                temperature=0.80,
            )
            gen_time = time.time() - t1
            
            audio = wav.cpu().numpy() if hasattr(wav, 'cpu') else np.array(wav)
            sr = model.sr
            
            clone_dir = os.path.join(CASTING, f["char"], f["cid"], "chatterbox-clone")
            os.makedirs(clone_dir, exist_ok=True)
            clone_path = os.path.join(clone_dir, "chatterbox-clone.wav")
            import torchaudio
            torchaudio.save(clone_path, torch.tensor(audio).unsqueeze(0) if audio.ndim==1 else torch.tensor(audio), sr)
            
            dur_r = subprocess.run(["ffprobe","-v","error","-show_entries","format=duration",
                "-of","default=noprint_wrappers=1:nokey=1",clone_path], capture_output=True, text=True).stdout.strip()
            sha = hashlib.sha256(open(clone_path,"rb").read()).hexdigest()[:16]
            
            results.append({
                "label": f["label"], "characterId": f["char"], "candidateId": f["cid"],
                "referenceWav": ref_wav, "cloneWav": clone_path,
                "duration_s": round(float(dur_r),1), "genTime_s": round(gen_time,1),
                "sha256": sha, "status": "cloned"
            })
            print(f"✓ {f['label']} → {dur_r}s ({gen_time:.1f}s)")
        except Exception as e:
            print(f"✗ {f['label']}: {str(e)[:80]}")
            results.append({"label": f["label"], "characterId": f["char"], "candidateId": f["cid"], "status": "FAILED", "error": str(e)[:200]})
    
    elapsed = time.time() - t0
    VRAM = subprocess.run(["nvidia-smi","--query-gpu=memory.used","--format=csv,noheader"], capture_output=True, text=True).stdout.strip()
    
    # crear comparisons por personaje
    import soundfile as sf2
    for char in ["javier","rodrigo","andrea","valeria"]:
        char_results = [r for r in results if r.get("characterId")==char]
        parts = []
        sr = 24000
        for r in char_results:
            vd = os.path.join(CASTING, r["characterId"], r["candidateId"], "common.wav")
            cb = r.get("cloneWav","")
            for p in [vd, cb]:
                if p and os.path.exists(p):
                    a, s = sf2.read(p)
                    parts.append(a); sr = s
            parts.append(np.zeros(int(sr*1.5), dtype=np.float32))
        
        if len(parts) > 1:
            combined = np.concatenate(parts)
            out = os.path.join(CASTING, f"chatterbox-{char}-finalists-comparison.wav")
            sf2.write(out, combined, sr)
            print(f"  {char}: {len(combined)/sr:.1f}s → {out}")
    
    # all-finalists comparison
    all_parts = []
    for char in ["javier","rodrigo","andrea","valeria"]:
        out = os.path.join(CASTING, f"chatterbox-{char}-finalists-comparison.wav")
        if os.path.exists(out):
            a, s = sf2.read(out)
            all_parts.append(a); sr = s
            all_parts.append(np.zeros(int(s*2), dtype=np.float32))
    if all_parts:
        combined = np.concatenate(all_parts)
        out_all = os.path.join(CASTING, "chatterbox-all-finalists-comparison.wav")
        sf2.write(out_all, combined, sr)
        print(f"  all-finalists: {len(combined)/sr:.1f}s")
    
    report = {
        "testText": TEST_TEXT,
        "elapsed_s": round(elapsed,1),
        "vram_after": VRAM,
        "finalists": results,
        "profiles_used": {"exaggeration": 0.50, "cfg_weight": 0.50, "temperature": 0.80},
    }
    with open(os.path.join(CASTING, "chatterbox-ab-report.json"), "w") as fp:
        json.dump(report, fp, indent=1, ensure_ascii=False)
    
    ok_count = sum(1 for r in results if r.get("status")=="cloned")
    print(f"\n═══ A/B CHATTERBOX ═══")
    print(f"clonados OK: {ok_count}/8 | tiempo total: {elapsed:.0f}s | VRAM: {VRAM}")

if __name__ == "__main__":
    main()
