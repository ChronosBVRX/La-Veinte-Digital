-- Derecho al olvido atómico para nómina.
-- Requiere: 003_payroll_contexts.sql, 004_imported_payslips.sql,
--           009_right_to_erasure.sql
--
-- `deletePayrollDataRemote` borraba en dos requests (tarjetones y contexto),
-- lo que permitía un borrado parcial si el segundo fallaba. Este RPC ejecuta
-- ambos DELETE en una sola transacción; las líneas y observaciones se eliminan
-- por cascada (ON DELETE CASCADE de 004).

CREATE OR REPLACE FUNCTION public.erase_user_payroll_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.imported_payslips WHERE user_id = auth.uid();
  DELETE FROM public.payroll_contexts WHERE user_id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.erase_user_payroll_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.erase_user_payroll_data() TO authenticated;
