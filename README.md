# La Veinte Digital

Plataforma digital de la comunidad SNTSS (Sindicato Nacional de Trabajadores del Seguro Social). Diseñada para trabajadores del IMSS, ofrece herramientas laborales, asistencia legal vía IA, foros, chat en vivo, calculadoras de prestaciones, y más.

---

## Stack Tecnológico

| Tecnología | Versión |
|---|---|
| Next.js | 16.2.12 |
| React | 19.2.4 |
| TypeScript | 5.x |
| Supabase (Auth + DB + Realtime) | ^0.12.3 |
| OpenAI API | GPT-4o-mini / text-embedding-ada-002 |
| Python FastAPI (Bot API) | LangChain + FAISS |
| PostgreSQL | 14.5 |
| Tailwind CSS | v4 (solo PostCSS, sin clases en componentes) |
| Framer Motion | ^12.43.0 |
| Vitest | ^4.1.10 |
| ESLint (flat config) | ^9 |

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
│   │   │   ├── chat/               # Salas de chat en vivo
│   │   │   ├── escritos/           # Generador de escritos PSD
│   │   │   ├── facebook/           # Feed de Facebook SNTSS
│   │   │   ├── foro/               # Foro de discusión
│   │   │   ├── nomina/             # Nómina y proyecciones
│   │   │   ├── profile/            # Perfil de usuario
│   │   │   ├── simulador/          # Simulador de audiencias
│   │   │   ├── layout.tsx          # Layout protegido
│   │   │   └── page.tsx            # Dashboard principal
│   │   ├── api/                    # API routes
│   │   │   ├── consulta/           # Asistente IA (Next.js)
│   │   │   ├── simulador/          # Simulador de audiencias
│   │   │   └── calendario/         # Exportar calendario (.ics)
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
│   │   ├── chat/                   # Chat en tiempo real
│   │   │   ├── components/         # ChatRoom
│   │   │   ├── hooks/              # useRealtime
│   │   │   └── services/           # chat.ts
│   │   ├── escritos/               # Generación de documentos PSD
│   │   │   ├── components/         # EscritosForm, Generator, Result
│   │   │   └── services/           # generarEscrito.ts
│   │   ├── facebook/               # Feed de Facebook
│   │   │   ├── components/         # FacebookFeed, FacebookFeeds
│   │   │   ├── hooks/              # (vacío)
│   │   │   └── services/           # (vacío)
│   │   ├── foro/                   # Foro de discusión
│   │   │   ├── components/         # CommentSection, NewPostForm
│   │   │   └── services/           # forum.ts
│   │   ├── nomina/                 # Nómina y proyecciones
│   │   │   ├── components/         # NominaIndex, Wizard, OptIn, Projection
│   │   │   ├── services/           # prefill.ts, storage.ts
│   │   │   ├── lib/                # Lógica de nómina
│   │   │   ├── data/               # Datos salariales
│   │   │   ├── hooks/              # Custom hooks
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

### 3. Calendario IMSS (`/calendario`)
Calendario laboral 2026 con fechas de pago, periodos de interactivo y vacacional. Exportable a formato `.ics` (iCalendar).

### 4. Catálogo (`/catalogo`)
Búsqueda en el catálogo de adscripciones del IMSS con función de búsqueda PostgreSQL (`search_catalogo`).

### 5. Chat (`/chat`)
Salas de chat en tiempo real con Supabase Realtime. Los usuarios pueden crear y unirse a salas de conversación.

### 6. Escritos (`/escritos`)
Generador de escritos formales PSD (Prestaciones de Servicios Diversos) con datos precargados del perfil del usuario. Exporta a PDF.

### 7. Facebook (`/facebook`)
Feed integrado de la página de Facebook de la Sección XX del SNTSS. Usa scraping vía bot-api Python.

### 8. Foro (`/foro`)
Foro de discusión con categorías, hilos, comentarios y anidación de respuestas.

### 9. Nómina (`/nomina`)
Visualización de nómina con wizard de perfil salarial, proyecciones de ingresos futuros y opción de opt-in para precarga de datos.

### 10. Perfil (`/profile`)
Gestión de perfil de usuario: nombre, matrícula, adscripción, categoría, antigüedad, teléfono.

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
| `NEXT_PUBLIC_BOT_API_URL` | URL del bot API Python (opcional, fallback a `/api/consulta`) |

### Bot API Python (opcional)

```bash
cd bot-api
python -m venv venv
source venv/bin/activate  # o venv\Scripts\activate en Windows
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

O con Docker:

```bash
cd bot-api
docker build -t bot-api-sntss .
docker run -p 8000:8000 bot-api-sntss
```

---

## Despliegue

El proyecto está configurado para desplegarse en Vercel:

```bash
# Despliegue manual
vercel --prod --yes
```

El archivo `vercel.json` incluye rewrites para `/health` y `/consulta` hacia `/api/consulta`.

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
| `forum_categories` | Categorías del foro |
| `forum_posts` | Publicaciones del foro |
| `forum_comments` | Comentarios del foro (soporta anidación) |
| `chat_rooms` | Salas de chat |
| `chat_messages` | Mensajes de chat |
| `chat_participants` | Participantes de salas |
| `catalogo_adscripciones` | Catálogo de adscripciones IMSS |
| `ai_chat_history` | Historial de conversaciones con IA |

### Funciones

- `search_catalogo(catalogo_type, search_term)` - Búsqueda en catálogo

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
