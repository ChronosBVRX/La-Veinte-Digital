-- 019: actualizacion idempotente de vacations en reimportacion de tarjeton duplicado
--
-- Si el trabajador reimporta un tarjeton previamente confirmado que no tenia
-- dueDate o porVencer persistida (p. ej. recibos con formato DDMMYYYY 14102026),
-- el registro existente se actualiza con la fecha valida sin crear duplicados y
-- sin sobrescribir fechas validas ya existentes.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'imported_payslips'
      AND policyname = 'Users can update own imported payslips'
  ) THEN
    CREATE POLICY "Users can update own imported payslips"
      ON public.imported_payslips FOR UPDATE
      TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
