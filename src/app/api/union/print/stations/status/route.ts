import { NextResponse } from "next/server";
import { requireUser } from "@/shared/server/auth/require-user";
import { requireUnionMembership } from "@/features/representacion/services/permissions";
import { getActiveStationForDelegation, isStationOnline } from "@/features/representacion/services/print-jobs";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request): Promise<NextResponse> {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const delegationId = searchParams.get("delegation_id");

    const memberships = await requireUnionMembership(delegationId || undefined);
    const targetDelegationId = delegationId || memberships[0]?.delegation_id;

    if (!targetDelegationId) {
      return NextResponse.json({ error: "Delegación no especificada." }, { status: 400 });
    }

    const station = await getActiveStationForDelegation(targetDelegationId);
    const supabase = await createClient();

    let queuedCount = 0;
    let printingCount = 0;
    let failedCount = 0;

    if (station) {
      const { data: counts } = await supabase
        .from("union_print_jobs")
        .select("status")
        .eq("station_id", station.id)
        .in("status", ["queued", "claimed", "printing", "failed"]);

      if (counts) {
        queuedCount = counts.filter((c) => c.status === "queued").length;
        printingCount = counts.filter((c) => c.status === "claimed" || c.status === "printing").length;
        failedCount = counts.filter((c) => c.status === "failed").length;
      }
    }

    const online = station ? isStationOnline(station.last_seen_at) : false;

    return NextResponse.json({
      success: true,
      has_station: Boolean(station),
      station: station
        ? {
            id: station.id,
            name: station.name,
            printer_name: station.printer_name,
            last_seen_at: station.last_seen_at,
            is_online: online,
          }
        : null,
      queue: {
        queued_count: queuedCount,
        printing_count: printingCount,
        failed_count: failedCount,
        pending_total: queuedCount + printingCount,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al consultar estado de estación.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
