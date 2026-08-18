<!-- Version: 0.005 -->
<!-- Last updated: 2026-07-31 -->
<!-- BEGIN:nextjs-agent-rules -->
# ⚠️ This is NOT the Next.js you know

This version (16.2.12) has breaking changes — APIs, conventions, and file structure may all differ from your training data.

**ALWAYS READ the relevant guide in `node_modules/next/dist/docs/` before writing any code.** Heed deprecation notices.

## Critical differences in this version:

- **Middleware is `proxy.ts`** (not `middleware.ts`). The function must be named `proxy`, not `middleware`. Next.js will warn if you name it `middleware`. File lives at `src/proxy.ts`.
- **ESLint config uses `eslint/config`** with `eslint-config-next` packages (flat config at `eslint.config.mjs`). Do NOT use `.eslintrc.*`.
- **`postcss.config.mjs`** exists but Tailwind is NOT used in components — all styling is inline `style={{}}`.
- **React 19.2.4** — verify APIs before using newer React features.
- **TypeScript 5.x** with `bundler` module resolution.
- **`Link` component** from `next/link` is required for internal navigation. Do NOT use `<a>` tags for internal links.
<!-- END:nextjs-agent-rules -->

---

# 🏛️ Architecture Rules

## Directory structure

```
src/
├── app/                   ← ONLY page.tsx files + API routes
│   ├── (auth)/            ← public routes (login, register, callback)
│   └── (dashboard)/       ← protected routes (all features)
│
├── features/              ← ONE folder per domain module
│   ├── asistente/         ← example module
│   │   ├── components/    ← React components
│   │   ├── hooks/         ← custom hooks
│   │   └── services/      ← API calls, data fetching
│   ├── tarjeton/          ← IMSS payslip PDF importer (PDF.js + OCR + review)
│   │   ├── components/    ← Dropzone, Review, Summary, ImportSuccess
│   │   ├── hooks/         ← useTarjetonImporter (state machine)
│   │   ├── services/      ← confirm-tarjeton, payslip-sync
│   │   └── lib/           ← pure parsers, sanitize, confidence, PDF/OCR
│   └── (other features)/
│
├── shared/                ← shared across ALL features
│   ├── components/
│   │   ├── ui/            ← reusable UI primitives (Button, Input, Card, etc.)
│   │   └── layout/        ← Navbar, Sidebar, etc.
│   ├── hooks/             ← shared hooks (useUser, etc.)
│   ├── services/          ← shared services (local-storage, etc.)
│   ├── contracts/         ← cross-feature contracts (tarjeton-import, calculator-prefill)
│   └── lib/               ← utils, helpers
│
├── lib/                   ← INFRASTRUCTURE (NOT business logic)
│   ├── supabase/          ← client, server, types ONLY
│   └── services/auth.ts   ← auth infrastructure (kept here because it's cross-cutting)
│
└── proxy.ts               ← auth middleware (NOT middleware.ts)
```

## Rule 1: Never put business logic in `app/` or `lib/`

- `app/` should ONLY have thin page.tsx files that import from `features/`
- `lib/` is ONLY for infrastructure (Supabase client setup, DB types)
- Business logic, components, hooks, and services go in `features/<module>/`

## Rule 2: Feature modules are self-contained

Each feature folder has its own:
- `components/` — React components
- `hooks/` — custom hooks
- `services/` — API calls and data fetching logic

**NEVER import across feature boundaries.** If code is needed by multiple features, promote it to `shared/`.

## Rule 3: ALWAYS use shared UI components

| Component | Import | Props |
|-----------|--------|-------|
| Button | `@/shared/components/ui/Button` | `variant`: "primary"\|"secondary"\|"ghost", `size`: "sm"\|"md", `loading`, `disabled` |
| Input | `@/shared/components/ui/Input` | `label`, plus all `<input>` props |
| Textarea | `@/shared/components/ui/Input` | `label`, plus all `<textarea>` props |
| Select | `@/shared/components/ui/Input` | `label`, plus all `<select>` props |
| Card | `@/shared/components/ui/Card` | `padding` (default "1.25rem"), `style` |
| Avatar | `@/shared/components/ui/Avatar` | `icon`, `size` (default 32), `gradient` |
| LoadingSpinner | `@/shared/components/ui/LoadingSpinner` | `text` (default "Cargando...") |

**DO NOT write inline `<button>`, `<input>`, `<select>`, `<textarea>` elements.** Use the shared components.

## Rule 4: Inline styles with CSS variables — NOT Tailwind

All components use `style={{}}` with these CSS variables (defined in `globals.css`):

```css
--bg: #f8fafc;         /* page background */
--fg: #0f172a;         /* text color */
--primary: #2563eb;    /* primary blue */
--primary-fg: #ffffff; /* text on primary */
--border: #e2e8f0;     /* borders */
--muted: #64748b;      /* secondary text */
--card: #ffffff;       /* card background */
--accent: #f1f5f9;     /* subtle gray background */
```

**NEVER add Tailwind classes.** Tailwind is installed but should NOT be used in components.

## Rule 5: Import conventions

```
@/features/<module>/components/<Component>
@/features/<module>/hooks/<hook>
@/features/<module>/services/<service>
@/shared/components/ui/<Component>
@/shared/hooks/<hook>
@/shared/services/<service>
@/shared/contracts/<contract>
@/shared/lib/utils
@/lib/supabase/client
@/lib/supabase/server
@/lib/supabase/types
```

The `@/` alias maps to `./src/` (configured in `tsconfig.json`).

## Rule 6: Proxy (middleware) — auth guard

The file `src/proxy.ts` uses Supabase SSR cookie-based auth. Pages are protected
by default. Every API route must be listed exactly in
`src/shared/server/routing/route-policy.ts`; unknown APIs return JSON 404.
Authenticated API routes must also call `requireUser()` inside the route handler.
The proxy is an optimistic boundary, never the only authorization layer.

## Rule 7: Database access

- **Server components**: use `@/lib/supabase/server` (`createClient()` is async)
- **Client components**: use `@/lib/supabase/client` (`createClient()` is sync)
- **DO NOT create Supabase clients inline** — always use the pre-configured clients
- **Type safety**: import types from `@/lib/supabase/types` (auto-generated `Database` type, `Tables<>`, `TablesInsert<>`, `TablesUpdate<>`)

## Rule 8: Server Actions with `useActionState`

Forms use `useActionState` with `"use server"` actions. Pattern:

```tsx
"use client"
import { useActionState } from "react"

const [state, formAction, pending] = useActionState(
  async (prev, formData: FormData) => {
    // logic
    return { error?: string, success?: boolean }
  },
  undefined
)
```

## Rule 9: Chat Bot — two backends

The chat assistant has two parallel backends:

1. **Next.js API route** at `/api/consulta` — uses OpenAI embeddings + cosine similarity on `vectorstore-data.json`
2. **Python FastAPI** (optional) — uses LangChain + FAISS, configured via server-only `BOT_API_URL` + `BOT_API_SHARED_SECRET`

The frontend (`features/asistente/services/bot.ts`) ALWAYS calls `/api/consulta` (auth + quota). That route invokes the Python bot with the `X-Bot-Secret` header when configured, and falls back to the direct OpenAI engine. Do NOT introduce client-side access to the Python bot (no `NEXT_PUBLIC_*` bot env vars).

**DO NOT create a third implementation.** If modifying the bot, update BOTH backends or consolidate to one.

The social chat (`/chat`, `features/chat`) and forum (`/foro`, `features/foro`)
are retired. Do not restore them. The AI assistant (`/asistente`,
`features/asistente`, `/api/consulta`, `bot-api`, `ai_chat_history`) remains active.

## Rule 10: System prompts

The AI assistant's personality is defined in two places:
- `src/app/api/consulta/route.ts` (Next.js version)
- `bot-api/embedding_service.py` (Python version)

Both must be kept in sync. The bot speaks Spanish, uses **negritas**, emojis with moderation, and acts as a friendly ally to workers.

## Rule 11: Tarjetón IMSS — client-side extraction only

- The PDF is processed **entirely in the browser** (PDF.js + Tesseract OCR from `public/vendor/`). NEVER upload the PDF to a server; only the structured, human-reviewed contract (`ConfirmTarjetonRequest` from `@/shared/contracts/tarjeton-import`) goes to `POST /api/tarjeton/confirm`.
- Parsers live in `features/tarjeton/lib/` and are **pure functions** (input → output, no I/O) with tests in `features/tarjeton/__tests__/`.
- Sensitive data (RFC, CURP, NSS, cuenta, QR, sellos, folio fiscal) is discarded or stored as hash (`lib/sanitize-sensitive-fields.ts`, `fiscal_folio_hash`).
- Persistence is atomic via the RPC `confirm_imported_payslip` (migration `004_imported_payslips.sql`), which also upserts `payroll_contexts` (categoría, jornada 6/6.5/8/12, antigüedad, recurrentes 050/023/063, hecho 054). Keep `src/lib/supabase/types.ts` in sync with new tables/functions.
- `public/vendor/` is **gitignored** and regenerated by `scripts/copy-vendor.mjs` (`predev`/`prebuild`). Do not commit vendor binaries; if `spa.traineddata.gz` fails to download, OCR falls back to CDN at runtime.
- Local (pre-auth) sync uses `@/shared/services/local-storage`; `useNomina` hydrates from it on mount.

## Rule 12: Biblioteca Normativa (evidencia documental, NO RAG libre)

- Fuente de verdad: `resources/normativa/bootstrap-sources.yaml` (corpus inicial, fecha de corte 2026-08-14).
- Datos descargados: `data/normativa/` (gitignored). Los PDFs/HTMLs oficiales originales JAMÁS se modifican; se conservan por versión (V1, V2, 2025-2027…) con SHA-256, metadata.json, extracted.txt, structure.json, chunks.jsonl y citations.jsonl.
- Catálogo: `data/normativa/catalog.sqlite` (node:sqlite + FTS5). Regla fundamental: LA IA NO ES LA FUENTE, LA FUENTE ES EL DOCUMENTO. Toda afirmación normativa requiere cita (documento, versión, página, cláusula/artículo).
- Código en `src/features/normativa/` (core/, services/, cli/, components/, __tests__/). UI en `(dashboard)/biblioteca-normativa`. APIs: `/api/normativa/*` (registradas en route-policy).
- Comandos: `npm run normativa:bootstrap|verify|update|recover|index|discover|report|search`.
- Descargas respetuosas: serial, con delay (WAF Incapsula en imss.gob.mx penaliza ráfagas; retry con backoff largo). Dominios fuera de allowlist → REVIEW_REQUIRED.
- Estatutos SNTSS: edición octubre 2022; vigencia PENDING_REVIEW (reforma estatutaria 2026). NUNCA etiquetar "Estatutos Vigentes 2026" sin validar documento.
- Tabulador Base expira 2026-10-15 (independiente del CCT). CCT 2025-2027 vigente hasta 2027-10-15. Leyes: usar compilaciones de Cámara de Diputados (LFT reforma 2026-05-14, LSS 2026-01-15).
- No borrar versiones usadas por episodios (usedByEpisode > 0).
- Estados por fuente en `source_states` (AVAILABLE/TEMPORARY_BLOCK/HTTP_403/WAF_BLOCK/NOT_FOUND/MANUAL_REVIEW/RETRY_AFTER) con `retry_after`; una fuente bloqueada NUNCA detiene el resto del corpus. Sin cooldowns fijos.
- Una fuente bloqueada (`HTTP_403`, `WAF_BLOCK`, `TEMPORARY_BLOCK`, `RETRY_AFTER`) NO se marca como completa ni verificable a mano. La página índice puede confirmar existencia de la clave, pero para citar contenido hace falta PDF/HTML original local con SHA-256, extracción, chunks y citas en `catalog.sqlite`. Si el portal oficial bloquea el PDF, reintentar con `normativa:update`, correr `normativa:discover`, luego `normativa:recover` (fetch/curl/Playwright/rutas oficiales alternas). Si solo se obtiene manualmente, usar `npm run normativa:recover -- --manual-dir <carpeta>`; el archivo debe llamarse como id, clave o nombre del PDF oficial y queda en `PENDING_REVIEW` hasta revisión editorial.
- OCR automático (mupdf + tesseract.js, modelo spa local): PDF sin texto → ocr.txt + ocr-confidence.json; original.pdf intacto.
- Flujo de episodio: cobertura documental → Evidence Pack → matriz → investigación con DeepSeek si está configurado → guion por RadioDirector (`modo: "ia"` por defecto, fallback determinista "solo corpus") → verificador con semáforo → voces (Chatterbox local con fallback edge-tts/SAPI) → master MP3/WAV + ficha de fuentes. La IA nunca sustituye la fuente: todo derecho, cifra, plazo, cláusula o artículo debe venir del Evidence Pack/corpus.
- Estado documental confirmado el 2026-08-18: `npm run normativa:report` mostró 71 documentos, 10 vigentes, 55 en revisión, 6 históricos, 7,593 secciones, 14,715 chunks y 153 referencias aún no localizadas. La UI puede mostrar "Documentos listos: 35/71" porque usa un criterio más estricto de publicación: original local completo + SHA-256 + extracción + chunks + citas + registro en `catalog.sqlite`. No tratar ese conteo como contradicción.
- Prioridad pendiente: ampliar la base documental local. La recuperación automática fue interrumpida por el usuario antes de ejecutarse; el próximo agente debe retomarla en tandas: `npm run normativa:update critical`, `npm run normativa:update all`, `npm run normativa:discover`, `npm run normativa:recover -- --limit 10 --wait-ms 6000`, repetir con `--headed` si hace falta observar Playwright, y para PDFs descargados manualmente usar `npm run normativa:recover -- --manual-dir <carpeta>`. Siempre cerrar con `npm run normativa:index`, `npm run normativa:verify` y `npm run normativa:report`. No marcar bloqueadas como verificadas sin PDF/HTML oficial local y trazabilidad completa.
- Política de repo para Radio Studio: el estudio se usa localmente, pero sí se versiona todo lo que define la producción actual: código fuente, documentación, manifiestos, scripts y activos editoriales estables pequeños. Se permiten en Git únicamente estas referencias/identidad sonora bajo `data/`: `data/tts/ref/mariana.wav`, `data/tts/ref/narrador.wav`, `data/tts/ref/rodrigo.wav`, `data/tts/ref/valeria.wav`, `data/tts/music/bed-uniforme-vivo.wav` y `data/tts/music/jingle-uniforme-vivo.wav`. No subir `data/normativa/`, `catalog.sqlite`, caches, masters, previews, modelos, venvs, instaladores ni `tools/ACE-Step-1.5/`/`tools/piper/`; esos son pesados o regenerables y deben quedar locales.
- Pilotos: `node --import tsx src/features/normativa/cli/pilotos.ts` genera los 5 episodios en data/normativa/pilotos/.
- Comparador CCT (CCT 2013-2025 vs 2025-2027) detecta cláusulas añadidas/eliminadas/modificadas y cambios de cifras.
- TTS local Chatterbox (FASE 3): venv en `data/tts/venv` (Python 3.13 + torch 2.6.0+cu126 — chatterbox-tts PINNEA torch==2.6.0, no subir sin romperlo). Motor: `packages/tts-core/engine/chatterbox_engine.py` (JSONL por stdin/stdout UTF-8 — forzar `sys.stdin.reconfigure(encoding="utf-8")` o textos con Í/Ó fallan). Modelo: base `ResembleAI/chatterbox` + T3 `t3_es_mx_latam.safetensors` (data/tts/models/latam). Voces físicas actuales: `A` Eduardo (conductor, voz integrada Chatterbox), `B` Andrea (co-conductora, `data/tts/ref/mariana.wav`, Piper `es_MX-claude-high`, regenerable con `scripts/generate-andrea-piper-ref.ps1`), `N` Alonso (narrador, `data/tts/ref/narrador.wav`, Piper `es_MX-ald-medium`, regenerable con `scripts/generate-narrador-piper-ref.ps1`), `C` Rodrigo Torres (corresponsal, `data/tts/ref/rodrigo.wav`, Piper `es_ES-davefx-medium`) y `P` Valeria Soto (comerciales, `data/tts/ref/valeria.wav`, Piper `es_AR-daniela-high`). Rodrigo y Valeria se regeneran con `scripts/generate-extra-premium-voice-refs.ps1`. Andrea debe sonar adulta, calida, despierta y con energia conversacional; Alonso debe sonar serio, adulto, institucional y latinoamericano neutro; Rodrigo debe sonar como reporte de campo; Valeria solo entra en anuncios/patrocinios editables y nunca en contenido editorial. Ninguna voz premium debe caer al default `A`; `/generate` debe recibir `voces` desde el guion y el sidecar debe resolver `NARRADOR`/`ALONSO` como `N`, `RODRIGO`/`CORRESPONSAL` como `C`, y `VALERIA`/`COMERCIAL`/`PATROCINIO` como `P` aun si falta el mapa. Si se cambia una referencia, actualizar `VOICE_SLOTS`, `VOICE_REFS`, `voiceSourceId`, `referenceAudioSha256` y cache keys. Estrategia de sesión: reinicio del modelo cada ~13 min de voz acumulada (`sessionMaxAudioSec=780`, override `CHATTERBOX_SESSION_MAX_AUDIO_SEC`); watchdog de salida degenerada (texto>60 chars, dur<1s). RTF real GTX 1650: acumulado ~1.03, media por bloque ~1.96 (estimaciones usan el conservador). VRAM pico ~3.7/4.0 GB. Cache por bloque (hash provider+model+device+voz+texto). Fallbacks: edge-tts (403 en esta red) → SAPI solo para maqueta/emergencia marcada; producto final publicable debe usar Chatterbox LatAm salvo aprobación explícita del usuario. Si la laptop está en batería, no entregar SAPI como final: pausar o pedir conectar corriente. Benchmark: `npm run tts:benchmark-laptop -- [segundos]`.
- Música local (FASE 5c): ACE-Step 1.5 en `tools/ACE-Step-1.5` (MIT, API async 127.0.0.1:8001, DiT-only `acestep-v15-turbo`, Tier 1 en GTX 1650: INT8 + offload CPU/DiT, sin LM, máx 360s). Perfil en `.env` — **CRÍTICO: `ACESTEP_COMPILE_MODEL=false`**. Con `torch.compile` activo (default del Tier 1), el server crashea con segfault c10.dll (0xc0000005) durante el offload post-difusión tras ~5-6 generaciones; con compile off va estable (3+ seguidas OK). venv: `tools/ACE-Step-1.5/.venv` (Python 3.12.14, torch 2.7.1+cu128 — ACE-Step PINNEA esa versión en Windows). Arranque preferido: automático desde `/musica/motor` o `/musica/generar` del sidecar; el sidecar ejecuta `uv run --no-sync acestep-api` con cwd `tools/ACE-Step-1.5` y fuerza `ACESTEP_COMPILE_MODEL=false` (logs en `data/tts/ace-step-api.log`). El comando manual queda solo como rescate. Flujo API: `POST /release_task` → `task_id` → poll `POST /query_result` (status 1=ok, 2=fallo; `result` es JSON array, usar `arr[0]`) → `GET /v1/audio?path=...` para el WAV. RTF real: 10s→8.15, 30s→2.71, 60s→2.71 (acumulado 3.26), VRAM pico ~532MB; 1ª generación tras arranque ~76s (carga modelos), siguientes ~35-45s. Benchmark: `npm run musica:benchmark` en `apps/radio-studio/sidecar`. Worker: `apps/radio-studio/sidecar/worker/musica_worker.ts` (proceso independiente, cola `data/tts/jobs/musica-actual.json`, mismo patrón que chatterbox_worker). Endpoints sidecar: `/musica` (lista), `/musica/motor` (también intenta auto-arrancar ACE-Step), `/musica/generar`, `/musica/progreso`, `/musica/cancelar`. Audio generado: `data/tts/music/<tipo>-ace-<id>.wav` (licencia MIT ACE-Step, seed/rtf/bpm en el job). RAM: el proceso python ACE-Step llega a ~10GB con offload a CPU — vigilar antes de producción larga.
- FASE 5 — RadioDirector multi-voz: modos de cita al aire (`natural` predeterminado — "De acuerdo con el Contrato Colectivo vigente" —, `documental`, `tecnico`); variedad de frases cíclica; modo `ia` por defecto con DeepSeek preferente cuando existe API configurada (LLM con Evidence Pack exclusivo + ScriptVerifier con semáforo; si falla → determinista). `DialogueDiversityAnalyzer` detecta muletillas, inicios similares, dominancia, alternancia perfecta y textos repetidos. `DialoguePolisher` (segunda pasada: solo estilo, nunca líneas con citas; re-verificar después). Expansión temática de búsqueda en el sidecar (temas relacionados) para programas de 20-30 min. Escaleta permanente obligatoria: `Apertura breve` → `Caso de arranque` → `Qué dice la normativa` → `Ojo con esto` → `Caso práctico` o `Consultorio` → `Cómo documentarlo` → `Cierre práctico`; en episodios de 15+ min alternar subtemas relacionados dentro del mismo tema central (regla, excepción, trámite, ejemplo, error común, duda frecuente, pasos) para evitar monotonía. Reglas editoriales vigentes: conversación viva con secciones y variación temática; no usar cortinillas internas; las transiciones se marcan como `transition: "cambio editorial"`; master con música solo en intro/outro muy cortos, cama uniforme baja por defecto (`bedGainDb=-25`, ducking `6`, attack `120`, release `1400`); identidad sonora uniforme obligatoria: apertura y cierre usan el mismo motivo o variaciones hermanas, la selección automática prefiere `jingle-uniforme-*`, `bed-uniforme-*`, `lv-theme-*`, `la-veinte-*` o `brand-*`, y no debe generarse un estilo distinto por episodio; espacios comerciales se insertan como turnos `kind: "ad"`, `adSlot: true`, editables, nunca como contenido editorial inventado. Master: 128/192/256/320 kbps (192 default) + WAV, ducking editable, intro/outro musical, ganancia por locutor. Timeline multipista en el estudio (clips, waveforms, pausas editables, solapes visuales, zoom, playhead).
- FASE 5b — Desacople API/worker: `sidecar/worker/chatterbox_worker.ts` es un PROCESO INDEPENDIENTE con cola persistente (`data/tts/jobs/job-actual.json`, escritura atómica por bloque, estados QUEUED/RUNNING/PAUSED/DONE/FAILED/INTERRUPTED+RESUMABLE). El sidecar HTTP nunca se bloquea: `/generate` crea el job y lanza el worker; `/progress` lee el archivo (funciona aunque el sidecar se reinicie); `/resume` continúa desde el siguiente bloque (cache); `/cancel` pausa y conserva reanudable; `/discard` detiene worker, elimina el job activo y limpia la producción actual; `/sistema` mide contención (CPU, RAM, GPU, procesos competidores) y avisa "Rendimiento TTS reducido por carga del sistema". Métricas por bloque: chars, audioDurMs, genMs, rtf, cacheHit, speaker, engineRestart; RTF global = inferencia real / audio real (excluye caché y mezcla). Checkpoint de sesión por voz acumulada (12-15 min) → reinicio del motor. Prueba larga: `node --import tsx apps/radio-studio/sidecar/scripts/produccion-larga.ts` (reporte en `data/tts/benchmark/produccion-larga-report.json`).
- FASE 5d — AI Radio Studio ejecutable: Tauri arranca automáticamente el sidecar local al abrir la app (`apps/radio-studio/src-tauri/src/lib.rs`). Si `127.0.0.1:3977` ya responde, no duplica procesos. Si no, lanza `node --no-warnings <ruta absoluta>/apps/radio-studio/sidecar/dist/sidecar.js` desde la raíz del repo y guarda logs en `data/tts/sidecar-tauri.log`. CRÍTICO en Windows: la ruta contiene espacios (`Axel Rosete`, `La Veinte Digital`), por eso el Rust debe usar `Command::new("node").arg("--no-warnings").arg(&sidecar)`, no construir una cadena con `cmd /C`, porque Node intentará abrir una ruta truncada. Antes de crear instalador, recompilar SIEMPRE `apps/radio-studio/sidecar/dist/sidecar.js` con `npm run bundle` en `apps/radio-studio/sidecar`; si no se hace, el `.exe` puede abrir una versión vieja del motor. El instalador NSIS se genera en `apps/radio-studio/src-tauri/target/release/bundle/nsis/AI Radio Studio_0.1.0_x64-setup.exe`.
- Toolchain Tauri: Rust GNU (`stable-x86_64-pc-windows-gnu` via rustup) + MSYS2 MinGW en `C:\Users\Axel Rosete\msys64\msys64` (gcc/binutils). Sin MSVC/VS Build Tools. Para compilar: `PATH` debe incluir `C:\Users\Axel Rosete\msys64\msys64\mingw64\bin` y `%USERPROFILE%\.cargo\bin`. Comandos: `npm run bundle` en `apps/radio-studio/sidecar`, `npm run build` en `apps/radio-studio`, luego `npm run tauri -- build` en `apps/radio-studio`. Cerrar `radio-studio.exe` antes de reconstruir: Windows bloquea reemplazar el exe abierto con `Acceso denegado`. NOTA: gcc empaquetado por rust-mingw es solo linker; compilar C requiere el MinGW real.

## Infrastructure Access

### Supabase (Database)

| Info | Value |
|------|-------|
| Project URL | `https://ragktminwduiggvaoeix.supabase.co` |
| Project ref | `ragktminwduiggvaoeix` |
| Service role key | en `.env.local` como `NEXT_PUBLIC_SUPABASE_ANON_KEY` NO es la service role — la service_role solo está en el dashboard de Supabase |

**Comandos útiles:**
```bash
# Login con PAT (Personal Access Token de app.supabase.com/account/tokens)
supabase login --token <pat>

# Vincular proyecto local
supabase link --project-ref ragktminwduiggvaoeix

# Inventario remoto de solo lectura
supabase migration list --linked
supabase db query --linked "begin transaction read only; SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'; commit;"
```

**PAT (Supabase access token):** no commitearlo — configurarlo en `.env.local` como `SUPABASE_ACCESS_TOKEN` o en `~/.supabase/access-token`. Se genera en app.supabase.com/account/tokens.

No presupongas el historial remoto. La evidencia de 2026-08-03 muestra deriva
entre el ledger y los archivos locales; consulta `docs/schema-reconciliation/`
y vuelve a ejecutar inventario de solo lectura antes de cualquier decisión.
Toda operación remota, incluida una reparación de historial, migración, hotfix o
deploy, exige revisión y aprobación explícitas. Nunca uses `db reset --linked`.

### Vercel (Deploy)

| Info | Value |
|------|-------|
| Project name | `la-veinte-digital` |
| Production URL | `https://la-veinte-digital.vercel.app` |

**Comandos útiles:**
```bash
# Deploy a producción
vercel --prod --yes
```

El OIDC token de Vercel está en `.env.local` como `VERCEL_OIDC_TOKEN`. Las variables de entorno se configuran en el dashboard de Vercel.

### Notas

- `.env.local` no se sube a git (está en `.gitignore`). Las secrets van en el dashboard de Vercel para producción.
- El Service Role Key de Supabase NO debe exponerse al cliente ni subirse a git — solo se usa desde scripts de administración o el dashboard.

## Anti-patterns — NEVER do these

- ❌ Put business logic in `app/` or `lib/`
- ❌ Import across feature boundaries (promote to `shared/` instead)
- ❌ Use `<a>` for internal navigation (use `<Link>` from `next/link`)
- ❌ Create new Supabase client instances (use `@/lib/supabase/client` or `server`)
- ❌ Add Tailwind classes to components
- ❌ Use raw `<button>` / `<input>` instead of shared components
- ❌ Create new `middleware.ts` (use `proxy.ts` with function named `proxy`)
- ❌ Store large data files (like vectorstore) in `src/` — move to external storage
- ❌ Commit `public/vendor/` or `supabase/.temp/` (regenerados por `prebuild`/CLI)
- ❌ Upload tarjetón PDFs (o cualquier archivo) a rutas API — la extracción es 100% local
- ❌ Assume local migration names prove remote SQL equivalence
- ❌ Run `migration repair`, `db push`, remote SQL writes, or `db reset --linked` without explicit approval
- ❌ Add dependencies without running `npm run build` to verify

## Before committing changes

1. Run `npm run build` — must compile without errors
2. Run `npm run lint` — must pass with no errors (warnings are acceptable)
3. Verify ESLint flat config: uses `eslint.config.mjs`, NOT `.eslintrc.*`

## After every change

1. Run `npm run build` and `npx vitest run` — the suite must pass
2. Do NOT deploy automatically; deployments are explicit and requested by the user
