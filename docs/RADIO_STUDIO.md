# AI Radio Studio: guía para agentes

Última actualización: 2026-08-18

Esta guía es la fuente de verdad operativa para el flujo de podcast de La
Veinte Digital. Si vas a tocar el estudio, lee esto junto con `AGENTS.md` y
`apps/radio-studio/README.md`.

## Estado actual confirmado (2026-08-18)

El estudio ya quedó compilado como ejecutable de Windows. Antes de reconstruir
otra vez, conservar este orden:

1. `npm run bundle` en `apps/radio-studio/sidecar`.
2. `npm run build` en `apps/radio-studio`.
3. `npm run tauri -- build` en `apps/radio-studio` con MinGW en `PATH`.

Último instalador generado:
`apps/radio-studio/src-tauri/target/release/bundle/nsis/AI Radio Studio_0.1.0_x64-setup.exe`.

Verificación ejecutada el 2026-08-18:

- Build raíz Next.js: correcto.
- Pruebas: 906 pasaron, 10 omitidas.
- Build Vite/Tauri: correcto.
- `/casting` devuelve exactamente cinco perfiles oficiales con preview de voz.

Estado documental observado ese mismo día con `npm run normativa:report`:

- 71 documentos en el catálogo.
- 10 vigentes, 55 en revisión, 6 históricos.
- 7,593 secciones indexadas.
- 14,715 chunks.
- 153 referencias aún no localizadas.
- La tarjeta del estudio puede mostrar un conteo más estricto, por ejemplo
  "Documentos listos: 35/71", porque solo cuenta fuentes con evidencia local
  completa y publicable.

El intento de recuperación automática de fuentes bloqueadas fue interrumpido
por el usuario antes de ejecutarse. El próximo agente debe retomarlo desde el
flujo de recuperación documental descrito abajo, no asumir que ya se agotaron
fetch, curl, Playwright o recuperación manual.

## Qué debe ir al repo y qué debe quedarse local

El usuario confirmó que AI Radio Studio se usa localmente, pero toda la
documentación y todo lo que define la producción actual debe quedar en el repo.

Sí debe versionarse:

- Código fuente de `apps/radio-studio/`, `packages/radio-core/` y
  `packages/tts-core/`.
- Documentación operativa: `docs/RADIO_STUDIO.md`, `apps/radio-studio/README.md`
  y reglas de `AGENTS.md`.
- Manifiestos y scripts que definen corpus, recuperación, voces y producción:
  `resources/normativa/bootstrap-sources.yaml`, scripts de `src/features/normativa/cli/`
  y scripts de voz en `scripts/`.
- Activos editoriales estables que cambian el resultado del episodio:
  `data/tts/ref/mariana.wav`, `data/tts/ref/narrador.wav`,
  `data/tts/ref/rodrigo.wav`, `data/tts/ref/valeria.wav`,
  `data/tts/music/bed-uniforme-vivo.wav` y
  `data/tts/music/jingle-uniforme-vivo.wav`.

No debe versionarse:

- `data/normativa/`: PDFs/HTMLs oficiales descargados, `catalog.sqlite`,
  índices, probes y corpus local. Es fuente local verificable, pero pesada y
  regenerable desde manifiestos/manual recovery.
- `data/tts/cache/`, `data/tts/master/`, `data/tts/episodes/`,
  `data/tts/jobs/`, `data/tts/casting/`, logs y previews generados.
- Modelos y entornos: `data/tts/models/`, `data/tts/venv/`, `tools/piper/` y
  `tools/ACE-Step-1.5/`. ACE-Step pesa ~16 GB en esta máquina.
- Builds e instaladores: `apps/radio-studio/dist/`,
  `apps/radio-studio/sidecar/dist/` y `apps/radio-studio/src-tauri/target/`.

Si una voz, música o modelo cambia el sonido final, documentar el cambio y
subir solo el activo estable pequeño o el script reproducible. No subir backups
como `*-backup-*`, raws de Piper, previews de casting ni masters terminados
salvo que el usuario pida publicar un episodio como artefacto.

## Objetivo del producto

AI Radio Studio debe sentirse como un programa real, no como una prueba técnica.
La experiencia esperada es:

- El usuario abre el ejecutable.
- Cada apertura empieza como trabajo nuevo: no restaurar guion, contexto ni cola
  de producción de la sesión anterior. Se conservan preferencias como locutores.
- La app levanta el motor local sin pedir comandos manuales.
- DeepSeek investiga el tema con base en toda la documentación disponible.
- El director arma un guion vivo, por secciones, con contexto editable.
- El usuario puede ajustar una parte sin borrar el guion completo.
- El episodio permite espacios comerciales editables.
- La producción usa voces locales, cama uniforme, intro/outro breve y master
  listo para publicar.

## Principios que no se deben romper

- La documentación manda, no la IA. DeepSeek solo organiza, pregunta y escribe
  con el Evidence Pack y el mapa documental recibido.
- Toda afirmación normativa sobre derechos, cifras, plazos, artículos,
  cláusulas o procedimientos requiere soporte en el corpus.
- La conversación debe variar: secciones, casos concretos, preguntas reales,
  resúmenes prácticos y cambios editoriales sin volverse repetitiva.
- No usar cortinillas internas por defecto. El usuario pidió música de intro y
  final solamente, super corta, para ambientar.
- Las transiciones internas se marcan como `transition: "cambio editorial"`.
- La cama ambiental debe sonar uniforme y baja, no subir y bajar de forma
  distractora.
- Los comerciales son espacios editables, no texto editorial inventado.
- El guion generado se debe poder corregir por partes. No borrar todo al aplicar
  contexto nuevo salvo que el usuario lo pida expresamente.
- El ejecutable debe intentar levantar servicios locales automáticamente.

## Flujo editorial

### Escaleta permanente del programa

Todo episodio de La Veinte Digital debe seguir esta dinámica, tanto en DeepSeek
como en el director rápido:

1. `Apertura breve`: saludo único, tema del día y promesa concreta.
2. `Caso de arranque`: situación cotidiana de trabajador IMSS, sin inventar
   experiencia personal de los locutores.
3. `Qué dice la normativa`: regla base explicada en lenguaje hablado, con citas
   naturales del Evidence Pack.
4. `Ojo con esto`: error común, abuso frecuente, confusión de pasillo o límite
   de la regla.
5. `Caso práctico` o `Consultorio`: ejemplo hipotético, duda frecuente o
   contraste entre dos situaciones.
6. `Cómo documentarlo`: qué revisar, guardar o preguntar antes de reclamar o
   aclarar.
7. `Cierre práctico`: resumen en pasos concretos y despedida cálida.

Para episodios de 15 minutos o más, alternar subtemas dentro del mismo tema
central: regla, excepción, trámite, ejemplo, error común, documento faltante,
duda frecuente y paso práctico. Nunca convertir el episodio en una lista plana
de preguntas ni en lectura de artículos.

1. `Nuevo episodio` recibe tema, duración, nivel, contexto adicional y opción de
   comerciales.
   La acción principal en UI es `CREAR GUION CON DEEPSEEK`. `REVISAR FUENTES`
   solo muestra cobertura documental y `ARMAR GUION RÁPIDO` usa el director
   seleccionado como herramienta secundaria.
2. `/investigar` arma Evidence Pack desde `data/normativa/catalog.sqlite` y
   envía también un mapa documental a DeepSeek si hay provider configurado.
3. `/director` usa `modo: "ia"` por defecto. DeepSeek es preferente cuando está
   configurado; si falla, se usa el director determinista.
4. El director divide el programa en segmentos para cubrir 20-30 minutos sin
   monotonía.
5. `DialogueDiversityAnalyzer` y `DialoguePolisher` reducen muletillas,
   repeticiones, dominancia de un locutor e inicios demasiado similares.
6. `sanitizeEditorialScript` limpia reglas editoriales, incluyendo cortinillas
   internas.
7. `insertSponsorSlots` agrega bloques comerciales editables cuando
   `comerciales !== false`.
8. `/director/ajustar` recibe `script`, `contexto` y `scope`; ajusta solo el
   alcance indicado y re-verifica el resultado.
9. `/generate` produce voces con Chatterbox por worker independiente.
10. `/master` mezcla voces con cama uniforme, intro/outro breve, loudnorm y
    exportación MP3/WAV.

## Reglas de audio

Defaults de master:

- `kbps`: 192
- `bedGainDb`: -25
- `bedDuckDb`: 6
- `duckAttack`: 120
- `duckRelease`: 1400
- `bed`: automático salvo que el usuario lo desactive
- `jingle`: automático salvo que el usuario lo desactive

Regla actual: el master inserta música breve solo al inicio y al final. No
insertar separadores musicales internos como comportamiento por defecto.

Identidad sonora obligatoria:

- La apertura y el cierre deben usar el mismo motivo musical o variaciones de
  la misma familia sonora.
- La cama debe sentirse hermana del intro/outro: mismo tempo aproximado,
  instrumentación compatible, energía institucional-moderna y sin voces.
- Por defecto se prefieren archivos llamados `jingle-uniforme-*`,
  `bed-uniforme-*`, `lv-theme-*`, `la-veinte-*` o `brand-*`.
- No generar un estilo distinto para cada episodio. Si se crean variaciones,
  deben sonar como paquete de marca, no como canciones independientes.
- Duración objetivo: intro 5-8 s y cierre 5-8 s. Puede usarse el mismo archivo
  para ambos; si hay dos archivos, deben compartir motivo.

ACE-Step genera assets locales en `data/tts/music/<tipo>-ace-<id>.wav`.
La licencia se registra como MIT de ACE-Step; placeholders o assets de origen
desconocido no deben exportarse sin confirmar licencia.

Calidad vocal obligatoria:

- Un episodio publicable debe producirse con Chatterbox LatAm y el reparto
  oficial: Eduardo (`A`), Andrea (`B`), Alonso (`N`), Rodrigo Torres (`C`) y
  Valeria Soto (`P`).
- SAPI/edge-tts son fallback técnico de emergencia o maqueta, no producto final
  publicable, salvo que el usuario acepte explícitamente esa calidad.
- Para naturalidad, preferir turnos breves de una o dos frases. Bloques largos
  vuelven lenta la generación y pueden sonar menos orgánicos.
- Si la laptop está en batería o la GPU está saturada, pausar y recomendar
  conectar corriente antes de producir el master final.

## DeepSeek y documentación

DeepSeek se usa para:

- Investigación del tema con preguntas de interés para trabajadores.
- Selección de enfoque y subtemas.
- Guion conversacional por segmentos.
- Ajustes parciales del guion con contexto adicional.

DeepSeek no debe:

- Inventar normativa.
- Escribir derechos, porcentajes, plazos o artículos sin evidencia.
- Usar documentación fuera del Evidence Pack como si fuera fuente.
- Convertir comerciales en recomendaciones legales o sindicales.

El sidecar debe enviar a DeepSeek:

- Evidence Pack de chunks relevantes.
- Mapa documental completo disponible.
- Contexto adicional escrito por el usuario.
- Reglas editoriales vigentes.

Si no hay cobertura suficiente, el guion debe decirlo como advertencia o duda,
no rellenar con suposiciones.

## Biblioteca Normativa y fuentes bloqueadas

El contador de la Biblioteca Normativa distingue tres cosas:

- `disponibles`: documentos con copia local original, SHA-256, texto extraído e
  índice FTS.
- `bloqueadas`: fuentes oficiales que existen, pero cuyo servidor respondió
  `HTTP_403`, `WAF_BLOCK`, `TEMPORARY_BLOCK` o `RETRY_AFTER`.
- `por revisar`: documentos sin versión local, con vigencia desconocida o con
  verificación editorial pendiente.

No convertir una fuente bloqueada en `AVAILABLE` manualmente. Para que un
documento pueda alimentar a DeepSeek como evidencia, debe existir el original
local en `data/normativa/documents/...`, su `metadata.json`, `sha256.txt`,
`extracted.txt`, `chunks.jsonl` y `citations.jsonl`, y debe estar registrado en
`catalog.sqlite`.

Cuando el portal del IMSS bloquee procedimientos (`HTTP_403` o Incapsula):

1. Ejecutar `npm run normativa:update` para reintentar con backoff respetuoso.
2. Ejecutar `npm run normativa:discover` para confirmar referencias oficiales.
3. Ejecutar `npm run normativa:recover` para probar recuperación con `fetch`,
   `curl`, Playwright y rutas oficiales alternas conocidas.
4. Usar espejos oficiales permitidos solo si están en el manifiesto o se agregan
   explícitamente con procedencia clara.
5. Si el PDF solo puede obtenerse manualmente desde navegador, integrarlo con
   `npm run normativa:recover -- --manual-dir <carpeta>`; el archivo debe
   llamarse como el id (`IMSS-1A74-003-031.pdf`), la clave
   (`1A74-003-031.pdf`) o el nombre del PDF de la URL oficial. El importador
   valida que sea PDF real, calcula SHA-256, extrae texto/chunks/citas y deja
   estado inicial `PENDING_REVIEW`.

Las páginas índice del IMSS sirven para confirmar que una clave existe, pero no
sustituyen al PDF original para citar contenido. El episodio puede generarse
como borrador con advertencia, pero no debe marcarse como publicable/verificado
si falta el procedimiento específico del tema.

### Estrategia para ampliar la base documental

La prioridad del usuario es tener todo lo posible en local e indexado para que
DeepSeek y también modelos locales pequeños investiguen con poco contexto. El
orden recomendado es:

1. Correr `npm run normativa:report` y guardar mentalmente la línea base.
2. Correr `npm run normativa:update critical` para fuentes críticas y leyes.
3. Correr `npm run normativa:update all` cuando haya tiempo; respeta el delay
   largo porque `imss.gob.mx` bloquea ráfagas.
4. Correr `npm run normativa:discover` para refrescar páginas índice y enlaces
   oficiales.
5. Correr `npm run normativa:recover -- --limit 10 --wait-ms 6000` por tandas.
   Si una tanda no recupera nada, probar `--headed` para que Playwright abra el
   navegador y permita observar si hay desafío del portal.
6. Para procedimientos IMSS que solo bajen manualmente desde navegador, guardar
   los PDFs en una carpeta temporal y ejecutar
   `npm run normativa:recover -- --manual-dir <carpeta>`. Usar nombres como
   `IMSS-1A74-003-031.pdf`, `1A74-003-031.pdf` o el nombre oficial del archivo.
7. Después de cada recuperación, correr `npm run normativa:index`,
   `npm run normativa:verify` y `npm run normativa:report`.
8. No marcar una fuente como vigente o publicable solo porque aparece en una
   página índice. Debe existir original local, SHA-256, texto extraído, chunks,
   citas y registro en `catalog.sqlite`.

Fuentes de más valor para episodios de trabajadores:

- Procedimientos de asistencia, puntualidad, sustituciones, vacaciones,
  cambios de horario, guardias, permisos, incapacidades, fondo de ahorro,
  antigüedad, sanciones, bolsa de trabajo y tiempo extraordinario.
- Ley Federal del Trabajo, Ley del Seguro Social, CPEUM, LGRA, Ley General de
  Salud, reglamentos interiores y NOMs laborales aplicables.
- CCT vigente y anexos virtuales: RIT, Bolsa, Escalafón, Becas, Capacitación,
  Jubilaciones, Infectocontagiosidad y Cambio de Rama.

Cuando una fuente siga bloqueada:

- Mantener `source_states` con `HTTP_403`, `WAF_BLOCK`, `TEMPORARY_BLOCK` o
  `RETRY_AFTER`.
- Permitir borradores con advertencia, pero no publicación verificada.
- No reemplazar el PDF oficial por texto resumido, capturas, IA o copias sin
  procedencia clara.
- Agregar espejo solo si es dominio permitido o si se documenta explícitamente
  su procedencia institucional.

## Reparto oficial y voces

La sección `Locutores` no es un editor técnico de voces: debe mostrar solo el
reparto oficial con tarjetas claras, función editorial y preview de audio.
`Nuevo episodio` debe mostrar esos mismos personajes como selección intuitiva.
Eduardo, Andrea y Alonso son base fija; Rodrigo y Valeria se pueden activar o
desactivar según el formato, aunque Valeria se activa automáticamente cuando el
episodio deja espacios comerciales.

El sidecar expone el casting por `/casting`. La UI debe leer ese endpoint para
mostrar `previewAudioPath` y reproducir las muestras desde `/media`. No mostrar
botones para "agregar invitado", "experto" o voces genéricas mientras no exista
una identidad de audio aprobada, referencia local, licencia y regla editorial.

Al crear el guion, la UI debe enviar a `/director` solo los perfiles
seleccionados. El director IA y DeepSeek deben considerar esos personajes en el
reparto del diálogo:

- Eduardo conduce, ordena y aterriza preguntas.
- Andrea explica, cuestiona y traduce lo normativo a lenguaje cotidiano.
- Alonso narra fuentes, abre/cierra bloques y mantiene tono serio.
- Rodrigo Torres entra como corresponsal cuando aporta reporte de campo,
  ambiente de unidad o dudas de piso.
- Valeria Soto entra solo en menciones comerciales editables, patrocinios o
  avisos pagados.

Importante: las ranuras `A/B/N/C/P` son la identidad de audio disponible en el
motor actual; los demás rasgos guían escritura, actuación y reparto del diálogo
en DeepSeek.

Asignación obligatoria actual:

- `A`: Eduardo, voz integrada de Chatterbox.
- `B`: Andrea, referencia `data/tts/ref/mariana.wav`, generada desde Piper
  `es_MX-claude-high` para tener una co-conductora mas expresiva y con mejor
  energia que la voz SAPI anterior.
- `N`: Alonso, narrador, referencia propia `data/tts/ref/narrador.wav`, generada desde
  Piper `es_MX-ald-medium`; debe sonar serio, adulto, institucional y con acento
  latinoamericano neutro.
- `C`: Rodrigo Torres, corresponsal, referencia `data/tts/ref/rodrigo.wav`,
  generada desde Piper `es_ES-davefx-medium`; entra para reportes de campo,
  dudas de unidades y contexto de piso.
- `P`: Valeria Soto, voz comercial, referencia `data/tts/ref/valeria.wav`,
  generada desde Piper `es_AR-daniela-high`; entra solo en patrocinios, menciones
  y avisos pagados editables.

Ningun personaje premium debe apuntar a otra referencia ni caer al default `A`. La
producción debe mandar siempre el mapa de voces del guion a `/generate`; si no
llega mapa, el sidecar debe resolver `NARRADOR`/`ALONSO` como `N`,
`RODRIGO`/`CORRESPONSAL` como `C` y `VALERIA`/`COMERCIAL`/`PATROCINIO` como `P`. El archivo
`mariana.wav` se regenera con `scripts/generate-andrea-piper-ref.ps1`; conservar
la fuente Piper local en `data/tts/models/piper/es_MX-claude-high/` y el motor en
`tools/piper/`. Si Andrea vuelve a sonar plana o con poco entusiasmo, regenerar
esa referencia antes de tocar el guion.

`narrador.wav` es una referencia separada con SHA propio; no borrarlo ni
reemplazarlo por la referencia de Andrea. Si se agrega una voz real mejor para
el narrador, actualizar `VOICE_SLOTS.N`, `VOICE_REFS.N`, `voiceSourceId` y las
cache keys. La referencia premium actual se regenera con
`scripts/generate-narrador-piper-ref.ps1`; conservar la fuente Piper local en
`data/tts/models/piper/es_MX-ald-medium/`. No usar una voz aguda, juvenil o
caricaturizada para el narrador porque rompe la seriedad editorial.

`rodrigo.wav` y `valeria.wav` se regeneran con
`scripts/generate-extra-premium-voice-refs.ps1`; conservar sus modelos en
`data/tts/models/piper/es_ES-davefx-medium/` y
`data/tts/models/piper/es_AR-daniela-high/`. Rodrigo no debe leer comerciales;
Valeria no debe participar en contenido editorial.

No descargar modelos de voz nuevos sin decidir proveedor, licencia, VRAM
esperada, cache keys y prueba de calidad. Si se agregan voces reales, mantener
la regla de identidad: cache por texto + speakerId + voiceSourceId +
referenceAudioSha256/modelRevision.

## Comerciales

Los comerciales se modelan como turnos especiales:

- `kind: "ad"`
- `adSlot: true`
- `adDurationSec`: 15, 30, 45 o 60
- `sponsorName`: `null` mientras no exista patrocinador

La UI debe permitir insertarlos y editar su texto. El director IA no debe
escribir comerciales como parte del contenido editorial; el sidecar los inserta
aparte para mantenerlos reemplazables.

## Arranque automático

Tauri:

- Archivo: `apps/radio-studio/src-tauri/src/lib.rs`.
- Al iniciar, revisa `127.0.0.1:3977`.
- Si el sidecar ya responde, no hace nada.
- Si no responde, lanza `node --no-warnings <ruta absoluta>/apps/radio-studio/sidecar/dist/sidecar.js`.
- Usa la raíz del repo como `cwd`.
- Logs: `data/tts/sidecar-tauri.log`.
- La ruta del proyecto contiene espacios (`Axel Rosete`, `La Veinte Digital`):
  no construir el comando como una sola cadena (`cmd /C "node ..."`). Debe
  usarse `Command::new("node").arg("--no-warnings").arg(&sidecar)` para que
  Windows no corte la ruta en los espacios.

Sidecar:

- Archivo: `apps/radio-studio/sidecar/src/index.ts`.
- Debe responder `OPTIONS` con CORS antes de rutear. La ventana Tauri hace
  preflight para POST JSON; si falta, la UI muestra `Failed to fetch` aunque
  PowerShell sí pueda llamar `/director`.
- `/musica/motor` revisa `127.0.0.1:8001`.
- Si ACE-Step no responde, intenta arrancarlo.
- Comando: `uv run --no-sync acestep-api`.
- `cwd`: `tools/ACE-Step-1.5`.
- Fuerza `ACESTEP_COMPILE_MODEL=false`.
- Logs: `data/tts/ace-step-api.log`.
- No reintenta más de una vez por minuto para evitar procesos duplicados.

La UI:

- Archivo: `apps/radio-studio/src/screens/BibliotecaAudio.tsx`.
- Debe mostrar `encendiendo` mientras ACE-Step carga.
- Debe refrescar periódicamente el estado del motor.
- No debe presentar el comando manual como flujo principal.

## Construcción del ejecutable

Antes de empaquetar:

```powershell
cd apps/radio-studio/sidecar
npm run bundle

cd ..
npm run build

$env:PATH = "C:\Users\Axel Rosete\msys64\msys64\mingw64\bin;$env:USERPROFILE\.cargo\bin;$env:PATH"
npm run tauri -- build
```

El instalador queda en:

`apps/radio-studio/src-tauri/target/release/bundle/nsis/AI Radio Studio_0.1.0_x64-setup.exe`

El ejecutable directo queda en:

`apps/radio-studio/src-tauri/target/release/radio-studio.exe`

Cerrar `radio-studio.exe` antes de reconstruir. Si está abierto, Rust/Tauri no
puede reemplazarlo y falla con `Acceso denegado`.

## Verificación mínima

```powershell
npm exec vitest run packages/radio-core/src/__tests__/editorial-qa.test.ts packages/radio-core/src/__tests__/director.test.ts
cd apps/radio-studio/sidecar
npm run bundle
cd ..
npm run build
npm run tauri -- build
```

Prueba manual:

- Abrir el ejecutable.
- Confirmar `Motor local conectado`.
- Abrir `Biblioteca de audio`.
- Esperar que ACE-Step pase de `encendiendo` a `en línea`.
- Generar un jingle corto antes de una cama larga.
- Crear un episodio con DeepSeek, contexto adicional y comerciales habilitados.
- Ajustar una escena con `/director/ajustar` desde la UI sin perder el resto del
  guion.

## Antipatrones

- No regresar al flujo de “abre una terminal y corre ACE-Step” como experiencia
  principal.
- No restaurar cortinillas internas por defecto.
- No convertir `transition: "cambio editorial"` en música real dentro del
  master.
- No permitir que DeepSeek escriba fuera del corpus.
- No reemplazar el guion completo cuando el usuario solo agregó contexto para
  una parte.
- No bloquear el sidecar HTTP durante TTS o música: usar workers y colas.
- No quitar el fallback determinista del director.
- No subir o modificar PDFs originales de `data/normativa/`.
- No empaquetar un instalador sin recompilar `sidecar/dist/sidecar.js`.

## Archivos principales

- `apps/radio-studio/src/screens/CrearEpisodio.tsx`: flujo de investigación,
  guion, contexto, comerciales y ajustes parciales.
- `apps/radio-studio/src/screens/BibliotecaAudio.tsx`: música local y estado
  ACE-Step.
- `apps/radio-studio/src/lib/studio-api.ts`: cliente HTTP del sidecar.
- `apps/radio-studio/sidecar/src/index.ts`: endpoints locales, DeepSeek,
  director, master, música y auto-arranque ACE-Step.
- `apps/radio-studio/sidecar/worker/chatterbox_worker.ts`: producción TTS.
- `apps/radio-studio/sidecar/worker/musica_worker.ts`: generación musical.
- `packages/radio-core/src/director.ts`: tipos de guion, turnos, personas y
  director determinista.
- `packages/radio-core/src/editorial-qa.ts`: reglas de calidad editorial.
- `packages/radio-core/src/diversity.ts`: análisis de variedad.
- `packages/radio-core/src/polisher.ts`: pulido de estilo.
- `apps/radio-studio/src-tauri/src/lib.rs`: arranque automático del sidecar.
