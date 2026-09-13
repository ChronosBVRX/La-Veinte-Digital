"""Detector de Entidades del Mundo Laboral e Institucional para La Veinte Radio.

Analiza textos y turnos del guion extrayendo organizaciones, documentos normativos,
leyes, artículos, cláusulas, conceptos de nómina, cifras financieras, edificios
y eventos sin inventar atribuciones.
"""
from __future__ import annotations

import re
from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass
class DetectedEntity:
    name: str
    category: str  # organization, document, law, standard, clause, payroll_concept, financial_stat, building, event, topic
    raw_text: str
    confidence: float = 1.0
    attributes: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class EntityDetector:
    """Extrae entidades con soporte de 20 categorías normalizadas."""

    def __init__(self) -> None:
        self._init_patterns()

    def _init_patterns(self) -> None:
        # Organizaciones conocidas
        self.org_patterns = [
            (r"\b(IMSS|Instituto Mexicano del Seguro Social)\b", "IMSS", "organization", {"official_acronym": "IMSS"}),
            (r"\b(SNTSS|Sindicato Nacional de Trabajadores del Seguro Social)\b", "SNTSS", "organization", {"official_acronym": "SNTSS"}),
            (r"\b(CFCRL|Centro Federal de Conciliaci[oó]n y Registro Laboral)\b", "CFCRL", "organization", {"official_acronym": "CFCRL"}),
            (r"\b(STPS|Secretar[ií]a del Trabajo y Previsi[oó]n Social)\b", "STPS", "organization", {"official_acronym": "STPS"}),
            (r"\b(AFORE|cuenta individual)\b", "AFORE", "organization", {"type": "pension_fund"}),
            (r"\b(La Veinte (?:Radio|Digital))\b", "La Veinte Radio", "organization", {"is_internal": True}),
        ]

        # Documentos normativos
        self.doc_patterns = [
            (r"\b(Contrato Colectivo(?: de Trabajo)?(?:\s+(?:dos mil veinticinco[–\-\s]+dos mil veintisiete|2025[–\-\s]+2027))?|CCT)\b",
             "Contrato Colectivo de Trabajo", "document", {"edition": "2025-2027", "abbreviation": "CCT"}),
            (r"\b(Estatutos(?: del SNTSS)?)\b", "Estatutos SNTSS", "document", {"organization": "SNTSS"}),
            (r"\b(Reglamento Interior de Trabajo|RIT)\b", "Reglamento Interior de Trabajo", "document", {"organization": "IMSS-SNTSS"}),
            (r"\b(Tabulador(?: de Sueldos| de Base)?)\b", "Tabulador de Sueldos IMSS", "document", {"scope": "personal_base"}),
            (r"\b(tarjet[oó]n(?: de pago)?(?:\s+IMSS)?)\b", "Tarjetón IMSS", "document", {"type": "payslip"}),
            (r"\b(formato\s+ST[-\s]?7|aviso\s+de\s+atenci[oó]n\s+m[eé]dica\s+inicial|ST[-\s]?7)\b",
             "Formato ST-7 Riesgo de Trabajo", "document", {"type": "medical_format", "procedure": "riesgo_trabajo"}),
            (r"\b(solicitud\s+de\s+vacaciones|rol\s+de\s+vacaciones|d[ií]as\s+de\s+vacaciones)\b",
             "Solicitud de Vacaciones", "document", {"type": "labor_request", "topic": "vacaciones"}),
        ]

        # Leyes y Códigos
        self.law_patterns = [
            (r"\b(Ley Federal del Trabajo|LFT)\b", "Ley Federal del Trabajo", "law", {"jurisdiction": "federal"}),
            (r"\b(Ley del Seguro Social|LSS)\b", "Ley del Seguro Social", "law", {"jurisdiction": "federal"}),
            (r"\b(Constituci[oó]n Pol[ií]tica|CPEUM)\b", "Constitución Política de los Estados Unidos Mexicanos", "law", {"jurisdiction": "federal"}),
        ]

        # Artículos legales específicos
        self.article_patterns = [
            (r"\bart[ií]culo\s+(trescientos noventa y nueve\s+Bis|399\s*Bis)\b", "Artículo 399 Bis LFT", "law",
             {"article": "399 Bis", "law": "LFT", "topic": "revisión salarial anual"}),
            (r"\bart[ií]culo\s+(cuatrocientos\s+Bis|400\s*Bis)\b", "Artículo 400 Bis LFT", "law",
             {"article": "400 Bis", "law": "LFT", "topic": "revisión contractual integral"}),
            (r"\bart[ií]culo\s+(trescientos noventa\s+Ter|390\s*Ter)\b", "Artículo 390 Ter LFT", "law",
             {"article": "390 Ter", "law": "LFT", "topic": "consulta democrática y voto personal libre y secreto"}),
        ]

        # Cláusulas contractuales
        self.clause_patterns = [
            (r"\b(cl[aá]usula\s+(?:sesenta y tres\s+Bis|63\s*Bis))\b", "Cláusula 63 Bis CCT", "clause",
             {"clause": "63 Bis", "document": "CCT", "topic": "Ayuda para renta / Concepto 11"}),
            (r"\b(cl[aá]usula\s+(?:ciento cincuenta y siete|157))\b", "Cláusula 157 CCT", "clause",
             {"clause": "157", "document": "CCT", "topic": "Previsión social / Aportación para el retiro"}),
        ]

        # Conceptos de nómina
        self.payroll_patterns = [
            (r"\b(Concepto\s+once|Concepto\s+11|Ayuda de renta)\b", "Concepto 11 - Ayuda de Renta", "payroll_concept",
             {"code": "011", "category": "percepcion", "clause_ref": "63 Bis"}),
            (r"\b(sueldo tabular|sueldo base|Concepto\s+(?:dos|02|002))\b", "Concepto 02 - Sueldo Tabular", "payroll_concept",
             {"code": "002", "category": "percepcion", "is_base": True}),
            (r"\b(Concepto\s+diez|Concepto\s+10|Ayuda asistencial)\b", "Concepto 10 - Ayuda Asistencial", "payroll_concept",
             {"code": "010", "category": "percepcion"}),
            (r"\b(cuota sindical|deducci[oó]n sindicato)\b", "Deducción Cuota Sindical", "payroll_concept",
             {"code": "002", "category": "deduccion"}),
            (r"\b(impuestos|ISR|impuesto sobre la renta)\b", "Deducción ISR", "payroll_concept",
             {"code": "001", "category": "deduccion"}),
            (r"\b(prima\s+vacacional)\b", "Prima Vacacional", "payroll_concept",
             {"category": "percepcion"}),
            (r"\b(incapacidad\s+temporal(?:\s+al\s+100%)?|subsidio\s+por\s+incapacidad)\b",
             "Incapacidad Temporal 100%", "payroll_concept",
             {"category": "prestacion"}),
            (r"\b(Nueva Generaci[oó]n)\b", "Trabajadores Nueva Generación", "topic",
             {"scope": "Cláusula 157 CCT"}),
        ]

        # Cifras y porcentajes clave del episodio
        self.stat_patterns = [
            (r"\b(cien\s+por\s+ciento|100\s*%|100\s+por\s+ciento)\b", "100% Salario Base", "financial_stat",
             {"value": 100.0, "type": "percentage", "metric": "incapacidad_temporal"}),
            (r"\b(ocho punto cincuenta y cinco|8\.55)\s*(?:%|por ciento)?\b", "8.55% Incremento Ponderado", "financial_stat",
             {"value": 8.55, "type": "percentage", "metric": "ponderado_congreso"}),
            (r"\b(dos punto nueve|2\.9)\s*(?:%|por ciento)?\b", "2.9% Sueldo Tabular", "financial_stat",
             {"value": 2.9, "type": "percentage", "metric": "sueldo_tabular"}),
            (r"\b(tres punto nueve|3\.9)\s*(?:%|por ciento)?\b", "3.9% Concepto 11", "financial_stat",
             {"value": 3.9, "type": "percentage", "metric": "concepto_11"}),
            (r"\b(uno punto setenta y cinco|1\.75)\s*(?:%|por ciento)?\b", "1.75% Cláusula 157 (Retiro)", "financial_stat",
             {"value": 1.75, "type": "percentage", "metric": "clausula_157_propuesta"}),
            (r"\b(uno punto veinticinco|1\.25)\s*(?:%|por ciento)?\b", "1.25% Incremento Programado CCT", "financial_stat",
             {"value": 1.25, "type": "percentage", "metric": "clausula_157_pactado"}),
        ]

        # Edificios e instalaciones
        self.building_patterns = [
            (r"\b(Hospital General Regional(?:\s+No\.?\s*1|\s+n[uú]mero\s+uno)?(?:\s+Charo)?|HGR\s*1)\b",
             "Hospital General Regional No. 1 Charo", "hospital", {"verified": True, "location": "Charo, Michoacán"}),
            (r"\b(Hospital General de Zona|HGZ(?:/MF)?\s*\d*)\b", "Hospital General de Zona IMSS", "hospital",
             {"verified": False, "generic": True}),
            (r"\b(Unidad de Medicina Familiar|UMF\s*\d*)\b", "Unidad de Medicina Familiar IMSS", "clinic",
             {"verified": False, "generic": True}),
            (r"\b(Recursos Humanos|oficinas de personal)\b", "Oficinas de Recursos Humanos IMSS", "workplace",
             {"category": "administrative"}),
            (r"\b(Congreso(?: del Sindicato| del SNTSS| Nacional)?)\b", "Congreso Nacional SNTSS", "event",
             {"organization": "SNTSS"}),
        ]

    def detect_in_text(self, text: str) -> list[DetectedEntity]:
        """Detecta entidades en una cadena de texto respetando límites de palabras."""
        if not text:
            return []

        results: list[DetectedEntity] = []
        seen_names = set()

        all_pattern_groups = [
            self.article_patterns,  # Mayor especificidad primero
            self.clause_patterns,
            self.doc_patterns,
            self.law_patterns,
            self.org_patterns,
            self.payroll_patterns,
            self.stat_patterns,
            self.building_patterns,
        ]

        for group in all_pattern_groups:
            for pat, name, cat, attrs in group:
                for match in re.finditer(pat, text, re.IGNORECASE):
                    if name not in seen_names:
                        seen_names.add(name)
                        results.append(DetectedEntity(
                            name=name,
                            category=cat,
                            raw_text=match.group(0),
                            confidence=0.95,
                            attributes=attrs.copy(),
                        ))

        # Detección de montos en moneda ($10,000, diez mil pesos, etc.)
        monto_matches = re.finditer(r"\$\s*([\d,]+(?:\.\d+)?)\s*(?:pesos)?|(\d+[\d,]*\s*pesos)", text, re.IGNORECASE)
        for m in monto_matches:
            raw = m.group(0).strip()
            num_clean = re.sub(r"[^\d.]", "", raw)
            if num_clean and raw not in seen_names:
                try:
                    val = float(num_clean)
                    val_str = f"${val:,.0f} MXN" if val.is_integer() else f"${val:,.2f} MXN"
                    seen_names.add(raw)
                    results.append(DetectedEntity(
                        name=f"Monto: {val_str}",
                        category="financial_stat",
                        raw_text=raw,
                        confidence=0.9,
                        attributes={"value": val, "currency": "MXN"},
                    ))
                except ValueError:
                    pass

        # Montos en palabras (ej. "diez mil pesos", "doscientos noventa pesos")
        palabras_pesos = re.finditer(
            r"\b(?:un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|veinte|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien|ciento|doscientos|trescientos|cuatrocientos|quinientos|seiscientos|setecientos|ochocientos|novecientos|mil)"
            r"(?:\s+(?:y\s+)?(?:un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|veinte|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien|ciento|doscientos|trescientos|cuatrocientos|quinientos|seiscientos|setecientos|ochocientos|novecientos|mil))*"
            r"\s+pesos\b",
            text,
            re.IGNORECASE,
        )
        for pm in palabras_pesos:
            raw_p = pm.group(0).strip()
            if raw_p not in seen_names and not any(raw_p in e.raw_text for e in results):
                seen_names.add(raw_p)
                results.append(DetectedEntity(
                    name=f"Monto: {raw_p.title()}",
                    category="financial_stat",
                    raw_text=raw_p,
                    confidence=0.88,
                    attributes={"currency": "MXN", "raw_currency": raw_p},
                ))

        # Detección general de artículos legales no cubiertos específicamente
        for art_m in re.finditer(r"\bart[íi]culo\s+(\d+(?:\s*(?:bis|ter|qu[aá]ter))?)\b", text, re.IGNORECASE):
            art_raw = art_m.group(0).strip()
            art_num = art_m.group(1).strip()
            art_name = f"Artículo {art_num.title()}"
            if not any(art_num in e.name for e in results) and art_name not in seen_names:
                seen_names.add(art_name)
                # Inferir ley si está cerca en el texto
                law_ref = "LSS" if "seguro social" in text.lower() or "lss" in text.lower() else ("LFT" if "ley federal del trabajo" in text.lower() or "lft" in text.lower() or "trabajo" in text.lower() else "Ley")
                results.append(DetectedEntity(
                    name=f"{art_name} {law_ref}",
                    category="law",
                    raw_text=art_raw,
                    confidence=0.90,
                    attributes={"article": art_num, "law": law_ref, "generic": True},
                ))

        # Detección general de cláusulas contractuales no cubiertas específicamente
        for cl_m in re.finditer(r"\bcl[áa]usula\s+(\d+(?:\s*(?:bis|ter))?)\b", text, re.IGNORECASE):
            cl_raw = cl_m.group(0).strip()
            cl_num = cl_m.group(1).strip()
            cl_name = f"Cláusula {cl_num.title()} CCT"
            if not any(cl_num in e.name for e in results) and cl_name not in seen_names:
                seen_names.add(cl_name)
                results.append(DetectedEntity(
                    name=cl_name,
                    category="clause",
                    raw_text=cl_raw,
                    confidence=0.90,
                    attributes={"clause": cl_num, "document": "CCT", "generic": True},
                ))

        # Detección general de conceptos de nómina
        for con_m in re.finditer(r"\bconcepto\s+(\d+)\b", text, re.IGNORECASE):
            con_raw = con_m.group(0).strip()
            con_num = con_m.group(1).strip()
            con_name = f"Concepto {con_num}"
            if not any(con_num in e.name for e in results) and con_name not in seen_names:
                seen_names.add(con_name)
                results.append(DetectedEntity(
                    name=con_name,
                    category="payroll_concept",
                    raw_text=con_raw,
                    confidence=0.90,
                    attributes={"code": con_num, "generic": True},
                ))

        # Detección general de porcentajes
        for pct_m in re.finditer(r"\b(\d+(?:\.\d+)?)\s*(?:%|por ciento)\b", text, re.IGNORECASE):
            pct_raw = pct_m.group(0).strip()
            pct_val = pct_m.group(1).strip()
            pct_name = f"{pct_val}%"
            if not any(pct_val in e.name for e in results) and pct_name not in seen_names:
                seen_names.add(pct_name)
                try:
                    p_float = float(pct_val)
                except ValueError:
                    p_float = 0.0
                results.append(DetectedEntity(
                    name=pct_name,
                    category="financial_stat",
                    raw_text=pct_raw,
                    confidence=0.88,
                    attributes={"value": p_float, "type": "percentage", "generic": True},
                ))

        return results

    def detect_in_turn(self, turn: dict) -> list[DetectedEntity]:
        text = " ".join([
            turn.get("displayText") or turn.get("display_text") or "",
            turn.get("ttsText") or "",
            str(turn.get("relation") or ""),
        ])
        return self.detect_in_text(text)

    def detect_in_script(self, turns: list[dict]) -> dict[str, list[DetectedEntity]]:
        """Mapea cada turno a sus entidades detectadas."""
        out = {}
        for idx, t in enumerate(turns):
            tid = t.get("id") or f"turn-{idx + 1}"
            out[tid] = self.detect_in_turn(t)
        return out

    def get_unique_entities(self, turns: list[dict]) -> list[DetectedEntity]:
        """Obtiene el catálogo único de entidades presentes en el guion."""
        unique: dict[str, DetectedEntity] = {}
        for t in turns:
            for ent in self.detect_in_turn(t):
                if ent.name not in unique:
                    unique[ent.name] = ent
        return list(unique.values())
