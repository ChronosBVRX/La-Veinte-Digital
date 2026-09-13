"""Generador de Control de Calidad Documental V3 (40 fotogramas) para La Veinte Radio.

Extrae 40 fotogramas clave curados cronológicamente del video preview:
- Locutores (intro y contacto humano)
- CCT 2025-2027 portada y cláusula 157
- LFT Cámara de Diputados / DOF (Art. 399 Bis y 400 Bis)
- Tarjetón IMSS Digital (completo, C02 y C11)
- SNTSS Congreso Nacional
- HGR No. 1 Charo y Hospital General
- Gráficos y simulaciones (8.55%, nómina, LFT, retiro)
- Contexto B-Roll (pasillo, oficina, trabajador revisando tarjetón, trabajador con documento)
- Opening institucional y Closing institucional

Genera:
qa/documentary-v3-contact-sheet.jpg (rejilla 5x8 de alta resolución)
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from PIL import Image, ImageDraw


def extract_frame_at(video_path: Path, time_s: float, out_path: Path) -> bool:
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
    except Exception as e:
        print(f"Error extrayendo cuadro en t={time_s:.2f}s: {e}", file=sys.stderr)
        return False


def get_curated_timestamps(project_dir: Path, target_count: int = 40) -> list[dict]:
    plan_path = project_dir / "visual-plan.json"
    if not plan_path.exists():
        raise FileNotFoundError(f"No se encontró {plan_path}")

    data = json.loads(plan_path.read_text(encoding="utf-8"))
    beats = data.get("beats", [])
    dur_s = data.get("duration_s", 735.97)

    milestones: list[dict] = []

    for b in beats:
        st = b.get("scene_type")
        vf = b.get("visual_function")
        chart = b.get("chart_type")
        asset = b.get("resolved_asset") or {}
        aid = asset.get("id") or ""
        t_mid = round((b["start_s"] + b["end_s"]) / 2.0, 2)
        label = b.get("headline") or b.get("display_text") or st

        if st == "brand_opening":
            milestones.append({"t": 2.5, "label": "Opening Institucional", "fn": "BRAND", "desc": "La Veinte Radio"})
        elif aid.startswith("cct_2025_2027_cover"):
            milestones.append({"t": t_mid, "label": "CCT 2025–2027", "fn": "EVIDENCIA", "desc": "Portada Oficial SNTSS-IMSS"})
        elif chart == "cct_clause_157":
            milestones.append({"t": t_mid, "label": "CCT Cláusula 157", "fn": "EVIDENCIA", "desc": "Fondo de Retiro IMSS"})
        elif chart == "lft_document_399bis":
            milestones.append({"t": t_mid, "label": "LFT Art. 399 Bis", "fn": "EVIDENCIA", "desc": "Revisión Salarial Anual"})
        elif chart == "lft_document_400bis":
            milestones.append({"t": t_mid, "label": "LFT Art. 400 Bis", "fn": "EVIDENCIA", "desc": "Revisión Integral Contractual"})
        elif chart == "tarjeton_detail_c02":
            milestones.append({"t": t_mid, "label": "Tarjetón: Concepto 02", "fn": "EVIDENCIA", "desc": "Sueldo Tabular (+2.9%)"})
        elif chart == "tarjeton_detail_c11":
            milestones.append({"t": t_mid, "label": "Tarjetón: Concepto 11", "fn": "EVIDENCIA", "desc": "Ayuda de Renta (+3.9%)"})
        elif chart == "payroll_sim_tarjeton":
            milestones.append({"t": t_mid, "label": "Simulación Nómina", "fn": "EXPLICACION", "desc": "+$290 Quincenales"})
        elif aid.startswith("hgr1_charo"):
            milestones.append({"t": t_mid, "label": "HGR No. 1 Charo", "fn": "EVIDENCIA", "desc": "Michoacán · Hospital IMSS"})
        elif aid.startswith("hospital_general"):
            milestones.append({"t": t_mid, "label": "Hospital General", "fn": "EVIDENCIA", "desc": "Sede Médica IMSS"})
        elif aid.startswith("sntss_congress"):
            milestones.append({"t": t_mid, "label": "SNTSS Congreso", "fn": "EVIDENCIA", "desc": "Recinto Sindical Nacional"})
        elif chart == "stat_breakdown_855":
            milestones.append({"t": t_mid, "label": "Desglose 8.55%", "fn": "EXPLICACION", "desc": "Ponderado Salarial"})
        elif chart == "comparison_lft_revision":
            milestones.append({"t": t_mid, "label": "LFT Comparativa", "fn": "EXPLICACION", "desc": "399 Bis vs 400 Bis"})
        elif chart == "retirement_timeline_cct157":
            milestones.append({"t": t_mid, "label": "Ruta Escalonada", "fn": "EXPLICACION", "desc": "Cláusula 157 CCT"})
        elif aid.startswith("hospital_corridor"):
            milestones.append({"t": t_mid, "label": "Contexto: Clínica", "fn": "CONTEXTO", "desc": "Pasillo y Guardia IMSS"})
        elif aid.startswith("administrative_office"):
            milestones.append({"t": t_mid, "label": "Contexto: Oficina", "fn": "CONTEXTO", "desc": "Personal y Nómina IMSS"})
        elif aid.startswith("worker_reviewing_payslip"):
            milestones.append({"t": t_mid, "label": "Contexto: Tarjetón", "fn": "CONTEXTO", "desc": "Revisión en Turno"})
        elif aid.startswith("worker_reviewing_document"):
            milestones.append({"t": t_mid, "label": "Contexto: Normativa", "fn": "CONTEXTO", "desc": "Consulta CCT Trabajador"})
        elif st == "brand_closing":
            milestones.append({"t": round(dur_s - 3.0, 2), "label": "Closing Institucional", "fn": "BRAND", "desc": "La Veinte Digital"})

    unique_milestones: list[dict] = []
    for m in milestones:
        if not any(abs(m["t"] - u["t"]) < 4.0 and m["label"] == u["label"] for u in unique_milestones):
            unique_milestones.append(m)

    speaker_beats = [b for b in beats if b.get("visual_function") == "LOCUTOR" and b.get("scene_type") == "speaker_focus"]
    for spk_b in speaker_beats:
        t_spk = round(spk_b["start_s"] + 1.2, 2)
        if len(unique_milestones) >= target_count:
            break
        if not any(abs(t_spk - m["t"]) < 8.0 for m in unique_milestones):
            unique_milestones.append({
                "t": t_spk,
                "label": f"Locutor: {spk_b.get('speaker', 'Presentador')}",
                "fn": "LOCUTOR",
                "desc": "Contacto Humano / Intro",
            })

    if len(unique_milestones) < target_count:
        step = dur_s / (target_count - len(unique_milestones) + 1)
        for i in range(1, target_count - len(unique_milestones) + 1):
            t_fill = round(i * step, 2)
            b_match = next((b for b in beats if b["start_s"] <= t_fill <= b["end_s"]), beats[0])
            unique_milestones.append({
                "t": t_fill,
                "label": b_match.get("headline") or b_match.get("display_text") or b_match.get("scene_type"),
                "fn": b_match.get("visual_function", "LOCUTOR"),
                "desc": f"Timeline {int(t_fill//60):02d}:{int(t_fill%60):02d}",
            })

    unique_milestones.sort(key=lambda x: x["t"])
    return unique_milestones[:target_count]


def build_documentary_v3_contact_sheet(
    video_path: Path,
    out_sheet_path: Path,
    milestones: list[dict],
    cols: int = 8,
    rows: int = 5,
) -> None:
    temp_dir = out_sheet_path.parent / "temp_qa_v3_frames"
    temp_dir.mkdir(parents=True, exist_ok=True)

    thumb_w, thumb_h = 320, 180
    pad_x, pad_y = 8, 32
    header_h = 75

    sheet_w = cols * thumb_w + (cols + 1) * pad_x
    sheet_h = rows * thumb_h + rows * pad_y + header_h + 20

    sheet = Image.new("RGB", (sheet_w, sheet_h), (11, 15, 23))
    draw = ImageDraw.Draw(sheet)

    draw.text((pad_x + 10, 15), "LA VEINTE RADIO — HOJA DE CONTACTO DIRECCIÓN DOCUMENTAL V3 (40 CUADROS)", fill=(255, 255, 255))
    draw.text(
        (pad_x + 10, 42),
        "Episodio d5f1fc16 · Modo Documental + Anti-Karaoke (Cero Transcripción · 4 Familias Visuales · Referencias Reales)",
        fill=(148, 163, 184),
    )

    fn_colors = {
        "LOCUTOR": (59, 130, 246),
        "EVIDENCIA": (16, 185, 129),
        "EXPLICACION": (245, 158, 11),
        "CONTEXTO": (168, 85, 247),
        "BRAND": (239, 68, 68),
    }

    for i, m in enumerate(milestones):
        r = i // cols
        c = i % cols
        x = pad_x + c * (thumb_w + pad_x)
        y = header_h + r * (thumb_h + pad_y)

        frame_file = temp_dir / f"frame_{i:02d}.jpg"
        ok = extract_frame_at(video_path, m["t"], frame_file)
        if ok:
            try:
                img = Image.open(frame_file).resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)
                sheet.paste(img, (x, y))
            except Exception as e:
                print(f"Error procesando frame {i}: {e}", file=sys.stderr)

        draw.rectangle([x, y, x + thumb_w, y + thumb_h], outline=(30, 41, 59), width=1)
        col = fn_colors.get(m["fn"], (148, 163, 184))
        draw.rectangle([x, y + thumb_h + 2, x + 5, y + thumb_h + 22], fill=col)

        mins = int(m["t"] // 60)
        secs = int(m["t"] % 60)
        lbl_text = f"#{i + 1:02d} · {mins:02d}:{secs:02d} · [{m['fn']}] {m['label'][:22]}"
        draw.text((x + 9, y + thumb_h + 2), lbl_text, fill=(241, 245, 249))
        draw.text((x + 9, y + thumb_h + 16), m["desc"][:34], fill=(100, 116, 139))

    out_sheet_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out_sheet_path, "JPEG", quality=92)
    print(f"Hoja de contacto guardada exitosamente en: {out_sheet_path}")

    for f in temp_dir.glob("*.jpg"):
        try: f.unlink()
        except: pass
    try: temp_dir.rmdir()
    except: pass


def main():
    root = Path(__file__).resolve().parents[1]
    project_dir = root / "data" / "projects" / "d5f1fc16"
    video_dir = root / "data" / "tts" / "video" / "d5f1fc16"
    video_path = video_dir / "episodio-d5f1fc16-preview.mp4"
    out_sheet = root / "qa" / "documentary-v3-contact-sheet.jpg"

    if not video_path.exists():
        print(f"ERROR: Video preview no encontrado en {video_path}", file=sys.stderr)
        sys.exit(1)

    print("Seleccionando 40 hitos cronológicos...")
    milestones = get_curated_timestamps(project_dir, target_count=40)
    print(f"Hitos seleccionados: {len(milestones)}")

    print(f"Generando hoja de contacto de 40 fotogramas en {out_sheet}...")
    build_documentary_v3_contact_sheet(video_path, out_sheet, milestones, cols=8, rows=5)


if __name__ == "__main__":
    main()
