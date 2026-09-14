import { redirect } from "next/navigation";
import { getUnionMemberships } from "@/features/representacion/services/permissions";
import { UnionPageHeader } from "@/features/representacion/components/UnionPageHeader";
import { LockerBoard } from "@/features/representacion/components/LockerBoard";
import { WaitlistPanel } from "@/features/representacion/components/WaitlistPanel";

export const dynamic = "force-dynamic";

export default async function LockersPage(): Promise<React.JSX.Element> {
  const m = await getUnionMemberships();
  if (m.length === 0) redirect("/");
  return (
    <div>
      <UnionPageHeader title="Lockers" subtitle="Asignación, liberación e historial. Liberar cierra la asignación, no borra historial." />
      <LockerBoard />
      <div style={{ marginTop: "0.75rem" }}>
        <WaitlistPanel />
      </div>
    </div>
  );
}
