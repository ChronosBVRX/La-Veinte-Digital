import { CalendarioLaboral } from "@/shared/components/app/CalendarioLaboral"
import { PageHeader } from "@/shared/components/app/PageHeader"
import { PageContainer } from "@/shared/components/layout/PageContainer"

export default function CalendarioPage() {
  return (
    <PageContainer maxWidth={1000}>
      <PageHeader
        title="Calendario laboral"
        description="Fechas institucionales del IMSS y tus compromisos personales."
      />
      <CalendarioLaboral fullPage />
    </PageContainer>
  )
}
