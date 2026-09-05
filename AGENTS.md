<!-- Version: 0.006 -->
<!-- Last updated: 2026-09-05 -->

# 🛡️ STABLE BASELINE — READ BEFORE CHANGING CODE

> **REGLA SUPREMA DE GOBERNANZA:**  
> A partir del commit `d90ab2bbc2f4b648cb8ed0bed1801902cb9976da` (2026-09-05), este repositorio se encuentra en **ESTABILIZACIÓN + PULIDO INCREMENTAL**.
> 
> ```text
> EL REPOSITORIO FUNCIONA.
> NO ESTOY AUTORIZADO A REDISEÑARLO.
> MI TRABAJO ES CAMBIAR ÚNICAMENTE EL DELTA SOLICITADO.
> ```
> 
> **Todo comportamiento que existe actualmente es comportamiento protegido y no puede eliminarse, cambiarse, simplificarse, sustituirse o degradarse salvo autorización explícita del usuario.**
> 
> **OBJETIVO PERMANENTE: CERO REGRESIONES NO AUTORIZADAS.**

---

## Principios Obligatorios de Desarrollo

1. **Autorización estricta del delta:**  
   > **Si el usuario pide A, la autorización es A. No es A+B+C.**
2. **Un bug localizado NO autoriza una refactorización general.** Corrige de forma mínima y quirúrgica el defecto sin tocar áreas circundantes.
3. **Una petición visual NO autoriza alterar lógica.** Modificar layout, colores o márgenes nunca debe alterar APIs, parsers, persistencia ni fórmulas laborales.
4. **Una petición Android NO autoriza modificar comportamiento web no relacionado.** Y viceversa: un ajuste web jamás debe romper WebViews ni bridges de Android o iOS.
5. **Una mejora de rendimiento NO autoriza quitar funciones o relajar contratos.**
6. **Prohibido eliminar código "aparentemente no usado"**: No elimines archivos, clases ni funciones sin verificar bridges nativos, inyección en WebViews, rutas dinámicas, reflectores, imports indirectos o compatibilidad multiplataforma.
7. **Prohibido consolidar funciones "aparentemente duplicadas" sin demostrar equivalencia matemática y de efectos secundarios en todas las plataformas.**
8. **"Limpiar", "modernizar", "simplificar" o "hacer más elegante" NO son autorizaciones de producto.**
9. **No introducir dependencias nuevas salvo necesidad explícita y aprobación.**
10. **No cambiar contratos públicos o internos compartidos de forma incidental.**
11. **No modificar tests para que acepten una regresión:** Los tests existentes son la especificación ejecutable. Si un test falla tras tu cambio, asumirlo como regresión hasta demostrar lo contrario.
12. **NO DRIVE-BY REFACTORING:** Si tocas `A.ts` y te parece que `B.ts` y `C.ts` podrían quedar mejor, **NO LOS TOQUES**. Repórtalos como observación aparte.

---

## Protocolo Obligatorio para Todo Cambio Futuro

### Change Contract
Antes de escribir código, define:
```text
REQUESTED DELTA:    Qué pidió exactamente el usuario.
ALLOWED SCOPE:      Archivos/módulos razonablemente necesarios.
PROTECTED BEHAVIOR: Qué funcionalidades cercanas deben conservarse intactas.
DEPENDENCIES:       Quién consume el código que voy a tocar (Web, Android, iOS, APIs).
REGRESSION TESTS:   Qué pruebas demuestran el comportamiento actual.
OUT OF SCOPE:       Qué NO tengo autorización para modificar.
```

### Pre-Change Regression Check
```text
[ ] Leí docs/STABLE_BASELINE.md y docs/REGRESSION_GUARDRAILS.md.
[ ] Entendí exactamente el delta solicitado (Si pide A, es solo A).
[ ] Identifiqué las fuentes de verdad y consumidores.
[ ] Revisé contratos web/native y claves de persistencia.
[ ] Ejecuté las pruebas unitarias relevantes antes de modificar.
[ ] Sé qué comportamiento debo preservar.
[ ] No estoy introduciendo una refactorización no solicitada.
[ ] Mi cambio será el mínimo compatible.
```

### Post-Change Regression Check
```text
[ ] El requerimiento nuevo funciona.
[ ] Los comportamientos protegidos siguen funcionando.
[ ] No desaparecieron capacidades ni fallbacks anteriores.
[ ] No cambiaron contratos ni storage keys incidentalmente.
[ ] No cambiaron rutas ni bridges incidentalmente.
[ ] No se modificaron tests para ocultar regresiones.
[ ] `npm run typecheck` pasa.
[ ] `npm run lint` pasa.
[ ] `npm test` pasa.
[ ] `npm run build` pasa.
[ ] Android/iOS pasan si fueron afectados.
[ ] `git diff` contiene exclusivamente el cambio solicitado.
```

---

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
- Local (pre-auth) sync uses `@/shared/services/local-storage`; the payroll simulator (`/simulador-nomina`) hydrates from it as cache, with `/api/worker-context` (Supabase) as source of truth. Tarjetón import lives ONLY at `/profile/mi-informacion-laboral` (sección "Subir tarjetón IMSS"); `/tarjeton` y `/nomina/perfil` son redirects.

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
- Flujo de episodio: cobertura documental → Evidence Pack → matriz → investigación y guion editorial gobernado en producción EXCLUSIVAMENTE por Groq API (`openai/gpt-oss-120b` y `openai/gpt-oss-20b` vía `GroqLLMProvider`, PR #62; sin degradación silenciosa; Ollama local reservado solo para desarrollo experimental con `RADIO_ALLOW_EXPERIMENTAL_LOCAL_LLM="true"`) → guion por RadioDirector (`modo: "ia"` por defecto) → verificador con semáforo → voces (Speechify simba-3.0 en la nube) → master MP3/WAV + ficha de fuentes. La IA nunca sustituye la fuente: todo derecho, cifra, plazo, cláusula o artículo debe venir del Evidence Pack/corpus.
- Estado documental confirmado el 2026-08-18: `npm run normativa:report` mostró 71 documentos, 10 vigentes, 55 en revisión, 6 históricos, 7,593 secciones, 14,715 chunks y 153 referencias aún no localizadas. La UI puede mostrar "Documentos listos: 35/71" porque usa un criterio más estricto de publicación: original local completo + SHA-256 + extracción + chunks + citas + registro en `catalog.sqlite`. No tratar ese conteo como contradicción.
- Estado del corpus (ampliación completada 2026-08-25, auditada y verificada): 82 fuentes en `resources/normativa/bootstrap-sources.yaml`; 88 documentos con versión local; 94 versiones verificadas (`verify` OK=94 FAIL=0); 22,270 chunks; 22,270 citas estructuradas; cobertura temática 34/34 FULL (`data/normativa/normativa-coverage-report.md`, comando `npm run normativa:coverage`); 79/79 tests de normativa. Corpus actualizado al 2026-08-25. Incluye leyes nuevas desde Cámara (INFONAVIT/LIFNVT, LSAR, FONACOT/LIFNCT, LGAMVLV, LGIPD, LIC), Ley Silla/bipedestación (DOF 2026-07-17), 10 NOMs STPS y 8 NOMs salud — todas con estado VIGENTE confirmado en PLATIICA (economia.gob.mx está en allowlist). `normativa:update all -- --ids=A,B,C` permite tandas selectivas sin despertar el WAF. El monitor estatutario ya corre dentro de `update` y detectó el Congreso Nacional Extraordinario; los Estatutos siguen siendo edición 2022 (NUNCA crear "Estatutos 2026"). NOM-017-STPS-2008 quedó registrada como sustituida por la 2024.
- Siguiente prioridad: RAG productivo sobre Supabase pgvector + fuentes verificables ([S1]/[S2] validadas server-side) en el chatbot `/api/consulta`. El flujo es: corpus local (source of truth) → pgvector idempotente → retrieval híbrido (exact-match cláusula/artículo → FTS → vector → fusión → filtro vigencia) → LLM. NO ejecutar refresh masivo de imss.gob.mx: las copias locales están verificadas y el WAF lo penaliza; dejarlo como mantenimiento en tandas pequeñas con backoff/jitter usando `--ids`.
- Política de repo para Radio Studio: el estudio se usa localmente, pero sí se versiona todo lo que define la producción actual: código fuente, documentación, manifiestos, scripts y activos editoriales estables pequeños. Se permiten en Git únicamente estas referencias/identidad sonora bajo `data/`: `data/tts/ref/mariana.wav`, `data/tts/ref/narrador.wav`, `data/tts/ref/rodrigo.wav`, `data/tts/ref/valeria.wav`, `data/tts/music/bed-uniforme-vivo.wav` y `data/tts/music/jingle-uniforme-vivo.wav`. No subir `data/normativa/`, `catalog.sqlite`, caches, masters, previews, modelos, venvs, instaladores ni `tools/ACE-Step-1.5/`/`tools/piper/`; esos son pesados o regenerables y deben quedar locales.
- Pilotos: `node --import tsx src/features/normativa/cli/pilotos.ts` genera los 5 episodios en data/normativa/pilotos/.
- Comparador CCT (CCT 2013-2025 vs 2025-2027) detecta cláusulas añadidas/eliminadas/modificadas y cambios de cifras.
- TTS Speechify (único motor publicable, FASE 6+): API https://api.speechify.ai/v1/audio/speech, modelo simba-3.0, idioma es-MX, formato WAV, límite 2000 chars incl. SSML. Autenticación solo server-side vía SPEECHIFY_API_KEY leída por el sidecar (nunca NEXT_PUBLIC_, nunca en logs/frontend). Casting automático 5 voces únicas determinista (3M+2F) vía GET /v1/voices filtrando español compatible simba-3.0, preferencia es-MX; mapeo fijo: EDUARDO direct, ANDREA warm, JAVIER rate -5%, RODRIGO rate +6%, VALERIA bright; persistido en data/tts/speechify-cast.json y overrides SPEECHIFY_VOICE_MALE_1/2/3 y FEMALE_1/2. SSML escapado XML, validación Base64 WAV RIFF, manejo 429/5xx con backoff y reintentos limitados sin duplicar worker/motor, AbortController para cancelar, caché por bloque (provider+modelo+idioma+voiceId+personaje+texto+perfil SSML+revisión). /tts-fallback también usa Speechify. No existe switch a otro proveedor. Qwen/Ollama solo para guion, nunca voces. No ElevenLabs/OpenAI/Edge/SAPI/Azure/Google.

- Música local (FASE 5c): ACE-Step 1.5 en `tools/ACE-Step-1.5` (MIT, API async 127.0.0.1:8001, DiT-only `acestep-v15-turbo`, Tier 1 en GTX 1650: INT8 + offload CPU/DiT, sin LM, máx 360s). Perfil en `.env` — **CRÍTICO: `ACESTEP_COMPILE_MODEL=false`**. Con `torch.compile` activo (default del Tier 1), el server crashea con segfault c10.dll (0xc0000005) durante el offload post-difusión tras ~5-6 generaciones; con compile off va estable (3+ seguidas OK). venv: `tools/ACE-Step-1.5/.venv` (Python 3.12.14, torch 2.7.1+cu128 — ACE-Step PINNEA esa versión en Windows). Arranque preferido: automático desde `/musica/motor` o `/musica/generar` del sidecar; el sidecar ejecuta `uv run --no-sync acestep-api` con cwd `tools/ACE-Step-1.5` y fuerza `ACESTEP_COMPILE_MODEL=false` (logs en `data/tts/ace-step-api.log`). El comando manual queda solo como rescate. Flujo API: `POST /release_task` → `task_id` → poll `POST /query_result` (status 1=ok, 2=fallo; `result` es JSON array, usar `arr[0]`) → `GET /v1/audio?path=...` para el WAV. RTF real: 10s→8.15, 30s→2.71, 60s→2.71 (acumulado 3.26), VRAM pico ~532MB; 1ª generación tras arranque ~76s (carga modelos), siguientes ~35-45s. Benchmark: `npm run musica:benchmark` en `apps/radio-studio/sidecar`. Worker: `apps/radio-studio/sidecar/worker/musica_worker.ts` (proceso independiente, cola `data/tts/jobs/musica-actual.json`, mismo patrón que la cola Qwen TTS `job-actual.json`). Endpoints sidecar: `/musica` (lista), `/musica/motor` (también intenta auto-arrancar ACE-Step), `/musica/generar`, `/musica/progreso`, `/musica/cancelar`. Audio generado: `data/tts/music/<tipo>-ace-<id>.wav` (licencia MIT ACE-Step, seed/rtf/bpm en el job). RAM: el proceso python ACE-Step llega a ~10GB con offload a CPU — vigilar antes de producción larga.
- FASE 5 — RadioDirector multi-voz: modos de cita al aire (`natural` predeterminado — "De acuerdo con el Contrato Colectivo vigente" —, `documental`, `tecnico`); variedad de frases cíclica; modo `ia` por defecto gobernado por Groq (`openai/gpt-oss-120b` writer y `openai/gpt-oss-20b` fast model con Evidence Pack exclusivo + ScriptVerifier con semáforo; si Groq no está disponible lanza GroqUnavailableError; nunca degradación silenciosa a local o determinista en producción). `DialogueDiversityAnalyzer` detecta muletillas, inicios similares, dominancia, alternancia perfecta y textos repetidos. `DialoguePolisher` (segunda pasada: solo estilo, nunca líneas con citas; re-verificar después). Expansión temática de búsqueda en el sidecar (temas relacionados) para programas de 20-30 min. Escaleta permanente obligatoria: `Apertura breve` → `Caso de arranque` → `Qué dice la normativa` → `Ojo con esto` → `Caso práctico` o `Consultorio` → `Cómo documentarlo` → `Cierre práctico`; en episodios de 15+ min alternar subtemas relacionados dentro del mismo tema central (regla, excepción, trámite, ejemplo, error común, duda frecuente, pasos) para evitar monotonía. Reglas editoriales vigentes: conversación viva con secciones y variación temática; no usar cortinillas internas; las transiciones se marcan como `transition: "cambio editorial"`; master con música solo en intro/outro muy cortos, cama uniforme baja por defecto (`bedGainDb=-25`, ducking `6`, attack `120`, release `1400`); identidad sonora uniforme obligatoria: apertura y cierre usan el mismo motivo o variaciones hermanas, la selección automática prefiere `jingle-uniforme-*`, `bed-uniforme-*`, `lv-theme-*`, `la-veinte-*` o `brand-*`, y no debe generarse un estilo distinto por episodio; espacios comerciales se insertan como turnos `kind: "ad"`, `adSlot: true`, editables, nunca como contenido editorial inventado. Master: 128/192/256/320 kbps (192 default) + WAV, ducking editable, intro/outro musical, ganancia por locutor. Timeline multipista en el estudio (clips, waveforms, pausas editables, solapes visuales, zoom, playhead).
- FASE 5b — Desacople API/worker: la cola Speechify (sidecar/worker/job-store.ts) es un PROCESO INDEPENDIENTE con cola persistente (data/tts/jobs/job-actual.json, escritura atómica por bloque, estados QUEUED/RUNNING/PAUSED/DONE/FAILED/INTERRUPTED+RESUMABLE). El sidecar HTTP nunca se bloquea: /generate crea el job y lanza el worker Speechify cloud; /progress lee el archivo (funciona aunque el sidecar se reinicie); /resume continúa desde el siguiente bloque (cache); /cancel pausa y conserva reanudable; /discard detiene worker, elimina el job activo y limpia la producción actual; /sistema mide contención (CPU, RAM, GPU, procesos competidores) para LLM local y música. Métricas por bloque: chars, audioDurMs, genMs, rtf, cacheHit, speaker; RTF global = síntesis real / audio real (excluye caché y mezcla). Caché por bloque evita repago (provider+modelo+idioma+voiceId+personaje+texto+perfil SSML+revisión).
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
