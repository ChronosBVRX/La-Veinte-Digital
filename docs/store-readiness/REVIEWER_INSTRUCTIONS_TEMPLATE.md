# Instrucciones para el Revisor (Demo Mode)

Plantilla con los pasos exactos para que un revisor de Google Play (o un QA) pueda probar La Veinte
Digital. **No hay contraseñas reales en Git**; los campos marcados se completan manualmente.

> ⚠️ Los bloques `[PENDIENTE]` deben rellenarse con datos reales antes de subir la build de revisión.

## Cuenta de revisión

- Correo de acceso (demo): `[PENDIENTE — correo demo]`
- Contraseña (demo): `[PENDIENTE — contraseña demo, NO commitear]`
- El dueño puede crearla/manejar en Supabase Auth.

## Pasos de inicio

1. Instalar el AAB/APK (si es `playRelease`, instalar desde Play internal testing o sideload configurado).
2. Abrir la app. Verás la pantalla de inicio y el aviso de protección.
3. Tocar **Iniciar sesión**.
4. Introducir la cuenta demo (correo + contraseña).
5. Aceptar la invitación biométrica (si aparece): **Activar** → autenticarse con huella/rostro/PIN.
6. Si se pide permiso de **notificaciones**, se puede aceptar o denegar; la app sigue funcionando.

## Qué probar (y cómo)

### Navegación interna
- Desde el inicio, entrar a **Mi Perfil**, **Documentos personales**, **Agenda**, **Asistente**.
- El contenido es la plataforma web **La Veinte Digital**.

### Tarjetón IMSS / Datos laborales
- Perfil → **Datos laborales y tarjetones IMSS** → **Subir tarjetón IMSS**.
- Requiere un PDF de tarjetón IMSS de ejemplo: `[PENDIENTE — PDF demo de tarjetón]`.
- Verificar la revisión de datos extraídos y el guardado.

### Cámara / QR
- Entrar a la función de **transferir/impresión por QR**.
- Tocar **Escanear QR**: aparecerá el diálogo de permiso de cámara (solo aquí, no al abrir la app).
- QR de ejemplo: `[PENDIENTE — QR o entorno de prueba]`.

### Documentos / PDF / imprimir
- Abrir un PDF desde histórico; **guardar**, **borrar**, **imprimir**.
- PDF inexistente/corrupto: mostrar manejo de error (no crash).

### Bloqueo biométrico
- Habilitar biometría, cerrar y abrir la app → pedirá desbloqueo.
- Ir a segundo plano y volver después de >5 min → re-bloquea.
- Enviar un deep link mientras está bloqueada → se procesa tras desbloquear.

### Notificaciones / push
- Con permiso concedido, pedir un envío de prueba desde el panel admin.
- Denegar el permiso y verificar la app sigue funcionando (sin notificaciones).

### Cuenta
- **Cerrar sesión**.
- **Eliminar cuenta** (Perfil → Privacidad y cuenta → **Eliminar mi cuenta**): leer el aviso, escribir
  `ELIMINAR` y confirmar → redirige y la cuenta desaparece (verificar que ya no existe).

## Funciones que dependen de servicios reales

| Función | Requiere acceso externo | Nota |
|---------|-------------------------|------|
| App principal (web) | Sí — `https://la-veinte-digital.vercel.app` | Debe estar desplegada |
| Tu Perfil IMSS / nómina | Sí — portal oficial IMSS | Requiere credenciales IMSS reales del revisor |
| Chat asistente | Sí — backend `/api/consulta` | Requiere backend + RAG |
| Push | Sí — Firebase + Supabase | Requiere backend configurado |

## Funciones que NO requieren credenciales externas

- Perfil, calculadoras/simuladores, biblioteca normativa, agenda local, documentos locales.

## Nota para el revisor

- La Veinte Digital es una herramienta **independiente**; no es app oficial del IMSS.
- Los resultados de simuladores son informativos.
