# Auditoría de información gubernamental — 2026-09-06

Baseline: `a3e5792` (prod verificado vía `/api/health`). Rama:
`fix/google-play-government-info-compliance`.

Fuentes oficiales consultadas (2026-09-06):
- Información gubernamental: https://support.google.com/googleplay/android-developer/answer/9514050
  → Las apps con info gubernamental deben identificar fuentes y no sugerir afiliación oficial.
- Políticas para desarrolladores: https://support.google.com/googleplay/android-developer/answer/17517561
- Contenido generado por IA: https://support.google.com/googleplay/android-developer/answer/13985936
  → Exige reporte interno de contenido ofensivo.
- Seguridad de los datos: https://support.google.com/googleplay/android-developer/answer/10787469
- Eliminación de cuentas: https://support.google.com/googleplay/android-developer/answer/13327111
- Target SDK: https://developer.android.com/google/play/requirements/target-sdk
  → Desde 2026-08-31, actualizaciones deben apuntar a API 36 (cumplido: targetSdk 36).
- Android 16: https://developer.android.com/about/versions/16/behavior-changes-16
- Páginas 16 KB: https://developer.android.com/guide/practices/page-sizes

## Matriz de contenido

| Pantalla o función | Afirmación mostrada | Fuente usada | URL original | Emisor | Clasificación | Riesgo | Corrección |
|---|---|---|---|---|---|---|---|
| Calculadoras (`/calculadoras`) | Estimaciones de prestaciones, referencia al CCT | CCT IMSS–SNTSS 2025–2027 | https://www.imss.gob.mx/sites/all/statics/pdf/CCT-2025-2027.pdf | IMSS + SNTSS | Fuente laboral IMSS–SNTSS (NO gubernamental) | Medio: antes sin enlace visible | `SourceAttribution` + enlace a `/informacion-y-fuentes` |
| Asistente (`/asistente`) | Respuestas normativas con citas y vigencia | RAG local + LFT/LSS/CCT | Ver registro canónico | Varios (ley/CCT/sindicato) | Mixta: legislativa/laboral/sindical/IA | Alto: riesgo de presentar IA como oficial | Aviso orientativo + fuentes existentes + `AiContentReport` |
| Escritos (`/escritos`) | Borradores con fundamento citado | CCT/LFT según caso | Ver registro canónico | Varios | Interpretación generada por IA | Alto: presentarse como resolución | Banner “revísalo antes de presentarlo” + reporte |
| Agenda (`/bitacora`) | Consecuencias normativas de faltas/tiempo extra | CCT + cálculo canónico local | CCT (arriba) | IMSS + SNTSS | Fuente laboral + editorial propia | Bajo | Sin cambio de fórmula; atribución vía fuentes |
| Tarjetón / portales IMSS | Acceso a Tu Perfil IMSS, tarjetones | Portal oficial IMSS | https://www.imss.gob.mx/ | IMSS | Fuente institucional del IMSS | Medio: confusión de titularidad | Aviso portal externo (acerca-de, fuentes); bridge nativo NO expuesto a hosts externos |
| Biblioteca normativa | Textos de leyes, NOMs, CCT | Corpus local + DOF/Diputados | https://www.dof.gob.mx/, https://www.diputados.gob.mx/LeyesBiblio/index.htm | SEGOB / Cámara | Fuente gubernamental / legislativa | Medio | Registro canónico; copias RAG conservan URL original |
| Estatutos SNTSS | Contenido sindical | Edición octubre 2022 | (sin URL pública verificada) | SNTSS | Fuente sindical — NUNCA gubernamental | Alto si se etiqueta “vigente 2026” | Etiqueta `PENDING_REVIEW`; no se enlaza como fuente gubernamental |
| Acerca/privacidad/términos | Aviso de independencia | Editorial propia | — | La Veinte Digital | Contenido editorial propio | Bajo (ya existía) | Enlace añadido a `/informacion-y-fuentes` |

## Identidad y marca

- Nombre `La Veinte Digital` conservado (cabe en límite Play, no imita símbolos oficiales).
- Icono/splash/colores actuales: sin escudos, sellos ni logotipos del IMSS/Gobierno detectados
  en `public/` y `android-app/app/src/main/res` (revisión manual de assets).
- Mención “IMSS” usada solo de forma descriptiva (“tarjetón IMSS”, “portal del IMSS”),
  nunca como propietario o patrocinador.

## Registro canónico

`src/shared/lib/government-sources.ts` — 7 fuentes mínimas, con id, título, emisor,
categoría, URL oficial, documento, vigencia, verificación 2026-09-06, consumidores y
bandera gubernamental/institucional/laboral/sindical. El CCT se clasifica
`laboral-cct` con `esGubernamental: false`.
