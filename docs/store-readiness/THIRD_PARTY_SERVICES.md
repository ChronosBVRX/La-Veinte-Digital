# Servicios de Terceros y Declaraciones

Auditoría de las integraciones externas de La Veinte Digital y qué declarar a Google Play y a los
revisores. **La Veinte Digital NO es una aplicación oficial del IMSS ni de ninguna institución.**

## Portales/servicios a los que se accede

| Servicio/Portal | Tipo de acceso | Qué hace la app | Credenciales que usa | ¿El usuario inicia el proceso? | Riesgo de TOS/política |
|-----------------|----------------|-----------------|----------------------|-------------------------------|------------------------|
| **La Veinte Digital (web)** | WebView interno | App principal | Sesión de usuario (email+password) | Sí (inicia sesión) | Bajo — es nuestro servicio |
| **IMSS «Tu Perfil» / nómina / tarjetón** | WebView / portal oficial | Llega al portal del IMSS para tu perfil y recibos | El usuario ingresa sus credenciales del IMSS; se guardan **cifradas en el dispositivo** | Sí (usuario decide entrar) | **Medio** — accedemos a un portal público del IMSS; no somos oficiales |
| **Aplicación SAT, SNTSS, STPS, GobMX, CONDUSEF, Infonavit** | External WebView / Custom Tab | Enlaza a portales oficiales | En general, ninguna | Sí (el usuario pulsa el enlace) | Bajo/Medio — solo enlace informativo |
| **Login OAuth (Google, bancos, etc.)** | Custom Tab (CustomTabsIntent) | Login de terceros | Sesiones del sistema del usuario | Sí | Bajo |

## Qué credenciales almacena la app

**Credenciales IMSS:** el usuario puede optar por guardarlas para no escribirlas cada vez. Se cifran
con **AES-256/GCM** con clave **no exportable** en **Android Keystore**, por portal. Nunca se envían a
los servidores de La Veinte Digital; se usan únicamente para operar dentro del portal oficial del IMSS
desde el dispositivo. Al elegir «Olvidar credenciales» se borra el texto cifrado y la clave.

**Credenciales de La Veinte (email/password):** se gestionan con Supabase Auth; la sesión viaja en
cookies del WebView (local).

## Aviso obligatorio a presentar al revisor

La app debe declarar (ya integrado en `/acerca-de`, `/privacidad`, `/terminos` y en el onboarding del
portal IMSS) el texto equivalente a:

> **La Veinte Digital es una herramienta independiente. No es una aplicación oficial del IMSS ni
> sustituye los portales o servicios oficiales.**

Recomendación de dónde mostrarlo (sin saturar):
1. **Acerca de** (`/acerca-de`) — visible y claro.
2. **Política de privacidad** (`/privacidad`) — sección 1.
3. **Términos de uso** (`/terminos`) — sección 2.
4. **Zona de acceso a servicios externos** (pantalla `OfficialPayslips` / portal IMSS) — un aviso
   breve al entrar.

## Riesgos de políticas/TOS

- **IMSS:** el acceso se hace con las credenciales del propio usuario dentro de un WebView a un portal
  público. Riesgo de rechazo es bajo, pero conviene dejar clara la independencia (no es app oficial)
  y que el usuario elige guardar sus credenciales. No automatizamos ni scrapeamos el portal más allá de
  lo que el usuario hace manualmente.
- **Out-of-app communication (OOC):** Google Play pregunta si la app abre una **URL externa** fuera del
  contexto de la app. La Veinte abre Custom Tabs y enlaces externos; se debe declarar **Sí** (la acción
  es iniciada por el usuario final), y el enlace externo debe llevar al navegador/portal del sistema.

## Qué declarar en Play Console (PENDIENTE si no se sabe con certeza)

- **¿Contiene anuncios?** No (no usamos SDKs de anuncios).
- **¿Tiene contenido generado por usuarios?** Los documentos/tarjetones son del usuario; no publicamos
  contenido a otros.
- **¿Requiere cuenta de terceros para iniciar sesión?** Sí, usamos Supabase Auth (email/password y
  opcionalmente OAuth de Google). Declarar los proveedores.
- **Data Safety:** ver `GOOGLE_PLAY_DATA_SAFETY.md`.
