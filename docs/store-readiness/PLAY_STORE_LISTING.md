# Meta-datos Play Store (borrador)

Borrador para rellenar el Play Console. Marca con `[PENDIENTE DE CONFIRMACIÓN DEL PROPIETARIO]` lo que
no se puede afirmar con certeza desde el código.

## Nombre

`La Veinte Digital`

## Descripción corta (80 caracteres)

`Herramientas laborales y de nómina para trabajadores: tarjetón, agenda y simuladores.`

## Descripción completa

```
La Veinte Digital es una plataforma digital para trabajadores. Reúne en un solo lugar tu perfil
laboral, tus tarjetones y recibos del IMSS, tu historial de checadas, tu agenda, calculadoras y
simuladores de prestaciones y una biblioteca de normativa laboral.

Cifrado y privacidad
- Tus credenciales del portal IMSS se guardan cifradas solo en tu dispositivo (Android Keystore).
- Tus tarjetones se procesan en tu teléfono; solo los datos necesarios van a nuestros servidores.
- Bloqueo biométrico opcional para proteger tu información.

Recuerda: La Veinte Digital es una herramienta independiente. No es una aplicación oficial del IMSS
ni sustituye los portales o servicios oficiales. Los resultados de los simuladores son informativos
y dependen de los datos que tú proporcionas.
```

## Categoría sugerida

- **Categoría:** Productivity (Productividad) — o *Tools*.
- **Etiquetas/tags:** laboral, nómina, IMSS, trabajadores, sindicato.

## Contacto

- Correo de soporte: `[REQUIERE_DATO_DEL_PROPIETARIO — correo oficial]`
- Sitio web: `https://la-veinte-digital.vercel.app`
- Política de privacidad: `https://la-veinte-digital.vercel.app/privacidad`

## Política de privacidad

URL pública: **`https://la-veinte-digital.vercel.app/privacidad`** (ya creada como ruta pública).

## Instrucciones de acceso para el revisor

`docs/store-readiness/REVIEWER_INSTRUCTIONS_TEMPLATE.md` (completar credenciales demo).

## Declaraciones potenciales (Play Console)

| Declaración | Respuesta |
|-------------|-----------|
| ¿Contiene anuncios? | No |
| ¿Tiene contenido con clasificación? | No (herramienta/productividad) |
| ¿Requiere cuenta? | Sí (cualquiera puede crearla con correo) |
| ¿Obtiene información del usuario? | Sí (perfil, datos laborales, correo) |
| ¿Comparte datos con terceros? | No (excepto el proveedor de push Firebasen como sub-procesador) |
| ¿Usa App Links/Universal links? | Sí (App Links a `la-veinte-digital.vercel.app`) |
| Out-of-app communication / URL externas | Sí, iniciadas por el usuario (Custom Tabs / portales oficiales) |

## Contenido de la app / target audience

- **Target audience:** Adultos (18+), trabajadores mexicanos. 
- **Edad mínima sugerida:** 18+. `[PENDIENTE DE CONFIRMACIÓN DEL PROPIETARIO]`
- **No** está dirigida a menores de 13. No contiene información médica personal equivalente a salud.

## Disclaimer institucional

> La Veinte Digital es una herramienta independiente. No es una aplicación oficial del IMSS ni de
> ninguna institución de gobierno y no sustituye los portales o servicios oficiales.

## Data Safety

Ver `GOOGLE_PLAY_DATA_SAFETY.md`.

## Capturas de pantalla (sugerencia)

- Inicio de sesión.
- Pantalla de inicio (dashboard).
- Mi Perfil / Datos laborales.
- Tarjetón / nómina.
- Calculadoras / simulador.
- Pantalla de "Acerca de" con el aviso de independencia.
