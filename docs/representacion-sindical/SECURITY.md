# Seguridad — Representación Sindical XXI

## RLS (migración 20260914000000)

- Todas las tablas `union_*` con RLS habilitada.
- No autenticado: 0 acceso. Autenticado sin membresía: 0 acceso (páginas
  redirigen a `/`, APIs 403).
- `union_rep`: solo delegaciones asignadas (`union_is_member`).
- `union_admin`: además escribe settings,
  miembros y overrides.
- BETA PRIVADA: `profiles.role='admin'` NO otorga acceso sindical; todo acceso
  depende exclusivamente de `union_members` (helpers SQL y capa de aplicación
  sin bypass global).
- Tablas detalle (maternidad/lactancia/pasajes/licencias/documentos/eventos)
  autorizan vía delegación del caso padre.
- `union_folio_counters`: escritura autenticada (folio atómico vía RPC
  `union_next_folio`, SECURITY DEFINER); `storage.objects` del bucket
  `union-private` limitado a miembros (lectura/escritura autenticada del bucket).

## Storage

- Bucket privado `union-private` (nunca público). Organización sugerida:
  `union/delegation-xxi/workers/<worker-id>/cases/<case-id>/`.
- Sin matrícula ni nombre completo en el path cuando pueda evitarse.
- Descargas con URLs firmadas de duración breve; sin URLs permanentes públicas.
- Sin `service_role` en el cliente.

## Auditoría y minimización

- `union_audit_log` + `union_case_events` (timeline sin cambios silenciosos).
- `sanitizeAuditMetadata`: redacta contraseñas/tokens/teléfonos/domicilios/
  diagnósticos; matrícula solo últimos 4; trunca strings largos.
- Maternidad: solo fecha de incapacidad + datos administrativos.
- Licencias: motivo en grado indispensable.
- Expedientes: cancelación/archivado, no DELETE físico desde UI. Trabajadores:
  desactivar, no borrar con expedientes. Lockers: liberar conserva historial.

## Endurecimiento de endpoints

- `requireUser()` en cada API + `requireUnionMembership/Admin` por delegación.
- Validación Zod en cliente y servidor (fechas, rangos, 90/365 inclusivos,
  unicidad de asignaciones, control SIAP opcional).
- Límites: uploads con MIME/tamaño verificados en storage; sin path traversal
  (paths generados en servidor); salidas PDF/Excel/Word sin HTML inyectable;
  sin stack traces al usuario; sin PII completa en logs.
- IDOR: todo `worker_id`/`case_id`/`delegation_id` del navegador se revalida
  contra membresía en servidor.
