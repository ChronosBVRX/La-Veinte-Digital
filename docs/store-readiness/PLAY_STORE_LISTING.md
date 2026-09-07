# Meta-datos Play Store — La Veinte Digital (compliance 2026-09-06)

Listo para copiar a Play Console. Verificado contra funciones reales del repo.
Tag de baseline previo: `stable-pre-play-compliance-20260906-a3e5792`.

## Nombre

`La Veinte Digital`

## Descripción breve (73/80 caracteres)

`Herramientas laborales y normativas para trabajadores. App independiente.`

## Descripción completa (1915/4000 caracteres, URLs completas, sin HTML)

```
AVISO IMPORTANTE: APLICACIÓN INDEPENDIENTE

La Veinte Digital es una herramienta independiente dirigida a trabajadores. No es una aplicación oficial del Instituto Mexicano del Seguro Social (IMSS), no pertenece al IMSS ni al Gobierno de México y no representa a ninguna entidad gubernamental o partido político.

La aplicación ofrece herramientas informativas para organizar asuntos laborales: perfil y documentos personales, agenda y recordatorios, calculadoras orientativas, consulta de normativa, asistencia para comprender documentos y generación de escritos.

Los resultados, cálculos y respuestas generadas son orientativos. Deben verificarse con la documentación vigente y, cuando corresponda, con las áreas competentes.

Cuando La Veinte Digital abre un portal oficial, dicho portal pertenece y es operado por la institución indicada. La Veinte Digital únicamente facilita su acceso y no expide, valida ni sustituye documentos, trámites o resoluciones oficiales.

FUENTES GUBERNAMENTALES Y OFICIALES

Instituto Mexicano del Seguro Social:
https://www.imss.gob.mx/

Gobierno de México — IMSS:
https://www.gob.mx/imss

Diario Oficial de la Federación:
https://www.dof.gob.mx/

Cámara de Diputados — Leyes Federales:
https://www.diputados.gob.mx/LeyesBiblio/index.htm

Ley Federal del Trabajo:
https://www.diputados.gob.mx/LeyesBiblio/pdf/LFT.pdf

Ley del Seguro Social:
https://www.diputados.gob.mx/LeyesBiblio/pdf/LSS.pdf

Contrato Colectivo de Trabajo IMSS–SNTSS 2025–2027:
https://www.imss.gob.mx/sites/all/statics/pdf/CCT-2025-2027.pdf

Los documentos sindicales se identifican separadamente por su emisor y no se presentan como fuentes gubernamentales.

Consulta la sección “Información y fuentes” dentro de la aplicación para conocer la procedencia de cada contenido, su vigencia y los enlaces originales.

La Veinte Digital no sustituye asesoría jurídica, médica, administrativa o sindical personalizada.
```

Funciones mencionadas verificadas en el repo: perfil (`/profile`), documentos personales
(`features/documentos-personales`), agenda y recordatorios (`/bitacora`, cron
`agenda-reminders`), calculadoras (`/calculadoras`), consulta de normativa
(`/asistente`, `/api/consulta`), asistencia documental (tarjetón local
`features/tarjeton`), generación de escritos (`/escritos`, `/api/escritos/generar`).

## Novedades de esta versión (267/500 caracteres)

```
Añadimos una sección pública de Información y fuentes, enlaces directos a publicaciones oficiales y avisos claros sobre el carácter independiente de La Veinte Digital. También mejoramos la transparencia de las respuestas normativas y la compatibilidad con Android 16.
```

## Categoría sugerida

- **Categoría:** Productivity (Productividad).
- **Etiquetas/tags:** laboral, nómina, IMSS, trabajadores, sindicato.

## Contacto

- Sitio web: `https://la20.com.mx`
- Política de privacidad: `https://la20.com.mx/privacidad`
- Eliminación de cuenta (URL para Play Console): `https://la20.com.mx/eliminar-cuenta`
- Información y fuentes (pública, sin login): `https://la20.com.mx/informacion-y-fuentes`
- Correo de soporte: `[REQUIERE_DATO_DEL_PROPIETARIO — correo oficial]`

## Instrucciones de acceso para el revisor

`docs/store-readiness/REVIEWER_INSTRUCTIONS_TEMPLATE.md` (credenciales demo solo en
Play Console, nunca en el repo). La sección “Información y fuentes” es revisable sin
iniciar sesión.

## Declaraciones Play Console (basadas en código)

| Declaración | Respuesta |
|-------------|-----------|
| ¿Contiene anuncios? | No |
| ¿Tiene contenido con clasificación? | No (herramienta/productividad, público 18+) |
| ¿Requiere cuenta? | Sí (cualquiera puede crearla con correo; fuentes visibles sin cuenta) |
| ¿Obtiene información del usuario? | Sí (perfil, datos laborales, correo — ver matriz Data Safety) |
| ¿Comparte datos con terceros? | Solo sub-procesadores declarados (Supabase, Firebase FCM) |
| ¿Usa App Links? | Sí (`la20.com.mx`, `la-veinte-digital.vercel.app`) |
| ¿Contenido generado por IA? | Sí — con mecanismo interno “Reportar contenido” en cada salida |
| ¿Funciones de salud/finanzas/noticias? | No — calculadoras de nómina = cálculo laboral orientativo, no servicio financiero |

## Capturas (reales, no mockups)

1. Home. 2. Herramientas laborales. 3. Calculadoras. 4. Agenda o documentos.
5. Asistente o generador de escritos. 6. Pantalla “Información y fuentes”
(incluye al menos una que muestre el aviso de independencia y los enlaces oficiales).
Pendiente de dispositivo físico — ver reporte de pruebas.
