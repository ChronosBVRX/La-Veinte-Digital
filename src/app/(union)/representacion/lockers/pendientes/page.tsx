import { redirect } from "next/navigation";
import { getUnionMemberships } from "@/features/representacion/services/permissions";
import { UnionPageHeader } from "@/features/representacion/components/UnionPageHeader";
import { LockerPendingReviewList } from "@/features/representacion/components/LockerPendingReviewList";

export const dynamic = "force-dynamic";

export default async function LockerPendientesPage(): Promise<React.JSX.Element> {
  const m = await getUnionMemberships();
  if (m.length === 0) redirect("/");

  return (
    <div>
      <UnionPageHeader
        title="Pendientes de lockers"
        subtitle="Registros con datos por vincular o inconsistencias para resolver progresivamente."
      />
      <LockerPendingReviewList />
    </div>
  );
}
