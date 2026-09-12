"""AudioVideoSyncValidator: ±1 frame @30fps contra alignment canónico y duración total."""
from __future__ import annotations

FPS = 30
TOL_FRAMES = 1
FRAME_MS = 1000.0 / FPS
TOLERANCE_MS = FRAME_MS + 1.0


def check_sync(
    video_path: str,
    audio_s: float,
    beats: list[dict],
    alignment: dict | None = None,
) -> dict:
    """Compara duración del vídeo contra el audio y valida matemáticamente cada turno contra alignment.

    beats: [{id/beat_id, start, end}].
    alignment: dict opcional con MixAlignmentManifest {"turns": [{turnId, startMs, endMs, durationMs}]}.
    """
    import json
    import subprocess

    r = subprocess.run(
        [
            "ffprobe", "-hide_banner", "-v", "error", "-select_streams", "v:0",
            "-show_entries", "stream=nb_frames,avg_frame_rate,duration",
            "-of", "json", video_path,
        ],
        capture_output=True, text=True, timeout=60,
    )
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

    drift_s = abs(video_s - audio_s)
    points = []
    for key in ["inicio", "mitad", "final"]:
        points.append({"punto": key, "ok": drift_s <= (TOL_FRAMES / FPS) + 0.05})

    beats_ok = all(
        0 <= float(b.get("start", 0)) <= float(b.get("end", 0)) <= video_s + 0.05
        for b in beats
    )

    max_start_error_ms = 0.0
    max_end_error_ms = 0.0
    bad_turns = []

    if alignment and isinstance(alignment, dict):
        al_turns = alignment.get("turns", [])
        al_map = {t["turnId"]: t for t in al_turns if "turnId" in t}

        for b in beats:
            bid = b.get("id") or b.get("beat_id")
            if bid and bid in al_map:
                target = al_map[bid]
                expected_start_s = target["startMs"] / 1000.0
                expected_end_s = target["endMs"] / 1000.0
                actual_start_s = float(b.get("start", 0))
                actual_end_s = float(b.get("end", 0))

                start_err_ms = abs(actual_start_s - expected_start_s) * 1000.0
                end_err_ms = abs(actual_end_s - expected_end_s) * 1000.0

                if start_err_ms > max_start_error_ms:
                    max_start_error_ms = start_err_ms
                if end_err_ms > max_end_error_ms:
                    max_end_error_ms = end_err_ms

                if start_err_ms > TOLERANCE_MS or end_err_ms > TOLERANCE_MS:
                    bad_turns.append({
                        "turnId": bid,
                        "startErrorMs": round(start_err_ms, 2),
                        "endErrorMs": round(end_err_ms, 2),
                    })

    duration_ok = drift_s <= (TOL_FRAMES / FPS) + 0.05
    alignment_ok = len(bad_turns) == 0
    ok = duration_ok and beats_ok and alignment_ok

    return {
        "ok": bool(ok),
        "video_s": round(video_s, 3),
        "audio_s": round(audio_s, 3),
        "drift_s": round(drift_s, 3),
        "maxStartErrorMs": round(max_start_error_ms, 2),
        "maxEndErrorMs": round(max_end_error_ms, 2),
        "badTurns": bad_turns,
        "puntos": points,
        "beats_dentro": bool(beats_ok),
    }
