import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getUnionMemberships } from "@/features/representacion/services/permissions";
import { ParkingManager } from "@/features/representacion/components/parking/ParkingManager";

export const dynamic = "force-dynamic";

export default async function EstacionamientoPage(): Promise<React.JSX.Element> {
  const memberships = await getUnionMemberships();
  if (memberships.length === 0) redirect("/");

  return (
    <div>
      <Suspense
        fallback={
          <div style={{ padding: "1.5rem", color: "var(--muted)", fontSize: "0.875rem" }}>
            Cargando control de estacionamiento CAV HGR 1…
          </div>
        }
      >
        <ParkingManager />
      </Suspense>
    </div>
  );
}
