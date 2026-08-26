-- Centraliza la agenda: migra bitacora_entries a worker_commitments.
-- worker_commitments pasa a ser la única fuente de verdad (inicio, calendario y /bitacora).
-- La tabla bitacora_entries NO se elimina; queda como histórico inactivo.

begin;

create unique index if not exists worker_commitments_user_legacy_idx
  on public.worker_commitments (user_id, legacy_local_id);

-- Amplía el catálogo de tipos: reemplaza cualquier CHECK previo sobre la columna type.
do $$
declare
  con record;
  col_attnum smallint;
begin
  select a.attnum::smallint into col_attnum
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'worker_commitments'
    and a.attname = 'type';

  for con in
    select cn.conname
    from pg_constraint cn
    where cn.conrelid = 'public.worker_commitments'::regclass
      and cn.contype = 'c'
      and cn.conkey @> array[col_attnum]
  loop
    execute format('alter table public.worker_commitments drop constraint %I', con.conname);
  end loop;
end $$;

alter table public.worker_commitments
  add constraint worker_commitments_type_check
  check (type in (
    'txt_substitution',
    'overtime',
    'shift_change',
    'guardia_festiva',
    'falta_injustificada',
    'incapacidad',
    'pase_salida',
    'vacaciones',
    'no_pagado',
    'other'
  ));

-- Backfill idempotente. Respeta el tipo de columna (timestamptz vs timestamp)
-- y usa la zona horaria de México para los registros que solo tenían fecha.
do $$
declare
  start_type text;
  end_type text;
  start_expr text;
  end_expr text;
begin
  select data_type into start_type
  from information_schema.columns
  where table_schema = 'public' and table_name = 'worker_commitments' and column_name = 'start_at';

  select data_type into end_type
  from information_schema.columns
  where table_schema = 'public' and table_name = 'worker_commitments' and column_name = 'end_at';

  if start_type is null or end_type is null then
    raise exception 'worker_commitments.start_at/end_at no encontrados';
  end if;

  if start_type = 'timestamp with time zone' then
    start_expr := '(be.entry_date::date + time ''00:00:00'') at time zone ''America/Mexico_City''';
  else
    start_expr := '(be.entry_date::date + time ''00:00:00'')';
  end if;

  if end_type = 'timestamp with time zone' then
    end_expr := '(be.entry_date::date + time ''23:59:00'') at time zone ''America/Mexico_City''';
  else
    end_expr := '(be.entry_date::date + time ''23:59:00'')';
  end if;

  execute format($f$
    insert into public.worker_commitments
      (user_id, legacy_local_id, type, title, start_at, end_at,
       reminder_day_before, reminder_hours_before, reminder_at_start, status)
    select
      be.user_id,
      'bitacora-' || be.id::text,
      case be.entry_type
        when 'Tiempo Extra' then 'overtime'
        when 'TxT (Sustitución)' then 'txt_substitution'
        when 'Guardia Festiva' then 'guardia_festiva'
        when 'Falta Injustificada' then 'falta_injustificada'
        when 'Incapacidad' then 'incapacidad'
        when 'Pases de salida/entrada' then 'pase_salida'
        when 'Vacaciones' then 'vacaciones'
        when 'No pagado (Reclamación en proceso)' then 'no_pagado'
        else 'other'
      end,
      coalesce(nullif(btrim(be.description), ''), be.entry_type),
      %s,
      %s,
      false,
      false,
      false,
      'active'
    from public.bitacora_entries be
    where not exists (
      select 1 from public.worker_commitments wc
      where wc.user_id = be.user_id
        and wc.legacy_local_id = 'bitacora-' || be.id::text
    )
  $f$, start_expr, end_expr);
end $$;

commit;
