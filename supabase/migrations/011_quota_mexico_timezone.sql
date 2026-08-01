-- 011_quota_mexico_timezone.sql
-- La cuota diaria de API se reiniciaba según `current_date` (UTC) de la base,
-- no a medianoche de Ciudad de México. Se introduce una fecha explícita en
-- America/Mexico_City y se usa en el RPC de cuota y en el default de la tabla.

create or replace function public.mexico_date()
returns date
language sql
stable
as $$
  select (now() at time zone 'America/Mexico_City')::date
$$;

create or replace function public.increment_api_usage(
  p_user uuid,
  p_route text,
  p_limit integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'unauthorized';
  end if;
  if auth.uid() <> p_user then
    raise exception 'forbidden';
  end if;

  insert into public.api_usage_log (user_id, route, usage_date, count)
  values (p_user, p_route, public.mexico_date(), 1)
  on conflict (user_id, route, usage_date)
  do update set count = api_usage_log.count + 1
  returning count into v_count;

  return v_count <= p_limit;
end;
$$;

alter table public.api_usage_log
  alter column usage_date set default public.mexico_date();

revoke all on function public.increment_api_usage(uuid, text, integer) from public;
grant execute on function public.increment_api_usage(uuid, text, integer) to authenticated;
