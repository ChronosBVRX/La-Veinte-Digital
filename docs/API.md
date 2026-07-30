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

## Bot API Python (FastAPI)

Endpoint base: `NEXT_PUBLIC_BOT_API_URL` (ej: `http://localhost:8000`)

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

### Tabla: `forum_categories`
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
