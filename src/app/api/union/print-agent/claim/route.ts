import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { authenticatePrintStation } from "@/features/representacion/services/print-token";
import { addCaseEvent } from "@/features/representacion/services/cases";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const claimSchema = z.object({
  job_id: z.string().uuid(),
});

export async function POST(req: Request): Promise<NextResponse> {
  const supabase = await createClient();
  const { station, errorResponse } = await authenticatePrintStation(req, supabase);
  if (errorResponse || !station) return errorResponse!;

  try {
    const body: unknown = await req.json();
    const parsed = claimSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "job_id inválido." }, { status: 400 });
    }

    const jobId = parsed.data.job_id;

    // Ejecutar reclamo atómico mediante RPC si está disponible o UPDATE condicional con row-locking
    let claimed = false;
    let claimedJob: {
      id?: string;
      job_id?: string;
      case_id?: string | null;
      document_type?: string;
      document_revision?: number;
      copies?: number;
      duplex?: boolean;
    } | null = null;

    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc("claim_print_job", {
        p_job_id: jobId,
        p_station_id: station.id,
      });

      if (!rpcErr && rpcRes && rpcRes.length > 0 && rpcRes[0].claimed) {
        claimed = true;
        claimedJob = rpcRes[0];
      }
    } catch {
      claimed = false;
    }

    // Fallback directo tolerante por si la migración de la función aún está propagándose
    if (!claimed) {
      const { data: directUpdated, error: directErr } = await supabase
        .from("union_print_jobs")
        .update({
          status: "claimed",
          claimed_at: new Date().toISOString(),
        })
        .eq("id", jobId)
        .eq("station_id", station.id)
        .eq("status", "queued")
        .select("id, case_id, document_type, document_revision, copies, duplex")
        .maybeSingle();

      if (!directErr && directUpdated) {
        claimed = true;
        claimedJob = directUpdated;
      }
    }

    if (!claimed || !claimedJob) {
      return NextResponse.json({
        success: true,
        claimed: false,
        message: "El trabajo ya no está disponible en cola o ya fue reclamado por otra instancia.",
      });
    }

    // Si tiene caso asociado, registrar evento de auditoría
    if (claimedJob.case_id) {
      await addCaseEvent(
        claimedJob.case_id,
        "document",
        "Trabajo reclamado por estación de impresión",
        `La estación "${station.name}" reclamó el trabajo de impresión para procesamiento.`,
      );
    }

    return NextResponse.json({
      success: true,
      claimed: true,
      job: claimedJob,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al reclamar trabajo.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
