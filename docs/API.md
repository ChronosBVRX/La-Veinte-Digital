# API Reference

## Rutas Internas (Next.js API Routes)

### GET /api/consulta
Health check del asistente.

**Response:**
```json
{ "status": "ok" }
```

---

### POST /api/consulta
Consulta al asistente SNTSS con RAG (Retrieval-Augmented Generation).

**Request Body:**
```json
{
  "history": [
    { "role": "user", "content": "¿Cuántos días de vacaciones me corresponden?" },
    { "role": "assistant", "content": "..." }
  ]
}
```

**Process:**
1. Extrae la última pregunta del usuario del historial
2. Genera embedding con `text-embedding-ada-002`
3. Calcula cosine similarity contra `vectorstore-data.json`
4. Refuerza score por keywords (vacaciones, aguinaldo, escalafón, etc.)
5. Refuerza score por referencias a artículos/cláusulas específicas
6. Selecciona top-8 chunks relevantes como contexto
7. Envía a `gpt-4o-mini` con system prompt + historial + contexto

**Response:**
```json
{
  "respuesta": "¡Claro que sí! Según la **Cláusula 47 del CCT**, tienes derecho a..."
}
```

**Error:**
```json
{
  "error": "Error interno: ..."
}
```

---

### POST /api/simulador
Simulador de audiencias disciplinarias IMSS. Dos modos: `chat` y `analyze`.

**Request Body (chat):**
```json
{
  "action": "chat",
  "history": [{ "role": "user", "content": "..." }],
  "scenario": "faltas",
  "difficulty": 1
}
```

**Request Body (analyze):**
```json
{
  "action": "analyze",
  "history": [{ "role": "user", "content": "..." }, { "role": "assistant", "content": "..." }],
  "scenario": "faltas"
}
```

**Escenarios disponibles:**
| ID | Nombre |
|---|---|
| `faltas` | Faltas Injustificadas |
| `maltrato` | Presunto Maltrato |
| `incumplimiento` | Incumplimiento de Funciones |
| `extravio` | Extravío de Insumos |
| `retardo` | Retardos Frecuentes |
| `confidencialidad` | Violación de Confidencialidad |

**Response (chat):**
```json
{
  "respuesta": "Buenos días. Soy el Lic. Mendoza del área jurídica...",
  "presion": 3,
  "estado": "neutral"
}
```

**Response (analyze):**
```json
{
  "puntajeCalma": 75,
  "puntajeFirmeza": 60,
  "erroresTacticos": ["Respondió de forma agresiva", "Se contradijo en su declaración"],
  "fortalezas": ["Mantuvo la compostura", "Citó cláusulas relevantes"],
  "articulosRelevantes": ["Cláusula 47 del CCT", "Artículo 51 del Reglamento Interior de Trabajo"],
  "resumen": "El trabajador mostró áreas de oportunidad en..."
}
```

---

### GET /api/calendario
Exporta el calendario IMSS 2026 a formato iCalendar (.ics).

**Query Parameters:**
| Param | Tipo | Descripción |
|---|---|---|
| `mes` | `number` (opcional) | Índice del mes (0-11). Si se omite, exporta el año completo. |

**Response:** `Content-Type: text/calendar; charset=utf-8`

---

### GET /api/calculator-prefill
Prerrelleno normativo para calculadoras IMSS (requiere sesión).

**Query Parameters:**
| Param | Tipo | Descripción |
|---|---|---|
| `calculator` | `string` (requerido) | ID de la calculadora: `aguinaldo`, `clausula-97`, `prestamos`, `segunda-julio`, `segunda-julio-proporcional`, `tiempo-extra` |
| `targetDate` | `string` (opcional) | Fecha de referencia ISO `YYYY-MM-DD`. Por defecto: hoy. |

**Process:**
1. Autentica con la sesión de Supabase (401 si no hay sesión)
2. Lee `profiles` (categoría, antigüedad) y `payroll_contexts` (contexto de nómina)
3. Lee el último tarjetón confirmado (`imported_payslips`) para
   `daysWorkedInAnnualPeriod` (`source: "last_payslip"`)
4. Resuelve la categoría contra el tabulador vigente en `targetDate`
5. Calcula antigüedad (fecha efectiva > texto del perfil)
6. Ejecuta el motor de nómina existente (`calculateProjection`)
7. Filtra por la política cerrada de la calculadora y devuelve el contrato

**Response (200):**
```json
{
  "schemaVersion": "1.0",
  "calculatorId": "aguinaldo",
  "targetDate": "2026-07-31",
  "generatedAt": "2026-07-31T12:00:00.000Z",
  "categoryResolved": true,
  "categoryResolutionStatus": "resolved",
  "fields": {
    "categoryId": { "value": "TECNICO_RADIOLOGO_80", "source": "profile", "confidence": "high", "effectiveAt": "2026-07-31", "editable": true },
    "categoryName": { "value": "TECNICO RADIOLOGO 80", "source": "profile", "confidence": "high", "effectiveAt": "2026-07-31", "editable": true },
    "concepto002": { "value": 3937.64, "source": "salary_table", "confidence": "high", "effectiveAt": "2026-07-31", "editable": true, "ruleVersion": "salary-table-2025-2027" }
  },
  "missingFacts": [],
  "warnings": []
}
```

**Errores:**
- `401` — sin sesión activa
- `400` — `calculator` inválido o fecha malformada
- `500` — error interno

Los campos entregados son una lista **cerrada** por calculadora (política en
`src/features/nomina/lib/calculator-prefill-policy.ts`); el 022 se muestra solo
como información en Cláusula 97 y nunca se integra a una base.

### POST /api/tarjeton/confirm
Confirma un tarjetón IMSS ya extraído y revisado por el trabajador (requiere
sesión). **El PDF nunca se sube**: el cliente envía solo el resultado
estructurado (`ConfirmTarjetonRequest`, contrato
`src/shared/contracts/tarjeton-import.ts`).

**Request Body:**
```json
{
  "schemaVersion": "1.0",
  "sourceHash": "<sha256 del PDF, 64 hex>",
  "parsed": { "type": "imss_payroll_receipt", "extraction": { "method": "native_text" }, "...": "..." },
  "profileUpdates": { "matricula": true, "categoria": false },
  "acknowledgeTotalDifference": false
}
```

**Process (RPC `confirm_imported_payslip`, una transacción):**
1. Autentica con la sesión de Supabase (401 si no hay sesión)
2. Valida el contrato (schemaVersion "1.0", tipo, límites de líneas/observaciones)
3. Recalcula los totales en servidor con tolerancia 0.05 (salvo reconocimiento)
4. Si la matrícula difiere y no fue autorizado el cambio → `matricula_mismatch`
5. Si `(user_id, source_hash)` ya existe → respuesta `duplicate` (sin error)
6. Inserta cabecera + líneas + observaciones; actualiza `profiles` solo con
   campos autorizados; hace upsert de `payroll_contexts` (categoría, jornada,
   antigüedad efectiva, conceptos recurrentes 050/023/063, hecho 054)

**Response (200):**
```json
{
  "id": "uuid",
  "duplicate": false,
  "profileUpdated": true,
  "payrollContextUpdated": true
}
```

**Errores:**
- `401` — sin sesión activa
- `400` — `invalid_payload` o `template_not_detected`
- `422` — `totals_mismatch`, `matricula_mismatch`, `duplicate`, `limits_exceeded`
- `500` — error interno

---

## Bot API Python (FastAPI)

El navegador nunca llama al bot Python directamente: siempre pasa por `POST /api/consulta` (Next.js), que lo invoca con el header `X-Bot-Secret` cuando `BOT_API_URL` y `BOT_API_SHARED_SECRET` están configurados; si no responde, se degrada al motor directo de OpenAI dentro de Next.js. Para desarrollo local, el bot corre en `http://localhost:8000`.

### GET /
Página de estado HTML.

### POST /consulta
Consulta al asistente usando LangChain + FAISS.

**Request Body:**
```json
{
  "history": [
    { "role": "user", "content": "¿Qué dice la Cláusula 47?" }
  ]
}
```

**Process:**
1. Detecta saludos simples y responde directamente
2. Extrae la última pregunta del historial
3. LangChain ReAct agent con FAISS retriever (MMR, k=6, fetch_k=20)
4. Usa `gpt-4o-mini` con system prompt
5. Genera respuesta con citas a documentos

**Response:**
```json
{
  "respuesta": "Según la **Cláusula 47 del CCT**..."
}
```

### GET /facebook
Obtiene posts de Facebook de una página.

**Query Parameters:**
| Param | Tipo | Default | Descripción |
|---|---|---|---|
| `page` | `string` | `SNTSSSeccionXXMichoacan` | Nombre/ID de la página de Facebook |
| `pages` | `number` | `3` | Número de páginas a scrapear |

**Response:**
```json
{
  "posts": [
    {
      "id": "123456789",
      "text": "Contenido del post...",
      "time": "2026-07-30 10:00:00",
      "image": "https://...",
      "video": null,
      "likes": 42,
      "comments": 5,
      "shares": 2,
      "url": "https://facebook.com/..."
    }
  ]
}
```

### GET /health
Health check.

**Response:**
```json
{ "status": "ok" }
```

---

## Supabase Database Schema

### Tabla: `profiles`
| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID (PK) | Referencia a `auth.users.id` |
| `full_name` | text | Nombre completo |
| `matricula` | text | Matrícula IMSS |
| `adscripcion` | text | Adscripción |
| `categoria` | text | Categoría |
| `antiguedad` | text | Antigüedad |
| `phone` | text | Teléfono |
| `avatar_url` | text | URL de avatar |
| `role` | text | Rol del usuario |
| `is_online` | boolean | Estado de conexión |
| `created_at` | timestamptz | Fecha de creación |
| `updated_at` | timestamptz | Última actualización |

### Tabla: `forum_posts`
| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID (PK) | ID del post |
| `author_id` | UUID (FK → profiles) | Autor |
| `category_id` | UUID (FK → forum_categories) | Categoría |
| `title` | text | Título |
| `content` | text | Contenido |
| `is_pinned` | boolean | Fijado |
| `is_locked` | boolean | Cerrado |
| `created_at` | timestamptz | Fecha de creación |
| `updated_at` | timestamptz | Última actualización |

### Tabla: `forum_comments`
| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID (PK) | ID del comentario |
| `post_id` | UUID (FK → forum_posts) | Post padre |
| `author_id` | UUID (FK → profiles) | Autor |
| `parent_id` | UUID (FK → forum_comments) | Comentario padre (anidación) |
| `content` | text | Contenido |
| `created_at` | timestamptz | Fecha |
| `updated_at` | timestamptz | Última actualización |

### Tabla: `bitacora_entries`
| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID (PK) | ID |
| `user_id` | UUID (FK → profiles) | Usuario |
| `entry_type` | text | Tipo: Tiempo Extra, Guardia Festiva, TxT (Sustitución), Falta Injustificada, Incapacidad, Pases de salida/entrada, Vacaciones, No pagado |
| `description` | text | Descripción |
| `entry_date` | date | Fecha de la incidencia |
| `created_at` | timestamptz | Fecha de registro |

### Tabla: `payroll_contexts`
| Columna | Tipo | Descripción |
|---|---|---|
| `user_id` | UUID (PK, FK → profiles) | Usuario (una fila por usuario) |
| `category_id` | text | ID estable de categoría |
| `category_code` | text | Código de categoría |
| `category_name` | text | Nombre de categoría |
| `workday_hours` | numeric(4,1) | Horas de jornada |
| `employment_type` | text | Tipo de empleo |
| `effective_seniority_date` | date | Fecha efectiva de antigüedad |
| `occupational_conditions` | jsonb | Condiciones ocupacionales |
| `payroll_facts` | jsonb | Hechos de nómina |
| `recurring_concepts` | jsonb | Evidencia de conceptos recurrentes (023, 050, 063…) |
| `siap_concept_marks` | jsonb | Marcas de conceptos SIAP |
| `updated_at` | timestamptz | Última actualización |

RLS: cada usuario solo puede leer/insertar/actualizar su propia fila
(migración `003_payroll_contexts.sql`).

### Tabla: `imported_payslips`
| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID (PK) | ID |
| `user_id` | UUID (FK → profiles) | Dueño del tarjetón |
| `source_hash` | text | SHA-256 del PDF fuente (dedup) |
| `extraction_method` | text | `native_text` \| `ocr` \| `hybrid` |
| `period_raw` / `period_year` / `period_month` / `period_half` | text / int | Periodo del tarjetón |
| `folio` | text | Folio del tarjetón |
| `fiscal_folio_hash` | text | Folio fiscal como huella (sin exponer el original) |
| `certification_date` | date | Fecha de certificación |
| `global_confidence` | numeric(4,3) | Confianza 0–1 |
| `warnings` | jsonb | Advertencias de validación |
| `employee_data` / `attendance` / `vacations` / `payroll_totals` | jsonb | Datos estructurados |
| `created_at` | timestamptz | Fecha |

UNIQUE(`user_id`, `source_hash`). Sin RFC/CURP/NSS/cuenta/QR/sellos.

### Tabla: `imported_payslip_lines`
Líneas de percepciones/deducciones: `line_index`, `concept_code`,
`description`, `amount numeric(14,2)`, `kind` (`earning`/`deduction`),
`confidence`, `confirmed_by_user`. UNIQUE(`payslip_id`, `line_index`).

### Tabla: `imported_payslip_observations`
Observaciones: `line_index`, `concept_code`, `amount`, `due_period`, `units`,
`control_number`, `initial_charge`, `notes`. UNIQUE(`payslip_id`, `line_index`).

RLS en las tres tablas: solo el dueño lee/inserta (migración
`004_imported_payslips.sql`).

### Función: `confirm_imported_payslip`
```sql
confirm_imported_payslip(
  p_source_hash text,
  p_parsed jsonb,
  p_profile_updates jsonb,
  p_acknowledge_total_difference boolean
) → jsonb  -- { id, duplicate, profileUpdated, payrollContextUpdated }
```
SECURITY DEFINER, validación de contrato y totales en servidor.

### Función: `search_catalogo`
| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID (PK) | ID |
| `name` | text | Nombre |
| `slug` | text | Slug URL |
| `description` | text | Descripción |
| `sort_order` | int | Orden |

### Tabla: `chat_rooms`
| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID (PK) | ID de sala |
| `name` | text | Nombre de sala |
| `description` | text | Descripción |
| `created_by` | UUID (FK → profiles) | Creador |
| `is_private` | boolean | Sala privada |
| `created_at` | timestamptz | Fecha |

### Tabla: `chat_messages`
| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID (PK) | ID |
| `room_id` | UUID (FK → chat_rooms) | Sala |
| `user_id` | UUID (FK → profiles) | Autor |
| `content` | text | Mensaje |
| `created_at` | timestamptz | Fecha |

### Tabla: `chat_participants`
| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID (PK) | ID |
| `room_id` | UUID (FK → chat_rooms) | Sala |
| `user_id` | UUID (FK → profiles) | Usuario |
| `joined_at` | timestamptz | Fecha de ingreso |

### Tabla: `catalogo_adscripciones`
| Columna | Tipo | Descripción |
|---|---|---|
| `id` | int (PK) | ID |
| `nombre` | text | Nombre de adscripción |
| `created_at` | timestamptz | Fecha |

### Tabla: `ai_chat_history`
| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID (PK) | ID |
| `user_id` | UUID (FK → profiles) | Usuario |
| `role` | text | `user` o `assistant` |
| `content` | text | Mensaje |
| `created_at` | timestamptz | Fecha |

### Función: `search_catalogo`
```sql
search_catalogo(catalogo_type text, search_term text) → TABLE(nombre text)
```
