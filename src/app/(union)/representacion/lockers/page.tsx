import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getUnionMemberships } from "@/features/representacion/services/permissions";
import { LockerBoard } from "@/features/representacion/components/LockerBoard";
import { WaitlistPanel } from "@/features/representacion/components/WaitlistPanel";

export const dynamic = "force-dynamic";

export default async function LockersPage(): Promise<React.JSX.Element> {
  const m = await getUnionMemberships();
  if (m.length === 0) redirect("/");
  return (
    <div>
      <Suspense
        fallback={
          <div style={{ padding: "1.5rem", color: "var(--muted)", fontSize: "0.875rem" }}>
            Cargando casilleros…
          </div>
        }
      >
        <LockerBoard />
      </Suspense>
      <div style={{ marginTop: "1.5rem" }}>
        <WaitlistPanel />
      </div>
    </div>
  );
}
