-- Transferir documentos: transferencia de archivos teléfono → PC
--
-- Un usuario genera una "sesión de transferencia" (con un token de subida
-- público y un owner_token secreto) y muestra un QR. Un teléfono escanea el
-- QR, abre /transfer?t=<token> y sube archivos mediante la RPC
-- transfer_upload_file (rol anon). La PC que generó la sesión consulta los
-- archivos con su owner_token y los descarga. Los archivos se almacenan en
-- base64 de forma temporal y se eliminan al cerrar la sesión o al expirar.
--
-- Seguridad: el acceso a las tablas se concede ÚNICAMENTE a través de las
-- RPC SECURITY DEFINER listadas abajo; RLS queda habilitado sin políticas
-- (denegación directa por defecto). El token de subida NO permite leer o
-- descargar otros archivos; solo el owner_token puede listar/descargar.
--
-- Límites (cuota gratuita de Supabase): máx. 10 MB por archivo, 10 archivos
-- y 25 MB por sesión, 100 MB de archivos activos en total; sesiones de 10 min
-- (máx. 30). Las sesiones vencidas se purgan al crear o consultar.

-- 1. Sesiones de transferencia
CREATE TABLE IF NOT EXISTS public.transfer_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  owner_token TEXT NOT NULL UNIQUE,
  owner_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- 2. Archivos transferidos (data = base64 del contenido binario)
CREATE TABLE IF NOT EXISTS public.transfer_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.transfer_sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  data TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS transfer_files_session_id_idx
  ON public.transfer_files (session_id);

CREATE INDEX IF NOT EXISTS transfer_sessions_expires_at_idx
  ON public.transfer_sessions (expires_at);

ALTER TABLE public.transfer_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfer_files ENABLE ROW LEVEL SECURITY;

-- 3. Crear sesión de transferencia (PC). owner_id se deriva de auth.uid();
--    es NULL para sesiones iniciadas sin login desde la pantalla de acceso.
CREATE OR REPLACE FUNCTION public.transfer_create_session(
  p_ttl_minutes integer DEFAULT 10
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_token TEXT;
  v_owner_token TEXT;
  v_expires TIMESTAMPTZ;
  v_ttl INTEGER;
BEGIN
  DELETE FROM public.transfer_sessions WHERE expires_at < now();

  v_id := gen_random_uuid();
  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_owner_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_ttl := GREATEST(LEAST(COALESCE(p_ttl_minutes, 10), 30), 1);
  v_expires := now() + make_interval(mins => v_ttl);

  INSERT INTO public.transfer_sessions (id, token, owner_token, owner_id, expires_at)
  VALUES (v_id, v_token, v_owner_token, auth.uid(), v_expires);

  RETURN jsonb_build_object(
    'id', v_id,
    'token', v_token,
    'ownerToken', v_owner_token,
    'expiresAt', v_expires,
    'ttlMinutes', v_ttl
  );
END;
$$;

-- 4. Subir un archivo (teléfono, con el token del QR).
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
BEGIN
  SELECT * INTO v_session FROM public.transfer_sessions WHERE token = p_token;
  IF v_session.id IS NULL THEN
    RAISE EXCEPTION 'invalid_session';
  END IF;
  IF v_session.expires_at < now() THEN
    RAISE EXCEPTION 'session_expired';
  END IF;

  IF p_content_type NOT IN (
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
    'application/pdf'
  ) THEN
    RAISE EXCEPTION 'invalid_content_type';
  END IF;
  IF p_size_bytes IS NULL OR p_size_bytes <= 0 OR p_size_bytes > 10485760 THEN
    RAISE EXCEPTION 'invalid_size';
  END IF;
  IF p_data IS NULL OR length(p_data) = 0 THEN
    RAISE EXCEPTION 'empty_file';
  END IF;
  IF length(p_data) > 14000000 THEN
    RAISE EXCEPTION 'file_too_large';
  END IF;

  SELECT count(*), COALESCE(sum(size_bytes), 0)
    INTO v_count, v_session_bytes
    FROM public.transfer_files WHERE session_id = v_session.id;
  IF v_count >= 10 THEN
    RAISE EXCEPTION 'session_full';
  END IF;
  IF v_session_bytes + p_size_bytes > 26214400 THEN
    RAISE EXCEPTION 'session_size_exceeded';
  END IF;

  SELECT COALESCE(sum(size_bytes), 0) INTO v_global_bytes FROM public.transfer_files;
  IF v_global_bytes + p_size_bytes > 104857600 THEN
    RAISE EXCEPTION 'capacity_full';
  END IF;

  INSERT INTO public.transfer_files (session_id, name, content_type, size_bytes, data)
  VALUES (
    v_session.id,
    left(COALESCE(NULLIF(p_name, ''), 'archivo'), 255),
    p_content_type,
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

-- 5. Listar metadatos de los archivos recibidos (PC, con owner_token).
CREATE OR REPLACE FUNCTION public.transfer_list_files(p_owner_token TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.transfer_sessions%ROWTYPE;
BEGIN
  DELETE FROM public.transfer_sessions WHERE expires_at < now();
  SELECT * INTO v_session FROM public.transfer_sessions WHERE owner_token = p_owner_token;
  IF v_session.id IS NULL THEN
    RAISE EXCEPTION 'invalid_session';
  END IF;
  IF v_session.expires_at < now() THEN
    RAISE EXCEPTION 'session_expired';
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', f.id,
        'name', f.name,
        'contentType', f.content_type,
        'sizeBytes', f.size_bytes,
        'createdAt', f.created_at
      ) ORDER BY f.created_at ASC
    ), '[]'::jsonb)
    FROM public.transfer_files f
    WHERE f.session_id = v_session.id
  );
END;
$$;

-- 6. Obtener un archivo completo (PC, con owner_token + id del archivo).
CREATE OR REPLACE FUNCTION public.transfer_get_file(
  p_owner_token TEXT,
  p_file_id UUID
) RETURNS jsonb
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

  RETURN jsonb_build_object(
    'id', v_file.id,
    'name', v_file.name,
    'contentType', v_file.content_type,
    'sizeBytes', v_file.size_bytes,
    'data', v_file.data,
    'createdAt', v_file.created_at
  );
END;
$$;

-- 7. Cerrar la sesión (PC, con owner_token). Borra la sesión y, en cascada,
--    todos sus archivos.
CREATE OR REPLACE FUNCTION public.transfer_close_session(p_owner_token TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.transfer_sessions%ROWTYPE;
BEGIN
  SELECT * INTO v_session FROM public.transfer_sessions WHERE owner_token = p_owner_token;
  IF v_session.id IS NULL THEN
    RAISE EXCEPTION 'invalid_session';
  END IF;

  DELETE FROM public.transfer_sessions WHERE id = v_session.id;
  RETURN jsonb_build_object('closed', true);
END;
$$;

REVOKE ALL ON FUNCTION public.transfer_create_session(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.transfer_upload_file(TEXT, TEXT, TEXT, INTEGER, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.transfer_list_files(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.transfer_get_file(TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.transfer_close_session(TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.transfer_create_session(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_upload_file(TEXT, TEXT, TEXT, INTEGER, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_list_files(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_get_file(TEXT, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_close_session(TEXT) TO anon, authenticated;
