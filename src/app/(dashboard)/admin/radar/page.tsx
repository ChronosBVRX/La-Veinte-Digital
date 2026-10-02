import { redirect } from "next/navigation"
import { getAdminCapabilities } from "@/shared/server/admin/admin-capabilities"
import { getAllTopics } from "@/features/radar/services/radar-store"
import {
  evaluateTodayCalendar,
  getUpcomingCalendarAlerts,
} from "@/features/radar/services/calendar-alerts-service"
import { RadarDashboard } from "@/features/radar/components/RadarDashboard"

export const metadata = {
  title: "Radar Laboral & Notificaciones de Calendario | Admin La Veinte Digital",
}

export default async function AdminRadarPage() {
  const { capabilities } = await getAdminCapabilities()
  if (!capabilities.isAdmin) {
    redirect("/admin")
  }

  const initialTopics = await getAllTopics()
  const todayEvaluation = evaluateTodayCalendar()
  const upcomingEvaluations = getUpcomingCalendarAlerts(14)

  return (
    <RadarDashboard
      initialTopics={initialTopics}
      todayEvaluation={todayEvaluation}
      upcomingEvaluations={upcomingEvaluations}
    />
  )
}
