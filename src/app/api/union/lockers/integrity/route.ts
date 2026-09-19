import { NextResponse } from "next/server";
import { requireUser } from "@/shared/server/auth/require-user";
import { requireUnionMembership } from "@/features/representacion/services/permissions";
import { getLockerIntegrityIssues } from "@/features/representacion/services/lockers-integrity";

export const dynamic = "force-dynamic";

function noStore(res: NextResponse): NextResponse {
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

export async function GET(req: Request): Promise<NextResponse> {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const url = new URL(req.url);
  const delegationId = url.searchParams.get("delegation_id");
  const memberships = await requireUnionMembership(delegationId ?? undefined);
  const depId = delegationId ?? memberships[0]?.delegation_id;
  if (!depId) return noStore(NextResponse.json({ error: "Sin delegación" }, { status: 403 }));

  try {
    const report = await getLockerIntegrityIssues(depId);
    return noStore(NextResponse.json(report));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al evaluar integridad de casilleros";
    return noStore(NextResponse.json({ error: msg }, { status: 500 }));
  }
}
