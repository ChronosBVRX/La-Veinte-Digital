-- Right to erasure: DELETE policies for payroll data
-- Requires: 003_payroll_contexts.sql, 004_imported_payslips.sql
--
-- Los trabajadores pueden borrar permanentemente su contexto de nómina y
-- sus tarjetones confirmados. Las líneas y observaciones se eliminan por
-- cascada (ON DELETE CASCADE, ya existente en 004); se agrega política
-- DELETE explícita también en las tablas hijas por seguridad.
--
-- Las guardas DO permiten re-ejecutar la migración sobre una base que ya
-- la tiene parcialmente aplicada.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'payroll_contexts'
      AND policyname = 'Users can delete own payroll context'
  ) THEN
    CREATE POLICY "Users can delete own payroll context"
      ON public.payroll_contexts FOR DELETE
      TO authenticated
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'imported_payslips'
      AND policyname = 'Users can delete own imported payslips'
  ) THEN
    CREATE POLICY "Users can delete own imported payslips"
      ON public.imported_payslips FOR DELETE
      TO authenticated
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'imported_payslip_lines'
      AND policyname = 'Users can delete own imported payslip lines'
  ) THEN
    CREATE POLICY "Users can delete own imported payslip lines"
      ON public.imported_payslip_lines FOR DELETE
      TO authenticated
      USING (payslip_id IN (SELECT id FROM public.imported_payslips WHERE user_id = auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'imported_payslip_observations'
      AND policyname = 'Users can delete own imported payslip observations'
  ) THEN
    CREATE POLICY "Users can delete own imported payslip observations"
      ON public.imported_payslip_observations FOR DELETE
      TO authenticated
      USING (payslip_id IN (SELECT id FROM public.imported_payslips WHERE user_id = auth.uid()));
  END IF;
END
$$;
