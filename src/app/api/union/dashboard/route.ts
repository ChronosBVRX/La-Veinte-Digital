import { NextResponse } from "next/server";
import { requireUser } from "@/shared/server/auth/require-user";
import { requireUnionMembership } from "@/features/representacion/services/permissions";
import { getUnionDashboardSummary } from "@/features/representacion/services/dashboard";

export const dynamic = "force-dynamic";

function noStore(res: NextResponse): NextResponse {
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

export async function GET(req: Request): Promise<NextResponse> {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const url = new URL(req.url);
  try {
    const delegationId = url.searchParams.get("delegation_id");
    const memberships = await requireUnionMembership(delegationId ?? undefined);
    const depId = delegationId ?? memberships[0]?.delegation_id;
    if (!depId) return noStore(NextResponse.json({ error: "Sin delegación" }, { status: 403 }));

    const summary = await getUnionDashboardSummary(depId);

    // Retorna el resumen completo del Centro de Control, preservando claves legadas
    return noStore(
      NextResponse.json({
        ...summary,
        // Compatibilidad hacia atrás
        pending: summary.metrics.procedures.inProgress ?? 0,
        lockersAvailable: summary.metrics.lockers.available ?? 0,
        lockersAssigned: summary.metrics.lockers.assigned ?? 0,
        lockersTotal: summary.metrics.lockers.total ?? 0,
        waitlist: summary.metrics.lockers.waitlistCount ?? 0,
        recent: summary.recentActivity,
      }),
    );
  } catch {
    return noStore(NextResponse.json({ error: "No se pudo cargar el tablero" }, { status: 500 }));
  }
}
