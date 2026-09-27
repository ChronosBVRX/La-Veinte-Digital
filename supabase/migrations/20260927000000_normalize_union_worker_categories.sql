-- ============================================================================
-- MIGRACIÓN: NORMALIZACIÓN Y HOMOLOGACIÓN DE CATEGORÍAS SINDICALES
-- Fecha: 2026-09-27
-- Objetivo:
-- 1. Respaldo preventivo de seguridad de categorías en union_workers.
-- 2. Preservar categorías crudas en position_description cuando esté vacía (origen lockers).
-- 3. Crear función pura public.union_normalize_category(text).
-- 4. Actualizar todas las filas de public.union_workers con su categoría canónica única.
-- 5. Actualizar el RPC union_confirm_worker_import para normalizar de forma continua.
-- ============================================================================

-- 1. RESPALDO PREVENTIVO DE SEGURIDAD
create table if not exists public.backup_union_workers_cat_20260927 as
select id, employee_number, category, position_description from public.union_workers;

alter table public.backup_union_workers_cat_20260927 enable row level security;
revoke all on public.backup_union_workers_cat_20260927 from anon, authenticated;

-- 2. PRESERVAR DESCRIPCIÓN HISTÓRICA EN POSITION_DESCRIPTION SI ESTABA VACÍA
update public.union_workers
set position_description = category
where coalesce(position_description, '') = '' and coalesce(category, '') <> '';

-- 3. FUNCIÓN DE NORMALIZACIÓN CANÓNICA DE CATEGORÍAS
create or replace function public.union_normalize_category(p_raw text)
returns text
language plpgsql
immutable
as $$
declare
  v_clean text;
begin
  if p_raw is null or trim(p_raw) = '' or trim(p_raw) in ('(VACIO)', '(NULL)') then
    return 'PENDIENTE DE REVISION';
  end if;

  v_clean := trim(upper(p_raw));

  -- Detección de anomalías evidentes
  if v_clean = 'JUAN DE DIOS' then
    return 'PENDIENTE DE REVISION';
  end if;

  -- 1. Quitar acentos y diacríticos
  v_clean := translate(v_clean, 'ÁÉÍÓÚÜÑ', 'AEIOUUN');

  -- 2. Limpieza de horarios y turnos incrustados
  v_clean := regexp_replace(v_clean, 'DE\s+\d{1,2}:\s*\d{2}\s*A\s*\d{1,2}:\s*\d{2}.*$', '', 'i');
  v_clean := regexp_replace(v_clean, '\d{1,2}:\s*\d{2}\s*A\s*\d{1,2}:\s*\d{2}.*$', '', 'i');
  v_clean := regexp_replace(v_clean, '\bTURNO\s+(MATUTINO|VESPERTINO|NOCTURNO|MIXTO|ACUMULADA|JORNADA)\b.*$', '', 'i');
  v_clean := regexp_replace(v_clean, '\bJORNADA\s+(MIXTA|ACUMULADA)\b.*$', '', 'i');
  v_clean := trim(v_clean);

  -- 3. Quitar sufijo de jornada laboral (80, 65, 60, 40, 20, E0, 6.5)
  v_clean := regexp_replace(v_clean, '(?:\s+|^)(80|65|60|40|20|E0|6\.5)$', '');
  v_clean := regexp_replace(v_clean, '([^0-9\s])(?:80|65|60|40|20|E0|0)$', '\1');

  -- 4. Puntuación y colapso de espacios
  v_clean := regexp_replace(v_clean, '[\.,\-_/\(\):]', ' ', 'g');
  v_clean := trim(regexp_replace(v_clean, '\s+', ' ', 'g'));

  -- 5. Mapeos directos y sinónimos
  case v_clean
    -- Limpieza e Higiene
    when 'AUX LIMPIEZA E HIGIENE UM Y NO MED', 'AUXILIAR DE LIMPIEZA E HIGIENE',
         'AUX DE LIMPIEZA E HIGIENE', 'AUXILIAR DE HIGIENE Y LIMPIEZA',
         'AUX DE HIGIENE Y LIMPIEZA', 'AUXILIAR DE HIGIENE Y LIMP',
         'AUX DE LIMPIEZ E HIGIENE', 'AUX DELIMPIEZA E HIGIENE',
         'AUX DE HIGIENE', 'AUXILIAT DE LIMPIEZA E HIGIENE',
         'AXILIAR DELIMPIEZA HIGIENE', 'AUXILIAR DE LIPIEZA E HIGIENE' then
      return 'AUXILIAR DE LIMPIEZA E HIGIENE';

    when 'AYTE LIMPIEZA E HIGIENE UM Y NO MED', 'AYUDANTE DE LIMPIEZA E HIGIENE' then
      return 'AYUDANTE DE LIMPIEZA E HIGIENE';

    -- Enfermería
    when 'ENFERMERA GENERAL', 'ENFERMERO GENERAL', 'ENFERMERA GENRAL',
         'ENFERMERA GRAL', 'ENF GENERAL', 'ENF GRAL', 'ENFERMERIA GRAL' then
      return 'ENFERMERA GENERAL';

    when 'ENFERMERA GENERAL CLINICA', 'ENFERMERO GENERAL CLINICA',
         'ENFERMERA GRAL CLINICA' then
      return 'ENFERMERA GENERAL CLINICA';

    when 'ENFERMERA ESPECIALISTA', 'ENFERMERO ESPECIALISTA',
         'ENFERMERA ESP', 'ENFERMERA QUIRURGICA' then
      return 'ENFERMERA ESPECIALISTA';

    when 'ENFERMERA JEFE DE PISO' then
      return 'ENFERMERA JEFE DE PISO';

    when 'AUX DE ENFERMERIA GRAL', 'AUXILIAR DE ENFERMERA GENERAL',
         'AUXILIAR DE ENFERMERIA', 'AUXILIAR ENFERMERIA',
         'AUX ENFERMERA GENERAL', 'AUX DE ENFERMERIA', 'AUX ENFERMERIA U M' then
      return 'AUXILIAR DE ENFERMERIA GENERAL';

    when 'ENF ESPEC SALUD PUBL' then
      return 'ENFERMERA ESPECIALISTA EN SALUD PUBLICA';

    -- Médicos
    when 'MEDICO NO FAMILIAR' then
      return 'MEDICO NO FAMILIAR';
    when 'MEDICO FAMILIAR' then
      return 'MEDICO FAMILIAR';
    when 'MEDICO GENERAL' then
      return 'MEDICO GENERAL';
    when 'CIRUJANO MAXILO FACIAL' then
      return 'CIRUJANO MAXILOFACIAL';
    when 'RESIDENTE 1' then return 'RESIDENTE 1';
    when 'RESIDENTE 2' then return 'RESIDENTE 2';
    when 'RESIDENTE 3' then return 'RESIDENTE 3';
    when 'RESIDENTE 4' then return 'RESIDENTE 4';
    when 'INTERNO DE PREGRADO' then return 'INTERNO DE PREGRADO';

    -- Asistente Médica y Trabajo Social
    when 'ASISTENTE MEDICA', 'ASISTENTE MEDICO' then
      return 'ASISTENTE MEDICA';
    when 'TRABAJADORA SOCIAL', 'TRABAJADOR SOCIAL' then
      return 'TRABAJADORA SOCIAL';
    when 'TRABAJADOR SOCIAL CLINICO' then
      return 'TRABAJADOR SOCIAL CLINICO';

    -- Camilleros y Choferes
    when 'CAMILLERO', 'CAMILLERO EN UNIDADES HOSPITALARIAS' then
      return 'CAMILLERO EN UNIDADES HOSPITALARIAS';
    when 'CHOFER' then
      return 'CHOFER';

    -- Alimentos y Cocina
    when 'MANEJADOR ALIMENTOS', 'MANEJADOR DE ALIMENTOS' then
      return 'MANEJADOR DE ALIMENTOS';
    when 'NUTRICIONISTA DIETISTA' then
      return 'NUTRICIONISTA DIETISTA';
    when 'ESP NUTRIC DIETETICA' then
      return 'ESPECIALISTA EN NUTRICION Y DIETETICA';
    when 'COCINERO TECNICO 1' then return 'COCINERO TECNICO 1';
    when 'COCINERO TECNICO 2' then return 'COCINERO TECNICO 2';

    -- Laboratorio y Farmacia
    when 'LABORATORISTA' then return 'LABORATORISTA';
    when 'AUX DE LABORATORIO', 'AUXILIAR DE LABORATORIO' then
      return 'AUXILIAR DE LABORATORIO';
    when 'QUIMICO CLINICO' then return 'QUIMICO CLINICO';
    when 'AYUDANTE DE FARMACIA' then return 'AYUDANTE DE FARMACIA';
    when 'AUXILIAR DE FARMACIA' then return 'AUXILIAR DE FARMACIA';
    when 'OFICIAL DE FARMACIA' then return 'OFICIAL DE FARMACIA';
    when 'COORDINADOR DE FARMACIA' then return 'COORDINADOR DE FARMACIA';
    when 'RESP SAN FARM HOSP 2DO NIVEL TIPO A' then
      return 'RESPONSABLE SANITARIO FARMACIA HOSPITALARIA';

    -- Almacén
    when 'AUXILIAR DE ALMACEN' then return 'AUXILIAR DE ALMACEN';
    when 'OFICIAL DE ALMACEN' then return 'OFICIAL DE ALMACEN';
    when 'COORDINADOR DE ALMACEN' then return 'COORDINADOR DE ALMACEN';

    -- Oficinas y Administrativos
    when 'AUX UNIV DE OFICINAS' then return 'AUXILIAR UNIVERSAL DE OFICINAS';
    when 'AUXILIAR GENERAL' then return 'AUXILIAR GENERAL';
    when 'OFICIAL DE ESTADISTICA' then return 'OFICIAL DE ESTADISTICA';
    when 'COORD DE ESTADISTICA' then return 'COORDINADOR DE ESTADISTICA';
    when 'JEFE GPO ESTADISTICA' then return 'JEFE DE GRUPO DE ESTADISTICA';
    when 'OFICIAL DE PERSONAL' then return 'OFICIAL DE PERSONAL';
    when 'COORD DE PERSONAL' then return 'COORDINADOR DE PERSONAL';
    when 'COORD ASIST MEDICAS' then return 'COORDINADOR DE ASISTENTES MEDICAS';

    -- Técnicos y Mantenimiento
    when 'TECNICO RADIOLOGO' then return 'TECNICO RADIOLOGO';
    when 'TERAPISTA FISICO' then return 'TERAPISTA FISICO';
    when 'TERAPISTA OCUPACIONAL' then return 'TERAPISTA OCUPACIONAL';
    when 'INHALOTERAPEUTA', 'HINALOTERAPEUTA' then return 'INHALOTERAPEUTA';
    when 'TECNICO MECANICO', 'TEC MECANICO' then return 'TECNICO MECANICO';
    when 'TECNICO PLOMERO' then return 'TECNICO PLOMERO';
    when 'TECNICO ELECTRICISTA' then return 'TECNICO ELECTRICISTA';
    when 'TECNICO ELECTRONICO' then return 'TECNICO ELECTRONICO';
    when 'TECNICO POLIVALENTE' then return 'TECNICO POLIVALENTE';
    when 'TECNICO DE BIBLIOTECAS' then return 'TECNICO DE BIBLIOTECAS';
    when 'ASIST BIBLIOTECARIO' then return 'ASISTENTE BIBLIOTECARIO';
    when 'TEC A AIRE ACON REFRIG' then return 'TECNICO A EN AIRE ACONDICIONADO Y REFRIGERACION';
    when 'TEC A EQUIPOS MEDICOS' then return 'TECNICO A EN EQUIPOS MEDICOS';
    when 'TEC B EQUIPOS MEDICOS' then return 'TECNICO B EN EQUIPOS MEDICOS';
    when 'TEC C FLUIDOS ENERGET' then return 'TECNICO C EN FLUIDOS Y ENERGETICOS';
    when 'TEC EQ HELICOIDAL' then return 'TECNICO EN EQUIPO HELICOIDAL';
    when 'TEC EQ RECIPROCANTES' then return 'TECNICO EN EQUIPOS RECIPROCANTES';
    when 'TEC MANEJO AP ELECTRODI' then return 'TECNICO EN MANEJO DE APARATOS DE ELECTRODIAGNOSTICO';
    when 'AUX SOPORTE TEC INFORMAT' then return 'AUXILIAR DE SOPORTE TECNICO EN INFORMATICA';

    -- Lavandería e Intendencia
    when 'OP SERVS DE LAVANDERIA' then return 'OPERADOR DE SERVICIOS DE LAVANDERIA';
    when 'OF SERVS DE LAVANDERIA' then return 'OFICIAL DE SERVICIOS DE LAVANDERIA';
    when 'AUX DE SERVS DE INT' then return 'AUXILIAR DE SERVICIOS DE INTENDENCIA';
    when 'OP MAQUINA DE REV AUT' then return 'OPERADOR DE MAQUINA DE REVISION AUTOMATICA';

    -- Transporte y Comunicación
    when 'OPERADOR AMBULANCIAS' then return 'OPERADOR DE AMBULANCIAS';
    when 'OPERADOR TELEFONICO A' then return 'OPERADOR TELEFONICO A';
    when 'MENSAJERO' then return 'MENSAJERO';

    -- Clínicos y Paramédicos
    when 'CITOTECNOLOGO' then return 'CITOTECNOLOGO';
    when 'HISTOTECNOLOGO' then return 'HISTOTECNOLOGO';
    when 'FONOAUDIOLOGO' then return 'FONOAUDIOLOGO';
    when 'PSICOLOGO CLINICO' then return 'PSICOLOGO CLINICO';
    when 'YESISTA' then return 'YESISTA';
    when 'AYUDANTE DE AUTOPSIA' then return 'AYUDANTE DE AUTOPSIA';

    -- Confianza / Niveles N
    when 'N17 CONTROLADOR INCIDENCIAS REC HUM' then return 'N17 CONTROLADOR DE INCIDENCIAS DE RECURSOS HUMANOS';
    when 'N20 TEC INF C CTR P INV' then return 'N20 TECNICO EN INFORMATICA C CENTRO INVESTIGACION';
    when 'N25 J O DIE ENS UMH AYB' then return 'N25 JEFE DE DIETETICA ENSEÑANZA UMH A Y B';
    when 'N25 TECNICA ATN OR DER' then return 'N25 TECNICA EN ATENCION Y ORIENTACION AL DERECHOHABIENTE';
    when 'N30 SUP AREA ROPERIA UMH' then return 'N30 SUPERVISOR DE AREA ROPERIA UMH';
    when 'N32 JEFE LIMP E HIG UMAE HGR HGZ' then return 'N32 JEFE DE LIMPIEZA E HIGIENE UMAE HGR HGZ';
    when 'N36 ANALISTA RESP D' then return 'N36 ANALISTA RESPONSABLE D';
    when 'N36 JEF D NUT DIE UMHA' then return 'N36 JEFE DE NUTRICION Y DIETETICA UMH A';
    when 'N36 JEF TRAB SOC UMH A' then return 'N36 JEFE DE TRABAJO SOCIAL UMH A';
    when 'N36 SUBJEF A CONS UNID' then return 'N36 SUBJEFE A CONSULTA DE UNIDAD';
    when 'N39 SUPERVISOR LIMPIEZA E HIGIENE' then return 'N39 SUPERVISOR DE LIMPIEZA E HIGIENE';
    when 'N41 ANALISTA COORD C' then return 'N41 ANALISTA COORDINADOR C';
    when 'N41 COORD CURSOS TEC' then return 'N41 COORDINADOR DE CURSOS TECNICOS';
    when 'N41 SUBJ ENF UM A' then return 'N41 SUBJEFE DE ENFERMERIA UM A';
    when 'N47 JEFE DEPTO UMH A' then return 'N47 JEFE DE DEPARTAMENTO UMH A';
    when 'N51 JEFE DE LABORATORIO UMH' then return 'N51 JEFE DE LABORATORIO UMH';
    when 'N51 JEFE SERVICIO UMH' then return 'N51 JEFE DE SERVICIO UMH';
    when 'N52 COORD CLINICO UMH' then return 'N52 COORDINADOR CLINICO UMH';
    when 'N53 COORD CL TURNO UMH' then return 'N53 COORDINADOR CLINICO DE TURNO UMH';
    when 'N54 SUBDIR ADMVO UMH A' then return 'N54 SUBDIRECTOR ADMINISTRATIVO UMH A';
    when 'N55 SUBD MED UMH A' then return 'N55 SUBDIRECTOR MEDICO UMH A';
    when 'N56 DIRECTOR UMH A' then return 'N56 DIRECTOR UMH A';
    when 'CONSULTORA AL DERECHOHABIENTE' then return 'CONSULTORA AL DERECHOHABIENTE';
    when 'CONTROLADOR INCIDENCIAS REC HUM' then return 'CONTROLADOR DE INCIDENCIAS DE RECURSOS HUMANOS';
    when 'ESPECIAL SEG EN EL TRABAJO' then return 'ESPECIALISTA EN SEGURIDAD EN EL TRABAJO';
    when 'TEC ATN DERECHOHABIENTE' then return 'TECNICO EN ATENCION AL DERECHOHABIENTE';

    else
      return v_clean;
  end case;
end;
$$;

-- 4. HOMOLOGACIÓN DE CATEGORÍAS EXISTENTES EN UNION_WORKERS
update public.union_workers
set category = public.union_normalize_category(category)
where coalesce(category, '') <> '';

update public.union_workers
set category = 'PENDIENTE DE REVISION'
where coalesce(category, '') = '';

-- 5. ACTUALIZAR union_confirm_worker_import PARA NORMALIZAR EN EL FLUJO CONTINUO
create or replace function public.union_confirm_worker_import(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_batch record;
  v_row record;
  v_existing record;
  v_worker_id uuid;
  v_applied_count integer := 0;
  v_updated_count integer := 0;
  v_unchanged_count integer := 0;
  v_missing_marked integer := 0;
  v_history_count integer := 0;
  v_c jsonb;
  v_now timestamptz := clock_timestamp();
  v_raw_cat text;
  v_norm_cat text;
begin
  -- 1. Obtener y bloquear el lote
  select * into v_batch
  from public.union_worker_import_batches
  where id = p_batch_id
  for update;

  if not found then
    raise exception 'BATCH_NOT_FOUND: Lote % no encontrado.', p_batch_id;
  end if;

  -- 2. Validar formato SIAP_2026
  if v_batch.format_version <> 'SIAP_2026' then
    raise exception 'INVALID_FORMAT_VERSION: Este lote tiene formato "%" y debe procesarse con su RPC correspondiente.', v_batch.format_version;
  end if;

  -- 3. Validar permisos de union_admin
  if not public.union_is_admin(v_batch.delegation_id) then
    raise exception 'UNAUTHORIZED_UNION_ADMIN: No tienes permisos de administrador sindical en esta delegación.';
  end if;

  -- 4. Validar estado preview
  if v_batch.status <> 'preview' then
    raise exception 'INVALID_BATCH_STATUS: El lote se encuentra en estado "%" y no puede ser confirmado.', v_batch.status;
  end if;

  -- 5. Iterar filas de staging
  for v_row in
    select *
    from public.union_worker_import_rows
    where batch_id = p_batch_id
      and row_status in ('new', 'updated', 'unchanged', 'warning')
      and action_taken = 'pending'
    order by row_number asc
  loop
    select * into v_existing
    from public.union_workers
    where delegation_id = v_batch.delegation_id
      and employee_number = v_row.matricula;

    v_raw_cat := coalesce(v_row.parsed_data->>'category', v_row.parsed_data->>'position_description', '');
    v_norm_cat := public.union_normalize_category(v_raw_cat);

    if not found then
      -- INSERTAR NUEVO TRABAJADOR
      insert into public.union_workers (
        delegation_id,
        employee_number,
        siap_full_name,
        first_name,
        paternal_surname,
        maternal_surname,
        category,
        assignment,
        turn,
        schedule,
        rest_days,
        active,
        notes,
        contract_type_code,
        plaza_code,
        responsibility_area_code,
        occupation_start_date,
        occupation_limit_date,
        occupation_limit_is_sentinel,
        occupation_mark_code,
        plaza_type_code,
        shift_code,
        associated_concepts_mask,
        associated_concepts,
        position_code,
        position_description,
        department_code,
        department_description,
        schedule_code,
        schedule_description,
        seniority_raw,
        seniority_years,
        seniority_fortnights,
        seniority_days,
        rfc,
        curp,
        nss,
        employment_start_date,
        reemployment_date,
        source_status_code,
        termination_code,
        termination_date,
        micro_group_code,
        source,
        source_created_by_batch_id,
        last_import_batch_id,
        source_last_seen_at,
        source_missing_since,
        source_rolled_back_at,
        source_import_state,
        created_by,
        updated_by,
        created_at,
        updated_at
      ) values (
        v_batch.delegation_id,
        v_row.matricula,
        coalesce(v_row.parsed_data->>'siap_full_name', v_row.full_name),
        coalesce(v_row.parsed_data->>'first_name', ''),
        coalesce(v_row.parsed_data->>'paternal_surname', ''),
        coalesce(v_row.parsed_data->>'maternal_surname', ''),
        v_norm_cat,
        coalesce(v_row.parsed_data->>'department_description', ''),
        coalesce(v_row.parsed_data->>'turn', ''),
        coalesce(v_row.parsed_data->>'schedule_description', ''),
        '',
        true,
        '',
        coalesce(v_row.parsed_data->>'contract_type_code', ''),
        coalesce(v_row.parsed_data->>'plaza_code', ''),
        coalesce(v_row.parsed_data->>'responsibility_area_code', ''),
        (v_row.parsed_data->>'occupation_start_date')::date,
        (v_row.parsed_data->>'occupation_limit_date')::date,
        coalesce((v_row.parsed_data->>'occupation_limit_is_sentinel')::boolean, false),
        coalesce(v_row.parsed_data->>'occupation_mark_code', ''),
        coalesce(v_row.parsed_data->>'plaza_type_code', ''),
        coalesce(v_row.parsed_data->>'shift_code', ''),
        coalesce(v_row.parsed_data->>'associated_concepts_mask', '00000'),
        coalesce(v_row.parsed_data->'associated_concepts', '[]'::jsonb),
        coalesce(v_row.parsed_data->>'position_code', ''),
        coalesce(v_row.parsed_data->>'position_description', ''),
        coalesce(v_row.parsed_data->>'department_code', ''),
        coalesce(v_row.parsed_data->>'department_description', ''),
        coalesce(v_row.parsed_data->>'schedule_code', ''),
        coalesce(v_row.parsed_data->>'schedule_description', ''),
        coalesce(v_row.parsed_data->>'seniority_raw', ''),
        (v_row.parsed_data->>'seniority_years')::integer,
        (v_row.parsed_data->>'seniority_fortnights')::integer,
        (v_row.parsed_data->>'seniority_days')::integer,
        coalesce(v_row.parsed_data->>'rfc', ''),
        coalesce(v_row.parsed_data->>'curp', ''),
        coalesce(v_row.parsed_data->>'nss', ''),
        (v_row.parsed_data->>'employment_start_date')::date,
        (v_row.parsed_data->>'reemployment_date')::date,
        coalesce(v_row.parsed_data->>'source_status_code', ''),
        coalesce(v_row.parsed_data->>'termination_code', ''),
        (v_row.parsed_data->>'termination_date')::date,
        coalesce(v_row.parsed_data->>'micro_group_code', ''),
        'siap_excel',
        p_batch_id,
        p_batch_id,
        v_now,
        null,
        null,
        'active',
        auth.uid(),
        auth.uid(),
        v_now,
        v_now
      ) returning id into v_worker_id;

      update public.union_worker_import_rows
      set action_taken = 'applied', target_worker_id = v_worker_id
      where id = v_row.id;

      v_applied_count := v_applied_count + 1;
    else
      -- TRABAJADOR EXISTENTE
      v_worker_id := v_existing.id;

      if v_row.diff ? 'changes' and jsonb_array_length(v_row.diff->'changes') > 0 then
        for v_c in select * from jsonb_array_elements(v_row.diff->'changes')
        loop
          insert into public.union_worker_change_history (
            delegation_id,
            batch_id,
            worker_id,
            field_name,
            old_value,
            new_value,
            changed_by,
            created_at
          ) values (
            v_batch.delegation_id,
            p_batch_id,
            v_worker_id,
            v_c->>'field',
            v_c->>'oldValue',
            v_c->>'newValue',
            auth.uid(),
            v_now
          );
          v_history_count := v_history_count + 1;
        end loop;

        update public.union_workers set
          siap_full_name = coalesce(v_row.parsed_data->>'siap_full_name', siap_full_name),
          category = coalesce(nullif(v_norm_cat, ''), category),
          assignment = coalesce(v_row.parsed_data->>'department_description', assignment),
          turn = coalesce(v_row.parsed_data->>'turn', turn),
          schedule = coalesce(v_row.parsed_data->>'schedule_description', schedule),
          contract_type_code = coalesce(v_row.parsed_data->>'contract_type_code', contract_type_code),
          plaza_code = coalesce(v_row.parsed_data->>'plaza_code', plaza_code),
          responsibility_area_code = coalesce(v_row.parsed_data->>'responsibility_area_code', responsibility_area_code),
          occupation_start_date = coalesce((v_row.parsed_data->>'occupation_start_date')::date, occupation_start_date),
          occupation_limit_date = coalesce((v_row.parsed_data->>'occupation_limit_date')::date, occupation_limit_date),
          occupation_limit_is_sentinel = coalesce((v_row.parsed_data->>'occupation_limit_is_sentinel')::boolean, occupation_limit_is_sentinel),
          occupation_mark_code = coalesce(v_row.parsed_data->>'occupation_mark_code', occupation_mark_code),
          plaza_type_code = coalesce(v_row.parsed_data->>'plaza_type_code', plaza_type_code),
          shift_code = coalesce(v_row.parsed_data->>'shift_code', shift_code),
          associated_concepts_mask = coalesce(v_row.parsed_data->>'associated_concepts_mask', associated_concepts_mask),
          associated_concepts = coalesce(v_row.parsed_data->'associated_concepts', associated_concepts),
          position_code = coalesce(v_row.parsed_data->>'position_code', position_code),
          position_description = coalesce(v_row.parsed_data->>'position_description', position_description),
          department_code = coalesce(v_row.parsed_data->>'department_code', department_code),
          department_description = coalesce(v_row.parsed_data->>'department_description', department_description),
          schedule_code = coalesce(v_row.parsed_data->>'schedule_code', schedule_code),
          schedule_description = coalesce(v_row.parsed_data->>'schedule_description', schedule_description),
          seniority_raw = coalesce(v_row.parsed_data->>'seniority_raw', seniority_raw),
          seniority_years = coalesce((v_row.parsed_data->>'seniority_years')::integer, seniority_years),
          seniority_fortnights = coalesce((v_row.parsed_data->>'seniority_fortnights')::integer, seniority_fortnights),
          seniority_days = coalesce((v_row.parsed_data->>'seniority_days')::integer, seniority_days),
          rfc = coalesce(v_row.parsed_data->>'rfc', rfc),
          curp = coalesce(v_row.parsed_data->>'curp', curp),
          nss = coalesce(v_row.parsed_data->>'nss', nss),
          employment_start_date = coalesce((v_row.parsed_data->>'employment_start_date')::date, employment_start_date),
          reemployment_date = coalesce((v_row.parsed_data->>'reemployment_date')::date, reemployment_date),
          source_status_code = coalesce(v_row.parsed_data->>'source_status_code', source_status_code),
          termination_code = coalesce(v_row.parsed_data->>'termination_code', termination_code),
          termination_date = coalesce((v_row.parsed_data->>'termination_date')::date, termination_date),
          micro_group_code = coalesce(v_row.parsed_data->>'micro_group_code', micro_group_code),
          source = 'siap_excel',
          last_import_batch_id = p_batch_id,
          source_last_seen_at = v_now,
          source_missing_since = null,
          source_import_state = 'active',
          updated_by = auth.uid(),
          updated_at = v_now
        where id = v_worker_id;

        update public.union_worker_import_rows
        set action_taken = 'applied', target_worker_id = v_worker_id
        where id = v_row.id;

        v_updated_count := v_updated_count + 1;
      else
        update public.union_workers set
          source = 'siap_excel',
          last_import_batch_id = p_batch_id,
          source_last_seen_at = v_now,
          source_missing_since = null,
          source_import_state = 'active',
          updated_by = auth.uid(),
          updated_at = v_now
        where id = v_worker_id;

        update public.union_worker_import_rows
        set action_taken = 'applied', target_worker_id = v_worker_id
        where id = v_row.id;

        v_unchanged_count := v_unchanged_count + 1;
      end if;
    end if;
  end loop;

  -- 6. Detectar y marcar ausentes
  update public.union_workers
  set
    source_import_state = 'missing_in_source',
    source_missing_since = coalesce(source_missing_since, v_now),
    updated_at = v_now
  where delegation_id = v_batch.delegation_id
    and source_import_state = 'active'
    and (source_last_seen_at is null or source_last_seen_at < v_now - interval '1 minute')
    and id not in (
      select target_worker_id
      from public.union_worker_import_rows
      where batch_id = p_batch_id
        and target_worker_id is not null
        and action_taken = 'applied'
    );

  get diagnostics v_missing_marked = row_count;

  -- 7. Actualizar batch
  update public.union_worker_import_batches
  set
    status = 'confirmed',
    confirmed_at = v_now,
    confirmed_by = auth.uid(),
    applied_at = v_now,
    new_workers_count = v_applied_count,
    updated_workers_count = v_updated_count,
    unchanged_workers_count = v_unchanged_count,
    missing_in_file_count = v_missing_marked,
    updated_at = v_now
  where id = p_batch_id;

  return jsonb_build_object(
    'batch_id', p_batch_id,
    'status', 'confirmed',
    'applied_count', v_applied_count,
    'updated_count', v_updated_count,
    'unchanged_count', v_unchanged_count,
    'missing_marked', v_missing_marked,
    'history_records_created', v_history_count
  );
end;
$$;
