import { redirect } from "next/navigation";
import { getUnionMemberships } from "@/features/representacion/services/permissions";
import { UnionPageHeader } from "@/features/representacion/components/UnionPageHeader";
import { PassageWizard } from "@/features/representacion/components/PassageWizard";

export const dynamic = "force-dynamic";

export default async function PasajesPage(): Promise<React.JSX.Element> {
  const m = await getUnionMemberships();
  if (m.length === 0) redirect("/");
  return (
    <div>
      <UnionPageHeader title="Pasajes 026 / 027" subtitle="Prepara y valida el trámite (Cl. 103). El sistema no dictamina ni autoriza." />
      <PassageWizard />
    </div>
  );
}
