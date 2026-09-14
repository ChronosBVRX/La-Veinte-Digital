# Representación Sindical — Delegación XXI (HGR No. 1)

Módulo privado y autónomo dentro de La Veinte Digital para representantes de los
turnos vespertino y nocturno. SNTSS · Sección XX Michoacán · Comité Delegacional XXI.

- Ruta: `/representacion` (protegida por membresía `union_rep` / `union_admin`).
- Sin acceso para usuarios comunes: la ruta redirige a `/` y las APIs devuelven 403.
- Submódulos: Trabajadores, Maternidad, Lactancia, Lockers (+lista de espera),
  Pasajes 026/027, Licencias (Excel + Word), Expedientes, Administración, Aviso de privacidad.
- Lenguaje del sistema: preparar/validar/gestionar. Nunca "autorizar", "conceder" ni "aprobar"
  salvo registro de una resolución externa real recibida.

Documentos relacionados:

- `ARCHITECTURE.md` — capas, rutas, APIs, permisos.
- `NORMATIVE-RULES.md` — fundamentos CCT 2025-2027 y procedimientos, con fecha de consulta.
- `SECURITY.md` — RLS, storage privado, auditoría sanitizada.
- `DOCUMENT-TEMPLATES.md` — Excel/Word/PDF generados en runtime Vercel.
- `TESTING.md` — cómo correr pruebas y qué cubren.
- `SOURCE-INVENTORY.md` — inventario SIN datos personales de los archivos D:\.
