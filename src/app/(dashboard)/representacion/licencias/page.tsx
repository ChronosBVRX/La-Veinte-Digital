import { redirect } from "next/navigation";
import { getUnionMemberships } from "@/features/representacion/services/permissions";
import { UnionPageHeader } from "@/features/representacion/components/UnionPageHeader";
import { LicenseWizard } from "@/features/representacion/components/LicenseWizard";

export const dynamic = "force-dynamic";

export default async function LicenciasPage(): Promise<React.JSX.Element> {
  const m = await getUnionMemberships();
  if (m.length === 0) redirect("/");
  return (
    <div>
      <UnionPageHeader title="Licencias" subtitle="Una sola captura → Excel 1A74-009-036 + oficio Word. El software genera y controla, no concede." />
      <LicenseWizard />
    </div>
  );
}
