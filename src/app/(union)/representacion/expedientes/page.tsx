import { redirect } from "next/navigation";
import { getUnionMemberships } from "@/features/representacion/services/permissions";
import { UnionPageHeader } from "@/features/representacion/components/UnionPageHeader";
import { CaseBrowser } from "@/features/representacion/components/CaseBrowser";

export const dynamic = "force-dynamic";

export default async function ExpedientesPage(): Promise<React.JSX.Element> {
  const m = await getUnionMemberships();
  if (m.length === 0) redirect("/");
  return (
    <div>
      <UnionPageHeader title="Expedientes" subtitle="Folio interno XXI-AAAA-XXX-000001. Timeline sin cambios silenciosos; resoluciones externas auditadas." />
      <CaseBrowser />
    </div>
  );
}
