import { redirect } from "next/navigation";
import { getUnionMemberships } from "@/features/representacion/services/permissions";
import { UnionPageHeader } from "@/features/representacion/components/UnionPageHeader";
import { AdminPanel } from "@/features/representacion/components/AdminPanel";

export const dynamic = "force-dynamic";

export default async function AdministracionPage(): Promise<React.JSX.Element> {
  const m = await getUnionMemberships();
  if (m.length === 0) redirect("/");
  const isAdmin = m.some((membership) => membership.role === "union_admin");
  if (!isAdmin) redirect("/representacion/acceso-denegado");
  return (
    <div>
      <UnionPageHeader title="Administración" subtitle="Configuración del Comité XXI, miembros habilitados y auditoría. Solo union_admin modifica." />
      <AdminPanel />
    </div>
  );
}
