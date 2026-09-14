import { redirect } from "next/navigation";
import { getUnionMemberships } from "@/features/representacion/services/permissions";
import { DashboardClient } from "@/features/representacion/components/DashboardClient";
import { Card } from "@/shared/components/ui/Card";

export const dynamic = "force-dynamic";

export default async function RepresentacionPage(): Promise<React.JSX.Element> {
  const memberships = await getUnionMemberships();
  if (memberships.length === 0) redirect("/");
  return (
    <div>
      <Card>
        <p style={{ margin: 0, fontSize: "0.75rem", fontWeight: 700, color: "var(--primary)", letterSpacing: "0.06em" }}>
          SNTSS · SECCIÓN XX MICHOACÁN
        </p>
        <h1 style={{ margin: "0.25rem 0", fontSize: "1.5rem", fontWeight: 800 }}>Representación Sindical</h1>
        <p style={{ margin: 0, fontSize: "0.9375rem", color: "var(--muted)" }}>
          Delegación XXI · HGR No. 1 · Turnos vespertino y nocturno
        </p>
      </Card>
      <div style={{ marginTop: "0.75rem" }}>
        <DashboardClient />
      </div>
    </div>
  );
}
