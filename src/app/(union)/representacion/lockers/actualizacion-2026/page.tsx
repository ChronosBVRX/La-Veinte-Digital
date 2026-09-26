import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getUnionMemberships } from "@/features/representacion/services/permissions";
import { LockerRenewalWizard } from "@/features/representacion/components/lockers/LockerRenewalWizard";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ locker_id?: string }>;
}

export default async function LockerActualizacionPage({
  searchParams,
}: Props): Promise<React.JSX.Element> {
  const m = await getUnionMemberships();
  if (m.length === 0) redirect("/");

  const resolvedParams = await searchParams;
  const initialLockerId = resolvedParams.locker_id || null;

  return (
    <div>
      <Suspense
        fallback={
          <div style={{ padding: "1.5rem", color: "var(--muted)", fontSize: "0.875rem" }}>
            Cargando programa de actualización de casilleros 2026…
          </div>
        }
      >
        <LockerRenewalWizard initialLockerId={initialLockerId} />
      </Suspense>
    </div>
  );
}
