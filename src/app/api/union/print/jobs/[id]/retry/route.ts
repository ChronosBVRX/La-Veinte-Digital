import { NextResponse } from "next/server";
import { requireUser } from "@/shared/server/auth/require-user";
import { requireUnionMembership } from "@/features/representacion/services/permissions";
import { retryPrintJob } from "@/features/representacion/services/print-jobs";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  _req: Request,
  props: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  try {
    const { id } = await props.params;
    if (!id) {
      return NextResponse.json({ error: "ID de trabajo no proporcionado." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: job } = await supabase.from("union_print_jobs").select("delegation_id").eq("id", id).single();
    if (!job) {
      return NextResponse.json({ error: "Trabajo no encontrado." }, { status: 404 });
    }

    await requireUnionMembership(job.delegation_id);

    const updated = await retryPrintJob(id, auth.user.id);
    return NextResponse.json({ success: true, job: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al reintentar el trabajo de impresión.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
