import { redirect } from "next/navigation";
import { getUnionMemberships } from "@/features/representacion/services/permissions";
import { UnionPageHeader } from "@/features/representacion/components/UnionPageHeader";
import { WorkerImportWizard } from "@/features/representacion/components/worker-importer/WorkerImportWizard";

export const dynamic = "force-dynamic";

export default async function ImportarTrabajadoresPage(): Promise<React.JSX.Element> {
  const memberships = await getUnionMemberships();
  const isAdmin = memberships.some((m) => m.role === "union_admin");

  if (!isAdmin) {
    redirect("/representacion/acceso-denegado");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <UnionPageHeader
        title="Actualizar base de trabajadores"
        subtitle="Conciliación segura y no destructiva del padrón laboral institucional. Exclusivo para union_admin."
      />
      <WorkerImportWizard format="SIAP" />
    </div>
  );
}
