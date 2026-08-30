# Google Play Data Safety — Matriz de Datos

Matriz para rellenar el formulario de **Data Safety** de Google Play basada en el código real.
Se indica si un dato se recopila o no, y por qué. Para cada dato: recopilado, compartido, finalidad,
obligatorio/opcional, en tránsito, en reposo, retención, eliminación y responsable.

> Convenciones: **Supabase** = base de datos + auth de La Veinte Digital (contacto: La Veinte Digital).
> **Firebase FCM** = Firebase Cloud Messaging (Google). **Local** = solo en el dispositivo del usuario.

## Datos recopilados

### 1) Cuenta del usuario (correo electrónico)

| Atributo | Valor |
|----------|-------|
| Recopilado | Sí |
| Compartido | No (solo interno, con el proveedor de auth Supabase) |
| Finalidad | Crear/cuenta, autenticación, gestión de sesión |
| Obligatorio/Opcional | Obligatorio para usar la plataforma |
| En tránsito | HTTPS (TLS) |
| En reposo | Cifrado en Supabase |
| Retención | Mientras la cuenta esté activa |
| Eliminación | Al eliminar la cuenta |
| Responsable | Supabase / La Veinte Digital |

### 2) Perfil laboral (nombre, matrícula/adscripción, categoría, antigüedad, jornada)

| Atributo | Valor |
|----------|-------|
| Recopilado | Sí |
| Compartido | No |
| Finalidad | Cubrir las funciones de perfil/tarjetón/agenda; calcular prestaciones |
| Obligatorio/Opcional | Opcional (podés usarla con menos datos) |
| En tránsito | HTTPS |
| En reposo | Supabase (cifrado) |
| Retención | Mientras la cuenta exista |
| Eliminación | Al eliminar la cuenta |
| Responsable | Supabase / La Veinte Digital |

### 3) Datos de tarjetón/nómina (datos estructurados extraídos de tu tarjetón)

| Atributo | Valor |
|----------|-------|
| Recopilado | Sí |
| Compartido | No |
| Finalidad | Mostrar tu histórico de recibos/checadas y calcular simulaciones |
| Obligatorio/Opcional | Opcional |
| En tránsito | HTTPS |
| En reposo | Supabase |
| Retención | Mientras exista tu cuenta (puedes borrarlos antes con «borrar tarjetones») |
| Eliminación | Al borrar tarjetones o al eliminar la cuenta |
| Responsable | Supabase / La Veinte Digital |
| Nota | El **PDF original** del tarjetón se procesa en tu dispositivo; **no** subimos el PDF a nuestros servidores. Solo viajan los datos estructurados. |

### 4) Identificadores / token de notificaciones (FCM)

| Atributo | Valor |
|----------|-------|
| Recopilado | Sí |
| Compartido | No (Firebase procesa el token para entregar el push) |
| Finalidad | Enviar notificaciones de avisos, agenda, documentos |
| Obligatorio/Opcional | Opcional (podés usar la app sin notificaciones) |
| En tránsito | HTTPS |
| En reposo | Supabase (`push_devices`) + servidores de Firebase |
| Retención | Mientras tu cuenta exista; al cerrar sesión se des-asocia el token |
| Eliminación | Al cerrar sesión o eliminar la cuenta |
| Responsable | Firebase (Google) / Supabase |

### 5) Datos de dispositivo (modelo, versión de Android, versión de app)

| Atributo | Valor |
|----------|-------|
| Recopilado | Sí |
| Compartido | No |
| Finalidad | Registro del dispositivo para push |
| Obligatorio/Opcional | Opcional |
| En tránsito | HTTPS |
| En reposo | Supabase |
| Retención | Mientras tu cuenta exista |
| Eliminación | Al eliminar la cuenta |
| Responsable | Supabase |

## Datos que NO se recopilan (declarar de forma explícita)

- **Historial de navegación / actividad web:** no lo recopilamos.
- **Contactos / galería de fotos:** no los leemos; la cámara solo se usa bajo tu acción para QR.
- **Ubicación precisa:** no la recopilamos.
- **Mensajes de voz / audio del usuario:** no se recopilan (el TTS es de estudio/servidor, local).
- **Publicidad / rastreadores:** no usamos SDKs de publicidad ni de analítica.

## Permisos del sistema (declarados en el manifest)

| Permiso | Google Play categoría | Necesario |
|---------|-----------------------|-----------|
| `CAMERA` | Puede usar la cámara | Sí, solo para escaneo QR bajo acción del usuario |
| `POST_NOTIFICATIONS` | Enviar notificaciones | Sí, para avisos |
| `INTERNET` / `ACCESS_NETWORK_STATE` | Acceso a red | Sí |
| `REQUEST_INSTALL_PACKAGES` | Instalar apps (⚠️ SOLO canal `direct`, **NO en Play**) | No en Play |

## Nota importante para Play Console

- **Data Safety:** marcar «Sí» para *email*, *información de perfil*, *datos laborales*, *IDs de
  dispositivo*, y «No» para *ubicación*, *contactos*, *fotos*, *historial de búsqueda*, *publicidad*.
- **No** marcar que se comparte con terceros, salvo el servicio de push (Firebase) que se debe declarar
  como proveedor.
- Todo el procesamiento por Firebase/Supabase debe declararse en la sección «Third-party».
