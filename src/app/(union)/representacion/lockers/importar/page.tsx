import { redirect } from "next/navigation";
import { getUnionMemberships } from "@/features/representacion/services/permissions";
import { UnionPageHeader } from "@/features/representacion/components/UnionPageHeader";
import { LockerImportWizard } from "@/features/representacion/components/worker-importer/LockerImportWizard";

export const dynamic = "force-dynamic";

export default async function ImportarLockersPage(): Promise<React.JSX.Element> {
  const memberships = await getUnionMemberships();
  const isAdmin = memberships.some((m) => m.role === "union_admin");

  if (!isAdmin) {
    redirect("/representacion/acceso-denegado");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <UnionPageHeader
        title="Actualizar base de lockers"
        subtitle="Conciliación segura del inventario de casilleros y asignaciones activas. Exclusivo para union_admin."
      />
      <LockerImportWizard />
    </div>
  );
}
