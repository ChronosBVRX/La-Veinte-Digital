import { redirect } from "next/navigation";
import { getUnionMemberships } from "@/features/representacion/services/permissions";
import { UnionPageHeader } from "@/features/representacion/components/UnionPageHeader";
import { MaternityTool } from "@/features/representacion/components/MaternityTool";

export const dynamic = "force-dynamic";

export default async function MaternidadPage(): Promise<React.JSX.Element> {
  const m = await getUnionMemberships();
  if (m.length === 0) redirect("/");
  return (
    <div>
      <UnionPageHeader
        title="Maternidad"
        subtitle="90 días naturales desde la incapacidad (Cl. 77). Cálculo administrativo orientativo."
        backHref="/representacion/maternidad-lactancia"
        backLabel="← Maternidad y Lactancia"
      />
      <MaternityTool />
    </div>
  );
}
