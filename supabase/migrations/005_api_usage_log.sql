-- 005_api_usage_log.sql
-- Cuota persistente y atómica por usuario y ruta API (simulador, consulta).
-- Reemplaza los Map en memoria que se perdían entre reinicios serverless.

create table if not exists public.api_usage_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  route text not null check (route in ('consulta', 'simulador')),
  usage_date date not null default current_date,
  count integer not null default 0,
  constraint api_usage_log_user_route_day unique (user_id, route, usage_date)
);

alter table public.api_usage_log enable row level security;

create policy "Usuarios pueden ver su propio uso de API"
  on public.api_usage_log for select
  using (auth.uid() = user_id);

-- Incremento atómico + verificación de límite en una sola operación.
-- Devuelve true si la llamada está permitida (count <= limite) y false si la
-- cuota ya se agotó. La escritura es indivisible: dos peticiones simultáneas
-- no pueden rebasar el límite.
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
  values (p_user, p_route, current_date, 1)
  on conflict (user_id, route, usage_date)
  do update set count = api_usage_log.count + 1
  returning count into v_count;

  return v_count <= p_limit;
end;
$$;

revoke all on function public.increment_api_usage(uuid, text, integer) from public;
grant execute on function public.increment_api_usage(uuid, text, integer) to authenticated;
