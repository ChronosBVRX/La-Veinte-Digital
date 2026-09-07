"use client"

import { usePayslipInvalidation } from "@/shared/hooks/usePayslipInvalidation"

/**
 * Componente cliente persistente montado en el layout del dashboard.
 *
 * Permanece montado durante toda la sesión del usuario. Escucha el evento
 * global `nomina_payslip_updated` emitido al confirmar un tarjetón desde
 * cualquier parte (Perfil, Documentos Personales, modal, etc.) y ejecuta
 * un debounced `router.refresh()` para invalidar las fuentes del servidor.
 */
export function PayslipGlobalInvalidation() {
  usePayslipInvalidation({ refreshRouter: true })
  return null
}
