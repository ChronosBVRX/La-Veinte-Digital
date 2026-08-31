#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# PostgreSQL / Supabase Complete Disaster Recovery & RLS Isolation Drill
# ==============================================================================
# Este script está diseñado para ejecutarse EXCLUSIVAMENTE contra una instancia
# local o de staging de Supabase/PostgreSQL. NUNCA contra producción.
# ==============================================================================

echo "=== INICIANDO POSTGRESQL DISASTER RECOVERY & ISOLATION DRILL ==="

if ! command -v supabase &> /dev/null; then
  echo "::error::supabase CLI no encontrado en PATH"
  exit 1
fi

if ! command -v docker &> /dev/null; then
  echo "::warning::Docker no está disponible en este host. Omitiendo drill de contenedor local."
  echo "Para ejecutar en CI: ver .github/workflows/ci.yml (job supabase-db)."
  exit 0
fi

# 1. Resetear esquema limpio
echo "1. Reseteando base de datos y aplicando migraciones..."
supabase db reset

db_container=$(docker ps --format '{{.Names}}' | grep -E 'supabase_db_' | head -1)
if [ -z "$db_container" ]; then
  echo "::error::No se encontró el contenedor supabase_db_"
  exit 1
fi

# 2. Insertar fixtures sintéticos multi-usuario con relaciones
echo "2. Insertando fixtures sintéticos (Auth, Perfiles, Contextos, Compromisos)..."
docker exec -i "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres << 'EOF'
  -- Auth Users
  INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES
    ('00000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'trabajador.a@test.laveinte.org', '', now(), '{}', '{"email":"trabajador.a@test.laveinte.org"}', now(), now()),
    ('00000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'trabajador.b@test.laveinte.org', '', now(), '{}', '{"email":"trabajador.b@test.laveinte.org"}', now(), now())
  ON CONFLICT (id) DO NOTHING;

  -- Fixture Usuario A
  INSERT INTO public.profiles (id, full_name, matricula) VALUES
    ('00000000-0000-0000-0000-000000000001', 'Trabajador A', 'MATR-A001')
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;
  INSERT INTO public.payroll_contexts (user_id, category_id, workday_hours) VALUES
    ('00000000-0000-0000-0000-000000000001', 'ENF-GRAL', 8.0)
  ON CONFLICT (user_id) DO UPDATE SET category_id = EXCLUDED.category_id;
  INSERT INTO public.worker_commitments (id, user_id, type, title, start_at, end_at, status) VALUES
    ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000001', 'shift_change', 'Permuta programada A', now(), now() + interval '8 hours', 'active')
  ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title;

  -- Fixture Usuario B
  INSERT INTO public.profiles (id, full_name, matricula) VALUES
    ('00000000-0000-0000-0000-000000000002', 'Trabajador B', 'MATR-B002')
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;
  INSERT INTO public.payroll_contexts (user_id, category_id, workday_hours) VALUES
    ('00000000-0000-0000-0000-000000000002', 'MED-ESP', 6.5)
  ON CONFLICT (user_id) DO UPDATE SET category_id = EXCLUDED.category_id;
  INSERT INTO public.worker_commitments (id, user_id, type, title, start_at, end_at, status) VALUES
    ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-000000000002', 'shift_change', 'Revisión escalafón B', now(), now() + interval '8 hours', 'pending')
  ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title;
EOF

# 3. Producir dump real
echo "3. Generando dump SQL de la base de datos..."
mkdir -p .temp
supabase db dump --local --data-only -f .temp/backup_drill.sql

# 4. Destrucción total de tablas en cascada
echo "4. Vaciando tablas en cascada (simulación de pérdida total)..."
docker exec -i "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "TRUNCATE auth.users CASCADE; TRUNCATE public.profiles CASCADE;"

# 5. Restauración del dump
echo "5. Restaurando desde dump SQL..."
docker exec -i "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres < .temp/backup_drill.sql

# 6. Comprobar integridad de conteos y relaciones FK
echo "6. Comprobando integridad referencial post-restore..."
p_count=$(docker exec -i "$db_container" psql -U postgres -d postgres -t -c "SELECT count(*) FROM public.profiles;" | tr -d '[:space:]')
ctx_count=$(docker exec -i "$db_container" psql -U postgres -d postgres -t -c "SELECT count(*) FROM public.payroll_contexts;" | tr -d '[:space:]')
com_count=$(docker exec -i "$db_container" psql -U postgres -d postgres -t -c "SELECT count(*) FROM public.worker_commitments;" | tr -d '[:space:]')

if [ "$p_count" -ne 2 ] || [ "$ctx_count" -ne 2 ] || [ "$com_count" -ne 2 ]; then
  echo "::error::Integridad fallida: esperados 2/2/2, encontrados $p_count/$ctx_count/$com_count"
  exit 1
fi

# 7. Validar aislamiento RLS post-restore (Usuario A vs Usuario B)
echo "7. Validando aislamiento RLS post-restore..."
docker exec -i "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres << 'EOF'
  -- Simular autenticación como Usuario A
  SET ROLE authenticated;
  SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';

  -- Usuario A debe ver únicamente su compromiso
  DO $$
  DECLARE
    cnt integer;
  BEGIN
    SELECT count(*) INTO cnt FROM public.worker_commitments;
    IF cnt <> 1 THEN
      RAISE EXCEPTION 'RLS Falló: Usuario A vio % compromisos (esperado 1)', cnt;
    END IF;
  END
  $$;

  -- Usuario A intenta modificar indebidamente el compromiso de Usuario B
  UPDATE public.worker_commitments SET title = 'Hackeado' WHERE id = '00000000-0000-0000-0000-0000000000c2';

  -- Verificar que no se modificó nada de Usuario B
  SET ROLE postgres;
  DO $$
  DECLARE
    t text;
  BEGIN
    SELECT title INTO t FROM public.worker_commitments WHERE id = '00000000-0000-0000-0000-0000000000c2';
    IF t = 'Hackeado' THEN
      RAISE EXCEPTION 'RLS Falló: Usuario A pudo modificar compromiso de Usuario B';
    END IF;
  END
  $$;
EOF

echo "=== POSTGRESQL DISASTER RECOVERY & ISOLATION DRILL: 100% PASS ==="
