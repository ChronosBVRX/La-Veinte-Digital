# AI Radio Studio (Tauri 2)

Aplicación de escritorio para Windows: estudio de producción de episodios de radio
para La Veinte Digital, con Biblioteca Normativa IMSS/SNTSS, investigación con
DeepSeek cuando está configurado, voces locales Qwen Base clone, música local
ACE-Step y master final listo para publicar.

La meta editorial actual es que el programa se sienta vivo: conversación natural,
varias secciones por episodio, preguntas reales de trabajador, cambios de ritmo,
citas normativas verificables y espacios comerciales editables cuando haya
patrocinio.

## Estructura del monorepo

```
La-Veinte-Digital/
├── (raíz)            → La Veinte Digital web (Next.js) — consume los packages
├── apps/
│   └── radio-studio/ → esta app (Tauri 2 + React + Vite)
├── packages/
│   ├── tts-core/     → motor TTS Qwen Base clone (proceso desechable), chunker, cache
│   ├── radio-core/   → episodios, plan de producción por sesiones, timeline
│   └── (normative-core/ → próxima extracción desde src/features/normativa)
└── tools/
    └── ACE-Step-1.5/ → motor local de música, API 127.0.0.1:8001
```

## Desarrollo

```powershell
# una sola vez: toolchain (Rust GNU + MSYS2 MinGW, ver AGENTS.md raíz)
$env:PATH = "C:\Users\Axel Rosete\msys64\msys64\mingw64\bin;$env:USERPROFILE\.cargo\bin;$env:PATH"

cd apps/radio-studio
npm install        # desde la raíz del monorepo (workspaces)

# sidecar local en desarrollo (motor Qwen + corpus normativo) — HTTP 127.0.0.1:3977
cd sidecar && npm run dev        # o: node scripts/bundle.mjs && node dist/sidecar.js

# en otra terminal: frontend o ventana nativa
cd apps/radio-studio
npm run dev        # solo frontend (vite, http://localhost:1420)
npm run tauri dev  # ventana nativa con hot reload
npm run tauri build -- --bundles nsis   # instalador AI Radio Studio.exe
```

## Ejecutable y arranque automático

La app Tauri ya intenta arrancar el sidecar local al abrirse:

- Revisa si `127.0.0.1:3977` está activo.
- Si no lo está, lanza `node --no-warnings <ruta-absoluta>/apps/radio-studio/sidecar/dist/sidecar.js`.
- Usa la raíz del repo como directorio de trabajo para que encuentre `data/`,
  `resources/`, modelos y `.env.local`.
- Escribe logs en `data/tts/sidecar-tauri.log`.
- La ruta del proyecto contiene espacios. No construir este comando como una
  sola cadena con `cmd /C`; pasar `sidecar.js` como argumento real evita que
  Windows corte la ruta.

El sidecar, a su vez, intenta arrancar ACE-Step cuando la UI consulta
`/musica/motor` o cuando se pide generar música:

- Revisa si `127.0.0.1:8001` responde.
- Si no responde, lanza `uv run --no-sync acestep-api` desde
  `tools/ACE-Step-1.5`.
- Fuerza `ACESTEP_COMPILE_MODEL=false` para evitar el crash conocido de
  `torch.compile` en Windows.
- Escribe logs en `data/tts/ace-step-api.log`.

La primera carga de ACE-Step puede tardar alrededor de un minuto. La UI debe
mostrar `encendiendo`, no instrucciones manuales como flujo principal.

Antes de crear un instalador nuevo:

```powershell
cd apps/radio-studio/sidecar
npm run bundle

cd ..
npm run build

$env:PATH = "C:\Users\Axel Rosete\msys64\msys64\mingw64\bin;$env:USERPROFILE\.cargo\bin;$env:PATH"
npm run tauri -- build
```

Cerrar `radio-studio.exe` antes de reconstruir. Windows no permite reemplazar
un ejecutable abierto y falla con `Acceso denegado`.

## Qué se versiona

El estudio es local, pero su comportamiento debe quedar reproducible desde el
repo. Versionar código, documentación, manifiestos, scripts y los activos
editoriales estables que determinan la producción actual:

- `data/tts/ref/mariana.wav`
- `data/tts/ref/narrador.wav`
- `data/tts/ref/rodrigo.wav`
- `data/tts/ref/valeria.wav`
- `data/tts/music/bed-uniforme-vivo.wav`
- `data/tts/music/jingle-uniforme-vivo.wav`

No versionar modelos, entornos, cachés, previews, masters, instaladores ni el
corpus descargado en `data/normativa/`. El corpus se reconstruye desde
`resources/normativa/bootstrap-sources.yaml` y los comandos de recuperación.

## Endpoints del sidecar (127.0.0.1:3977)

| Ruta | Método | Descripción |
|---|---|---|
| `/status` | GET | motor (VRAM/temp/RTF), corpus, caché, hardware |
| `/investigar` | POST `{tema}` | Evidence Pack + cobertura documental + análisis DeepSeek si hay provider |
| `/guion` | POST `{tema}` | guion determinista con citas C1..Cn y ficha de fuentes |
| `/director` | POST `{tema,nivel,duracionMin,modo,contextoExtra,comerciales,duracionComercialSec,speakers}` | investigación + guion dirigido por IA/determinista |
| `/director/ajustar` | POST `{script,contexto,scope}` | ajuste parcial o total sin borrar todo el guion |
| `/generate` | POST `{bloques,voces}` | producción Qwen Base clone (cola serial, watchdog externo) |
| `/progress` | GET | progreso por locutor, caché, GPU, tiempo restante |
| `/cancel` | POST | pausar producción y dejarla reanudable |
| `/discard` | POST | detener worker, eliminar job activo y limpiar la producción actual |
| `/master` | POST `{bloques}` | mezcla de WAVs → MP3/WAV con loudnorm, cama e intro/outro |
| `/tts-fallback` | POST `{escenas}` | fallback edge-tts → SAPI (siempre marcado) |
| `/musica` | GET | lista biblioteca de música local |
| `/musica/motor` | GET | estado de ACE-Step; intenta arranque automático si está apagado |
| `/musica/generar` | POST `{prompt,tipo,duracionSec}` | crea job musical local |
| `/musica/progreso` | GET | progreso del job musical |
| `/musica/cancelar` | POST | pausa/cancela generación musical |

## Reglas editoriales del podcast

- Escaleta permanente: `Apertura breve` → `Caso de arranque` → `Qué dice la
  normativa` → `Ojo con esto` → `Caso práctico` o `Consultorio` → `Cómo
  documentarlo` → `Cierre práctico`.
- En 15 minutos o más, abrir subtemas relacionados dentro del mismo tema central
  para evitar monotonía: regla, excepción, trámite, ejemplo de unidad, duda
  frecuente, error común y paso práctico.
- No convertir el episodio en entrevista plana ni lista de preguntas. Cada
  segmento debe cambiar la dinámica y aportar algo nuevo.
- No usar cortinillas internas por defecto. Las transiciones editoriales se
  marcan con `transition: "cambio editorial"`.
- El master usa música breve solo en intro y outro. No insertar separadores
  musicales entre secciones salvo decisión explícita futura.
- La apertura y el cierre deben compartir identidad sonora: idealmente el mismo
  motivo musical; si son archivos distintos, deben sonar como variaciones de la
  misma familia. La selección automática prefiere `jingle-uniforme-*`,
  `bed-uniforme-*`, `lv-theme-*`, `la-veinte-*` y `brand-*`.
- Mantener cama ambiental uniforme y baja. Defaults actuales:
  `bedGainDb=-25`, `bedDuckDb=6`, `duckAttack=120`, `duckRelease=1400`.
- Evitar conversación cansada: dividir el programa en secciones, alternar
  pregunta/respuesta, casos concretos, resumen práctico y dudas frecuentes.
- Los comerciales son espacios editables, no contenido editorial inventado:
  `kind: "ad"`, `adSlot: true`, `adDurationSec`.
- DeepSeek puede proponer enfoque, preguntas y subtemas, pero no puede inventar
  derechos, cifras, plazos, artículos ni cláusulas fuera del Evidence Pack.
- Si el usuario agrega contexto, usar `/director/ajustar` para modificar solo
  el alcance pedido (`all` o una escena), conservando el resto del guion.

## Biblioteca Normativa en la app

El estado de documentos se muestra en lenguaje operativo:

- `Listos para citar`: copia local original + SHA-256 + extracción + chunks en
  `catalog.sqlite`.
- `Bloqueados por el portal oficial`: el documento existe, pero el servidor del
  IMSS respondió `HTTP_403` o `WAF_BLOCK`.
- `Por revisar`: falta URL, vigencia, validación editorial o carga manual.

No usar DeepSeek para rellenar contenido de fuentes bloqueadas. Las páginas
índice del IMSS pueden confirmar que una clave existe, pero el contenido solo se
cita cuando el PDF original queda integrado al corpus. Para completar esos
casos: `npm run normativa:update`, luego `npm run normativa:discover`, y si el
portal sigue bloqueando, `npm run normativa:recover`. Este recuperador prueba
descarga directa, `curl`, Playwright y rutas oficiales alternas. Si aun así el
portal solo permite descarga manual, guardar los PDFs en una carpeta y correr
`npm run normativa:recover -- --manual-dir <carpeta>`; los nombres aceptados
son id, clave o nombre del PDF oficial. El importador valida PDF real, SHA-256,
extracción y chunks antes de dejarlo en `catalog.sqlite`.

Estado confirmado el 2026-08-18:

- `npm run normativa:report` registró 71 documentos, 7,593 secciones, 14,715
  chunks y 153 referencias aún no localizadas.
- La pantalla de inicio puede mostrar menos "documentos listos" porque usa el
  criterio publicable: fuente local completa, extraída e indexada.
- La recuperación automática por tandas debe retomarse; fue interrumpida antes
  de ejecutarse. No asumir que las estrategias de `fetch`, `curl`, Playwright,
  rutas alternas o carpeta manual ya se agotaron.

Estrategia recomendada para ampliar la base:

1. `npm run normativa:update critical`
2. `npm run normativa:update all`
3. `npm run normativa:discover`
4. `npm run normativa:recover -- --limit 10 --wait-ms 6000`
5. Si el portal bloquea, repetir con `--headed` para observar el navegador.
6. Si la descarga solo es manual, usar
   `npm run normativa:recover -- --manual-dir <carpeta>`.
7. Cerrar con `npm run normativa:index`, `npm run normativa:verify` y
   `npm run normativa:report`.

No subir a verificado una fuente bloqueada manualmente. Para citarla en guion
debe existir PDF/HTML original local, SHA-256, extracción, chunks, citas y
registro en `data/normativa/catalog.sqlite`.

## Arquitectura

- **Sidecar local (`sidecar/`)**: proceso Node (se empaqueta con esbuild en
  `dist/sidecar.js`) que expone HTTP en `127.0.0.1:3977`. Reutiliza
  `@la-veinte/tts-core` (motor Qwen Base clone por referencia, proceso desechable
  por bloque con watchdog externo, caché por bloque) y el corpus normativo
  (`NormativeCatalog`, búsqueda FTS5, cobertura documental). En esta máquina,
  Tauri lo arranca automáticamente con `node` local; empaquetar `node.exe` como
  recurso distribuible queda como siguiente endurecimiento si se instala en
  otra PC.
- **DeepSeek/LLM**: se resuelve con `resolveProvider` desde la configuración
  existente. DeepSeek es preferente para investigación, dirección y ajustes de
  guion cuando está configurado. Siempre recibe Evidence Pack y mapa documental;
  si falla, el director conserva fallback determinista.
- **UI** (`src/`): Inicio · Crear episodio (tema/duración/contexto/comerciales/
  cobertura/CREAR GUION CON DEEPSEEK como acción principal; REVISAR FUENTES y
  ARMAR GUION RÁPIDO como herramientas secundarias → guion editable por turnos
  y escenas → ajuste parcial con DeepSeek → GENERAR EPISODIO) ·
  Producción (progreso real por locutor, caché, GPU/VRAM/temp, tiempo restante,
  master MP3/WAV) · Biblioteca Normativa · Locutores · Biblioteca de audio.
- **radio-core**: `buildProductionPlan` (bloques de voz + sesiones de modelo),
  `buildTimeline` (voz + música/jingle/fx con volumen), `DialogueDiversityAnalyzer`,
  `DialoguePolisher`, QA editorial y estimaciones con RTF real.
- **Motor de voz**: Qwen3-TTS-12Hz-1.7B-Base (`generate_voice_clone`) en NVIDIA
  GPU (RTX 3060, offline, $0). Cada bloque se genera en un proceso desechable con
  watchdog externo (SIGTERM → SIGKILL) que evita cuelgues; el launcher corta al
  grupo de procesos completo. Referencias vocales registradas en
  `data/tts/voices/*/v1/reference.wav` con SHA-256 validado: `EDUARDO`,
  `ANDREA`, `JAVIER` (narrador) y `RODRIGO` (corresponsal). Auto-reintentos
  (2 intentos por bloque) y modo por cláusula como amortiguador de fallos.
  Producto final publicable: Qwen Base clone. edge/SAPI no se usan salvo
  maqueta o emergencia marcada y con aprobación explícita del usuario.
- **Motor de música**: ACE-Step 1.5 local en `tools/ACE-Step-1.5`, API
  `127.0.0.1:8001`, generación por worker independiente y cola persistente en
  `data/tts/jobs/musica-actual.json`.

## Verificación mínima

```powershell
npm exec vitest run packages/radio-core/src/__tests__/editorial-qa.test.ts packages/radio-core/src/__tests__/director.test.ts
cd apps/radio-studio/sidecar; npm run bundle
cd ..; npm run build
npm run tauri -- build
```

Al probar manualmente:

- Abrir el ejecutable.
- Confirmar que el pie diga `Motor local conectado`.
- Entrar a Biblioteca de audio y esperar que ACE-Step pase de `encendiendo` a
  `en línea`.
- Generar un jingle corto antes de intentar una cama larga.
- Crear un episodio desde `Nuevo episodio` con DeepSeek, contexto adicional y
  comerciales habilitados.
