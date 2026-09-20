-- Migración: RPC para resumen canónico de casilleros independiente de límites de filas
-- Resuelve el truncamiento en PostgREST (pgrst.db_max_rows = 1000) al calcular métricas en PostgreSQL.

CREATE OR REPLACE FUNCTION public.union_get_locker_summary(p_delegation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total int := 0;
  v_assigned int := 0;
  v_available int := 0;
  v_maintenance int := 0;
  v_blocked int := 0;
  v_reserved int := 0;
  v_unlocated int := 0;
  v_pending_review int := 0;
  v_affected_lockers int := 0;
  v_issue_count int := 0;
  v_waitlist int := 0;
BEGIN
  -- 1. Métricas de casilleros físicos
  SELECT
    count(*),
    count(*) FILTER (WHERE l.status = 'assigned' OR EXISTS (
      SELECT 1 FROM union_locker_assignments a WHERE a.locker_id = l.id AND a.status = 'active'
    )),
    count(*) FILTER (WHERE (l.status = 'available' OR l.status IS NULL) AND NOT EXISTS (
      SELECT 1 FROM union_locker_assignments a WHERE a.locker_id = l.id AND a.status = 'active'
    )),
    count(*) FILTER (WHERE l.status = 'maintenance' OR l.condition IN ('maintenance', 'damaged')),
    count(*) FILTER (WHERE l.status = 'blocked' OR l.condition = 'blocked'),
    count(*) FILTER (WHERE l.status = 'reserved'),
    count(*) FILTER (WHERE l.zone_id IS NULL OR l.bank_id IS NULL)
  INTO
    v_total,
    v_assigned,
    v_available,
    v_maintenance,
    v_blocked,
    v_reserved,
    v_unlocated
  FROM union_lockers l
  WHERE l.delegation_id = p_delegation_id;

  -- 2. Pendientes de revisión (incidencias de importación / conciliación)
  SELECT count(*)
  INTO v_pending_review
  FROM union_locker_review_items r
  WHERE r.delegation_id = p_delegation_id
    AND r.status = 'pending';

  -- 3. Lista de espera activa
  SELECT count(*)
  INTO v_waitlist
  FROM union_locker_waitlist w
  WHERE w.delegation_id = p_delegation_id
    AND w.status = 'waiting';

  -- 4. Casilleros únicos afectados (tienen revisión pendiente o condición/estado no óptimo)
  SELECT count(DISTINCT l.id)
  INTO v_affected_lockers
  FROM union_lockers l
  WHERE l.delegation_id = p_delegation_id
    AND (
      l.status IN ('maintenance', 'blocked')
      OR l.condition IN ('maintenance', 'damaged', 'blocked')
      OR EXISTS (
        SELECT 1
        FROM union_locker_review_items r
        WHERE r.delegation_id = p_delegation_id
          AND r.status = 'pending'
          AND (r.locker_id = l.id OR r.locker_number = l.locker_number)
      )
    );

  -- 5. Total de situaciones / incidencias
  v_issue_count := v_pending_review + v_maintenance + v_blocked;

  RETURN jsonb_build_object(
    'total', v_total,
    'assigned', v_assigned,
    'available', v_available,
    'maintenance', v_maintenance,
    'blocked', v_blocked,
    'reserved', v_reserved,
    'unlocated', v_unlocated,
    'pending_review', v_pending_review,
    'pendingReview', v_pending_review,
    'affected_lockers', v_affected_lockers,
    'affectedLockers', v_affected_lockers,
    'issue_count', v_issue_count,
    'issueCount', v_issue_count,
    'waitlist', v_waitlist,
    'waitlistCount', v_waitlist
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.union_get_locker_summary(uuid) TO authenticated, service_role, anon;

COMMENT ON FUNCTION public.union_get_locker_summary(uuid) IS
'Retorna métricas operativas globales agregadas de casilleros para una delegación, inmune al límite de filas de PostgREST.';
