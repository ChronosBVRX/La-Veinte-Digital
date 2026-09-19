import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getUnionMemberships } from "@/features/representacion/services/permissions";
import { LockerControlCenter } from "@/features/representacion/components/lockers/LockerControlCenter";

export const dynamic = "force-dynamic";

export default async function LockersPage(): Promise<React.JSX.Element> {
  const m = await getUnionMemberships();
  if (m.length === 0) redirect("/");
  const isAdmin = m.some((membership) => membership.role === "union_admin" || (membership.role as string) === "admin");
  return (
    <div>
      <Suspense
        fallback={
          <div style={{ padding: "1.5rem", color: "var(--muted)", fontSize: "0.875rem" }}>
            Cargando centro de casilleros…
          </div>
        }
      >
        <LockerControlCenter isAdmin={isAdmin} />
      </Suspense>
    </div>
  );
}
