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
│   └── (other features)/
│
├── shared/                ← shared across ALL features
│   ├── components/
│   │   ├── ui/            ← reusable UI primitives (Button, Input, Card, etc.)
│   │   └── layout/        ← Navbar, Sidebar, etc.
│   ├── hooks/             ← shared hooks (useUser, etc.)
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
@/shared/lib/utils
@/lib/supabase/client
@/lib/supabase/server
@/lib/supabase/types
```

The `@/` alias maps to `./src/` (configured in `tsconfig.json`).

## Rule 6: Proxy (middleware) — auth guard

The file `src/proxy.ts` uses Supabase SSR cookie-based auth. If you add a new route that needs auth protection, ensure the `proxy` function in `proxy.ts` does NOT exclude it. The current exclusion list:

```ts
/login /register /callback /api/ /health /consulta
```

Add new public routes to this exclusion list if needed.

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
2. **Python FastAPI** at `NEXT_PUBLIC_BOT_API_URL` — uses LangChain + FAISS

The frontend (`features/asistente/services/bot.ts`) checks for `NEXT_PUBLIC_BOT_API_URL` first, falls back to `/api/consulta`.

**DO NOT create a third implementation.** If modifying the bot, update BOTH backends or consolidate to one.

## Rule 10: System prompts

The AI assistant's personality is defined in two places:
- `src/app/api/consulta/route.ts` (Next.js version)
- `bot-api/embedding_service.py` (Python version)

Both must be kept in sync. The bot speaks Spanish, uses **negritas**, emojis with moderation, and acts as a friendly ally to workers.

## Anti-patterns — NEVER do these

- ❌ Put business logic in `app/` or `lib/`
- ❌ Import across feature boundaries (promote to `shared/` instead)
- ❌ Use `<a>` for internal navigation (use `<Link>` from `next/link`)
- ❌ Create new Supabase client instances (use `@/lib/supabase/client` or `server`)
- ❌ Add Tailwind classes to components
- ❌ Use raw `<button>` / `<input>` instead of shared components
- ❌ Create new `middleware.ts` (use `proxy.ts` with function named `proxy`)
- ❌ Store large data files (like vectorstore) in `src/` — move to external storage
- ❌ Add dependencies without running `npm run build` to verify

## Before committing changes

1. Run `npm run build` — must compile without errors
2. Run `npm run lint` — must pass with no errors (warnings are acceptable)
3. Verify ESLint flat config: uses `eslint.config.mjs`, NOT `.eslintrc.*`
