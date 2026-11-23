-- Actualización temporal de límites de transferencia de documentos (experimento: 500 MB y sin restricción de tipo)
--
-- Los archivos continúan almacenándose de forma estrictamente temporal en la tabla
-- transfer_files y se eliminan automáticamente del servidor:
-- 1. Al cerrar la sesión desde el receptor (RPC transfer_close_session borra la sesión y en cascada todos sus archivos).
-- 2. Al expirar el tiempo de vida de la sesión (10 minutos), purgado automático en transfer_create_session y transfer_list_files.

CREATE OR REPLACE FUNCTION public.transfer_upload_file(
  p_token TEXT,
  p_name TEXT,
  p_content_type TEXT,
  p_size_bytes INTEGER,
  p_data TEXT
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.transfer_sessions%ROWTYPE;
  v_file public.transfer_files%ROWTYPE;
  v_count INTEGER;
  v_session_bytes BIGINT;
  v_global_bytes BIGINT;
  v_safe_content_type TEXT;
BEGIN
  SELECT * INTO v_session FROM public.transfer_sessions WHERE token = p_token;
  IF v_session.id IS NULL THEN
    RAISE EXCEPTION 'invalid_session';
  END IF;
  IF v_session.expires_at < now() THEN
    RAISE EXCEPTION 'session_expired';
  END IF;

  -- Sin restricciones de tipo de archivo para el experimento temporal:
  v_safe_content_type := COALESCE(NULLIF(trim(p_content_type), ''), 'application/octet-stream');

  -- Límite de archivo fijado a 500 MB (500 * 1024 * 1024 = 524288000 bytes)
  IF p_size_bytes IS NULL OR p_size_bytes <= 0 OR p_size_bytes > 524288000 THEN
    RAISE EXCEPTION 'invalid_size';
  END IF;
  IF p_data IS NULL OR length(p_data) = 0 THEN
    RAISE EXCEPTION 'empty_file';
  END IF;
  -- Base64 de 500 MB es ~699.05 MB (~700 millones de caracteres). Límite de seguridad: 750 MB chars.
  IF length(p_data) > 750000000 THEN
    RAISE EXCEPTION 'file_too_large';
  END IF;

  SELECT count(*), COALESCE(sum(size_bytes), 0)
    INTO v_count, v_session_bytes
    FROM public.transfer_files WHERE session_id = v_session.id;
  IF v_count >= 10 THEN
    RAISE EXCEPTION 'session_full';
  END IF;
  -- Límite de sesión ampliado a 500 MB
  IF v_session_bytes + p_size_bytes > 524288000 THEN
    RAISE EXCEPTION 'session_size_exceeded';
  END IF;

  -- Capacidad global temporalmente ampliada a 2 GB para permitir archivos de 500 MB activos
  SELECT COALESCE(sum(size_bytes), 0) INTO v_global_bytes FROM public.transfer_files;
  IF v_global_bytes + p_size_bytes > 2147483648 THEN
    RAISE EXCEPTION 'capacity_full';
  END IF;

  INSERT INTO public.transfer_files (session_id, name, content_type, size_bytes, data)
  VALUES (
    v_session.id,
    left(COALESCE(NULLIF(p_name, ''), 'archivo'), 255),
    v_safe_content_type,
    p_size_bytes,
    p_data
  )
  RETURNING * INTO v_file;

  RETURN jsonb_build_object(
    'id', v_file.id,
    'name', v_file.name,
    'contentType', v_file.content_type,
    'sizeBytes', v_file.size_bytes,
    'createdAt', v_file.created_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.transfer_upload_file(TEXT, TEXT, TEXT, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transfer_upload_file(TEXT, TEXT, TEXT, INTEGER, TEXT) TO anon, authenticated;

-- Función para descargar archivo: cambiada a RETURNS json (en lugar de jsonb)
-- para superar el límite de 256 MB de jsonb en PostgreSQL y permitir archivos de 500 MB.
DROP FUNCTION IF EXISTS public.transfer_get_file(TEXT, UUID);
CREATE OR REPLACE FUNCTION public.transfer_get_file(
  p_owner_token TEXT,
  p_file_id UUID
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.transfer_sessions%ROWTYPE;
  v_file public.transfer_files%ROWTYPE;
BEGIN
  SELECT * INTO v_session FROM public.transfer_sessions WHERE owner_token = p_owner_token;
  IF v_session.id IS NULL THEN
    RAISE EXCEPTION 'invalid_session';
  END IF;
  IF v_session.expires_at < now() THEN
    RAISE EXCEPTION 'session_expired';
  END IF;

  SELECT * INTO v_file FROM public.transfer_files
  WHERE id = p_file_id AND session_id = v_session.id;
  IF v_file.id IS NULL THEN
    RAISE EXCEPTION 'file_not_found';
  END IF;

  RETURN json_build_object(
    'id', v_file.id,
    'name', v_file.name,
    'contentType', v_file.content_type,
    'sizeBytes', v_file.size_bytes,
    'data', v_file.data,
    'createdAt', v_file.created_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.transfer_get_file(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transfer_get_file(TEXT, UUID) TO anon, authenticated;
