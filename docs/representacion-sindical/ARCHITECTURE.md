# Arquitectura — Representación Sindical XXI

## Capas (convención del repo)

- `src/features/representacion/lib/` — dominio puro (maternidad, lactancia,
  licencias, pasajes, lockers, folio, validación Zod, fuentes normativas).
  Sin I/O, sin Supabase, con tests.
- `src/features/representacion/services/` — acceso a datos y generación de
  documentos en servidor (`permissions.ts`, `cases.ts`, `audit.ts`,
  `passage-pdf.ts` con pdf-lib, `license-excel.ts` con ExcelJS,
  `license-word.ts` con docxtemplater+pizzip).
- `src/features/representacion/components/` — UI cliente (mobile-first,
  componentes compartidos Button/Input/Card, sin Tailwind).
- `src/features/representacion/hooks/` — (reservado; hoy la data se obtiene
  vía fetch a las APIs del módulo).
- `src/app/(dashboard)/representacion/**` — páginas delgadas: verifican
  `getUnionMemberships()` en servidor y redirigen a `/` sin acceso.
- `src/app/api/union/**` — 13 rutas autenticadas, registradas exactamente en
  `src/shared/server/routing/route-policy.ts` (el proxy devuelve 404 JSON a
  cualquier API no listada).

## APIs

| Ruta | Uso |
|---|---|
| `/api/union/workers` | GET buscar, POST alta |
| `/api/union/cases` | GET listar, POST crear (maternity/lactation/passage_026/passage_027/license), PATCH estado |
| `/api/union/lockers` | GET grid, POST create/assign/release/status |
| `/api/union/waitlist` | GET/PATCH lista de espera |
| `/api/union/passages` | GET detalle de pasaje |
| `/api/union/passages/pdf` | POST genera PDF 026 (1 pág.) / 027 (2 págs. con aviso) |
| `/api/union/licenses` | GET detalle + timeline |
| `/api/union/licenses/excel` | POST genera .xlsx 1A74-009-036 |
| `/api/union/licenses/word` | POST genera .docx oficio XXI sanitizado |
| `/api/union/dashboard` | GET contadores + recientes |
| `/api/union/members` | GET miembros; POST registra solicitud de alta |
| `/api/union/settings` | GET/PUT configuración del comité (solo union_admin escribe) |
| `/api/union/audit` | GET auditoría sanitizada |

## Permisos

- Reutiliza Supabase Auth. No hay contraseñas propias.
- `union_members(user_id, delegation_id, role, active)` extiende el RBAC
  existente (`profiles.role='admin'` actúa como super-admin). No se altera el
  constraint `profiles_role_check`.
- Soporta N representantes por delegación.
- `union_delegations` aísla por delegación desde el día 1 (seed: XXI / HGR No. 1).
- Todas las escrituras verifican delegación en servidor; nunca confían en IDs del navegador.

## Datos

Migración `supabase/migrations/20260914000000_union_representacion.sql` (aditiva):
delegaciones, miembros, trabajadores, casos + detalles por tipo, lockers,
asignaciones (unique parcial anti-doble-activo), espera, documentos, eventos
(timeline), auditoría, settings, contadores de folio, función `union_next_folio`,
helpers `union_is_member/admin/my_delegations`, RLS completa y bucket privado
`union-private`. Tipos sincronizados en `src/lib/supabase/types.ts`.

## Integración con el shell

- `src/app/(dashboard)/layout.tsx` calcula `canAccessUnion` (membresía o admin).
- `DashboardShell` → `DesktopSidebar` muestra "Representación Sindical" solo con acceso.
- Home y demás módulos intactos (cero cambios en Tarjetón, Vacaciones,
  Calculadoras, Radio, TTS).
