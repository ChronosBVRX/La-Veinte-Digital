import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getUnionMemberships } from "@/features/representacion/services/permissions";
import { PrintQueueClient } from "@/features/representacion/components/PrintQueueClient";

export const dynamic = "force-dynamic";

export default async function PrintQueuePage(): Promise<React.JSX.Element> {
  const memberships = await getUnionMemberships();
  if (memberships.length === 0) redirect("/representacion");

  const currentMembership = memberships[0];
  const isAdmin = currentMembership.role === "union_admin";

  return (
    <div>
      <Suspense
        fallback={
          <div style={{ padding: "1.5rem", color: "var(--muted)", fontSize: "0.875rem" }}>
            Cargando cola de impresión…
          </div>
        }
      >
        <PrintQueueClient delegationId={currentMembership.delegation_id} isAdmin={isAdmin} />
      </Suspense>
    </div>
  );
}
