# Notas para el revisor (ES) — La Veinte Digital 1.1.5 (205)

> Esta versión corrige la observación relacionada con información gubernamental. La Veinte Digital ahora identifica de manera visible que es una aplicación independiente y que no representa al IMSS ni al Gobierno de México.
>
> La ficha de Google Play incluye enlaces directos a las fuentes oficiales utilizadas. Dentro de la aplicación se añadió la sección pública “Información y fuentes”, accesible sin iniciar sesión desde el menú lateral (“Información y fuentes”, ruta `/informacion-y-fuentes`), con enlaces funcionales al IMSS, Gobierno de México, Diario Oficial de la Federación, Cámara de Diputados, Ley Federal del Trabajo, Ley del Seguro Social y Contrato Colectivo IMSS–SNTSS 2025–2027.
>
> También se incorporó atribución contextual en las herramientas normativas y un mecanismo interno para reportar contenido generado mediante IA.
>
> Pasos para verificar:
>
> 1. Abrir La Veinte Digital.
> 2. Entrar al menú lateral.
> 3. Seleccionar “Información y fuentes”.
> 4. Verificar el aviso de independencia.
> 5. Abrir cualquiera de los enlaces oficiales.
>
> Los enlaces se abren como sitios externos (Custom Tabs / navegador externo para DOF y Diputados; visor externo integrado sin puente privilegiado para el resto) y no reciben el puente nativo de la aplicación (`window.LaVeinteApp` solo se instala en dominios propios).

# Reviewer notes (EN) — La Veinte Digital 1.1.5 (205)

> This release addresses the government information policy issue. La Veinte Digital now clearly identifies itself as an independent application that does not represent, belong to, or have an official affiliation with IMSS or the Government of Mexico.
>
> The Play Store listing contains direct links to the original official sources. A public “Information and Sources” section is available without signing in from the side menu (“Información y fuentes”, path `/informacion-y-fuentes`). It contains functional links to IMSS, the Government of Mexico, the Official Gazette, the Chamber of Deputies, applicable federal laws, and the current IMSS–SNTSS collective agreement.
>
> Contextual source attribution and an in-app reporting mechanism for AI-generated content were also added.
>
> Steps to verify:
>
> 1. Open La Veinte Digital.
> 2. Open the side menu.
> 3. Select “Información y fuentes”.
> 4. Check the independence notice.
> 5. Open any of the official links.
>
> Links open as external sites (Custom Tabs / external browser for DOF and Chamber of Deputies; integrated external viewer without the privileged bridge for the rest) and never receive the app's native bridge (`window.LaVeinteApp` is only installed on first-party domains).

Versión: `versionCode` 205, `versionName` 1.1.5, `targetSdk` 36, `minSdk` 29,
`applicationId` com.laveintedigital.app (sin cambios de identidad ni compatibilidad).
