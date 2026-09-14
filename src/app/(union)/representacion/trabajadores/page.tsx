import { redirect } from "next/navigation";
import { getUnionMemberships } from "@/features/representacion/services/permissions";
import { UnionPageHeader } from "@/features/representacion/components/UnionPageHeader";
import { WorkersManager } from "@/features/representacion/components/WorkersManager";

export const dynamic = "force-dynamic";

export default async function TrabajadoresPage(): Promise<React.JSX.Element> {
  const m = await getUnionMemberships();
  if (m.length === 0) redirect("/");
  return (
    <div>
      <UnionPageHeader title="Trabajadores" subtitle="Padrón por delegación. Busca por matrícula o nombre; el alta alimenta todos los trámites." />
      <WorkersManager />
    </div>
  );
}
