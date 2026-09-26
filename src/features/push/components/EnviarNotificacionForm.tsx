"use client"

import { SimplePushAlertForm } from "./SimplePushAlertForm"

export function EnviarNotificacionForm({ email }: { email: string }) {
  return <SimplePushAlertForm userEmail={email} />
}
