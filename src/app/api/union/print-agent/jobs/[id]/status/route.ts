import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { authenticatePrintStation } from "@/features/representacion/services/print-token";
import { addCaseEvent } from "@/features/representacion/services/cases";
import { getPrintableDocumentLabel } from "@/features/representacion/services/print-document-registry";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const statusSchema = z.object({
  status: z.enum(["printing", "printed", "failed"]),
  error_code: z.string().max(50).optional(),
  error_message: z.string().max(300).optional(),
});

function getPrintedEventTitle(documentType: string): string {
  switch (documentType) {
    case "license_package":
      return "Licencia impresa en oficina";
    case "passage_026":
      return "Pasaje 026 impreso en oficina";
    case "passage_027":
      return "Pasaje 027 impreso en oficina";
    default:
      return `${getPrintableDocumentLabel(documentType)} impreso en oficina`;
  }
}

function getFailedEventTitle(documentType: string): string {
  switch (documentType) {
    case "license_package":
      return "Fallo de impresión de Licencia";
    case "passage_026":
      return "Fallo de impresión de Pasaje 026";
    case "passage_027":
      return "Fallo de impresión de Pasaje 027";
    default:
      return `Fallo de impresión de ${getPrintableDocumentLabel(documentType)}`;
  }
}

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const supabase = await createClient();
  const { station, errorResponse } = await authenticatePrintStation(req, supabase);
  if (errorResponse || !station) return errorResponse!;

  try {
    const { id: jobId } = await props.params;
    const body: unknown = await req.json();
    const parsed = statusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos de estado inválidos." }, { status: 400 });
    }

    const { data: job, error: jobErr } = await supabase
      .from("union_print_jobs")
      .select("id, station_id, case_id, document_type, document_revision, status")
      .eq("id", jobId)
      .single();

    if (jobErr || !job) {
      return NextResponse.json({ error: "Trabajo no encontrado." }, { status: 404 });
    }

    if (job.station_id !== station.id) {
      return NextResponse.json({ error: "No autorizado para modificar este trabajo." }, { status: 403 });
    }

    const nowIso = new Date().toISOString();
    const updatePayload: {
      status: string;
      printing_at?: string;
      printed_at?: string;
      failed_at?: string;
      error_code?: string;
      error_message?: string;
    } = {
      status: parsed.data.status,
    };

    if (parsed.data.status === "printing") {
      updatePayload.printing_at = nowIso;
    } else if (parsed.data.status === "printed") {
      updatePayload.printed_at = nowIso;
    } else if (parsed.data.status === "failed") {
      updatePayload.failed_at = nowIso;
      updatePayload.error_code = parsed.data.error_code || "PRINT_ERROR";
      updatePayload.error_message = parsed.data.error_message || "Error al enviar a impresora.";
    }

    const { data: updated, error: updateErr } = await supabase
      .from("union_print_jobs")
      .update(updatePayload)
      .eq("id", jobId)
      .select("*")
      .single();

    if (updateErr || !updated) {
      return NextResponse.json({ error: updateErr?.message || "Error al actualizar estado." }, { status: 500 });
    }

    // Registrar evento de auditoría en el historial del expediente (generalizado por tipo documental)
    if (job.case_id) {
      if (parsed.data.status === "printed") {
        await addCaseEvent(
          job.case_id,
          "document",
          getPrintedEventTitle(job.document_type),
          `Expediente impreso exitosamente en la estación "${station.name}" (${station.printer_name || "Impresora predeterminada"}).`,
        );
      } else if (parsed.data.status === "failed") {
        await addCaseEvent(
          job.case_id,
          "document",
          getFailedEventTitle(job.document_type),
          `Error en estación "${station.name}": ${parsed.data.error_message || "Sin detalle"}.`,
        );
      }
    }

    return NextResponse.json({
      success: true,
      job: updated,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al actualizar el estado del trabajo.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
