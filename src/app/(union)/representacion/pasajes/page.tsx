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
      <UnionPageHeader
        title="Pasajes 026 / 027"
        subtitle="Prepara la solicitud con los datos del trabajador y genera el formato oficial."
      />
      <div style={{ marginTop: "-0.5rem", marginBottom: "1.25rem" }}>
        <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--muted)", fontStyle: "italic" }}>
          El sistema prepara el documento; el dictamen corresponde a la Comisión/Subcomisión.
        </p>
      </div>
      <PassageWizard />
    </div>
  );
}
