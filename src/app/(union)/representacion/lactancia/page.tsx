import { redirect } from "next/navigation";
import { getUnionMemberships } from "@/features/representacion/services/permissions";
import { UnionPageHeader } from "@/features/representacion/components/UnionPageHeader";
import { LactationTool } from "@/features/representacion/components/LactationTool";

export const dynamic = "force-dynamic";

export default async function LactanciaPage(): Promise<React.JSX.Element> {
  const m = await getUnionMemberships();
  if (m.length === 0) redirect("/");
  return (
    <div>
      <UnionPageHeader
        title="Lactancia"
        subtitle="365 días desde la reanudación (Cl. 77). Modalidad sujeta a acuerdo cuando aplique."
        backHref="/representacion/maternidad-lactancia"
        backLabel="← Maternidad y Lactancia"
      />
      <LactationTool />
    </div>
  );
}
