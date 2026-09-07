# La Veinte Digital

Plataforma digital de la comunidad SNTSS (Sindicato Nacional de Trabajadores del Seguro Social). Diseñada para trabajadores del IMSS, ofrece herramientas laborales, asistencia legal vía IA, calculadoras de prestaciones y gestión personal.

---

## Stack Tecnológico y Plataformas

| Plataforma / Tecnología | Detalle | Versión en Baseline |
|---|---|---|
| **Web** | Next.js (App Router, Turbopack) + React | Next.js `16.2.12`, React `19.2.4` |
| **Lenguaje** | TypeScript | `5.x` (modo estricto) |
| **Android App** | Kotlin, Jetpack Compose, Room, DataStore, Keystore | `compileSdk 36`, `versionCode 203`, `v1.1.3` |
| **iOS App** | Swift, SwiftUI, WKWebView, LocalAuthentication | iOS `16.0+`, XcodeGen, `v1.0.0` |
| **Desktop / Radio** | Tauri v2 + Vite + React | AI Radio Studio |
| **Base de Datos & Auth**| Supabase SSR + Supabase JS (PostgreSQL 14.5) | `@supabase/ssr ^0.12.3`, `@supabase/supabase-js ^2.111.0` |
| **IA Chatbot** | OpenAI API (gpt-4o-mini / text-embedding-ada-002) | RAG híbrido normativo |
| **IA Radio Studio** | Groq API (openai/gpt-oss-120b / openai/gpt-oss-20b) | Gobernanza editorial Groq-only |
| **TTS Radio Studio** | Speechify API (modelo simba-3.0, es-MX) | Casting determinista de 5 voces |
| **Música Local** | ACE-Step 1.5 (acestep-v15-turbo en GPU GTX 1650) | `tools/ACE-Step-1.5`, `ACESTEP_COMPILE_MODEL=false` |
| **Extracción Tarjetón** | PDF.js + Tesseract.js (100% en cliente, vendor local) | `pdfjs-dist 6.1.200`, `tesseract.js 7.0.0` |
| **Pruebas Automatizadas**| Vitest + Playwright E2E + Android Unit Tests | Vitest `^4.1.10`, Playwright `^1.62.1` |

---

## AI Radio Studio

El monorepo incluye `apps/radio-studio`, una aplicación de escritorio Tauri para crear
podcasts y programas laborales de La Veinte Digital con fundamentación en el CCT:

Guía obligatoria para agentes antes de tocar este flujo:
`docs/RADIO_STUDIO.md`.

Reglas clave:

- **La IA no es fuente normativa:** Todo fundamento emana estrictamente del corpus documental y Evidence Pack (`data/normativa/catalog.sqlite`).
- **Gobernanza Editorial Groq-Only:** Todo guion y propuesta en producción es generado exclusivamente por Groq (`openai/gpt-oss-120b` y `openai/gpt-oss-20b` vía `GroqLLMProvider`). Si la API key falta, lanza `GroqUnavailableError`; no hay degradación silenciosa a local o determinista.
- **Voces Oficiales:** Síntesis mediante Speechify simba-3.0 (Eduardo, Andrea, Javier, Rodrigo, Valeria).
- **Música Uniforme:** Cama ambiental baja e intro/outro breve generados con ACE-Step 1.5 local.
- **Espacios Comerciales:** Insertados como bloques editables, nunca como texto editorial inventado.

---

## Estructura del Proyecto

```
la-veinte-digital/
├── src/
│   ├── app/                        # Rutas y page.tsx únicamente
│   │   ├── (auth)/                 # Login, registro, callback OAuth
│   │   │   ├── login/
│   │   │   ├── register/
│   │   │   ├── callback/
│   │   │   └── actions.ts          # Server Actions de auth
│   │   ├── (dashboard)/            # Panel privado (protegido)
│   │   │   ├── asistente/          # Chat con IA SNTSS
│   │   │   ├── calculadoras/       # Calculadoras de prestaciones
│   │   │   ├── calendario/         # Calendario IMSS
│   │   │   ├── catalogo/           # Catálogo de adscripciones
│   │   │   ├── escritos/           # Generador de escritos PSD
│   │   │   ├── facebook/           # Feed de Facebook SNTSS
│   │   │   ├── nomina/             # Nómina y proyecciones
│   │   │   ├── profile/            # Perfil de usuario
│   │   │   ├── simulador/          # Simulador de audiencias
│   │   │   ├── layout.tsx          # Layout protegido
│   │   │   └── page.tsx            # Dashboard principal
│   │   ├── api/                    # API routes
│   │   │   ├── health/             # Health check público
│   │   │   ├── consulta/           # Asistente IA (Next.js)
│   │   │   ├── simulador/          # Simulador de audiencias
│   │   │   ├── calendario/         # Exportar calendario (.ics)
│   │   │   └── tarjeton/confirm/   # Confirmación de tarjetón IMSS
│   │   ├── globals.css             # Variables CSS globales
│   │   └── layout.tsx              # Root layout
│   │
│   ├── features/                   # Módulos de negocio (uno por feature)
│   │   ├── asistente/              # Chat con IA
│   │   │   ├── components/         # ChatAssistant, ChatMessage, etc.
│   │   │   ├── hooks/              # useChat
│   │   │   └── services/           # bot.ts (consulta al backend)
│   │   ├── calculadoras/           # 6 calculadoras de prestaciones
│   │   │   ├── components/         # 13 componentes
│   │   │   ├── services/           # saveProfileCategoria
│   │   │   ├── lib/                # Lógica de cálculo
│   │   │   ├── data/               # Datos de categorías
│   │   │   └── __tests__/          # Pruebas unitarias
│   │   ├── calendario/             # Calendario laboral IMSS
│   │   │   ├── components/         # CalendarioMensual, Anual, Export
│   │   │   └── services/           # calendarioData.ts
│   │   ├── catalogo/               # Catálogo de adscripciones
│   │   │   ├── components/         # CatalogSearch
│   │   │   └── services/           # catalogo.ts
│   │   ├── escritos/               # Generación de documentos PSD
│   │   │   ├── components/         # EscritosForm, Generator, Result
│   │   │   └── services/           # generarEscrito.ts
│   │   ├── facebook/               # Feed de Facebook
│   │   │   ├── components/         # FacebookFeed, FacebookFeeds
│   │   │   ├── hooks/              # (vacío)
│   │   │   └── services/           # (vacío)
│   │   ├── nomina/                 # Nómina y proyecciones
│   │   │   ├── components/         # NominaIndex, Wizard, OptIn, Projection
│   │   │   ├── services/           # prefill.ts, local-migration-service.ts
│   │   │   ├── lib/                # Lógica de nómina
│   │   │   ├── data/               # Datos salariales
│   │   │   ├── hooks/              # Custom hooks
│   │   │   └── __tests__/          # Pruebas
│   │   ├── tarjeton/               # Parsers cliente, OCR vendor local y confirmación
│   │   ├── tarjeton-guia/          # Guía del Tarjetón IMSS y análisis quincenal
│   │   ├── vacaciones/             # Asesor, planificador anual y cálculo cuatrimestral
│   │   ├── documentos-personales/  # Adaptadores y visor unificado DocumentViewerModal
│   │   ├── transferir/             # Emparejamiento por QR y transferencia entre dispositivos
│   │   ├── bitacora/               # Bitácora personal de incidencias laborales
│   │   ├── push/                   # Notificaciones push (FCM)
│   │   ├── normativa/              # Catálogo SQLite FTS5, búsqueda y citas CCT
│   │   ├── simulador-nomina/       # Simulador de nómina con 4 escenarios de entrada
│   │   ├── profile/                # Perfil laboral y subida de tarjetón
│   │   └── simulador/              # Simulador de audiencias disciplinarias IMSS
│   │
│   ├── shared/                     # Código compartido
│   │   ├── components/
│   │   │   ├── ui/                 # Button, Input, Card, Modal, Toast, etc.
│   │   │   └── layout/             # Navbar, Sidebar, BottomNav, DashboardShell
│   │   ├── hooks/                  # useUser
│   │   ├── services/               # local-storage (perfil, recibos, proyecciones)
│   │   ├── contracts/              # tarjeton-import, calculator-prefill
│   │   └── lib/                    # utils (cn, formatDate, etc.)
│   │
│   ├── lib/                        # Infraestructura
│   │   ├── supabase/               # client.ts, server.ts, types.ts
│   │   └── services/               # auth.ts, vectorstore-data.json
│   │
│   └── proxy.ts                    # Auth middleware (NO middleware.ts)
│
├── bot-api/                        # Backend Python alternativo
│   ├── main.py                     # FastAPI server
│   ├── embedding_service.py        # LangChain + FAISS + agente React
│   ├── generar_vectorstore.py      # Generación de vectorstore
│   ├── regenerate.py               # Regeneración de embeddings
│   ├── requirements.txt            # Dependencias Python
│   ├── Dockerfile                  # Containerización
│   ├── pdfs/                       # PDFs normativos (CCT, estatutos, reglamentos)
│   └── vectorstore/                # FAISS index (generado)
│
├── public/                         # Assets estáticos
├── apps/
│   └── radio-studio/               # App Tauri de producción de podcasts
├── packages/
│   ├── radio-core/                 # Director, QA editorial, timeline
│   └── tts-core/                   # Qwen Base clone local, chunker, caché, fallback
├── tools/
│   └── ACE-Step-1.5/               # Motor local de música
├── eslint.config.mjs               # ESLint flat config
├── postcss.config.mjs              # PostCSS + Tailwind
├── next.config.ts                  # Next.js config
├── tsconfig.json                   # TypeScript config
├── vitest.config.ts                # Vitest config
├── vercel.json                     # Vercel rewrites
└── package.json
```

---

## Funcionalidades por Módulo

### 1. Asistente SNTSS (`/asistente`)
Chat bot con IA que responde preguntas sobre el Contrato Colectivo de Trabajo (CCT), Estatutos del SNTSS, y reglamentos del IMSS. Usa RAG (Retrieval-Augmented Generation) con OpenAI embeddings y cosine similarity. Tiene dos backends paralelos: Next.js API route y Python FastAPI.

### 2. Calculadoras (`/calculadoras`)
6 calculadoras de prestaciones laborales:
- **Aguinaldo** - Cálculo proporcional
- **Cláusula 97** - Prima de antigüedad
- **Préstamos por Categoría** - Montos según categoría
- **Segunda de Julio** - Prima vacacional
- **Segunda de Julio Proporcional** - Cálculo proporcional
- **Tiempo Extra** - Horas extra

Incluyen **prerrelleno normativo**: al abrir una calculadora se cargan los
valores salariales del perfil y del tabulador vigente (con política cerrada
por calculadora; el 022 nunca se integra a una base y las horas extra siempre
se capturan a mano). Detalle: `docs/CALCULATOR_PREFILL.md`.

### 3. Mi Agenda (`/bitacora`)
Registro laboral con cinco altas autorizadas y campos propios para cada caso: Tiempo Extra, Falta Injustificada (con cálculo canónico de quincena y descuento estimado desde el concepto 002), Reclamación Pendiente, TxT y Recordatorio General (con prioridades). Los datos se almacenan en Supabase (`worker_commitments`), aparecen en el inicio, se integran al calendario y generan recordatorios idempotentes (`DAY_BEFORE`, `HOURS_BEFORE`, `AT_START`, `SCHEDULED_TIME` vía `/api/cron/agenda-reminders`). Los tipos históricos (Cambio de turno, Deporte, Guardia festiva, Incapacidad, Pase de salida/entrada, Vacaciones, Otro) se conservan en modo de lectura para no perder registros históricos.

### 4. Calendario IMSS (`/calendario`)
Calendario laboral 2026 con fechas de pago, periodos de interactivo y vacacional. Exportable a formato `.ics` (iCalendar).

### 5. Catálogo (`/catalogo`)
Búsqueda en el catálogo de adscripciones del IMSS con función de búsqueda PostgreSQL (`search_catalogo`).

### 6. Escritos (`/escritos`)
Generador de escritos formales PSD (Prestaciones de Servicios Diversos) con datos precargados del perfil del usuario. Exporta a PDF.

### 7. Facebook (`/facebook`)
Feed integrado de la página de Facebook de la Sección XX del SNTSS. Usa scraping vía bot-api Python.

### 8. Nómina (`/nomina`)
Visualización de nómina con wizard de perfil salarial, proyecciones de ingresos futuros y opción de opt-in para precarga de datos. El wizard **precarga automáticamente** la categoría desde el perfil de Supabase y deriva las horas de jornada del sufijo numérico (80→8h, 65→6.5h, 60→6h).

### 9. Perfil (`/profile`)
Gestión de perfil de usuario: nombre, matrícula, adscripción, categoría, antigüedad, teléfono, y **bitácora personal** de incidencias laborales. La antigüedad del perfil se usa también para calcular la evolución en la tarjeta del dashboard.

### 10. Tarjetón IMSS (`/tarjeton`)
Importa el PDF de tu recibo de pago del IMSS. La extracción corre **100% en tu navegador** (PDF.js + OCR Tesseract de respaldo para tarjetones escaneados); revisas cada campo y al confirmar se guarda solo el resultado estructurado — el PDF nunca se sube. RFC/CURP/NSS/cuenta se descartan o enmascaran; el folio fiscal se guarda como huella. La confirmación actualiza tu contexto de nómina (categoría, jornada, antigüedad, conceptos recurrentes) y el prerrelleno de las calculadoras. Detalle: `docs/TARJETON_IMPORT.md`.

### 11. Simulador (`/simulador`)
Simulador interactivo de audiencias disciplinarias IMSS con 6 escenarios (faltas, maltrato, incumplimiento, extravío, retardos, confidencialidad). Evalúa el desempeño del trabajador con análisis IA post-simulación.

### 12. Panel de Administración (`/admin`)
Hub operativo con métricas agregadas (sin fuga de PII), editor de avisos con revisión editorial (`/admin/avisos`, bandeja del trabajador en `/avisos`), barra informativa administrable (`/admin/barra` con fallback a catálogo local), campañas push con snapshot inmutable y worker transaccional (`/admin/campanas`), formulario push heredado (`/admin/push`) y consola de versiones Android (`/admin/android`). Acceso: rol `admin` en `profiles` (acceso completo) o email en `PUSH_ADMIN_ALLOWED_EMAILS` (solo `/admin/push`). Detalle operativo: `docs/admin/PROGRESS.md` y `docs/admin/ROLLOUT_ROLLBACK.md`.

### 13. Notificaciones
Recordatorios de agenda con entregas idempotentes (`commitment_reminder_deliveries`, cron `/api/cron/agenda-reminders` diario) y notificaciones push FCM con campañas programadas (cron `/api/cron/push-campaigns` cada 15 min vía GitHub Actions), preferencias por usuario (`/avisos/preferencias`) y lecturas idempotentes de comunicados.

---

## Instalación y Desarrollo

```bash
# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con las credenciales de Supabase y OpenAI

# Iniciar servidor de desarrollo
npm run dev

# Ejecutar linter
npm run lint

# Ejecutar tests
npm test

# Construir para producción
npm run build
```

### Variables de Entorno

| Variable | Descripción |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key de Supabase |
| `OPENAI_API_KEY` | API key de OpenAI |
| `BOT_API_URL` | URL del bot API Python (opcional). La ruta `/api/consulta` la consulta con el header `X-Bot-Secret`; si no responde, cae al motor Next.js |
| `BOT_API_SHARED_SECRET` | Secreto compartido para autenticar llamadas al bot Python. Sin él, el bot responde 503 en `/health` y `/consulta` (fail-closed) y la app usa el motor Next.js |

### Bot API Python (opcional)

```bash
cd bot-api
python -m venv venv
source venv/bin/activate  # o venv\Scripts\activate en Windows
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Variables del bot (`bot-api/.env`):

| Variable | Descripción |
|---|---|
| `OPENAI_API_KEY` | API key de OpenAI (embeddings + respuestas) |
| `BOT_API_SHARED_SECRET` | Secreto requerido por `/health` y `/consulta` (header `X-Bot-Secret`) |
| `BOT_CORS_ORIGIN` | Origen permitido (por defecto `https://la-veinte-digital.vercel.app`) |

O con Docker:

```bash
cd bot-api
docker build -t bot-api-sntss .
docker run -p 8000:8000 bot-api-sntss
```

---

## Aplicación Android (shell nativo)

Existe una app híbrida en `android-app/` que embebe el Home web en un WebView
persistente y aporta: actualizaciones OTA, biometría, bóveda de credenciales
IMSS, captura de tarjetones de los portales oficiales y visor PDF con gestos.
Toda la técnica (rutas del grafo, puente `window.LaVeinteApp`, ruteo por
dominios, flujo OTA, seguridad, tema claro, áreas de regresión) y el checklist
de publicación está en [`docs/ANDROID_APP.md`](./docs/ANDROID_APP.md).
Regla: cada cambio de código en `android-app/` requiere bump de versión +
actualización de doc + publicación OTA documentada en ese archivo.

---

## Despliegue

El proyecto está configurado para desplegarse en Vercel:

```bash
# Despliegue manual
vercel --prod --yes
```

El archivo `vercel.json` expone `/health` mediante el endpoint independiente `/api/health`.

---

## Versión Estable

El estado verificado y protegido contra regresiones está registrado en
[`docs/BASELINE_ESTABLE.md`](./docs/BASELINE_ESTABLE.md) (snapshot
`v2026.09.06-stable` sobre `main` `3bd9506`: tests, typecheck, lint y build
en verde; sin cambios funcionales). La gobernanza permanente vive en
`AGENTS.md`, `docs/STABLE_BASELINE.md` y `docs/REGRESSION_GUARDRAILS.md`.

---

## Comandos Disponibles

| Comando | Descripción |
|---|---|
| `npm run dev` | Inicia servidor de desarrollo |
| `npm run build` | Construye para producción |
| `npm start` | Inicia servidor de producción |
| `npm run lint` | Ejecuta ESLint |
| `npm run typecheck` | Verifica tipos con `tsc --noEmit` |
| `npm test` | Ejecuta Vitest |

---

## Base de Datos (Supabase)

### Tablas principales

| Tabla | Descripción |
|---|---|
| `profiles` | Perfiles de usuario (extends auth.users) |
| `catalogo_adscripciones` | Catálogo de adscripciones IMSS |
| `ai_chat_history` | Historial de conversaciones con IA |
| `payroll_contexts` | Contexto de nómina (categoría, jornada, antigüedad, recurrentes) |
| `imported_payslips` (+ `_lines`, `_observations`) | Tarjetones confirmados, sin datos sensibles |
| `worker_commitments` | Registros de Agenda (12 tipos en constraint; 5 autorizados para nuevas altas) |
| `commitment_reminder_deliveries` | Entregas idempotentes de recordatorios de Agenda |
| `announcements` (+ `_reads`) | Comunicados, tips y herramientas editoriales |
| `notification_preferences` | Preferencias push de comunicados por usuario |
| `push_campaigns` (+ `_deliveries`) | Campañas push con snapshot inmutable |
| `admin_audit_log` | Registro append-only de acciones administrativas |

El chat social y el foro fueron retirados del frontend. Sus tablas se conservan
temporalmente hasta completar el respaldo, la reconciliación de migraciones y el
rollout descrito en `docs/REMOVE_SOCIAL_MODULES_ROLLOUT.md`. El asistente de IA y
`ai_chat_history` no forman parte de esa retirada.

### Funciones

- `search_catalogo(search_term, catalogo_type)` - Búsqueda en catálogo
- `confirm_imported_payslip(...)` - Persistencia atómica de un tarjetón confirmado

---

## Convenciones del Proyecto

Ver `AGENTS.md` para las reglas completas de arquitectura:

1. **Sin lógica de negocio en `app/` o `lib/`** - Solo pages delgadas e infraestructura
2. **Módulos autocontenidos** - Cada feature tiene sus components/, hooks/, services/
3. **Componentes UI compartidos** - Usar Button, Input, Card, etc. de `shared/components/ui/`
4. **Inline styles con CSS variables** - Sin Tailwind en componentes
5. **Proxy para auth** - `src/proxy.ts` en vez de `middleware.ts`
6. **Server Actions con `useActionState`** - Patrón para formularios
7. **Dos backends de IA** - Next.js API route + Python FastAPI (mantener sincronizados)

---

## Licencia

Privado - SNTSS Sección XX
