import { CalendarioLaboral } from "@/shared/components/app/CalendarioLaboral"
import { PageHeader } from "@/shared/components/app/PageHeader"

export default function CalendarioPage() {
  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
      <PageHeader
        title="Calendario laboral"
        description="Fechas institucionales del IMSS y tus compromisos personales."
      />
      <CalendarioLaboral fullPage />
    </div>
  )
}
