#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# PostgreSQL / Supabase Live Restore Drill (Non-Production / Local Only)
# ==============================================================================
# Este script está diseñado para ejecutarse EXCLUSIVAMENTE contra una instancia
# local o de staging de Supabase/PostgreSQL. NUNCA contra producción.
# ==============================================================================

echo "=== INICIANDO POSTGRESQL RESTORE DRILL (ENTORNO LOCAL) ==="

if ! command -v supabase &> /dev/null; then
  echo "::error::supabase CLI no encontrado en PATH"
  exit 1
fi

if ! command -v docker &> /dev/null; then
  echo "::warning::Docker no está disponible en este host. Omitiendo drill de contenedor local."
  echo "Para ejecutar en CI: ver .github/workflows/ci.yml (job supabase-db)."
  exit 0
fi

# 1. Iniciar Supabase local limpio
echo "1. Reseteando base de datos local..."
supabase db reset

# 2. Insertar fixtures sintéticos de prueba
echo "2. Insertando fixtures de prueba..."
supabase db query --local "
  INSERT INTO public.profiles (id, email) VALUES
    ('00000000-0000-0000-0000-000000000001', 'trabajador.a@test.laveinte.org'),
    ('00000000-0000-0000-0000-000000000002', 'trabajador.b@test.laveinte.org');
"

# 3. Generar dump real
echo "3. Produciendo dump SQL de la base de datos..."
mkdir -p .temp
supabase db dump --local --data-only -f .temp/backup_drill.sql

# 4. Destruir datos en la base de prueba
echo "4. Vaciando tablas de prueba..."
supabase db query --local "TRUNCATE public.profiles CASCADE;"

# 5. Restaurar dump
echo "5. Restaurando dump..."
db_container=$(docker ps --format '{{.Names}}' | grep -E 'supabase_db_' | head -1)
docker exec -i "$db_container" psql -U postgres -d postgres < .temp/backup_drill.sql

# 6. Comprobar conteos y relaciones
echo "6. Verificando conteos..."
count=$(supabase db query --local --output-format json "SELECT count(*) FROM public.profiles;" | grep -o '"count": *[0-9]*' | grep -o '[0-9]*')
if [ "$count" -ne 2 ]; then
  echo "::error::Fallo en la restauración: se esperaban 2 perfiles y se encontraron $count"
  exit 1
fi

echo "=== POSTGRESQL RESTORE DRILL COMPLETADO CON ÉXITO ==="
