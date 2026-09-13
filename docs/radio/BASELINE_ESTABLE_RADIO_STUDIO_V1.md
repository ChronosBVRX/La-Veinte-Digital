# 🎙️ BASELINE ESTABLE: AI RADIO STUDIO V1

> **ESTADO DEL SISTEMA:** ESTABLE · V1.0.0-PREMIUM  
> **FECHA DE CIERRE:** 2026-09-13  
> **RAMA:** feat/radio-studio-v1-premium  
> **EPISODIO PILOTO AUDITADO:** d5f1fc16 (12:16, 129 Beats Visuales)  
> **AUDIO MASTER:** SHA-256 2432fc815fc050a2a3c8200e14fb818aff93de359accedccc8d8effc7f67e903 (17,664,813 bytes, Inalterable)

---

## 1. Declaración de Misión y Filosofía de Diseño

AI Radio Studio V1 transforma la suite de radio automatizada en una **aplicación de escritorio premium, rápida, determinista y documental**. Diseñada para que cualquier periodista, locutor o usuario no técnico pueda:

1. Abrir AI Radio Studio en su estación de trabajo.
2. Explorar y editar episodios de radio informativos de 12+ minutos con sincronización canónica palabra por palabra.
3. Editar escenas visuales en tiempo real sin esperar re-renders completos del episodio.
4. Validar fuentes y contratos colectivos (CCT IMSS-SNTSS / LFT) con respaldo documental estricto y hashes criptográficos.
5. Exportar previsualizaciones completas en menos de **4 segundos** gracias a su motor de caché granular por beats.

---

## 2. Arquitectura del Sistema

\\	ext
┌─────────────────────────────────────────────────────────────────────────┐
│                          AI RADIO STUDIO DESKTOP                        │
│             React 19 + TypeScript + Vite + Lucide + Studio CSS          │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ HTTP JSON / SSE (Port 3977)
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         SIDECAR DAEMON (Node.js)                        │
│    Project Store · Asset Manager · Health & Telemetry · Process Exec    │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ CLI / Subprocess Concurrency
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     INCREMENTAL VISUAL ENGINE (Python)                  │
│                                                                         │
│   VisualBeat (1..129) ──► Compute RenderHash ──► Cache Hit?             │
│                                                    │                    │
│                        ┌───────────────────────────┴──────────┐         │
│                        ▼ (MISS)                               ▼ (HIT)   │
│                 BeatRenderer (FFmpeg)                   Reutilizar clip │
│                 480p @ 30fps MP4                        existente       │
│                        │                                      │         │
│                        └─────────────┬────────────────────────┘         │
│                                      ▼                                  │
│                             FFmpeg Concat Demuxer                       │
│                                      ▼                                  │
│                             Cached AAC Audio Mux                        │
│                                      ▼                                  │
│                          preview-v4.1.mp4 (12:16)                       │
└─────────────────────────────────────────────────────────────────────────┘
\
---

## 3. Telemetría y Benchmarks de Rendimiento Auditados

El episodio piloto d5f1fc16 cuenta con una duración de **12 minutos y 16 segundos** (735.97 segundos, ~22,079 fotogramas de vídeo a 30 fps), segmentado en **129 Beats Visuales**.

### Tabla Comparativa de Rendimiento

| Métrica de Pipeline | Pipeline Anterior (V3 / V4.0) | AI Radio Studio V1 (Incremental) | Ganancia / Factor |
| :--- | :--- | :--- | :--- |
| **Edición de 1 sola escena** | 25 a 35 minutos (render completo) | **5.95 segundos** (1 beat dirty) | **~300x más rápido** |
| **Warm Full Assembly (129 beats)** | 22.29 segundos | **2.10 segundos** | **10.6x más rápido** |
| **Audio Muxing (12:16 de audio)** | 21.59 segundos (re-encode) | **0.46 segundos** (AAC stream copy cache) | **46.9x más rápido** |
| **Warm Full Preview Export** | N/A (requería re-render) | **3.65 segundos** (hits: 129/129) | **Instantáneo** |
| **Consumo de API Speechify en Visuales** | Riesgo de re-síntesis | **.00 USD** (0 llamadas) | **Costo Cero** |
| **Integridad del Audio Master** | Riesgo de desfase | **SHA-256 Idéntico** | **0 Desfase Canónico** |

### Breakdown de Tiempo por Componente (Warm Preview)

- **Comprobación de Caché (129 beats):** ~0.04s
- **Renderizado de Beats sucios (0 misses):** 0.00s
- **FFmpeg Concat Demuxer:** 1.64s
- **Muxing con Master Audio Cacheado:** 0.46s
- **Generación de Hoja de Contactos (16 frames):** 1.51s
- **Tiempo Total de Exportación de Episodio Completo:** **3.65s**

---

## 4. Principios Visuales V4.1 y Directrices Documentales

Queda estrictamente prohibida la introducción de activos sintéticos o de fantasía que comprometan la credibilidad periodística e institucional de La Veinte Digital:

1. **Cero Falsificaciones de Logos:**
   - Prohibido generar logotipos del IMSS, SNTSS o dependencias gubernamentales mediante modelos generativos (DALL-E, Midjourney, Stable Diffusion, etc.).
   - Solo se utilizan activos vectoriales e imágenes oficiales auditadas en editorial_assets_manifest.json.
2. **Cero Documentos de Fantasía:**
   - Los tarjetones de pago, cláusulas del CCT y artículos de la Ley Federal del Trabajo provienen exclusivamente de documentos oficiales digitalizados con hash SHA-256 verificado.
3. **Cero Riesgo de Karaoke:**
   - La subtitulación y cintillos informativos utilizan plantillas de tipografía limpia, estática o de aparición discreta, sin animaciones estridentes tipo redes sociales de entretenimiento.
4. **Variantes Visuales de Personajes:**
   - Los 5 conductores y analistas (Eduardo, Andrea, Javier, Rodrigo, Valeria) cuentan con 6 estados de expresión (neutral, speaking, serious, emphasis, explaining, listening), totalizando **30 variantes de estudio** en alta definición con canal alfa limpio.
5. **Cortes Semánticos Reales y Taxonomía de Procedencia:**
   - Prohibidas las reglas rígidas de duración (speaker <= 8s). La duración puede disparar análisis editorial, pero NO obligar al corte.
   - Todo corte requiere frontera semántica demostrable (cifra, documento, cláusula, entidad, contraste, ejemplo, conclusión). Si no existe frontera adecuada, el plano del locutor se sostiene sin corte arbitrario.
   - Taxonomía estricta de 4 tipos de procedencia visual:
     * OFFICIAL -> Fuente oficial (logos, sellos vectoriales, documentos depositados ante CFCRL/STPS).
     * REFERENCE_BASED -> Basado en referencia (reconstrucciones visuales a partir de documentos o arquitectura real).
     * GENERIC_CONTEXTUAL_AI -> Contexto visual generado (imágenes contextuales IA neutras sin texto apócrifo).
     * USER_PROVIDED -> Aportado por usuario (evidencia fotográfica o documental facilitada por trabajadores).

---

## 5. Hoja de Contactos Documental V4.1

Se generó la hoja de contactos oficial que audita 16 marcas de tiempo representativas a lo largo de los 12:16 minutos del episodio:

- **Ruta del Artefacto:** qa/documentary-v4.1-contact-sheet.jpg
- **Resolución:** 1970 x 1260 px
- **Garantías Verificadas:**
  - 00:02 Apertura de cabina y branding sobrio de La Veinte Radio.
  - 00:15 Eduardo (Locutor Titular) con badge de cabina.
  - 00:26 Infografía salarial (2.90% Sueldo Tabular, 3.90% Renta, 1.75% Cláusula 157).
  - 00:53 Contexto visual generado: trabajadora revisando nómina.
  - 01:05 Ficha documental de Cláusula 157 CCT con folio del CFCRL.
  - 01:57 Tarjetón Digital IMSS original de alta resolución.
  - 02:15 Desglose de conceptos de nómina (01, 02, 11, 22).
  - 03:30 Rodrigo Torres (Corresponsal de campo).
  - 04:35 Contexto visual generado: oficina de personal hospitalario.
  - 05:45 Andrea (Co-conductora).
  - 06:25 Carátula oficial del Contrato Colectivo de Trabajo 2025-2027.
  - 07:40 Cinética de datos (8.55% Ponderado).
  - 09:00 Cuadro comparativo de tipos de revisión de la LFT (Art. 399 Bis).
  - 10:50 Contexto visual generado: representación de sede sindical durante asamblea.
  - 11:50 Cabina de cierre con Andrea.
  - 12:12 Cierre oficial de transmisión La Veinte Digital.

---

## 6. Sistema de Diseño UI/UX de Escritorio

La interfaz de AI Radio Studio fue refactorizada en su totalidad para eliminar componentes genéricos de navegador y ofrecer una experiencia de software nativo premium:

### Componentes Creados y Estandarizados
- src/components/ui/Icons.tsx: Envoltorio tipado de **Lucide React** (Radio, Film, FileText, CheckCircle2, AlertTriangle, Play, Pause, ChevronRight, Settings, Cpu, HardDrive, Sparkles, Sliders, ExternalLink, etc.). Cero emojis como iconos de interfaz.
- src/components/ui/Badge.tsx: Badges semánticos con variantes de color (slate, blue, emerald, amber, rose, purple) y puntos indicadores de estado.
- src/components/ui/Button.tsx: Botones con estilos primario, secundario, peligro, fantasma y esquema outline, con estados disabled y loading con spinner SVG integrado. Cero botones grises de navegador.
- src/components/ui/Modal.tsx: Sistema de diálogo modal flotante con backdrop difuminado (backdrop-blur-sm), header con título, descripción y botón de cierre, y área de scroll contenida.
- src/components/ui/Toast.tsx + ToastContext: Notificaciones no intrusivas en la esquina inferior derecha con auto-cierre a los 3.5 segundos.

### Pantallas Principales
1. **Inicio (src/screens/Inicio.tsx):**
   - Panel de bienvenida estilo VEED/Descript.
   - Acceso rápido a crear nuevo episodio o cargar guion.
   - Lista de proyectos recientes con metadata (duración, número de escenas, estado de render, fecha).
   - Tarjetas de acciones rápidas (Auditoría documental, Generador de escaletas, Diagnóstico de sistema).
2. **Espacio de Trabajo de 3 Columnas (src/screens/ProyectoSimple.tsx):**
   - **Columna Izquierda:** Navegación por pestañas (Resumen, Guion con vista Riverside multi-voz, Fuentes CCT con validación SHA-256, Master de Audio con perfiles de cabina, Visuales con selector de las 129 escenas, Producción con tarjetas de exportación).
   - **Columna Central:** Reproductor de vídeo con barra de transporte, timecode actual/total, botón de reproducción/pausa, scrubbing en timeline de 12:16, y botón 'Abrir Storyboard (129 Escenas)'.
   - **Columna Derecha (Inspector):** Editor de escena activa. Permite modificar función visual, headline, texto secundario, conductor, emoción, y abrir el **Selector Visual de Activos** (CCT, Tarjetón, Sede Sindical, Hospital). Incluye botón de 'Renderizar Escena (Caché Rápido)' con telemetría en vivo.
3. **Modal de Storyboard (src/components/StoryboardModal.tsx):**
   - Vista de mosaico en cuadrícula de 6 columnas con las 129 escenas.
   - Cada tarjeta muestra timecode, duración, tipo de escena, conductor y texto clave.
   - Permite seleccionar cualquier escena con un clic y saltar instantáneamente en el reproductor.
4. **Diagnóstico del Sistema (src/screens/Diagnostico.tsx):**
   - Telemetría en tiempo real: Commit de Git, estado y PID del Sidecar, GPU / Acelerador de hardware (NVENC / CPU), estado de la cola de audio y directorio de caché.
   - Acciones de mantenimiento seguras: 'Verificar Integridad de Audio Master', 'Inspeccionar Caché de Beats' y 'Probar Conexión Sidecar'.

---

## 7. Protocolo de No Regresión y Operación para Nuevos Episodios

Para mantener la estabilidad absoluta del sistema en futuros desarrollos:

\\	ext
=============================================================================
REGLA DE ORO DE AI RADIO STUDIO
=============================================================================
1. NUNCA re-sintetizar audio si el guion y el audio master ya fueron aprobados.
2. El archivo data/tts/master/programa-<id>.mp3 es de solo lectura permanente.
3. Todo cambio en una escena visual debe invalidar EXCLUSIVAMENTE su beatId.
4. El ensamble completo NUNCA debe tardar más de 5 segundos en caché caliente.
5. Ningún activo visual puede publicarse sin registro en el catálogo editorial.
=============================================================================
\
### Comandos de Verificación Clave
- **Typecheck Frontend:** cd apps/radio-studio && npm run build (debe pasar con 0 errores TypeScript).
- **Pruebas Unitarias del Motor Incremental:** python -m unittest backend/tests/unit/test_visual_incremental.py (11/11 tests passing).
- **Comprobación de Sidecar:** curl http://127.0.0.1:3977/health (debe retornar {'ok':true}).
- **Auditoría de Audio Master:** Verificar que el SHA-256 sea 2432fc815fc050a2a3c8200e14fb818aff93de359accedccc8d8effc7f67e903.

---
*Fin del documento de Baseline Estable V1.0.0.*