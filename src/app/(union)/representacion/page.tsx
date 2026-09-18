import { redirect } from "next/navigation";
import { getUnionMemberships } from "@/features/representacion/services/permissions";
import { getUnionDashboardSummary } from "@/features/representacion/services/dashboard";
import { DashboardClient } from "@/features/representacion/components/DashboardClient";

export const dynamic = "force-dynamic";

export default async function RepresentacionPage(): Promise<React.JSX.Element> {
  const memberships = await getUnionMemberships();
  if (memberships.length === 0) redirect("/");

  const delegationId = memberships[0]?.delegation_id;
  const isAdmin = memberships.some((m) => m.role === "union_admin");

  // Inyección de datos server-side tolerante a fallos: cero waterfalls, cero destello de 0 a N
  let initialData = null;
  if (delegationId) {
    try {
      initialData = await getUnionDashboardSummary(delegationId);
    } catch {
      // Fallback a hidratación en cliente si el fetch server-side se interrumpe
      initialData = null;
    }
  }

  return (
    <div style={{ width: "100%", maxWidth: "1200px", margin: "0 auto" }}>
      <DashboardClient initialData={initialData} isAdmin={isAdmin} />
    </div>
  );
}
