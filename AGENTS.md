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

The file `src/proxy.ts` uses Supabase SSR cookie-based auth. Everything is protected **by default**; only paths in the explicit `PUBLIC_PATH_PREFIXES` constant are public:

```ts
["/login", "/register", "/callback", "/api/"]
```

`/api/*` is excluded because each API route self-guards with `requireUser`. Add a new public route to this array only with justification.

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

# Ejecutar SQL contra la base remota
supabase db query --linked --file supabase/migrations/<file>.sql

# Verificar tablas
supabase db query --linked "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
```

**PAT (Supabase access token):** no commitearlo — configurarlo en `.env.local` como `SUPABASE_ACCESS_TOKEN` o en `~/.supabase/access-token`. Se genera en app.supabase.com/account/tokens.

El proyecto ya está vinculado (`supabase link` hecho). Migraciones aplicadas a
remoto hasta la `004_imported_payslips.sql` (tablas `imported_payslips`,
`imported_payslip_lines`, `imported_payslip_observations` + RPC
`confirm_imported_payslip`). Al crear migraciones nuevas, actualiza a la par
`src/lib/supabase/types.ts`.

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
- ❌ Add dependencies without running `npm run build` to verify

## Before committing changes

1. Run `npm run build` — must compile without errors
2. Run `npm run lint` — must pass with no errors (warnings are acceptable)
3. Verify ESLint flat config: uses `eslint.config.mjs`, NOT `.eslintrc.*`

## After every change

1. Run `npm run build` and `npx vitest run` — the suite must pass
2. Do NOT deploy automatically; deployments are explicit and requested by the user
