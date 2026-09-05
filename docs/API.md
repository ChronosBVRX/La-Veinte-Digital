# API Reference — La Veinte Digital

> **Catálogo Canónico de Rutas API y Política de Acceso**  
> **Fecha de corte:** 2026-09-05 — Stable Baseline (`d90ab2bbc2f4b648cb8ed0bed1801902cb9976da`)  
> **Fuente de verdad de enrutamiento:** `src/shared/server/routing/route-policy.ts`

---

## 1. Política de Enrutamiento y Seguridad de APIs

Next.js App Router procesa las peticiones a través de `src/proxy.ts` (middleware) y las clasifica de acuerdo con la política cerrada definida en `route-policy.ts`:

- **Rutas Públicas (`public`):** Accesibles sin sesión de usuario.
- **Rutas Autenticadas (`authenticated`):** Exigen cookie de sesión Supabase SSR válida; además, cada handler ejecuta internamente `requireUser()`.
- **Rutas Desconocidas (`unknown-api`):** Cualquier petición hacia `/api/*` que no esté registrada en `route-policy.ts` es interceptada y rechazada inmediatamente con `HTTP 404` y un cuerpo JSON:
  ```json
  { "error": "Not Found", "message": "API route not recognized" }
  ```

---

## 2. Inventario Completo de Endpoints API (20 Rutas)

| Endpoint | Nivel de Acceso | Método | Descripción |
|---|---|---|---|
| `/api/health` | `public` | `GET` | Health check del servicio web con commit SHA y versión. |
| `/api/calendario` | `public` | `GET` | Exportación de descansos obligatorios en formato iCalendar (.ics). |
| `/api/calculator-prefill` | `authenticated` | `GET` | Prerrelleno normativo salarial con política cerrada por calculadora. |
| `/api/consulta` | `authenticated` | `POST` | Asistente de IA (RAG) para consultas del Contrato Colectivo de Trabajo. |
| `/api/simulador` | `authenticated` | `POST` | Simulador interactivo de audiencias disciplinarias IMSS. |
| `/api/tarjeton/confirm` | `authenticated` | `POST` | Confirmación estructurada y persistencia transaccional de tarjetón IMSS. |
| `/api/tarjeton/delete` | `authenticated` | `POST` | Eliminación de registro de tarjetón importado. |
| `/api/worker-context` | `authenticated` | `GET`, `POST` | Contexto laboral persistido del trabajador en Supabase. |
| `/api/push/register` | `authenticated` | `POST` | Registro de tokens FCM para notificaciones push en Android/iOS. |
| `/api/push/send` | `authenticated` | `POST` | Envío administrativo/notificación push a dispositivos registrados. |
| `/api/normativa/health` | `authenticated` | `GET` | Estado del catálogo normativo local SQLite FTS5. |
| `/api/normativa/search` | `authenticated` | `POST` | Búsqueda semántica y por texto completo en el catálogo normativo. |
| `/api/normativa/compare` | `authenticated` | `POST` | Comparador de versiones del Contrato Colectivo (2013-2025 vs 2025-2027). |
| `/api/normativa/audio` | `authenticated` | `GET`, `POST` | Streaming y generación de audio de fragmentos normativos. |
| `/api/normativa/document` | `authenticated` | `GET` | Recuperación de metadatos y secciones de documentos oficiales. |
| `/api/normativa/evidence` | `authenticated` | `POST` | Generación de Evidence Pack documental para fundamentación. |
| `/api/normativa/respuesta` | `authenticated` | `POST` | Respuestas normativas con citas estrictas a artículos y cláusulas. |
| `/api/normativa/script` | `authenticated` | `POST` | Generación y validación de guiones de audio basados en corpus. |
| `/api/normativa/tts` | `authenticated` | `POST` | Síntesis de voz para fragmentos normativos. |
| `/api/normativa/sync` | `authenticated` | `POST` | Sincronización idempotente de chunks normativos a pgvector. |
| `/api/normativa/visor` | `authenticated` | `GET` | Entrega de contenido estructurado para el visor de la biblioteca. |
| `/api/escritos/generar` | `authenticated` | `POST` | Asistencia por IA en redacción y fundamentación de escritos PSD. |

---

## 3. Especificación Detallada de Endpoints Principales

### GET /api/health
Health check público e independiente. No consume OpenAI, Supabase ni cuotas.

**Cabeceras de respuesta:**
- `Cache-Control: no-store`
- `x-commit-sha: <commit_sha>`

**Response Body (JSON):**
```json
{
  "status": "ok",
  "version": "0.002",
  "commitSha": "d90ab2bbc2f4b648cb8ed0bed1801902cb9976da"
}
```

---

### GET /api/calculator-prefill
Entrega los valores salariales sugeridos para una calculadora sin tocar sus fórmulas.

**Parámetros Query:**
- `calculator` (requerido): `"aguinaldo"` | `"clausula-97"` | `"segunda-julio"` | `"segunda-julio-proporcional"` | `"tiempo-extra"` | `"prestamos"`
- `targetDate` (opcional): Fecha en formato ISO `YYYY-MM-DD`.

**Response Body (JSON):**
```json
{
  "calculator": "segunda-julio",
  "targetDate": "2026-07-15",
  "generatedAt": "2026-09-05T17:00:00.000Z",
  "categoryId": "enf-gral-8h",
  "categoryName": "Enfermera General 8h",
  "fields": {
    "concepto002": { "value": 7500.50, "source": "payroll_context", "confidence": "high" },
    "concepto011": { "value": 1200.00, "source": "payroll_context", "confidence": "high" }
  },
  "missingFacts": [],
  "warnings": []
}
```

---

### POST /api/tarjeton/confirm
Confirma la importación de un tarjetón procesado localmente en el cliente. **Nunca recibe el archivo binario PDF.**

**Request Body (JSON - `ConfirmTarjetonRequest`):**
```json
{
  "documentHash": "a1b2c3d4e5f6...",
  "fileName": "tarjeton-2026-08-2A.pdf",
  "period": "2026-08-2A",
  "summary": {
    "perceptionsTotal": 14256.87,
    "deductionsTotal": 10354.87,
    "netAmount": 3902.00
  },
  "workerData": {
    "matricula": "99123456",
    "category": "Enfermera General",
    "jornada": 8,
    "antiguedad": "12 años"
  },
  "perceptions": [
    { "code": "002", "description": "SUELDO", "amount": 7500.50 },
    { "code": "011", "description": "AYUDA RENTA", "amount": 1200.00 }
  ],
  "deductions": [
    { "code": "100", "description": "CUOTA SINDICAL", "amount": 150.00 }
  ],
  "observations": []
}
```

**Proceso en servidor:**
1. Valida esquema y consistencia aritmética: $Percepciones - Deducciones = Neto$.
2. Invoca RPC `confirm_imported_payslip` (PostgreSQL transaccional).
3. Actualiza `profiles` y realiza upsert en `payroll_contexts`.

**Response Body (JSON):**
```json
{
  "success": true,
  "payslipId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Tarjetón confirmado y sincronizado exitosamente"
}
```

---

### POST /api/consulta
Consulta con RAG y búsqueda híbrida contra el Contrato Colectivo y catálogo normativo.

**Request Body (JSON):**
```json
{
  "history": [
    { "role": "user", "content": "¿Cuántos días corresponden de aguinaldo según el contrato?" }
  ]
}
```

**Response Body (JSON):**
```json
{
  "respuesta": "De acuerdo con la **Cláusula 107 del Contrato Colectivo de Trabajo vigente (2025-2027)**, los trabajadores del IMSS tienen derecho a...",
  "fuentes": [
    { "documento": "CCT 2025-2027", "clausula": "107", "pagina": 84 }
  ]
}
```

---

### POST /api/simulador
Simulador de audiencias disciplinarias IMSS con el Lic. Mendoza.

**Request Body (JSON - Modo chat):**
```json
{
  "action": "chat",
  "history": [
    { "role": "user", "content": "Buenos días, vengo acompañado de mi representación sindical." }
  ],
  "scenario": "faltas",
  "difficulty": 1
}
```

**Request Body (JSON - Modo analyze):**
```json
{
  "action": "analyze",
  "history": [...],
  "scenario": "faltas"
}
```

**Response Body (JSON - Modo analyze):**
```json
{
  "puntajeCalma": 85,
  "puntajeFirmeza": 90,
  "erroresTacticos": [],
  "fortalezas": ["Mantuvo apego a hechos", "Invocó acompañamiento sindical oportunamente"],
  "recomendacion": "Excelente manejo de la diligencia previa."
}
```

---

### POST /api/escritos/generar
Asistente para estructuración de escritos de descargo y peticiones sindicales (PSD).

**Request Body (JSON):**
```json
{
  "tipo": "descargo_diligencia",
  "destinatario": {
    "nombre": "Dr. Fernando Gutiérrez",
    "cargo": "Director de Unidad HGZ 24"
  },
  "hechos": "El día 14 de agosto me presenté a laborar puntualmente...",
  "fundamentoDeseado": "Cláusula 41 CCT"
}
```

**Response Body (JSON):**
```json
{
  "contenidoSugerido": "POR MEDIO DEL PRESENTE ESCRITO...",
  "fundamentosCCT": ["Cláusula 41", "Reglamento Interior de Trabajo"],
  "advertencias": []
}
```
