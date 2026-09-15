# Normas Técnicas y Jurídicas para la Importación Continua de Trabajadores SIAP

**Versión:** 2.0.0  
**Fecha de corte:** 2026-09-14  
**Ámbito de aplicación:** Representación Sindical — SNTSS Sección XX Michoacán / Delegación XXI HGR No. 1 Charo  
**Estado:** ESTABLE / OBLIGATORIO  

---

## 1. Fundamento Normativo Institucional y Sindical

### 1.1 Procedimientos Institucionales del IMSS
* **Procedimiento 1A74-003-030:** *Operación de la Plantilla de Personal en Unidades Médicas y Administrativas del IMSS*. Define la estructura presupuestal de plazas, claves tabulares de puesto a 8 posiciones, departamentos a 10 posiciones, áreas de responsabilidad a 3 posiciones, y la bitmask de 5 posiciones de conceptos asociados para la actualización de plazas SIAP.
* **Procedimiento 1A74-003-033:** *Control y Seguimiento de Incidencias y Movimientos de Personal de Base y Confianza*. Regula los cortes quincenales y mensuales emitidos por el Sistema Integral de Administración de Personal (SIAP) proporcionados a las representaciones sindicales para cotejo de derechos laborales.

### 1.2 Contrato Colectivo de Trabajo (CCT) IMSS-SNTSS 2025-2027
* **Cláusula 22:** *Padrón de Trabajadores y Afiliación Sindical*. El Instituto proporcionará periódicamente a la representación sindical la relación nominal analítica del personal adscrito a la unidad médica.
* **Cláusula 29:** *Plazas de Base y Coberturas*. La clave de plaza representa la unidad presupuestal del recurso humano, independiente del trabajador que la ocupe transitoria o definitivamente.
* **Cláusulas 41, 46 y 63 Bis:** *Jornadas, Horarios y Turnos*. Regulación de jornadas ordinarias, jornadas acumuladas y turnos matutino, vespertino, nocturno y veladas.
* **Cláusulas 89 y 91:** *Antigüedad efectiva y derechos escalafonarios*. Cómputo ininterrumpido en años, quincenas y días de servicio efectivo.
* **Cláusula 144:** *Conceptos Asociados al Puesto y Riesgos de Trabajo*. Pago de estímulos y asignaciones contractuales por infectocontagiosidad médica (023), infectocontagiosidad no médica (014), emanaciones radiactivas (063), emanaciones radiactivas no médicas (054) y horario discontinuo (012).

### 1.3 Marco de Protección de Datos Personales (LFPDPPP)
1. **Principio de Licitud y Lealtad:** La plantilla de personal se procesa exclusivamente para fines legítimos de representación gremial delegacional.
2. **Principio de Proporcionalidad y Calidad:** Se extraen únicamente los 27 campos técnicos y laborales necesarios para la gestión sindical.
3. **Aislamiento Estricto de PII:** Las vistas masivas en el navegador jamás transmiten ni renderizan RFC, CURP ni NSS completos; se aplica enmascaramiento unidireccional en frontend (`maskRfc`, `maskCurp`, `maskNss`). Los datos crudos (`raw_data`) permanecen confinados en tablas de auditoría protegidas por RLS.
4. **Almacenamiento Local y Seguro:** Queda terminantemente prohibido subir archivos de plantilla a servidores públicos externos, APIs de terceros o modelos de lenguaje.

### 1.4 Seguridad Técnica de Carga de Archivos (OWASP File Upload Cheat Sheet)
1. **Validación de Firma ZIP:** Todo archivo `.xlsx` debe verificar firma ZIP (`PK\x03\x04`).
2. **Rechazo de Binarios y Macros:** Archivos `.xls` (binario antiguo OLE) y `.xlsm` (macros) son rechazados de inmediato. Se analizan las entradas del archivo ZIP para bloquear `vbaProject.bin`, vínculos externos (`externalLinks`) y objetos OLE incrustados (`oleObject`).
3. **Protección contra Inyección de Fórmulas:** Cero fórmulas permitidas en celdas de datos. Cualquier celda que inicie con `=`, `@`, `+` o contenga `.formula` rechaza el lote.
4. **Límites de Recursos:** Tamaño máximo de archivo de 10 MB, máximo 20,000 filas, máximo 50 columnas y máximo 3 hojas con datos.
5. **Detección de Encabezados Duplicados:** Archivos con nombres de columna repetidos son rechazados inmediatamente.

---

## 2. Diccionario de Datos y Clasificación de las 27 Columnas SIAP

A partir de la auditoría técnica exhaustiva del archivo canónico institucional `General_Hgr 1_ (2).xlsx` (2,321 registros), se clasifica la fuente de certeza y normalización de cada una de las 27 columnas:

| No. | Encabezado Canónico | Alias Aceptados | Campo en BD | Tipo BD | Clasificación de Certeza | Descripción y Reglas Técnicas de Normalización |
|---|---|---|---|---|---|---|
| 1 | `TC` | Tipo Contrato, Contrato | `contract_type_code` | `text` | **CONFIRMADO POR CATÁLOGO IMSS** | Tipo de Contratación: `0` = Estatuto, `1` = Confianza, `2` = Base, `5` = Becario, `9` = Residente. Longitud 1 carácter. Códigos no catalogados se guardan tal cual con advertencia `TC_UNKNOWN_CODE`. Se descartan equivalencias obsoletas `02/03/08`. |
| 2 | `Matricula` | No Empleado, Numero Empleado | `employee_number` | `text` | **CONFIRMADO POR NORMA** | Llave primaria de identidad laboral en conjunto con `delegation_id`. Solo dígitos numéricos. |
| 3 | `Nombre` | Nombre del Trabajador, Nombre | `siap_full_name` | `text` | **CONFIRMADO POR NORMA** | Cadena completa oficial del trabajador emitida por SIAP. La división heurística de apellidos en México es inherentemente imperfecta debido a prefijos compuestos (`DE LA`, `DEL`, `DE LOS`, `SAN`); por tanto, `siap_full_name` es la fuente de verdad inmutable y los nombres estructurados manuales existentes (`first_name`, `paternal_surname`, `maternal_surname`) jamás se sobreescriben destructivamente. |
| 4 | `Plaza` | Cve Plaza, No Plaza | `plaza_code` | `text` | **CONFIRMADO POR CATÁLOGO IMSS** | Longitud numérica variable (entre 2 y 5 dígitos en archivo real, e.g. `502`, `96280`). Se convierte a texto sin rellenar artificialmente con ceros a 7 dígitos. |
| 5 | `AR` | A R, Area Responsabilidad | `responsibility_area_code` | `text` | **CONFIRMADO POR CATÁLOGO IMSS** | Área de Responsabilidad Operativa. Exactamente 3 posiciones alfanuméricas (`^[A-Z0-9]{3}$`). Todos los 2,321 registros del archivo canónico cumplen con longitud 3. Se elimina cualquier aserción errónea de 2 dígitos. |
| 6 | `Fech Ocu` | Inicio Ocupa, Inicio Ocupacion | `occupation_start_date` | `date` | **CONFIRMADO POR CATÁLOGO IMSS** | Fecha de inicio de ocupación de la plaza actual (`YYYY-MM-DD`). |
| 7 | `Lim Ocu` | Limite Ocupa, Fec Lim Ocu | `occupation_limit_date`, `occupation_limit_is_sentinel` | `date` / `bool` | **CONFIRMADO POR CATÁLOGO IMSS** | Fecha límite de ocupación de la plaza. La fecha `2050-01-01` constituye una fecha centinela del sistema SIAP y se marca con `occupation_limit_is_sentinel = true`. Etiqueta neutral: *Fecha centinela institucional 01/01/2050. Sin interpretación automática del tipo o definitividad de la plaza*. |
| 8 | `MO` | Mca Ocu, Marca Ocupacion | `occupation_mark_code` | `text` | **CÓDIGO INTERNO CONFIRMADO** | Marca de Ocupación institucional. Acepta cualquier código numérico (`^[0-9]+$`). Preserva el código original como texto. Códigos confirmados en el archivo real: `0, 1, 5, 7, 9, 11, 20, 62, 63, 64, 65, 71, 73, 75, 77, 90, 98, 99`. Etiqueta neutral de presentación: *Código SIAP {code}*. |
| 9 | `Tipo de Plaza` | Tipo Plaza | `plaza_type_code` | `text` | **CONFIRMADO POR CATÁLOGO IMSS** | Catálogo normalizado a 2 dígitos: `01` = Operativa Confianza (en Excel viene como `1`), `11` = Operativa Base, `12` = Compensada Base, `13` = Cubre Descansos Base, `14` = Cubre Vacaciones Base, `17` = Sobrantes Base, `30` = Becario, `40` = Residentes, `50` = Operativa Confianza Estatuto A, `61` = Operativa Confianza B, `63` = Cubre Descansos Confianza B. Se descarta la equivalencia temporal `1/2`. |
| 10 | `Turno` | Jor, Jornada, Tipo Jornada | `shift_code`, `turn` | `text` | **CONFIRMADO POR CATÁLOGO IMSS** | Turno institucional autorizado: `1` = Matutino, `2` = Vespertino, `3` = Nocturno, `4` = Móvil, `5` = Jornada acumulada. Se eliminan etiquetas confusas como `4=Mixto` o `5=Especial`. |
| 11 | `C A` | CA, Conceptos Asociados | `associated_concepts_mask`, `associated_concepts` | `text` / `jsonb` | **DEDUCIDO DEL ARCHIVO / PROCEDIMIENTO SIAP** | Bitmask de 5 posiciones leída de izquierda a derecha: bit 0 (`10000`) = `012 Horario discontinuo`, bit 1 (`01000`) = `014 Infectocontagiosidad no médica`, bit 2 (`00100`) = `023 Infectocontagiosidad médica`, bit 3 (`00010`) = `054 Emanaciones radiactivas no médicas`, bit 4 (`00001`) = `063 Emanaciones radiactivas`, `00000` = Sin concepto asociado. |
| 12 | `Puesto` | Cve Puesto, Clave Puesto | `position_code` | `text` | **CONFIRMADO POR CATÁLOGO IMSS** | Clave tabular institucional a 8 posiciones alfanuméricas (`^[A-Z0-9]{8}$`, e.g. `41500301`). No se trunca ni rellena a 6 dígitos. |
| 13 | `Descripcion 1` | Descripcion Puesto, Categoria | `position_description`, `category` | `text` | **CONFIRMADO POR NORMA** | Denominación contractual del puesto según tabulador CCT. |
| 14 | `Departamento` | Depto, Cve Depto | `department_code` | `text` | **CONFIRMADO POR CATÁLOGO IMSS** | Clave de adscripción departamental a 10 posiciones alfanuméricas (`^[A-Z0-9]{10}$`, e.g. `2114010001`). No se valida como 6 dígitos. |
| 15 | `Descripcion 2` | Descripcion Depto, Adscripcion | `department_description`, `assignment` | `text` | **CONFIRMADO POR NORMA** | Adscripción hospitalaria. En el archivo canónico existen 4 registros con descripción vacía; se admite como cadena vacía sin marcar error. |
| 16 | `Horario` | Cve Horario, Clave Horario | `schedule_code` | `text` | **CONFIRMADO POR CATÁLOGO IMSS** | Clave del horario institucional a 4 posiciones alfanuméricas (e.g. `0112`, `D731`, `D735`, `F714`). Códigos numéricos menores a 4 dígitos se rellenan con ceros a la izquierda (ej. `112` -> `0112`). No debe convertirse en turno. |
| 17 | `Descripcion 3` | Descripcion Horario | `schedule_description`, `schedule` | `text` | **CONFIRMADO POR NORMA** | Intervalo horario contractual detallado (e.g. `14.00 A 20.30 Y 1.0 HRS. PREP. ACT. DOC. INVEST.`). Se almacena por separado de la clave de horario. |
| 18 | `Antigüedad` | Antiguedad, Tiempo Servicio | `seniority_raw`, `years`, `fortnights`, `days` | `text` / `int` | **CONFIRMADO POR NORMA** | Antigüedad efectiva institucional. Se extraen años, quincenas y días numéricos. |
| 19 | `RFC` | R.F.C., R F C | `rfc` | `text` | **CONFIRMADO POR NORMA** | Registro Federal de Contribuyentes con o sin homoclave. Enmascarado en UI. |
| 20 | `CURP.` | C.U.R.P., CURP | `curp` | `text` | **CONFIRMADO POR NORMA** | Clave Única de Registro de Población (18 posiciones). Validador regex oficial. |
| 21 | `Número de Seguridad Social` | N.S.S., NSS | `nss`, `nss_raw` | `text` | **CONFIRMADO POR NORMA** | Número de Seguridad Social: se almacena `nss_raw` con el valor exacto recibido. Si tiene 10 dígitos (encontrados en SIAP sin dígito verificador), se normaliza a 11 dígitos anteponiendo cero inicial (`padStart(11, '0')`) y se emite la advertencia `NSS_LEADING_ZERO_RESTORED`. Si tiene 11 dígitos, se preserva sin advertencia. |
| 22 | `Fecha Ingreso` | Inicio Relacion Laboral | `employment_start_date` | `date` | **CONFIRMADO POR NORMA** | Fecha de ingreso original al Instituto IMSS (`YYYY-MM-DD`). |
| 23 | `Fec. Reingreso` | Fecha Reingreso, Reingreso | `reemployment_date` | `date` | **CONFIRMADO POR CATÁLOGO IMSS** | Fecha de reingreso institucional si existió interrupción laboral previa. |
| 24 | `Status` | Estatus, Estado | `source_status_code` | `text` | **CONFIRMADO POR CATÁLOGO IMSS** | Código de estatus en la fuente SIAP (e.g. `1`). Se preserva el valor crudo en `source_status_code`. No altera automáticamente el campo sindical `active` de `union_workers`, el cual permanece gobernado por la condición sindical del trabajador. |
| 25 | `Cve Baja` | Clave Baja, Motivo Baja | `termination_code` | `text` | **CONFIRMADO POR CATÁLOGO IMSS** | Clave institucional del motivo de separación laboral. |
| 26 | `Fecha de Baja` | Fecha Baja, Fec Baja | `termination_date` | `date` | **CONFIRMADO POR CATÁLOGO IMSS** | Fecha efectiva de baja (`YYYY-MM-DD`). En el archivo canónico existen 3 registros con fecha de baja presente y `Status=1` / `Cve Baja=0`; se aceptan sin error de consistencia. |
| 27 | `Micro y grupo` | Micro Grupo, Microgrupo | `micro_group_code` | `text` | **CÓDIGO INTERNO SIN CATÁLOGO PÚBLICO** | Campo interno del sistema SIAP. Valor observado: `5`. Se preserva como texto sin interpretación automática ni asignación laboral arbitraria. |

---

## 3. Matriz de Decodificación de Conceptos Asociados (C A)

La columna `C A` se genera conforme al procedimiento interno de actualización de plazas del SIAP como un número entero o máscara binaria de hasta 5 posiciones (`00000` a `10000`). En exportaciones de Excel donde los ceros a la izquierda no se conservan (`1`, `10`, `100`, `1000`), el sistema normaliza la longitud a 5 posiciones con `padStart(5, '0')`:

| Posición (Bit) | Máscara Normalizada | Concepto SIAP / CCT | Denominación Contractual | Cláusula CCT Aplicable |
|---|---|---|---|---|
| Bit 0 (Extremo Izq.) | `10000` | **012** | *Horario Discontinuo* | Cláusula 46 |
| Bit 1 | `01000` | **014** | *Infectocontagiosidad No Médica* | Cláusula 144 |
| Bit 2 | `00100` | **023** | *Infectocontagiosidad Médica / Hospitalaria* | Cláusula 144 |
| Bit 3 | `00010` | **054** | *Emanaciones Radiactivas No Médicas* | Cláusula 144 |
| Bit 4 (Extremo Der.) | `00001` | **063** | *Emanaciones Radiactivas / Radiología* | Cláusula 144 |

---

## 4. Arquitectura de Transacción Atómica y Rollback No Destructivo en PostgreSQL

### 4.1 Confirmación Atómica (`public.union_confirm_worker_import`)
Toda confirmación se delega exclusivamente a la función PL/pgSQL `public.union_confirm_worker_import(p_batch_id uuid)` con `SECURITY DEFINER` y `search_path = public, pg_temp`:
1. **Autorización y Bloqueo de Lote:** Valida que el usuario ejecutor sea `union_admin` activo en la delegación y bloquea el registro en `union_worker_import_batches` con `FOR UPDATE`. Verifica que su estado sea `'preview'`.
2. **Aplicación en Transacción Única:** Itera sobre `union_worker_import_rows` aplicando altas y modificaciones.
3. **Nuevos Trabajadores:** Inserta con `source_created_by_batch_id = p_batch_id`, `siap_full_name`, `occupation_limit_is_sentinel` y datos laborales completos.
4. **Trabajadores Existentes:** Modifica **únicamente** los campos gestionados por SIAP (`SIAP_MANAGED_FIELDS`). Los campos manuales sindicados (`phone`, `notes`, `active`, `first_name`, `paternal_surname`, `maternal_surname`) quedan estrictamente protegidos. Cada modificación genera su auditoría en `union_worker_change_history`.
5. **Detección de Ausentes:** Aquellos trabajadores de la delegación activos que no figuren en el archivo se marcan con `source_missing_since = now()`. **JAMÁS son eliminados ni inactivados automáticamente**.
6. **Cierre de Lote:** Actualiza el lote a `'confirmed'` registrando `confirmed_at` y `confirmed_by`. Si cualquier fila falla, toda la transacción efectúa rollback atómico sin dejar estados corruptos.

### 4.2 Rollback No Destructivo (`public.union_rollback_worker_import`)
La reversión de un lote confirmado se rige por el principio de no destrucción física:
1. **Prohibición de `DELETE`:** Queda terminantemente prohibido ejecutar `DELETE FROM union_workers`.
2. **Nuevos Trabajadores Creados por el Lote:** Se localizan mediante `source_created_by_batch_id = p_batch_id` y se marcan con `source_rolled_back_at = now()` y `source_import_state = 'rolled_back'`. NUNCA se modifican `active`, `notes`, `phone` ni nombres manuales. No se agrega texto a `notes`. Las consultas operativas del padrón excluyen `source_import_state = 'rolled_back'`. Las relaciones existentes (casos, casilleros, licencias, etc.) se preservan intactas sin registros huérfanos.
3. **Trabajadores Modificados por el Lote:** Se verifica previamente que el trabajador no haya sufrido modificaciones por lotes posteriores o ediciones manuales. De existir cambios posteriores, se aborta con la excepción `ROLLBACK_CONFLICT_NEWER_CHANGES`. De no haber conflicto, se restauran los valores anteriores documentados en `union_worker_change_history`.
4. **Restauración de Ausentes:** Se reinicia `source_missing_since = null` para los trabajadores cuya marca haya coincidido con este lote.
5. **Cierre de Reversión:** El lote transita a `'rolled_back'` con timestamp y usuario responsable.
