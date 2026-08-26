"""Episodio final con Qwen Base voice clone — 4 voces aprobadas."""
import torch, os, json, subprocess, gc, time, hashlib
import numpy as np
import soundfile as sf

REPO = "/home/chronos/Escritorio/La Veinte"
CASTING = os.path.join(REPO, "data/tts/casting")
OUT_DIR = os.path.join(REPO, "data/tts/production/episode/final")
MODEL_DIR = os.path.join(REPO, "data/tts/models/qwen-tts-base")
EDUARDO_REF = os.path.join(CASTING, "final-qwen-clips", "t001.wav")
os.makedirs(OUT_DIR, exist_ok=True)

VOICES = {
    "EDUARDO": {"ref_audio": EDUARDO_REF,
        "text": "Buenos días. Esto es La Veinte Radio. Yo soy Eduardo y quiero abrir con algo que veo a diario: la idea de que el jefe inmediato tiene un poder absoluto sobre cuándo empiezas, cuándo terminas o qué haces dentro de tu horario."},
    "ANDREA": {"ref_audio": os.path.join(CASTING, "andrea-mexico-v4", "canonical-reference.wav"),
        "text": "Espera, porque ahí tengo una duda que no me cuadra. Si solamente me lo dijeron por teléfono, ¿eso realmente significa que mi horario ya cambió? Porque yo entiendo que una cosa es recibir una indicación verbal del jefe y otra muy diferente es tener un documento oficial donde esté firmado ese cambio. Y si no existe ese papel, entonces ¿qué pasa con mi horario original? Porque eso es lo que me preocupa realmente."},
    "JAVIER": {"ref_audio": os.path.join(CASTING, "javier", "candidate-01", "common.wav"),
        "text": "Buenos días. Esto es La Veinte Radio. Hay algo que necesitamos aclarar: si hoy te cambian el horario por teléfono, ¿qué documento debería existir? Espera, porque ahí está el detalle. Una cosa es una indicación verbal y otra una modificación formal."},
    "RODRIGO": {"ref_audio": os.path.join(CASTING, "rodrigo", "candidate-01", "common.wav"),
        "text": "Revisé el procedimiento y encontré dos documentos que aquí importan mucho: la solicitud y el oficio con el que notifican la decisión."},
}

guion = json.load(open(os.path.join(REPO, "data/tts/episodes/ep-horario-1787599336487/guion-final.json")))
TURNS = guion["turns"]

def main():
    from qwen_tts import Qwen3TTSModel
    model = Qwen3TTSModel.from_pretrained(MODEL_DIR, device_map="cuda:0", dtype=torch.bfloat16)
    print("Qwen Base cargado ✓")

    prompts = {}
    for spk in set(t["speaker"] for t in TURNS):
        key = spk if spk in VOICES else ("JAVIER" if spk == "NARRADOR" else spk)
        v = VOICES[key]
        prompts[spk] = model.create_voice_clone_prompt(
            ref_audio=os.path.abspath(v["ref_audio"]), ref_text=v["text"])
    print(f"prompts: {len(prompts)} ✓\n")

    clips = []
    for turn in TURNS:
        tid = turn["id"]; spk = turn["speaker"]
        wav_path = os.path.join(OUT_DIR, f"{tid}.wav")
        
        if os.path.exists(wav_path) and os.path.getsize(wav_path) > 5000:
            audio, sr = sf.read(wav_path)
            print(f"  {tid} REUSE ({len(audio)/sr:.1f}s)")
            clips.append({"audio": np.array(audio,dtype=np.float32), "sr": sr,
                **{k:v for k,v in turn.items()}})
            continue
        
        prompt = prompts.get(spk, prompts.get("JAVIER"))
        torch.manual_seed(hash(tid) % 100000)
        
        t1 = time.time()
        wavs, sr = model.generate_voice_clone(text=turn["text"], language="Spanish", voice_clone_prompt=prompt)
        gen_t = time.time() - t1
        
        audio = np.array(wavs[0]).astype(np.float32)
        sf.write(wav_path, audio, sr)
        clips.append({"audio": audio, "sr": sr, **{k:v for k,v in turn.items()}})
        print(f"  {tid} {spk:8} GENERATE ({len(audio)/sr:.1f}s, gen={gen_t:.0f}s)")

    del model; gc.collect(); torch.cuda.empty_cache(); time.sleep(2)

    # VAD + timeline
    def vad(audio, sr):
        win=int(0.02*sr); nw=len(audio)//win
        if nw==0: return 0,int(len(audio)/sr*1000),int(len(audio)/sr*1000)
        energies=[float(np.sqrt(np.mean(audio[w*win:(w+1)*win]**2))) for w in range(nw)]
        thresh=max(energies)*0.05 if max(energies)>0 else 0.001
        fw=next((w for w,e in enumerate(energies) if e>thresh),0)
        lw=next((w for w in range(nw-1,-1,-1) if energies[w]>thresh),nw-1)
        return int(fw*win/sr*1000),int((lw+1)*win/sr*1000),int(len(audio)/sr*1000)

    for c in clips:
        ss,se,tot=vad(c["audio"],c["sr"])
        c["speechStartMs"]=ss; c["speechEndMs"]=se; c["totalMs"]=tot

    sr_out=clips[0]["sr"]
    cursor_speech_end=0
    pauses=[250,250,200,220,180,150,250,200,0,250,250,250,250,250,250,250,250,250]
    for i,c in enumerate(clips):
        overlap=180 if c["id"]=="t009" else 0
        pb=pauses[i] if i < len(pauses) else 250
        if overlap and overlap>0 and i>0:
            desired=clips[i-1]["timelineStart"]+clips[i-1]["speechEndMs"]-overlap
        else:
            seed=hash(c["id"])%170
            jittered=max(180,min(350,pb+seed-85)) if pb>100 else pb
            desired=cursor_speech_end+jittered
        ts=max(desired-c["speechStartMs"],0)
        te=ts+c["totalMs"]
        c["timelineStart"]=ts;c["timelineEnd"]=te
        cursor_speech_end=ts+c["speechEndMs"]
        rg=(ts+c["speechStartMs"])-(clips[i-1]["timelineStart"]+clips[i-1]["speechEndMs"]) if i>0 else 0
        flag=" ⚡" if overlap else ""
        warn=" ⚠" if rg>700 and not overlap else ""
        print(f"  {c['id']} gap={rg/1000:.3f}s{flag}{warn}")

    total_ms=max(c["timelineEnd"] for c in clips)+300
    mixed=np.zeros(int(total_ms/1000*sr_out),dtype=np.float32)
    for c in clips:
        s=int(c["timelineStart"]/1000*sr_out)
        e=min(s+len(c["audio"]),len(mixed))
        mixed[s:e]+=c["audio"][:e-s]
    pk=np.max(np.abs(mixed))
    if pk>0.95:mixed*=0.95/pk

    wav_out=os.path.join(OUT_DIR,"episodio-final.wav")
    sf.write(wav_out,mixed,sr_out)

    mp3_out=os.path.join(OUT_DIR,"episodio-final.mp3")
    subprocess.run(["ffmpeg","-y","-i",wav_out,"-af","loudnorm=I=-16:TP=-1.5:LRA=11",
        "-codec:a","libmp3lame","-b:a","192k",mp3_out],capture_output=True,timeout=120)
    
    dur_r=subprocess.run(["ffprobe","-v","error","-show_entries","format=duration",
        "-of","default=noprint_wrappers=1:nokey=1",mp3_out],capture_output=True,text=True).stdout.strip()
    qa_r=subprocess.run(["ffmpeg","-hide_banner","-nostats","-i",mp3_out,"-af","ebur128=peak=true","-f","null","-"],
        capture_output=True,text=True,timeout=60)
    idx=qa_r.stderr.rfind("Summary:")
    import re
    lufs_m=re.search(r"I:\s*(-?[\d.]+)\s*LUFS",qa_r.stderr[idx:])
    tp_m=re.search(r"True peak:\s*Peak:\s*(-?[\d.]+)",qa_r.stderr[idx:])
    lufs=float(lufs_m.group(1)) if lufs_m else None
    tp=float(tp_m.group(1)) if tp_m else None

    print(f"\n═══ EPISODIO FINAL QWEN ═══")
    print(f"MP3: {mp3_out}")
    print(f"duración: {dur_r}s | LUFS: {lufs} | TP: {tp}")
    
    manifest={"archivo":mp3_out,"duracion_s":round(float(dur_r),1),"turnos":len(clips),
        "engine":"Qwen/Qwen3-TTS-12Hz-1.7B-Base generate_voice_clone",
        "voces":{"EDUARDO":"Qwen voice_design (temporal)","ANDREA":"A-mx-a VoiceDesign→clone",
                 "JAVIER":"J01 VoiceDesign→clone","RODRIGO":"R01 VoiceDesign→clone"}}
    json.dump(manifest,open(os.path.join(OUT_DIR,"manifest.json"),"w"),indent=1,ensure_ascii=False)

if __name__ == "__main__":
    main()
