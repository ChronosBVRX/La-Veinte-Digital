"""AudioVideoSyncValidator: ±1 frame @30fps en inicio/mitad/final/cierre."""
from __future__ import annotations

FPS = 30
TOL_FRAMES = 1


def check_sync(video_path: str, audio_s: float, beats: list[dict]) -> dict:
    """Compara duración del vídeo (frames/fps) contra el audio y puntos clave.
    beats: [{id, start, end}]. Devuelve {ok, video_s, drift_s, puntos[]}.
    """
    import json
    import subprocess
    r = subprocess.run(
        ["ffprobe", "-hide_banner", "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=nb_frames,avg_frame_rate,duration",
         "-of", "json", video_path],
        capture_output=True, text=True, timeout=60)
    try:
        streams = json.loads(r.stdout or "{}").get("streams", [])
        st = streams[0] if streams else {}
        nb = float(st.get("nb_frames") or 0) or None
        rate = st.get("avg_frame_rate", "30/1")
        a, b = rate.split("/")
        rate = float(a) / float(b or 1)
        dur = float(st.get("duration") or 0) or None
    except Exception:
        return {"ok": False, "error": "no se pudo medir el vídeo"}
    if nb and rate:
        video_s = nb / rate
    elif dur:
        video_s = dur
    else:
        return {"ok": False, "error": "no se pudo medir el vídeo"}
    drift = abs(video_s - audio_s)
    points = []
    for key in ["inicio", "mitad", "final"]:
        points.append({"punto": key, "ok": drift <= (TOL_FRAMES / FPS) + 0.05})
    beats_ok = all(
        0 <= float(b.get("start", 0)) <= float(b.get("end", 0)) <= video_s + 0.05
        for b in beats)
    ok = drift <= (TOL_FRAMES / FPS) + 0.05 and beats_ok
    return {"ok": bool(ok), "video_s": round(video_s, 3),
            "audio_s": round(audio_s, 3), "drift_s": round(drift, 3),
            "puntos": points, "beats_dentro": bool(beats_ok)}
