"""Generador de activos visuales de contexto / B-roll documental para La Veinte Radio.

Produce imágenes de alta resolución (1920x1080 para 16:9 y 1080x1920 para 9:16)
con estética documental realista, profundidad de campo, iluminación cinematográfica
y detalles institucionales para representar entornos laborales verídicos.
"""
from pathlib import Path
import math
from PIL import Image, ImageDraw, ImageFilter

OUTPUT_DIR = Path("assets/editorial/context")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def create_hospital_corridor(w: int, h: int) -> Image.Image:
    """Crea una escena cinematográfica de pasillo hospitalario con perspectiva y profundidad."""
    img = Image.new("RGBA", (w, h), (18, 24, 32, 255))
    d = ImageDraw.Draw(img, "RGBA")

    horizon_y = int(h * 0.48)
    vanish_x = int(w * 0.52)

    # 1. Techo
    for y in range(horizon_y):
        prog = y / max(1, horizon_y)
        col = (int(30 + 20 * (1 - prog)), int(38 + 24 * (1 - prog)), int(48 + 28 * (1 - prog)), 255)
        d.line([(0, y), (w, y)], fill=col)

    # 2. Piso pulido
    for y in range(horizon_y, h):
        prog = (y - horizon_y) / max(1, h - horizon_y)
        col = (int(22 + 30 * prog), int(28 + 36 * prog), int(36 + 42 * prog), 255)
        d.line([(0, y), (w, y)], fill=col)

    # 3. Líneas de fuga
    for i in range(12):
        t = i / 12.0
        lx0 = int(vanish_x * t)
        d.line([(vanish_x, horizon_y), (lx0, 0)], fill=(45, 55, 70, 120), width=2)
        d.line([(vanish_x, horizon_y), (lx0, h)], fill=(35, 45, 58, 140), width=2)
        rx0 = int(vanish_x + (w - vanish_x) * (1 - t))
        d.line([(vanish_x, horizon_y), (rx0, 0)], fill=(45, 55, 70, 120), width=2)
        d.line([(vanish_x, horizon_y), (rx0, h)], fill=(35, 45, 58, 140), width=2)

    # 4. Franja verde institucional IMSS
    for step in range(30):
        frac = step / 30.0
        p_x = int(vanish_x * (1 - frac * 0.8))
        p_y = int(horizon_y + (h * 0.05) * frac)
        w_bar = max(4, int(24 * frac))
        d.rectangle([p_x - w_bar, p_y, p_x, p_y + int(14 * frac)], fill=(11, 79, 55, int(180 * frac)))
        p_xr = int(vanish_x + (w - vanish_x) * (frac * 0.8))
        d.rectangle([p_xr, p_y, p_xr + w_bar, p_y + int(14 * frac)], fill=(11, 79, 55, int(180 * frac)))

    # 5. Plafones de luz
    for k in range(1, 8):
        frac = (k / 8.0) ** 1.8
        ly = int(horizon_y * (1 - frac))
        lw = int(w * 0.18 * frac)
        lh = max(3, int(12 * frac))
        lx = vanish_x - lw // 2
        d.rounded_rectangle([lx, ly, lx + lw, ly + lh], radius=lh // 2, fill=(220, 240, 255, int(160 * frac)))

    blurred = img.filter(ImageFilter.GaussianBlur(radius=max(1, int(w * 0.003))))

    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay, "RGBA")
    cx, cy = w // 2, h // 2
    for r_step in range(15):
        r_frac = (r_step + 1) / 15.0
        alpha = int(140 * (r_frac ** 2.2))
        rad_x = int(cx + (w * 0.5) * r_frac)
        rad_y = int(cy + (h * 0.5) * r_frac)
        od.ellipse([cx - rad_x, cy - rad_y, cx + rad_x, cy + rad_y], outline=(8, 12, 18, alpha), width=int(w * 0.03))

    out = Image.alpha_composite(blurred, overlay)
    return out.convert("RGB")


def create_administrative_office(w: int, h: int) -> Image.Image:
    """Crea una escena documental de oficina administrativa / recursos humanos IMSS."""
    img = Image.new("RGBA", (w, h), (24, 28, 36, 255))
    d = ImageDraw.Draw(img, "RGBA")

    for y in range(int(h * 0.65)):
        prog = y / max(1, h * 0.65)
        col = (int(38 + 15 * prog), int(44 + 18 * prog), int(54 + 20 * prog), 255)
        d.line([(0, y), (w, y)], fill=col)

    desk_y = int(h * 0.58)
    for y in range(desk_y, h):
        prog = (y - desk_y) / max(1, h - desk_y)
        col = (int(42 - 12 * prog), int(34 - 10 * prog), int(28 - 8 * prog), 255)
        d.line([(0, y), (w, y)], fill=col)

    d.line([(0, desk_y), (w, desk_y)], fill=(120, 100, 85, 200), width=3)

    mon_x = int(w * 0.58)
    mon_w = int(w * 0.34)
    mon_h = int(h * 0.38)
    mon_y = desk_y - mon_h + int(h * 0.05)
    d.rounded_rectangle([mon_x, mon_y, mon_x + mon_w, mon_y + mon_h], radius=12, fill=(18, 20, 24, 255), outline=(60, 65, 75, 220), width=3)
    d.rounded_rectangle([mon_x + 12, mon_y + 12, mon_x + mon_w - 12, mon_y + mon_h - 24], radius=6, fill=(16, 32, 42, 255))
    d.rectangle([mon_x + 20, mon_y + 20, mon_x + mon_w - 20, mon_y + 35], fill=(11, 79, 55, 220))

    f_x0 = int(w * 0.08)
    for i in range(4):
        fy = desk_y - int(h * 0.04) + i * int(h * 0.02)
        fw = int(w * 0.28)
        fh = int(h * 0.08)
        col = (11, 79, 55, 230) if i % 2 == 0 else (188, 149, 92, 230)
        d.rounded_rectangle([f_x0 + i * 8, fy, f_x0 + fw + i * 8, fy + fh], radius=4, fill=col, outline=(30, 40, 35, 200), width=2)
        d.rectangle([f_x0 + i * 8 + int(fw * 0.6), fy + 4, f_x0 + fw + i * 8 - 10, fy + fh - 4], fill=(240, 244, 248, 220))

    px = int(w * 0.42)
    d.rounded_rectangle([px, desk_y - int(h * 0.12), px + int(w * 0.05), desk_y + 5], radius=6, fill=(50, 55, 65, 240))
    d.line([px + 10, desk_y - int(h * 0.18), px + 15, desk_y], fill=(180, 190, 200, 255), width=4)
    d.line([px + 25, desk_y - int(h * 0.16), px + 28, desk_y], fill=(11, 79, 55, 255), width=4)

    blurred = img.filter(ImageFilter.GaussianBlur(radius=max(1, int(w * 0.002))))

    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay, "RGBA")
    cx, cy = w // 2, h // 2
    for r_step in range(12):
        r_frac = (r_step + 1) / 12.0
        alpha = int(120 * (r_frac ** 2.0))
        rad_x = int(cx + (w * 0.5) * r_frac)
        rad_y = int(cy + (h * 0.5) * r_frac)
        od.ellipse([cx - rad_x, cy - rad_y, cx + rad_x, cy + rad_y], outline=(6, 8, 12, alpha), width=int(w * 0.03))

    out = Image.alpha_composite(blurred, overlay)
    return out.convert("RGB")


def create_worker_reviewing_payslip(w: int, h: int) -> Image.Image:
    """Crea una vista documental en primer plano de un escritorio con un tarjetón IMSS abierto."""
    img = Image.new("RGBA", (w, h), (26, 32, 40, 255))
    d = ImageDraw.Draw(img, "RGBA")

    for y in range(h):
        prog = y / max(1, h)
        col = (int(36 - 10 * prog), int(42 - 12 * prog), int(50 - 14 * prog), 255)
        d.line([(0, y), (w, y)], fill=col)

    doc_x0 = int(w * 0.15)
    doc_y0 = int(h * 0.12)
    doc_w = int(w * 0.70)
    doc_h = int(h * 0.76)

    d.rounded_rectangle([doc_x0 + 8, doc_y0 + 12, doc_x0 + doc_w + 8, doc_y0 + doc_h + 12], radius=6, fill=(10, 14, 20, 180))
    d.rounded_rectangle([doc_x0, doc_y0, doc_x0 + doc_w, doc_y0 + doc_h], radius=6, fill=(248, 250, 252, 255), outline=(203, 213, 225, 255), width=2)

    d.rectangle([doc_x0 + 16, doc_y0 + 16, doc_x0 + doc_w - 16, doc_y0 + int(doc_h * 0.12)], fill=(11, 79, 55, 255))
    for row in range(3):
        ry = doc_y0 + int(doc_h * 0.16) + row * int(doc_h * 0.04)
        d.rectangle([doc_x0 + 24, ry, doc_x0 + int(doc_w * 0.45), ry + int(doc_h * 0.02)], fill=(226, 232, 240, 255))
        d.rectangle([doc_x0 + int(doc_w * 0.52), ry, doc_x0 + doc_w - 24, ry + int(doc_h * 0.02)], fill=(226, 232, 240, 255))

    table_y = doc_y0 + int(doc_h * 0.32)
    for r in range(7):
        curr_y = table_y + r * int(doc_h * 0.075)
        if r == 1:
            d.rectangle([doc_x0 + 20, curr_y - 2, doc_x0 + doc_w - 20, curr_y + int(doc_h * 0.055)], fill=(254, 240, 138, 200))
        elif r == 3:
            d.rectangle([doc_x0 + 20, curr_y - 2, doc_x0 + doc_w - 20, curr_y + int(doc_h * 0.055)], fill=(224, 231, 255, 200))

        d.rectangle([doc_x0 + 24, curr_y + 4, doc_x0 + int(doc_w * 0.32), curr_y + int(doc_h * 0.035)], fill=(71, 85, 105, 255))
        d.rectangle([doc_x0 + int(doc_w * 0.38), curr_y + 4, doc_x0 + int(doc_w * 0.65), curr_y + int(doc_h * 0.035)], fill=(148, 163, 184, 255))
        d.rectangle([doc_x0 + int(doc_w * 0.72), curr_y + 4, doc_x0 + doc_w - 28, curr_y + int(doc_h * 0.035)], fill=(30, 41, 59, 255))

    badge_x = doc_x0 - int(w * 0.05)
    badge_y = doc_y0 + int(doc_h * 0.70)
    badge_w = int(w * 0.22)
    badge_h = int(h * 0.24)
    d.rounded_rectangle([badge_x + 6, badge_y + 8, badge_x + badge_w + 6, badge_y + badge_h + 8], radius=8, fill=(10, 14, 20, 140))
    d.rounded_rectangle([badge_x, badge_y, badge_x + badge_w, badge_y + badge_h], radius=8, fill=(241, 245, 249, 255), outline=(148, 163, 184, 255), width=2)
    d.rectangle([badge_x + 8, badge_y + 8, badge_x + badge_w - 8, badge_y + int(badge_h * 0.24)], fill=(11, 79, 55, 255))

    pen_x = doc_x0 + int(doc_w * 0.75)
    pen_y = doc_y0 + int(doc_h * 0.25)
    d.line([(pen_x, pen_y), (pen_x + int(w * 0.12), pen_y + int(h * 0.40))], fill=(30, 41, 59, 255), width=8)
    d.line([(pen_x + 2, pen_y + 2), (pen_x + int(w * 0.12) + 2, pen_y + int(h * 0.40) + 2)], fill=(203, 213, 225, 255), width=3)

    blurred = img.filter(ImageFilter.GaussianBlur(radius=max(1, int(w * 0.0015))))

    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay, "RGBA")
    cx, cy = w // 2, h // 2
    for r_step in range(12):
        r_frac = (r_step + 1) / 12.0
        alpha = int(110 * (r_frac ** 2.0))
        rad_x = int(cx + (w * 0.5) * r_frac)
        rad_y = int(cy + (h * 0.5) * r_frac)
        od.ellipse([cx - rad_x, cy - rad_y, cx + rad_x, cy + rad_y], outline=(8, 12, 16, alpha), width=int(w * 0.025))

    out = Image.alpha_composite(blurred, overlay)
    return out.convert("RGB")


def create_worker_reviewing_document(w: int, h: int) -> Image.Image:
    """Crea una vista documental de estudio normativo (CCT / LFT sobre escritorio)."""
    img = Image.new("RGBA", (w, h), (30, 34, 44, 255))
    d = ImageDraw.Draw(img, "RGBA")

    for y in range(h):
        prog = y / max(1, h)
        col = (int(48 - 14 * prog), int(40 - 12 * prog), int(34 - 10 * prog), 255)
        d.line([(0, y), (w, y)], fill=col)

    book_x0 = int(w * 0.16)
    book_y0 = int(h * 0.15)
    book_w = int(w * 0.68)
    book_h = int(h * 0.72)

    d.rounded_rectangle([book_x0 + 10, book_y0 + 14, book_x0 + book_w + 10, book_y0 + book_h + 14], radius=8, fill=(12, 16, 22, 160))
    mid_x = book_x0 + book_w // 2
    d.rectangle([book_x0, book_y0, mid_x - 2, book_y0 + book_h], fill=(245, 247, 250, 255))
    d.rectangle([mid_x + 2, book_y0, book_x0 + book_w, book_y0 + book_h], fill=(240, 243, 246, 255))
    d.line([(mid_x, book_y0), (mid_x, book_y0 + book_h)], fill=(148, 163, 184, 180), width=4)

    for side, sx in [(0, book_x0 + 20), (1, mid_x + 20)]:
        sw = (mid_x - book_x0) - 40
        d.rectangle([sx, book_y0 + 24, sx + int(sw * 0.6), book_y0 + 38], fill=(11, 79, 55, 230))
        for p in range(8):
            py = book_y0 + 56 + p * int(book_h * 0.075)
            if side == 1 and p in (2, 3):
                d.rectangle([sx - 4, py - 2, sx + sw + 4, py + 18], fill=(254, 240, 138, 210))
            d.rectangle([sx, py, sx + sw - (p * 12 % 30), py + 12], fill=(71, 85, 105, 240))

    gx = book_x0 + int(book_w * 0.18)
    gy = book_y0 + int(book_h * 0.55)
    gw = int(w * 0.08)
    d.ellipse([gx, gy, gx + gw, gy + gw // 2], outline=(30, 41, 59, 240), width=3)
    d.ellipse([gx + gw + 10, gy, gx + gw * 2 + 10, gy + gw // 2], outline=(30, 41, 59, 240), width=3)
    d.line([(gx + gw, gy + gw // 4), (gx + gw + 10, gy + gw // 4)], fill=(30, 41, 59, 240), width=3)

    blurred = img.filter(ImageFilter.GaussianBlur(radius=max(1, int(w * 0.0018))))

    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay, "RGBA")
    cx, cy = w // 2, h // 2
    for r_step in range(12):
        r_frac = (r_step + 1) / 12.0
        alpha = int(120 * (r_frac ** 2.0))
        rad_x = int(cx + (w * 0.5) * r_frac)
        rad_y = int(cy + (h * 0.5) * r_frac)
        od.ellipse([cx - rad_x, cy - rad_y, cx + rad_x, cy + rad_y], outline=(6, 8, 12, alpha), width=int(w * 0.025))

    out = Image.alpha_composite(blurred, overlay)
    return out.convert("RGB")


def main():
    specs = [
        ("hospital_corridor", create_hospital_corridor),
        ("administrative_office_imss", create_administrative_office),
        ("worker_reviewing_payslip", create_worker_reviewing_payslip),
        ("worker_reviewing_document", create_worker_reviewing_document),
    ]

    for name, gen_fn in specs:
        p16x9 = OUTPUT_DIR / f"{name}.webp"
        im16 = gen_fn(1920, 1080)
        im16.save(p16x9, "WEBP", quality=90)
        print(f"Generated 16:9: {p16x9}")

        p9x16 = OUTPUT_DIR / f"{name}_9x16.webp"
        im9 = gen_fn(1080, 1920)
        im9.save(p9x16, "WEBP", quality=90)
        print(f"Generated 9:16: {p9x16}")

    print("All context assets generated successfully!")


if __name__ == "__main__":
    main()
