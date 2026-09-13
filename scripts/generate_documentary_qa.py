"""Generador de Control de Calidad Visual (Contact Sheet & Before/After) para La Veinte Radio.

Genera:
1. qa/documentary-v2-contact-sheet.jpg (hoja de contacto de 36 cuadros del preview)
2. qa/visual-before-after.jpg (comparativa lado a lado: Antes vs Ahora)
3. Reporte de métricas formales de la dirección documental anti-karaoke.
"""
from __future__ import annotations

import json
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw


def extract_frame_at(video_path: Path, time_s: float, out_path: Path) -> bool:
    """Extrae un cuadro exacto del video usando ffmpeg."""
    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-ss", f"{time_s:.2f}",
        "-i", str(video_path),
        "-vframes", "1",
        "-q:v", "2",
        str(out_path),
    ]
    try:
        subprocess.run(cmd, check=True, timeout=30)
        return out_path.exists()
    except Exception:
        return False


def build_contact_sheet(
    video_path: Path,
    out_sheet_path: Path,
    num_frames: int = 36,
    cols: int = 6,
) -> None:
    """Genera una hoja de contacto de alta resolución (cuadrícula 6x6)."""
    rows = (num_frames + cols - 1) // cols
    temp_dir = out_sheet_path.parent / "temp_qa_frames"
    temp_dir.mkdir(parents=True, exist_ok=True)

    cmd = [
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        str(video_path),
    ]
    res = subprocess.run(cmd, capture_output=True, text=True, check=True)
    dur_s = float(res.stdout.strip())

    thumb_w, thumb_h = 320, 180
    sheet_w = cols * thumb_w + (cols + 1) * 8
    sheet_h = rows * thumb_h + (rows + 1) * 28 + 60

    sheet = Image.new("RGB", (sheet_w, sheet_h), (12, 16, 24))
    draw = ImageDraw.Draw(sheet)

    draw.text((20, 15), "LA VEINTE RADIO — HOJA DE CONTACTO DOCUMENTAL V2 (36 FOTOGRAMAS)", fill=(255, 255, 255))
    draw.text((20, 38), f"Episodio d5f1fc16 · Duración {dur_s / 60:.1f} min · Dirección Evidence-First & Anti-Karaoke", fill=(148, 163, 184))

    margin_s = 6.0
    effective_dur = dur_s - margin_s * 2
    step_s = effective_dur / max(1, num_frames - 1)

    for i in range(num_frames):
        t_s = margin_s + i * step_s
        r = i // cols
        c = i % cols
        x = 8 + c * (thumb_w + 8)
        y = 65 + r * (thumb_h + 28)

        frame_file = temp_dir / f"frame_{i:02d}.jpg"
        ok = extract_frame_at(video_path, t_s, frame_file)
        if ok:
            try:
                img = Image.open(frame_file).resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)
                sheet.paste(img, (x, y))
            except Exception:
                pass

        mins = int(t_s // 60)
        secs = int(t_s % 60)
        draw.text((x + 4, y + thumb_h + 4), f"#{i + 1:02d} · {mins:02d}:{secs:02d}", fill=(203, 213, 225))

    out_sheet_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out_sheet_path, "JPEG", quality=92)
    print(f"Hoja de contacto guardada en: {out_sheet_path}")

    for f in temp_dir.glob("*.jpg"):
        try: f.unlink()
        except: pass
    try: temp_dir.rmdir()
    except: pass


def build_before_after(
    before_img_path: Path,
    after_video_path: Path,
    out_comparison_path: Path,
    after_time_s: float = 25.0,
) -> None:
    """Genera una imagen comparativa Antes vs Después."""
    temp_after = out_comparison_path.parent / "temp_after_frame.jpg"
    extract_frame_at(after_video_path, after_time_s, temp_after)

    if not before_img_path.exists() or not temp_after.exists():
        print("No se encontraron cuadros para before/after")
        return

    before_raw = Image.open(before_img_path)
    after_raw = Image.open(temp_after)

    w, h = 854, 480
    b_resized = before_raw.resize((w, h), Image.Resampling.LANCZOS)
    a_resized = after_raw.resize((w, h), Image.Resampling.LANCZOS)

    comp_w = w * 2 + 30
    comp_h = h + 100
    canvas = Image.new("RGB", (comp_w, comp_h), (10, 14, 22))
    draw = ImageDraw.Draw(canvas)

    draw.text((30, 20), "EVOLUCIÓN AUDIOVISUAL: LA VEINTE RADIO", fill=(255, 255, 255))
    draw.text((30, 42), "Comparativa de Dirección de Arte: Modelo Genérico Anterior vs Modelo Documental Evidence-First", fill=(148, 163, 184))

    canvas.paste(b_resized, (10, 80))
    canvas.paste(a_resized, (w + 20, 80))

    draw.rectangle([10, 80, 10 + w, 115], fill=(225, 29, 72, 220))
    draw.text((25, 88), "ANTES: Fondo oscuro genérico + bloque de texto hablado transcripto (Efecto Karaoke)", fill=(255, 255, 255))

    draw.rectangle([w + 20, 80, w + 20 + w, 115], fill=(16, 185, 129, 220))
    draw.text((w + 35, 88), "AHORA: Dirección Documental (Documento protagonista 85-100% canvas + Titular sintético)", fill=(255, 255, 255))

    canvas.save(out_comparison_path, "JPEG", quality=94)
    print(f"Comparativa Before/After guardada en: {out_comparison_path}")

    try: temp_after.unlink()
    except: pass


def print_qa_metrics(timeline_path: Path, plan_path: Path) -> None:
    """Imprime el balance cuantitativo formal de métricas."""
    if not timeline_path.exists() or not plan_path.exists():
        return

    tl = json.loads(timeline_path.read_text(encoding="utf-8"))
    plan = json.loads(plan_path.read_text(encoding="utf-8"))
    metrics = tl.get("metrics") or plan.get("metrics") or {}
    mix = plan.get("visual_mix") or {}

    print("\n" + "=" * 60)
    print("REPORTE FORMAL DE MÉTRICAS AUDIOVISUALES — LA VEINTE RADIO")
    print("=" * 60)
    print(f"Total Palabras Habladas en Guion:      {metrics.get('total_spoken_words', 'N/A')}")
    print(f"Total Palabras Narrativas en Pantalla:  {metrics.get('total_editorial_words', 'N/A')}")
    print(f"Ratio de Texto Narrativo:               {metrics.get('narrative_text_ratio_pct', 'N/A')}% (Límite objetivo <= 25.0%)")
    print(f"Riesgo de Karaoke (KARAOKE_RISK):       {metrics.get('karaoke_risk_beats', 0)} escenas con riesgo")
    print(f"Dirección Visual Activa:                {metrics.get('visual_direction', 'documental').upper()}")
    print(f"Modo de Texto en Pantalla:              {metrics.get('on_screen_text_mode', 'editorial').upper()}")
    print(f"Gráficos Complejos Repetidos:           {metrics.get('strong_repetition_penalties_applied', 0)} (Penalización aplicada)")
    print("-" * 60)
    print("DISTRIBUCIÓN POR FAMILIAS VISUALES:")
    print(f"  • LOCUTOR (Foco humano, diálogo, intro):  {mix.get('speaker_focus_pct', mix.get('locutor_pct', 'N/A'))}%")
    print(f"  • EVIDENCIA (CCT, LFT, HGR 1 Charo, etc): {mix.get('evidencia_pct', 'N/A')}%")
    print(f"  • EXPLICACIÓN (Gráficos y simulaciones):  {mix.get('cards_charts_pct', mix.get('explicacion_pct', 'N/A'))}%")
    print(f"  • CONTEXTO (B-roll e institucional):      {mix.get('real_reference_broll_pct', mix.get('contexto_pct', 'N/A'))}%")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--video", required=True)
    p.add_argument("--before-frame", default="qa/before_frame.jpg")
    p.add_argument("--timeline", required=True)
    p.add_argument("--plan", required=True)
    args = p.parse_args()

    vpath = Path(args.video)
    build_contact_sheet(vpath, Path("qa/documentary-v2-contact-sheet.jpg"), num_frames=36)
    build_before_after(Path(args.before_frame), vpath, Path("qa/visual-before-after.jpg"))
    print_qa_metrics(Path(args.timeline), Path(args.plan))
