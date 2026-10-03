"""Pruebas de Generalización Multi-Episodio para la Dirección Visual Documental.

Garantiza que el VisualEditorialPlanner funciona mediante EntityDetector,
intención semántica, contexto y referencias verificadas sin estar sobreajustado
ni depender de frases literales de ningún episodio en particular.

Valida 3 fixtures independientes:
- Fixture A: d5f1fc16 (Revisión Salarial, CCT 2025-2027, LFT, Tarjetón IMSS)
- Fixture B: Vacaciones IMSS (Solicitud de vacaciones, CCT, cómputo de días, oficinas de personal)
- Fixture C: Accidente de Trabajo (Riesgo de trabajo, Formato ST-7, LSS, HGR 1 Charo, Incapacidad 100%)
"""
import json
from pathlib import Path
import pytest

from app.visual.editorial import VisualEditorialPlanner, VisualPlan, EditorialMemory


@pytest.fixture
def fixture_a_salarios():
    root = Path(__file__).resolve().parents[3]
    project_dir = root / "data" / "projects" / "d5f1fc16"
    if not (project_dir / "script.json").exists() or not (project_dir / "timeline-alignment.json").exists():
        pytest.skip("Archivos del episodio d5f1fc16 no disponibles")

    script = json.loads((project_dir / "script.json").read_text(encoding="utf-8"))
    turns = script.get("turns") or [t for s in script.get("scenes", []) for t in s.get("turns", [])]
    alignment = json.loads((project_dir / "timeline-alignment.json").read_text(encoding="utf-8"))
    duration_s = (alignment.get("durationMs") or 735969) / 1000.0
    return turns, alignment, duration_s


@pytest.fixture
def fixture_b_vacaciones():
    """Guion realista sobre disfrute de vacaciones, prima vacacional y cómputo de días en el IMSS."""
    turns = [
        {
            "id": "turn-vac-1",
            "speaker": "Eduardo",
            "displayText": "Bienvenidos a La Veinte Radio. Hoy analizamos el derecho a las vacaciones y el rol de programación anual para los trabajadores del IMSS.",
        },
        {
            "id": "turn-vac-2",
            "speaker": "Andrea",
            "displayText": "El Contrato Colectivo de Trabajo establece con precisión los periodos y los días hábiles a los que cada categoría tiene derecho según su antigüedad.",
        },
        {
            "id": "turn-vac-3",
            "speaker": "Eduardo",
            "displayText": "Hagamos un cálculo práctico de la prima vacacional: representa un porcentaje adicional sobre el sueldo tabular quincenal que se deposita antes de iniciar el periodo.",
        },
        {
            "id": "turn-vac-4",
            "speaker": "Valeria",
            "displayText": "El trámite debe registrarse formalmente ante las oficinas de personal y la jefatura de Recursos Humanos con la debida anticipación para respetar las sustituciones.",
        },
        {
            "id": "turn-vac-5",
            "speaker": "Rodrigo",
            "displayText": "La solicitud de vacaciones debe contener las firmas del trabajador y su representación sindical para evitar cambios arbitrarios en el calendario de servicio.",
        },
        {
            "id": "turn-vac-6",
            "speaker": "Eduardo",
            "displayText": "En La Veinte Digital defendemos el derecho al descanso digno y a cuentas claras en cada prestación.",
        },
    ]

    align_turns = [
        {"turnId": "turn-vac-1", "startMs": 4900, "endMs": 24000},
        {"turnId": "turn-vac-2", "startMs": 24200, "endMs": 45000},
        {"turnId": "turn-vac-3", "startMs": 45300, "endMs": 68000},
        {"turnId": "turn-vac-4", "startMs": 68200, "endMs": 88000},
        {"turnId": "turn-vac-5", "startMs": 88300, "endMs": 108000},
        {"turnId": "turn-vac-6", "startMs": 108200, "endMs": 120000},
    ]
    alignment = {"durationMs": 125000, "turns": align_turns}
    duration_s = 125.0
    return turns, alignment, duration_s


@pytest.fixture
def fixture_c_accidente():
    """Guion realista sobre riesgo de trabajo, formato ST-7 y atención en HGR 1 Charo."""
    turns = [
        {
            "id": "turn-acc-1",
            "speaker": "Eduardo",
            "displayText": "Saludos a todos. Hoy abordamos qué hacer ante un accidente de trabajo y cómo garantizar la calificación oportuna de tu riesgo laboral.",
        },
        {
            "id": "turn-acc-2",
            "speaker": "Andrea",
            "displayText": "El primer paso ante una contingencia en servicio o trayecto es acudir de inmediato al Hospital General Regional No. 1 Charo para recibir atención médica inicial.",
        },
        {
            "id": "turn-acc-3",
            "speaker": "Valeria",
            "displayText": "Es indispensable solicitar el formato ST-7 de aviso de atención médica inicial para que el área de Salud en el Trabajo inicie la investigación legal.",
        },
        {
            "id": "turn-acc-4",
            "speaker": "Rodrigo",
            "displayText": "La Ley del Seguro Social y la Ley Federal del Trabajo garantizan que un riesgo calificado como sí de trabajo otorga incapacidad temporal al 100% de salario base.",
        },
        {
            "id": "turn-acc-5",
            "speaker": "Eduardo",
            "displayText": "Ningún directivo puede obligarte a firmar una incapacidad por enfermedad general si las lesiones ocurrieron en cumplimiento de tu jornada.",
        },
        {
            "id": "turn-acc-6",
            "speaker": "Andrea",
            "displayText": "En La Veinte Radio la seguridad y la salud en el trabajo son derechos irrenunciables de toda la base trabajadora.",
        },
    ]

    align_turns = [
        {"turnId": "turn-acc-1", "startMs": 4900, "endMs": 25000},
        {"turnId": "turn-acc-2", "startMs": 25200, "endMs": 46000},
        {"turnId": "turn-acc-3", "startMs": 46300, "endMs": 68000},
        {"turnId": "turn-acc-4", "startMs": 68200, "endMs": 90000},
        {"turnId": "turn-acc-5", "startMs": 90300, "endMs": 110000},
        {"turnId": "turn-acc-6", "startMs": 110200, "endMs": 125000},
    ]
    alignment = {"durationMs": 130000, "turns": align_turns}
    duration_s = 130.0
    return turns, alignment, duration_s


def test_fixture_a_generalization(fixture_a_salarios):
    """Fixture A (d5f1fc16): salarios, CCT, LFT, tarjetón, SNTSS."""
    turns, alignment, duration_s = fixture_a_salarios
    planner = VisualEditorialPlanner()
    plan = planner.plan_project("d5f1fc16", turns, alignment, duration_s, direction="documental", text_mode="editorial")

    # 1. Suma exacta de mix al 100.0%
    mix = plan.visual_mix
    mix_sum = round(mix["locutor_pct"] + mix["evidencia_pct"] + mix["explicacion_pct"] + mix["contexto_pct"] + mix["brand_pct"], 1)
    assert mix_sum == 100.0, f"El mix visual debe sumar exactamente 100.0%, sumó {mix_sum}%"

    # 2. Rango documental equilibrado
    assert 40.0 <= mix["locutor_pct"] <= 55.0, f"Locutor {mix['locutor_pct']}% fuera de rango 40-55%"
    assert 20.0 <= mix["evidencia_pct"] <= 30.0, f"Evidencia {mix['evidencia_pct']}% fuera de rango 20-30%"
    assert 10.0 <= mix["explicacion_pct"] <= 25.0, f"Explicación {mix['explicacion_pct']}% fuera de rango"
    assert 5.0 <= mix["contexto_pct"] <= 20.0, f"Contexto {mix['contexto_pct']}% fuera de rango"

    # 3. Anti-karaoke estricto
    assert plan.metrics["karaoke_risk_beats"] == 0
    assert plan.metrics["narrative_text_ratio_pct"] <= 25.0

    # 4. Continuidad sin huecos
    for i in range(1, len(plan.beats)):
        assert plan.beats[i]["start_s"] == plan.beats[i - 1]["end_s"], f"Hueco temporal entre beat {i-1} y {i}"


def test_fixture_b_vacaciones_generalization(fixture_b_vacaciones):
    """Fixture B: Vacaciones IMSS - prueba que el motor generaliza a solicitudes, prima y personal."""
    turns, alignment, duration_s = fixture_b_vacaciones
    planner = VisualEditorialPlanner()
    plan = planner.plan_project("vacaciones_imss", turns, alignment, duration_s, direction="documental", text_mode="editorial")

    # 1. Suma exacta de mix al 100.0%
    mix = plan.visual_mix
    mix_sum = round(mix["locutor_pct"] + mix["evidencia_pct"] + mix["explicacion_pct"] + mix["contexto_pct"] + mix["brand_pct"], 1)
    assert mix_sum == 100.0, f"El mix de vacaciones debe sumar 100.0%, sumó {mix_sum}%"

    # 2. Presencia de evidencia de CCT y oficinas de personal / contexto administrativo
    evidencia_beats = [b for b in plan.beats if b.get("visual_function") == "EVIDENCIA"]
    contexto_beats = [b for b in plan.beats if b.get("visual_function") == "CONTEXTO"]
    explicacion_beats = [b for b in plan.beats if b.get("visual_function") == "EXPLICACION"]

    assert len(evidencia_beats) >= 1, "Debe existir al menos un beat de evidencia (CCT / solicitud de vacaciones)"
    assert len(contexto_beats) >= 1, "Debe existir al menos un beat de contexto (oficinas de personal / Recursos Humanos)"
    assert len(explicacion_beats) >= 1, "Debe existir al menos un beat de explicación (prima vacacional / cálculo)"

    # 3. Zero karaoke risk
    assert plan.metrics["karaoke_risk_beats"] == 0

    # 4. Cero fuga de conceptos no pertenecientes a vacaciones (no 8.55%, no concepto 11)
    for b in plan.beats:
        text_content = f"{b.get('headline')} {b.get('subheadline')} {b.get('display_text')}"
        assert "8.55" not in text_content, "Fuga de dato del episodio d5f1fc16 en fixture de vacaciones"
        assert "concepto 11" not in text_content.lower(), "Fuga de Concepto 11 en fixture de vacaciones"


def test_fixture_c_accidente_generalization(fixture_c_accidente):
    """Fixture C: Accidente de trabajo - prueba detección de HGR 1 Charo verificado, Formato ST-7 y LSS."""
    turns, alignment, duration_s = fixture_c_accidente
    planner = VisualEditorialPlanner()
    plan = planner.plan_project("accidente_trabajo", turns, alignment, duration_s, direction="documental", text_mode="editorial")

    # 1. Suma exacta de mix al 100.0%
    mix = plan.visual_mix
    mix_sum = round(mix["locutor_pct"] + mix["evidencia_pct"] + mix["explicacion_pct"] + mix["contexto_pct"] + mix["brand_pct"], 1)
    assert mix_sum == 100.0, f"El mix de accidente de trabajo debe sumar 100.0%, sumó {mix_sum}%"

    # 2. HGR 1 Charo verificado DEBE aparecer porque está explícitamente en el guion
    charo_beats = [
        b for b in plan.beats
        if "hgr1_charo" in str(b.get("resolved_asset", {})).lower() or "charo" in (b.get("headline") or "").lower()
    ]
    assert len(charo_beats) >= 1, "HGR 1 Charo debe aparecer como evidencia porque fue citado explícitamente en el guion de accidente"

    # 3. Formato ST-7 o leyes laborales deben aparecer en evidencia
    doc_beats = [
        b for b in plan.beats
        if b.get("visual_function") == "EVIDENCIA" and ("st-7" in str(b).lower() or "ley" in str(b).lower() or "seguro social" in str(b).lower())
    ]
    assert len(doc_beats) >= 1, "Debe existir evidencia documental para el Formato ST-7 o Ley del Seguro Social"

    # 4. Zero karaoke risk
    assert plan.metrics["karaoke_risk_beats"] == 0

    # 5. Cero fuga de conceptos de d5f1fc16
    for b in plan.beats:
        text_content = f"{b.get('headline')} {b.get('subheadline')} {b.get('display_text')}"
        assert "8.55" not in text_content, "Fuga de dato del episodio d5f1fc16 en fixture de accidente"
