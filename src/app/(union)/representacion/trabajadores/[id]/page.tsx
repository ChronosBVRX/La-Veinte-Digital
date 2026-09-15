import { redirect } from "next/navigation";
import Link from "next/link";
import { getUnionMemberships } from "@/features/representacion/services/permissions";
import { getUnionWorkerExpediente } from "@/features/representacion/services/worker-directory";
import { parseWorkerDirectoryReturnHref } from "@/features/representacion/lib/worker-directory-params";
import { UnionPageHeader } from "@/features/representacion/components/UnionPageHeader";
import { WorkerExpediente } from "@/features/representacion/components/workers/WorkerExpediente";
import { Card } from "@/shared/components/ui/Card";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function ExpedienteNoEncontrado({ backHref }: { backHref: string }): React.JSX.Element {
  return (
    <div>
      <UnionPageHeader title="Expediente" subtitle="Trabajador no disponible." backHref={backHref} backLabel="← Volver al directorio" />
      <Card padding="1rem">
        <p role="alert" style={{ margin: 0, fontSize: "0.875rem" }}>
          No se encontró el trabajador solicitado en esta delegación.
        </p>
        <p style={{ margin: "0.5rem 0 0", fontSize: "0.8125rem" }}>
          <Link href={backHref} style={{ color: "var(--primary)", fontWeight: 600 }}>
            Volver al directorio de trabajadores
          </Link>
        </p>
      </Card>
    </div>
  );
}

export default async function TrabajadorExpedientePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const memberships = await getUnionMemberships();
  if (memberships.length === 0) redirect("/");

  const { id } = await params;
  const sp = await searchParams;
  const volver = typeof sp.volver === "string" ? sp.volver : undefined;
  const backHref = parseWorkerDirectoryReturnHref(volver);

  const delegationId = memberships[0]?.delegation_id;
  if (!delegationId || !UUID_RE.test(id)) {
    return <ExpedienteNoEncontrado backHref={backHref} />;
  }

  const expediente = await getUnionWorkerExpediente(delegationId, id).catch(() => null);
  if (!expediente) {
    return <ExpedienteNoEncontrado backHref={backHref} />;
  }

  return (
    <div>
      <UnionPageHeader
        title="Expediente del trabajador"
        subtitle="Ficha operativa: datos laborales, trámites, documentos e historial."
        backHref={backHref}
        backLabel="← Volver al directorio"
      />
      <WorkerExpediente expediente={expediente} />
    </div>
  );
}
