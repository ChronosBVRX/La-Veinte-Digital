# PR4 — Copy deck (textos para usuarios)

> Borrador para revisión. Lenguaje sin tecnicismos. Marcado para revisión legal
> antes del lanzamiento.

---

## Wizard — Paso 1 (Bienvenida)

**Título:** ¡Tu cuenta está lista!

**Párrafo:** Vamos a configurar tu perfil laboral. Esto te ayudará a completar automáticamente calculadoras, simulaciones de nómina, vacaciones y otras herramientas que elijas usar.

**Secundario:** Tardarás menos de 2 minutos.

**Botón principal:** Comenzar

**Botón secundario:** Usar modo básico — No guardaré datos laborales.

---

## Wizard — Paso 2 (Modo)

**Título:** ¿Cómo quieres usar La Veinte Digital?

**Opción 1 (sin preselección):**
- **Encabezado:** Usar modo básico
- **Descripción:** No necesito guardar datos laborales. Capturaré lo necesario en cada herramienta.

**Opción 2 (sin preselección):**
- **Encabezado:** Configurar mi perfil laboral
- **Descripción:** Podré capturar mis datos manualmente o importar un tarjetón para proponerlos automáticamente.

**Texto de privacidad (recuadro):**
Tus datos laborales son opcionales. Si decides agregarlos, se utilizarán para completar calculadoras, simulaciones de nómina y vacaciones, preparar escritos y personalizar las herramientas que utilices. Podrás modificarlos o borrarlos en cualquier momento desde Mi perfil → Mi información laboral. El tarjetón se procesa en tu dispositivo y no se guarda. La Veinte Digital es una herramienta independiente, sin relación con el IMSS ni con el SNTSS.

**Enlace:** Consulta el Aviso de Privacidad.

---

## Wizard — Paso 3 (Método)

**Título:** ¿Cómo prefieres configurar tu perfil?

**Opción 1 (sin preselección):**
- **Encabezado:** Capturar manualmente
- **Descripción:** Llenaré los datos que conozca. Puedo completar el resto después.

**Opción 2 (sin preselección):**
- **Encabezado:** Importar mi tarjetón
- **Descripción:** Selecciono el PDF de mi último recibo de nómina. El archivo se procesa en mi dispositivo y no se guarda. Solo se almacenan los datos que revise y confirme.

---

## Wizard — Paso 4 (Captura manual)

**Título:** Datos básicos

**Campos:**

- **Categoría** — *¿Por qué la necesito?* Se utiliza para tu aguinaldo, prima vacacional, cálculo de nómina y simulador. Es el dato más importante para las calculadoras.
- **Antigüedad** — *¿Por qué la necesito?* Se utiliza para calcular tus vacaciones, prima vacacional, nómina y prestaciones. Es la fecha en que ingresaste al IMSS.
- **Jornada** (horas al día) — *¿Por qué la necesito?* Se utiliza para tiempo extra, nómina y simulador.

**Botón:** Continuar con datos opcionales (o saltar)

**Pantalla de opcionales:**
- **Adscripción** — *¿Por qué la necesito?* Aparece en los escritos que generes.
- **Matrícula** — *¿Por qué la necesito?* Se utiliza para verificar tu tarjetón y aparece en los escritos.

---

## Wizard — Paso 5 (Revisión)

**Título:** Revisa tus datos

**Instrucción:** Revisa cada campo. Puedes editarlo o excluirlo antes de guardar.

**Fuentes visuales:**
- ✓ Confirmado desde tarjetón (verde)
- ✏ Capturado manualmente (azul)
- ⚡ Calculado (gris)
- ⚠ Inferido (ámbar)

**Botones por campo:** [Editar] [Excluir]

---

## Wizard — Paso 6 (Consentimiento)

**Título:** Antes de guardar

**Párrafo:** Tus datos laborales se utilizarán para completar calculadoras, simulaciones de nómina y vacaciones, preparar escritos y personalizar las herramientas que utilices.

**Secundario:** Si importaste un tarjetón, el archivo se procesó en tu dispositivo y no se guardó. Solo se almacenaron los campos que revisaste y confirmaste.

**Secundario:** Podrás modificar o borrar tus datos en cualquier momento desde Mi perfil → Mi información laboral. Al borrarlos, tu cuenta permanecerá activa en modo básico.

**Checkbox (sin preselección):**
☐ Quiero guardar mi información laboral para que las herramientas puedan completar automáticamente los datos. Podré borrarla cuando quiera.

**Enlace:** Consulta el Aviso de Privacidad para conocer al responsable, las finalidades del tratamiento y los mecanismos para ejercer tus derechos de acceso, rectificación, cancelación y oposición.

---

## Wizard — Paso 7 (Confirmación)

**Título:** ¿Confirmas estos datos?

**Instrucción:** Revisa el resumen. Al confirmar, tu perfil quedará activo y las herramientas podrán usar esta información.

**Botón principal:** Confirmar y guardar

---

## Wizard — Paso 8 (Resumen)

**Título:** ¡Perfil configurado!

**Métrica:** Calidad del perfil: alta (o media, o básica). N datos confirmados, M pendientes.

**Lista:** Herramientas que ya pueden usar tus datos:
- Aguinaldo
- Prima vacacional
- Nómina
- Tiempo extra
- ...

**Botón principal:** Ir al inicio

**Botón secundario:** Volver a la herramienta (si vino con returnTo)

---

## Centro — configurado (manual o payslip)

**Título:** Mi información laboral

**Estado:** Perfil configurado mediante captura manual / tarjetón. Última actualización: hace N días.

**Calidad:** ████████░░ 82%. N confirmados · M manuales · P pendientes. Para mejorar: jornada, turno.

**Campos con fuente y explicación** (formato):
- *Nombre del campo* — *Valor* — [fuente] — *¿Por qué lo necesito?* Se utiliza para: lista de herramientas.

**Historial:**
- Hace N días — Importaste un tarjetón
- Hace M meses — Cambiaste de modo (manual → tarjetón)
- Hace M meses — Actualizaste categoría

**Sección de acciones:**

**Cambiar método:** Botón que abre diálogo: "¿Cómo quieres configurar tu perfil a partir de ahora?" con opciones ○ Manual ○ Tarjetón. Al confirmar, se actualiza el modo y se registra el evento.

**Actualizar datos:** Abre el wizard de captura (paso 4) o el importador de tarjetón según el método actual. Los datos existentes se precargan.

**Borrar mis datos laborales:**
- Descripción: Esto eliminará tu categoría, adscripción, antigüedad, contexto de nómina, tarjetones importados y preferencias. Tu cuenta permanecerá activa y volverás al modo básico.
- Botón: [Borrar mis datos laborales] (rojo, estilo danger)
- Confirmación: escribe BORRAR para confirmar.
- Al confirmar: pantalla de confirmación "Tus datos laborales fueron eliminados. Tu cuenta sigue activa en modo básico."

**Eliminar mi cuenta:**
- Separado visualmente (divider).
- Descripción: Esto eliminará tu cuenta y acceso a la plataforma. Es independiente de borrar tus datos laborales.
- Botón: [Eliminar mi cuenta] (estilo danger).
- Requiere autenticación adicional (re-ingresar contraseña). Fuera del alcance de PR4 (se diseñará en un PR de seguridad de cuenta).

---

## Centro — modo básico

**Título:** Mi información laboral

**Estado:** Estás en modo básico. No tienes datos laborales guardados.

**Descripción:** Si decides agregarlos, podrás usar las calculadoras y simuladores con tus datos reales y ahorrar tiempo en cada herramienta.

**Botón:** [Configurar mi perfil laboral] — lleva al wizard paso 1.

---

## Aviso simplificado de privacidad (borrador)

> ⚠ BORRADOR. Revisión legal obligatoria antes del lanzamiento.

**Uso voluntario de datos laborales**

Agregar tus datos laborales es opcional. Si decides hacerlo, La Veinte Digital los utilizará para configurar tu perfil, prerrellenar calculadoras, generar simulaciones de nómina y vacaciones, preparar escritos y personalizar las herramientas que tú utilices.

Puedes capturarlos manualmente o importar un tarjetón. El archivo se procesa en tu dispositivo y no se conserva; únicamente se guardan los campos que revises y confirmes.

Puedes modificar o borrar tus datos laborales en cualquier momento desde Mi perfil → Mi información laboral. Al borrarlos, tu cuenta permanecerá activa en modo básico.

La Veinte Digital es una herramienta independiente, sin relación con el Instituto Mexicano del Seguro Social ni con el Sindicato Nacional de Trabajadores del Seguro Social.

Consulta el Aviso de Privacidad completo para conocer al responsable, las finalidades del tratamiento, los mecanismos para limitar el uso o divulgación de tus datos y cómo ejercer tus derechos de acceso, rectificación, cancelación y oposición.
