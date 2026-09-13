"""Sistema de movimiento V1.2: tres capas + reactividad real + stage + métricas.

A. Ambient  — lento, independiente de voz (escala 1-3 %, drift 4-20 px).
B. Speech   — reacciona al envelope del WAV con attack/release (sin jitter).
C. Semantic — por intención; cuando es fuerte, Ambient se calma.

ConversationStage conserva la geometría del speaker anterior como memoria
espacial (10-20 % de presencia), evitando efecto "diapositiva".
EditorialVisualInterpreter deriva conceptos del display_text (sin inventar).
"""
from __future__ import annotations

import math
import re


# --------------------------------------------------------------------------
# B. AudioReactiveIdentity
# --------------------------------------------------------------------------
class AudioReactiveIdentity:
    """Suaviza el envelope con attack rápido y release lento. No mapea RMS
    directo: produce un valor estable en [0,1] que modula la identidad.

    V1.3: amplitud perceptiva mayor (antes era demasiado sutil)."""

    def __init__(self, attack: float = 0.5, release: float = 0.07) -> None:
        self.attack = attack
        self.release = release
        self.value = 0.0
        self.prev = 0.0

    def update(self, env_sample: float, energy: float = 0.5) -> float:
        target = max(0.0, min(1.0, float(env_sample) * (0.6 + 0.4 * float(energy))))
        a = self.attack if target > self.value else self.release
        self.value += a * (target - self.value)
        self.prev = target
        return self.value

    def delta(self, shape: str, energy: float = 0.5, base: float = 0.0) -> dict:
        """Cambio geométrico perceptible, por personaje (V1.3 amplitudes).

        circles ±2-4 % del radio; curves ±8-18 px; grid ±5-10 %;
        bars ±6-14 px. `base` es el tamaño nominal para calcular porcentajes."""
        v = self.value
        e = max(0.0, min(1.0, float(energy)))
        amp = v * (0.5 + 0.5 * e)
        if shape == "circles":
            pct = 0.02 + 0.02 * amp  # 2-4 %
            px = (base or 200) * pct
            return {"radius_px": 2.0 + px, "stroke_delta": 0.8 * amp}
        if shape == "curves":
            return {"amplitude_px": 8.0 + 10.0 * amp, "stroke_delta": 1.0 * amp}
        if shape == "grid":
            pct = 0.05 + 0.05 * amp  # 5-10 %
            px = (base or 160) * pct
            return {"length_px": 5.0 + px, "stroke_delta": 0.8 * amp}
        if shape == "bars":
            return {"separation_px": 6.0 + 8.0 * amp, "height_px": 8.0 + 12.0 * amp}
        return {"radius_px": 2.0 + 8.0 * amp, "stroke_delta": 0.6 * amp}


# --------------------------------------------------------------------------
# A. AmbientMotionLayer
# --------------------------------------------------------------------------
class AmbientMotionLayer:
    """2-4 elementos grandes y sutiles. No depende de texto. Bajo costo.

    V1.4: sin metrónomo. El único acento extra lo dispara el discurso
    (`pulse`) en un cambio de speaker o de concepto; decae en ~12 frames.
    """

    def __init__(self) -> None:
        self.boost = 0.0

    def pulse(self, strength: float = 1.0) -> None:
        """Acento ambiental disparado por un evento semántico, no por tiempo."""
        self.boost = min(1.0, self.boost + strength)

    def step(self) -> None:
        self.boost *= 0.82

    def draw(self, d, f: int, fps: int, energy: float, shape: str,
             accent: tuple, reduced: bool, semantic_strong: bool) -> None:
        W, H = d._image.size if hasattr(d, "_image") else (0, 0)
        if W == 0:
            return
        # Cuando Semantic domina, Ambient se calma (0.35x).
        calm = 0.35 if semantic_strong else 1.0
        ms = (0.15 if reduced else (0.25 + 0.75 * _smoothstep(energy))) * calm
        ms *= (1.0 + 0.5 * self.boost)
        if ms <= 0.02:
            return
        t = f / fps
        cx, cy = W * 0.5, H * 0.42
        # V1.3: opacidad mayor para que el movimiento se perciba.
        dim = tuple(max(22, int(c * 0.58)) for c in accent)
        drift = int(10 + 22 * ms)
        # V1.3: ciclos parciales cada ~2-4 s (antes 12-25 s), sin loop evidente.
        if shape == "circles":
            for k in range(3):
                ph = (t * 0.22 + k / 3.0) % 1.0
                r = min(W, H) * (0.16 + 0.24 * ph)
                dx = int(drift * math.sin(2 * math.pi * (t * 0.28 + k / 3)))
                d.ellipse([cx - r + dx, cy - r, cx + r + dx, cy + r],
                          outline=dim, width=2)
        elif shape == "curves":
            for k in range(3):
                off = int((10 + 12 * ms) * math.sin(2 * math.pi * 0.30 * t + k * 1.7))
                d.arc([-W * 0.15, cy - 200 + off + k * 120,
                       W * 1.15, cy + 200 + off + k * 120],
                      200, 340, fill=dim, width=3)
        elif shape == "grid":
            step = 110
            shift = int(drift * math.sin(2 * math.pi * 0.30 * t))
            for gx in range(-step, W + step, step):
                d.line([gx + shift, 0, gx + shift, H], fill=(23, 26, 36), width=1)
            for gy in range(-step, H + step, step):
                d.line([0, gy, W, gy], fill=(21, 24, 33), width=1)
        elif shape == "bars":
            w = 10 + int(6 * ms)
            dx = int(drift * math.sin(2 * math.pi * 0.30 * t))
            d.rectangle([dx, 0, dx + w, H], fill=dim)
            d.rectangle([W - w - dx, 0, W - dx, H], fill=dim)
        # V1.4: sin barrido periódico global. El movimiento ambiental solo
        # reacciona a la identidad/audio; los eventos provienen del discurso
        # (ver Renderer._semantic_event), nunca del paso del tiempo.


def _smoothstep(e: float) -> float:
    e = max(0.0, min(1.0, e))
    return e * e * (3 - 2 * e)


def ease_out_cubic(t: float) -> float:
    """Llegada rápida y asentamiento (V1.3)."""
    t = max(0.0, min(1.0, t))
    return 1 - (1 - t) ** 3


def transition_frames(ev: dict, prev_ev: dict | None) -> int:
    """Frames de transición por tipo (V1.3, 30 fps):
    reaction 4-6 · handoff 6-9 · question 6-10 · focus 8-12 · section 12-16."""
    kind = (ev.get("scene_type") or "conversation").lower()
    intent = (ev.get("intent") or "statement").lower()
    density = (ev.get("density") or "normal").lower()
    if ev.get("section") or kind in ("brand", "closing"):
        return 14
    if kind == "reaction" or intent in ("reaction", "agreement"):
        return 5
    if kind == "question":
        return 8
    if kind in ("warning", "number", "document", "quote") or density in ("focus", "impact"):
        return 10
    if prev_ev and prev_ev.get("speaker") == ev.get("speaker"):
        return 6
    return 8  # handoff normal (200-300 ms)


# Alias de compatibilidad con el nombre solicitado en la especificación.
PerceptualVisualEvent = dict


# --------------------------------------------------------------------------
# ConversationStage
# --------------------------------------------------------------------------
class ConversationStage:
    """Memoria espacial: mantiene la identidad anterior a baja presencia
    (10-20 %) y la desvanece. Nunca más de dos identidades activas."""

    def __init__(self, fade_frames: int = 8) -> None:
        # V1.3: 6-9 frames (200-300 ms), no 18. La identidad anterior se
        # desvanece rápido; el nuevo speaker toma dominio visual antes.
        self.fade_frames = max(1, fade_frames)
        self.prev_shape: str | None = None
        self.prev_accent: tuple | None = None
        self.age = self.fade_frames  # frames desde el cambio

    def notify(self, shape: str, accent: tuple) -> None:
        if shape != self.prev_shape:
            self.prev_shape = shape
            self.prev_accent = accent
            self.age = 0

    def step(self) -> None:
        if self.age < self.fade_frames:
            self.age += 1

    def presence(self) -> float:
        """1.0 inmediato -> 0.0 al terminar el fade. Máximo 20 %."""
        if self.prev_shape is None:
            return 0.0
        k = 1.0 - min(1.0, self.age / self.fade_frames)
        return 0.20 * k


# --------------------------------------------------------------------------
# C. Semantic + EditorialVisualInterpreter
# --------------------------------------------------------------------------
# Léxico de conceptos de dominio: si el texto menciona estos, son candidatos
# fuertes de resumen (el "objeto" de una proposición editorial).
DOMAIN_CONCEPTS = {
    "fecha", "fundamento", "plazo", "folio", "comprobante", "recibo",
    "contrato", "cláusula", "clausula", "procedimiento", "requisito",
    "documento", "evidencia", "prueba", "movimiento", "monto", "presupuesto",
    "cifra", "número", "numero", "dato", "dato", "registro", "expediente",
    "solicitud", "respuesta", "acuerdo", "cambio", "versión", "version",
    "origen", "fuente", "rumor", "versión oficial", "comunicado",
    "datos", "fechas", "montos", "cifras", "documentos", "recibos",
    "contratos", "cláusulas", "clausulas", "comprobantes",
}


class EditorialVisualInterpreter:
    """V1.4: interpretación editorial con importancia semántica.

    No elige "las primeras palabras largas". Extrae el OBJETO de la
    proposición (sintagmas encabezados por artículo: 'la fecha del
    movimiento', 'el fundamento'), prioriza el léxico de dominio y usa
    emphasis_words si el guion ya las produjo. Nunca inventa texto: todo
    token proviene literalmente de display_text.
    """

    STOP = {"que", "los", "las", "el", "la", "un", "una", "unos", "unas",
            "para", "con", "sin", "por", "como", "esto", "esta", "este",
            "pero", "porque", "cuando", "donde", "hasta", "desde", "sobre",
            "entre", "ante", "todo", "todos", "toda", "todas", "cada", "más",
            "muy", "tan", "así", "ahí", "hay", "ser", "está", "están", "son",
            "del", "de", "al", "nos", "hacer", "hace", "hacia", "según",
            "segun", "tiene", "tienen"}

    _ARTICLE = r"\b(?:el|la|los|las|un|una|unos|unas)\b"
    _NOUN = r"([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{4,})"

    def interpret(self, ev: dict) -> dict:
        """Devuelve {states:[{lines,at,emphasis}], concepts, derived,
        preservation}. `at` = fracción del beat (0-1). El renderer muestra
        el último estado cuyo `at` <= progreso, dentro de la MISMA composición.
        """
        text = ev.get("display_text") or ""
        intent = (ev.get("intent") or "statement").lower()
        scene = ev.get("scene_type") or "conversation"
        if scene in ("number", "brand", "closing", "question", "reaction", "quote"):
            return {"states": [], "concepts": [], "derived": False,
                    "preservation": {"ok": True, "issues": []}}
        concepts = self._concepts(text, ev.get("emphasis_words"))
        states: list[dict] = []
        if intent == "warning":
            states = self._warning_states(text, concepts)
        elif scene in ("explanation", "clarification", "summary") and len(concepts) >= 2:
            steps = concepts[:3]
            n = len(steps)
            states = [{"lines": [f"{i+1}  {c.upper()}"], "at": i / max(1, n),
                       "emphasis": [c.upper()]} for i, c in enumerate(steps)]
        if not states:
            return {"states": [], "concepts": concepts, "derived": False,
                    "preservation": {"ok": True, "issues": []}}
        self._drop_redundant(states)
        return {"states": states, "concepts": concepts, "derived": True,
                "preservation": editorial_meaning_preservation(ev, states)}

    def _warning_states(self, text: str, concepts: list[str]) -> list[dict]:
        """'ANTES DE X' (literal) → 'A + B' (objetos de la proposición) →
        'SIN ESO → CONSECUENCIA' (literal)."""
        low = text.lower()
        states: list[dict] = []
        s1 = self._lead_in(text)
        cset = {c.upper() for c in concepts}
        s1_toks = {w.upper().strip(".,;:") for w in s1.split()}
        # La entrada no debe duplicar un concepto del estado central.
        if s1 and not (s1_toks & cset):
            states.append({"lines": [s1.upper()], "at": 0.0, "emphasis": []})
        if len(concepts) >= 2:
            states.append({"lines": [concepts[0].upper(), "+",
                                     concepts[1].upper()], "at": 0.4,
                           "emphasis": [concepts[0].upper(), concepts[1].upper()]})
        m = re.search(r"(sin\s+(?:eso|ello|datos))", low)
        if m:
            head = m.group(1).strip().upper()
            tail = self._conclusion(low)
            lines = [head] + ([f"→ {tail}"] if tail else [])
            states.append({"lines": lines, "at": 0.72,
                           "emphasis": [tail] if tail else []})
        return states

    def _conclusion(self, low: str) -> str:
        """Consecuencia literal al cierre (p. ej. 'puro rumor' → 'RUMOR')."""
        m = re.search(r"(?:puro|pura|solo|sólo|mero|mera)\s+([a-záéíóúüñ]{4,})", low)
        if m and m.group(1).lower() not in self.STOP:
            return m.group(1).upper()
        m = re.search(r"\b(rumor|mentira|falso|error|problema)\b", low)
        return m.group(1).upper() if m else ""

    def _concepts(self, text: str, emphasis_words=None) -> list[str]:
        """Objetos de la proposición, en orden de importancia.

        1) emphasis_words provistas por el guion/dirección (si son literales).
        2) sintagmas 'el/la <sustantivo> [del/de la <sustantivo>]' → cabeza.
        3) el léxico de dominio tiene prioridad sobre otros sustantivos.
        """
        if not text:
            return []
        # (tier, orden, palabra): tier 0 = metadata; 1 = objeto con artículo;
        # 2 = término de dominio sin artículo. Orden = aparición en el texto.
        cands: list[tuple[int, int, str]] = []
        # 0) metadata explícita del guion/dirección.
        if emphasis_words:
            for i, w in enumerate(emphasis_words):
                w = str(w).strip()
                if w and re.search(re.escape(w), text, re.IGNORECASE):
                    cands.append((0, i, w))
        # 1) sintagmas 'el/la <sustantivo>' -> cabeza del sintagma.
        for m in re.finditer(self._ARTICLE + r"\s+" + self._NOUN, text,
                             re.IGNORECASE):
            head = m.group(1)
            if head.lower() not in self.STOP:
                cands.append((1, m.start(), head))
        # 2) términos del léxico de dominio sin artículo ('qué fecha', etc.).
        for m in re.finditer(r"[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{4,}", text):
            w = m.group(0)
            if w.lower() in DOMAIN_CONCEPTS:
                cands.append((2, m.start(), w))
        # Dentro del mismo tier, el léxico de dominio va antes (conserva orden).
        cands.sort(key=lambda c: (c[0], 0 if c[2].lower() in DOMAIN_CONCEPTS else 1,
                                  c[1]))
        out: list[str] = []
        for _, _, w in cands:
            self._push(out, w)
            if len(out) >= 3:
                break
        return out

    @staticmethod
    def _push(out: list[str], word: str) -> None:
        if word not in out and word.lower() not in EditorialVisualInterpreter.STOP:
            out.append(word)

    @staticmethod
    def _drop_redundant(states: list[dict]) -> None:
        """El remate (último estado) no repite tokens ya mostrados antes
        (p. ej. 'PURO RUMOR' → RUMOR si RUMOR ya se destacó). No toca los
        estados conceptuales intermedios."""
        if len(states) < 2:
            return
        seen: set[str] = set()
        for st in states[:-1]:
            for line in st["lines"]:
                for t in line.replace("→", " ").replace("+", " ").split():
                    seen.add(t.upper())
        last = states[-1]
        new_lines: list[str] = []
        for line in last["lines"]:
            if line in ("+", "→"):
                new_lines.append(line)
                continue
            toks = line.replace("→", " ").split()
            keep = [t for t in toks if t.upper() not in seen]
            if not keep:
                continue
            new_lines.append(("→ " if "→" in line else "") + " ".join(keep))
        if new_lines:
            last["lines"] = new_lines
            joined = " ".join(new_lines).upper()
            last["emphasis"] = [e for e in last.get("emphasis", [])
                                if e.upper() in joined]

    def _lead_in(self, text: str) -> str:
        """Frase de entrada, corta: 'antes de <verbo>' o primeras ≤4 palabras.
        Nunca toma la proposición completa (evita estados kilométricos)."""
        m = re.match(r"\s*(antes\s+de\s+\w+)", text or "", re.IGNORECASE)
        if m:
            return m.group(1).strip()
        first = re.split(r"[.!?…]", (text or "").strip(), maxsplit=1)[0]
        words = first.split()[:4]
        while words and words[-1].lower().rstrip(".,;:") in self.STOP:
            words.pop()
        return " ".join(words) if len(words) >= 2 else ""


def editorial_meaning_preservation(ev: dict, states: list[dict]) -> dict:
    """Valida que el resumen conserve la proposición central.

    - Todos los tokens derivan literalmente de display_text.
    - Hay al menos un estado conceptual (objeto) y no solo frases sueltas.
    - Si la fuente tiene contraste ('sin eso', 'pero', 'aunque'), el visual
      también lo representa.
    - Sin tokens duplicados entre estados (no redundancia).
    """
    text = (ev.get("display_text") or "").upper()
    issues: list[str] = []
    toks: list[str] = []
    for st in states:
        for line in st["lines"]:
            for t in line.replace("→", " ").replace("+", " ").split():
                if len(t) >= 4 and t.isalpha():
                    toks.append(t)
    for t in toks:
        if t not in text:
            issues.append(f"token no literal: {t}")
    low = text.lower()
    if any(k in low for k in ("sin eso", "pero", "aunque", "en cambio")):
        if not any("SIN ESO" in " ".join(s["lines"]).upper()
                   or "→" in " ".join(s["lines"]) for s in states):
            issues.append("contraste de la fuente no representado")
    if len(set(toks)) != len(toks):
        issues.append("redundancia entre estados")
    return {"ok": not issues, "issues": issues, "tokens": toks}


# --------------------------------------------------------------------------
# Métricas QC
# --------------------------------------------------------------------------
def audio_visual_response_score(env_window: list[float],
                                reactive_window: list[float]) -> float:
    """Correlación de Pearson entre envelope suavizado y parámetro reactivo
    sobre la región reactiva. Positiva clara = identidad responde al audio."""
    n = min(len(env_window), len(reactive_window))
    if n < 4:
        return 0.0
    a = env_window[:n]
    b = reactive_window[:n]
    ma, mb = sum(a) / n, sum(b) / n
    num = sum((x - ma) * (y - mb) for x, y in zip(a, b))
    da = math.sqrt(sum((x - ma) ** 2 for x in a))
    db = math.sqrt(sum((y - mb) ** 2 for y in b))
    if da < 1e-9 or db < 1e-9:
        return 0.0
    return max(-1.0, min(1.0, num / (da * db)))


def _frame_change(a, b, px_threshold: int = 6, block: int = 12,
                  cell_frac: float = 0.15) -> float:
    """Fracción de CELDAS con cambio localizado.

    V1.4: la fracción global de píxeles no detecta elementos pequeños
    (un nodo de identidad ocupa ~0.03 % del frame). Al normalizar por
    celdas de ~12 px, un elemento localizado que aparece o late cuenta
    como cambio perceptible; el ruido global uniforme no."""
    import numpy as np
    a = np.asarray(a, dtype=np.int16)
    b = np.asarray(b, dtype=np.int16)
    changed = np.abs(b - a) > px_threshold
    h, w = changed.shape
    bh, bw = max(1, h // block), max(1, w // block)
    hits = 0
    total = 0
    for by in range(bh):
        for bx in range(bw):
            cell = changed[by * block:(by + 1) * block,
                           bx * block:(bx + 1) * block]
            if cell.size == 0:
                continue
            total += 1
            if cell.mean() >= cell_frac:
                hits += 1
    return hits / max(1, total)


def perceptual_motion_score(frames: list, min_px_frac: float = 0.004) -> float:
    """Movimiento PERCEPTIBLE (no técnico): fracción de transiciones con
    cambio localizado suficiente. Detecta 'se mueve pero parece congelado'.

    frames: lista de arrays 2D (gris) en miniatura, uno por muestra temporal.
    """
    if len(frames) < 2:
        return 0.0
    changes = [_frame_change(frames[i - 1], frames[i]) for i in range(1, len(frames))]
    visible = sum(1 for d in changes if d >= min_px_frac) / len(changes)
    magnitude = min(1.0, (sum(changes) / len(changes)) / 0.05)
    return round(0.6 * visible + 0.4 * magnitude, 3)


def max_perceptual_hold_seconds(frames: list, fps_sample: float,
                                min_px_frac: float = 0.004) -> float:
    """Mayor tiempo (s) sin cambio perceptible entre frames muestreados.

    fps_sample = fps reales por muestra (p. ej. 10 si se muestrea cada 3 frames
    a 30 fps)."""
    if len(frames) < 2:
        return 0.0
    longest = 0
    run = 0
    for i in range(1, len(frames)):
        if _frame_change(frames[i - 1], frames[i]) < min_px_frac:
            run += 1
            longest = max(longest, run)
        else:
            run = 0
    return round(longest / max(fps_sample, 1e-6), 2)


def motion_coverage(samples: list[float], threshold: float = 0.02) -> float:
    """Fracción de ventanas de ~500 ms con cambio visual perceptible.

    samples: serie temporal del parámetro reactivo (una muestra por frame o
    por bloque). threshold: cambio mínimo normalizado para contar como vida."""
    if len(samples) < 2:
        return 0.0
    # Agrupa en ventanas de ~0.5 s (15 frames @30fps) si la serie es por frame.
    win = 15 if len(samples) > 60 else max(1, len(samples) // 8)
    covered = 0
    total = 0
    for i in range(win, len(samples), win):
        total += 1
        if abs(samples[i] - samples[i - win]) >= threshold:
            covered += 1
    if total == 0:
        # Serie corta: mide variación global.
        return 1.0 if (max(samples) - min(samples)) >= threshold else 0.0
    return covered / total
