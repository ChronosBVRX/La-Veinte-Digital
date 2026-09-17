import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getUnionMemberships } from "@/features/representacion/services/permissions";
import { LicenseManager } from "@/features/representacion/components/LicenseManager";

export const dynamic = "force-dynamic";

export default async function LicenciasPage(): Promise<React.JSX.Element> {
  const m = await getUnionMemberships();
  if (m.length === 0) redirect("/");
  return (
    <div>
      <Suspense
        fallback={
          <div style={{ padding: "1.5rem", color: "var(--muted)", fontSize: "0.875rem" }}>
            Cargando módulo de licencias…
          </div>
        }
      >
        <LicenseManager />
      </Suspense>
    </div>
  );
}

