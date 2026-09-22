import { redirect } from "next/navigation";
import { getUnionMemberships } from "@/features/representacion/services/permissions";
import { UnionPageHeader } from "@/features/representacion/components/UnionPageHeader";
import { MaternidadLactanciaHub } from "@/features/representacion/components/maternity-lactation/MaternidadLactanciaHub";

export const dynamic = "force-dynamic";

export default async function MaternidadLactanciaPage(): Promise<React.JSX.Element> {
  const m = await getUnionMemberships();
  if (m.length === 0) redirect("/");

  return (
    <div>
      <UnionPageHeader
        title="Maternidad y Lactancia"
        subtitle="Acompañamiento de la trabajadora desde el inicio de su periodo de maternidad hasta la conclusión de la lactancia."
        backHref="/representacion"
        backLabel="← Representación Sindical"
      />
      <MaternidadLactanciaHub />
    </div>
  );
}
