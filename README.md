# La Veinte Digital

Plataforma digital de la comunidad SNTSS (Sindicato Nacional de Trabajadores del Seguro Social). Diseñada para trabajadores del IMSS, ofrece herramientas laborales, asistencia legal vía IA, calculadoras de prestaciones y gestión personal.

---

## Stack Tecnológico

| Tecnología | Versión |
|---|---|
| Next.js | 16.2.12 |
| React | 19.2.4 |
| TypeScript | 5.x |
| Supabase (Auth + DB) | ^0.12.3 |
| OpenAI API | GPT-4o-mini / text-embedding-ada-002 |
| Python FastAPI (Bot API) | LangChain + FAISS |
| PostgreSQL | 14.5 |
| Tailwind CSS | v4 (solo PostCSS, sin clases en componentes) |
| Framer Motion | ^12.43.0 |
| Vitest | ^4.1.10 |
| ESLint (flat config) | ^9 |
| pdfjs-dist | ^6.1.200 (lectura local del tarjetón) |
| tesseract.js | ^7.0.0 (OCR de respaldo, vendor local) |

---

## AI Radio Studio

El monorepo incluye `apps/radio-studio`, una app de escritorio Tauri para crear
podcasts de La Veinte Digital con investigación normativa, DeepSeek, voces
locales, música local y master final.

Guía obligatoria para agentes antes de tocar este flujo:
`docs/RADIO_STUDIO.md`.

Reglas clave:

- La IA no es fuente normativa; todo sale del corpus documental y Evidence Pack.
- DeepSeek investiga, dirige y ajusta guiones cuando está configurado, con
  fallback determinista.
- No usar cortinillas internas por defecto: solo intro/outro musical breve.
- Mantener cama ambiental uniforme y baja.
- Permitir comerciales como espacios editables, no como contenido editorial fijo.
- El ejecutable debe levantar el sidecar y ACE-Step automáticamente; no volver al
  flujo manual como experiencia principal.
- Mantener tres identidades de voz distintas en producción: Eduardo `A`,
  Andrea `B` y Narrador `N`. El narrador usa `data/tts/ref/narrador.wav` y no
  debe compartir la referencia de Andrea.

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
│   │   ├── tarjeton/               # Importación de tarjetón IMSS
│   │   │   ├── components/         # Dropzone, Review, Summary, ImportSuccess
│   │   │   ├── hooks/              # useTarjetonImporter
│   │   │   ├── services/           # confirm-tarjeton, payslip-sync
│   │   │   ├── lib/                # Parsers, PDF.js/OCR, sanitize, confianza
│   │   │   └── __tests__/          # Pruebas
│   │   ├── profile/                # Perfil de usuario
│   │   │   ├── components/         # ProfileForm
│   │   │   └── services/           # profiles.ts
│   │   └── simulador/              # Simulador de audiencias disciplinarias
│   │       ├── components/         # 8 componentes
│   │       ├── hooks/              # useSimulation
│   │       └── services/           # bot.ts
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
│   └── tts-core/                   # Chatterbox local, chunker, caché, fallback
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

### 3. Bitácora Personal (`/profile` → sección)
Registro diario de incidencias laborales con tipos predefinidos: Tiempo Extra, Guardia Festiva, TxT (Sustitución), Falta Injustificada, Incapacidad, Pases de salida/entrada, Vacaciones, No pagado. Los datos se almacenan en Supabase y se muestran en el perfil del usuario.

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

## Comandos Disponibles

| Comando | Descripción |
|---|---|
| `npm run dev` | Inicia servidor de desarrollo |
| `npm run build` | Construye para producción |
| `npm start` | Inicia servidor de producción |
| `npm run lint` | Ejecuta ESLint |
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
