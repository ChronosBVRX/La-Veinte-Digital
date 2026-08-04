# Arquitectura de La Veinte Digital

## Visión General

La Veinte Digital es una aplicación web full-stack construida con Next.js 16 (App Router) que sirve a la comunidad del SNTSS Sección XX. Combina server-side rendering con componentes cliente para ofrecer un dashboard interactivo con herramientas laborales y asistencia basada en IA.

---

## Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│                      Cliente Web                         │
│              Next.js 16 (App Router)                     │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ Server       │  │ Client       │  │ API Routes     │  │
│  │ Components   │  │ Components   │  │ (REST)         │  │
│  │ (RSC)        │  │ (CSR)        │  │                │  │
│  └──────┬───────┘  └──────┬───────┘  └───────┬────────┘  │
│         │                 │                  │           │
│         └────────┬────────┘──────────────────┘           │
│                  │                                       │
│          ┌───────┴────────┐                              │
│          │   proxy.ts     │  ← Supabase SSR Auth         │
│          │    (Proxy)      │                              │
│          └────────────────┘                              │
├─────────────────────────────────────────────────────────┤
│                      Supabase                             │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ Auth        │  │ PostgreSQL   │  │ RLS + RPC      │  │
│  │ (SSR + PKCE)│  │ (Tablas +    │  │ (autorización  │  │
│  │             │  │  Funciones)  │  │  y operaciones)│  │
│  └─────────────┘  └──────────────┘  └────────────────┘  │
├─────────────────────────────────────────────────────────┤
│                   OpenAI API                              │
│  ┌──────────────────────────────────────────────────┐    │
│  │ GPT-4o-mini + text-embedding-ada-002             │    │
│  │ RAG con vectorstore-data.json (cosine similarity)│    │
│  └──────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────┤
│         Bot API Python (Opcional - FastAPI)              │
│  ┌──────────────────────────────────────────────────┐    │
│  │ LangChain + FAISS + React Agent                  │    │
│  │ PDFs → embeddings → retrieval → GPT-4o-mini     │    │
│  └──────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

---

## Flujo de Datos

### 1. Autenticación

```
Usuario → /login → Server Action (signInAction)
         → Supabase Auth (PKCE) → Cookie de sesión
         → proxy.ts verifica cookie en cada request
         → Redirección a /login si no autenticado
```

### 2. Chat con IA (Asistente SNTSS)

```
Usuario → ChatAssistant (CSR)
         → POST /api/consulta (Next.js; auth + cuota diaria)
           ├── Si BOT_API_URL + BOT_API_SHARED_SECRET configurados
           │    → Python FastAPI (X-Bot-Secret); si no responde → motor directo
           └── Motor directo en Next.js:
         → OpenAI: embedding de pregunta
         → Cosine similarity contra vectorstore-data.json
         → Contexto + prompt → GPT-4o-mini
         → Respuesta renderizada con react-markdown
```

### 3. Simulador de Audiencias

```
Usuario → SimuladorPage (CSR)
         → Selecciona escenario (faltas, maltrato, etc.)
         → POST /api/simulador (chat + analysis)
         → OpenAI: busca contexto relevante + genera respuesta del "Lic. Mendoza"
         → Análisis post-simulación: evalúa calma, firmeza, errores
```

### 4. Prerrelleno Normativo de Calculadoras

```
Calculadora (CSR) → useCalculatorPrefill(calculatorId, targetDate)
         → GET /api/calculator-prefill?calculator=...&targetDate=...
         → buildCalculatorPrefill (server, feature nomina):
             profiles + payroll_contexts → resolveCategory → antigüedad
             → calculateProjection (motor de nómina existente)
             → buildCalculatorPrefillResponse (filtro por política cerrada)
         → usePrefillFields aplica valores solo a campos vacíos
           (un campo editado nunca se sobrescribe; botón "Restaurar")
```

Las calculadoras **nunca importan lógica de la feature nomina**; consumen el
contrato compartido (`src/shared/contracts/calculator-prefill.ts`) vía API
interna. Las fórmulas de `features/calculators/lib/` no se tocan. Detalle en
[`CALCULATOR_PREFILL.md`](./CALCULATOR_PREFILL.md).

### 6. Importación de Tarjetón IMSS

```
Usuario → /tarjeton → TarjetonImporter (CSR)
         → useTarjetonImporter:
             PDF.js (texto nativo) → ¿< 120 chars? → Tesseract OCR (fallback)
             → parseImssTarjeton (orquestador) → Revisión humana (Review)
         → POST /api/tarjeton/confirm (contrato estructurado, NUNCA el PDF)
         → RPC confirm_imported_payslip (transacción única):
             imported_payslips + lines + observations
             → profiles (campos autorizados)
             → payroll_contexts (upsert: categoría, jornada, antigüedad,
               recurrentes 050/023/063, hecho 054)
         → syncConfirmedPayslip (localStorage: perfil + recibos)
```

El PDF se procesa 100% en el navegador (PDF.js + Tesseract vía
`public/vendor/`); RFC/CURP/NSS/cuenta/sellos se descartan y el folio fiscal
solo se guarda como hash. Detalle en
[`TARJETON_IMPORT.md`](./TARJETON_IMPORT.md).

---

## Patrón de Componentes

### Server Components (RSC)

- `app/(dashboard)/layout.tsx` - Verifica auth, carga perfil, renderiza DashboardShell
- `app/(dashboard)/page.tsx` - Dashboard con stats, calendario, feeds
- Todas las pages en `app/(dashboard)/` que no requieren interactividad

### Client Components (CSR)

- `features/asistente/components/` - Chat, mensajes, typing indicator
- `features/simulador/components/` - Simulación interactiva
- `features/calculators/components/` - Calculadoras con inputs
- `features/escritos/components/` - Formularios
- `features/bitacora/components/` - Bitácora personal (incidencias laborales)
- `features/nomina/components/` - Wizard de perfil salarial, proyecciones
- `features/tarjeton/components/` - Importador de tarjetón IMSS (Dropzone, Review, Summary)
- `shared/components/layout/` - Navbar, Sidebar, DashboardShell, TodayCard (modal interactivo)
- `shared/components/ui/` - Todos los componentes UI (Button, Input, Card, Modal, etc.)

---

## Manejo de Estado

| Estado | Mecanismo |
|---|---|
| Sesión de usuario | Supabase SSR cookies + `useUser` hook |
| Formularios | `useActionState` con Server Actions |
| Chat IA | `useState` en ChatAssistant |
| Simulador | `useSimulation` hook |
| Toast notifications | React Context (`ToastProvider`) |
| Sidebar | `useState` local en DashboardShell |
| Perfil nómina | `useNomina` hook + localStorage |
| Importación de tarjetón | `useTarjetonImporter` hook (máquina de estados idle→reading→review→confirming→done) |
| TodayCard | `useState` para modal + `getProfile()` de localStorage |

---

## Seguridad

1. **Auth Proxy** (`src/proxy.ts`): protege páginas por defecto y hace una comprobación optimista de APIs autenticadas.
2. **Registro API**: cada `src/app/api/**/route.ts` tiene clasificación exacta en `shared/server/routing/route-policy.ts`; las rutas desconocidas responden JSON 404.
3. **Autorización definitiva**: cada API privada conserva `requireUser()` dentro del handler y las operaciones de datos dependen además de RLS/RPC.
4. **Rutas públicas**: páginas legales/auth y únicamente `/api/health` y `/api/calendario` entre las APIs actuales.
5. **Secretos**: OpenAI y el secreto del bot Python permanecen solo en servidor.

---

## Rendimiento

- **RSC (React Server Components)**: Para páginas que no requieren interactividad, como calendario y vistas iniciales del dashboard
- **Streaming**: No implementado actualmente (considerar para carga de documentos grandes)
- **CSR**: Componentes interactivos (asistente, calculadoras, simulador) se cargan como client bundles
- **Optimización de imágenes**: Next.js Image component no se usa actualmente (img tags directas)

---

## Pruebas

- **Vitest**: Configurado con alias `@/` mapeado a `./src/`
- **Tests unitarios**: En `features/calculators/__tests__/`, `features/nomina/__tests__/`, `features/vacations/__tests__/` y `features/tarjeton/__tests__/` (parsers puros + servicio de confirmación, fixtures ficticios)
- **Tests de contrato**: `shared/contracts/__tests__/` (validadores del prerrelleno)
- **Tests de routing**: clasificación exhaustiva de APIs, proxy y health endpoint
- **Sin tests E2E** actualmente

```bash
npm test          # Ejecutar todos los tests
npx vitest        # Modo watch
```

---

## Dependencias Clave

| Paquete | Propósito |
|---|---|
| `@supabase/ssr` | Auth SSR con cookies |
| `@supabase/supabase-js` | Cliente Supabase |
| `openai` | API de OpenAI (embeddings + chat) |
| `framer-motion` | Animaciones (uso mínimo) |
| `lucide-react` | Iconos |
| `react-markdown` | Renderizado de respuestas del bot |
| `jspdf` + `html2canvas` | Generación de PDF |
| `pdfjs-dist` + `tesseract.js` | Extracción local del tarjetón (PDF.js) y OCR de respaldo (Tesseract), servidos desde `public/vendor/` |
