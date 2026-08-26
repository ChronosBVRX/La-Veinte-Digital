"""Registro canónico de voces Qwen — única fuente de verdad.
Cada voz apunta a las referencias aprobadas en data/tts/voices/<speaker>/v1/.
"""
import os
import json
import hashlib

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
# REPO = raíz del proyecto (packages/tts-core/qwen → sube 3)
REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
VOICES_ROOT = os.path.join(REPO, "data", "tts", "voices")

def _voice_path(speaker: str) -> str:
    return os.path.join(VOICES_ROOT, speaker.lower(), "v1")

def _ensure_voice_dir(speaker: str) -> str:
    d = _voice_path(speaker)
    os.makedirs(d, exist_ok=True)
    return d

def _sha256(path: str) -> str:
    return hashlib.sha256(open(path, "rb").read()).hexdigest()

def register_voice(speaker: str, ref_audio_src: str, ref_text: str, version: str):
    """Copia una referencia aprobada dentro de data/tts/voices/<speaker>/v1/ y
    escribe metadata.json. Devuelve el dict de la voz."""
    import shutil
    d = _ensure_voice_dir(speaker)
    ref_wav = os.path.join(d, "reference.wav")
    # copiar si el origen es distinto
    if os.path.abspath(ref_audio_src) != os.path.abspath(ref_wav):
        shutil.copy2(ref_audio_src, ref_wav)
    with open(os.path.join(d, "reference.txt"), "w") as f:
        f.write(ref_text)
    meta = {
        "speaker": speaker,
        "version": version,
        "engine": "qwen-voice-design",
        "sample_rate": 24000,
        "sha256": _sha256(ref_wav),
    }
    with open(os.path.join(d, "metadata.json"), "w") as f:
        json.dump(meta, f, indent=2)
    return load_registry().get(speaker)

def load_registry() -> dict:
    """Carga el registro desde data/tts/voices/. Las voces conocidas se resuelven
    contra las referencias canónicas. Devuelve dict {SPEAKER : voice}."""
    voices = {}
    for entry in sorted(os.listdir(VOICES_ROOT)) if os.path.isdir(VOICES_ROOT) else []:
        d = os.path.join(VOICES_ROOT, entry, "v1")
        ref = os.path.join(d, "reference.wav")
        txt = os.path.join(d, "reference.txt")
        meta_p = os.path.join(d, "metadata.json")
        if os.path.exists(ref) and os.path.exists(txt):
            speaker = entry.upper()
            meta = json.load(open(meta_p)) if os.path.exists(meta_p) else {}
            voices[speaker] = {
                "speaker": speaker,
                "version": meta.get("version", f"{speaker.lower()}-v1"),
                "ref_audio": ref,
                "ref_text": open(txt).read().strip(),
                "sha256": meta.get("sha256") or _sha256(ref),
            }
    return voices

def validate_registry(registry: dict, required_speakers=None) -> dict:
    """Valida el registro. Fail closed si falta voz o referencia inválida."""
    problems = []
    if not registry:
        problems.append("VOICE_REFERENCE_INVALID: registro vacío")
    required_speakers = required_speakers or ["EDUARDO", "ANDREA", "JAVIER", "RODRIGO"]
    for spk in required_speakers:
        v = registry.get(spk)
        if not v:
            problems.append(f"VOICE_REFERENCE_INVALID:{spk}")
        else:
            if not os.path.exists(v["ref_audio"]):
                problems.append(f"VOICE_REFERENCE_INVALID:{spk}:ref_audio no existe")
            elif os.path.getsize(v["ref_audio"]) == 0:
                problems.append(f"VOICE_REFERENCE_INVALID:{spk}:ref_audio vacío")
            if not v["ref_text"]:
                problems.append(f"VOICE_REFERENCE_INVALID:{spk}:ref_text vacío")
    return {"valid": len(problems) == 0, "problems": problems, "registry": registry}
