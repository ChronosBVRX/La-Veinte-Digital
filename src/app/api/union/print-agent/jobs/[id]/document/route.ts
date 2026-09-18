import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { authenticatePrintStation } from "@/features/representacion/services/print-token";
import { buildUnionLicenseDocumentData } from "@/features/representacion/services/license-document-dto";
import { buildLicensePrintPackage } from "@/features/representacion/services/license-print-package";
import crypto from "node:crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: Request,
  props: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const supabase = await createClient();
  const { station, errorResponse } = await authenticatePrintStation(req, supabase);
  if (errorResponse || !station) return errorResponse!;

  try {
    const { id: jobId } = await props.params;

    // Verificar que el trabajo pertenezca a la estación y esté en estado claimed o printing
    const { data: job, error: jobErr } = await supabase
      .from("union_print_jobs")
      .select("id, station_id, case_id, document_type, document_revision, status, document_sha256")
      .eq("id", jobId)
      .single();

    if (jobErr || !job) {
      return NextResponse.json({ error: "Trabajo no encontrado." }, { status: 404 });
    }

    if (job.station_id !== station.id) {
      return NextResponse.json({ error: "No autorizado para descargar este trabajo." }, { status: 403 });
    }

    if (job.status !== "claimed" && job.status !== "printing") {
      return NextResponse.json(
        { error: `El trabajo está en estado '${job.status}'. Solo puede descargarse tras ser reclamado.` },
        { status: 409 },
      );
    }

    if (!job.case_id) {
      return NextResponse.json({ error: "El trabajo no tiene un expediente asociado." }, { status: 422 });
    }

    // Generar o reconstruir el documento PDF conjunto correspondiente a la revisión del job
    const docData = await buildUnionLicenseDocumentData(supabase, job.case_id);
    const result = await buildLicensePrintPackage(docData, { supabase });

    const computedSha = crypto.createHash("sha256").update(result.buffer).digest("hex");

    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="job-${job.id}-rev${job.document_revision}.pdf"`,
        "Content-Length": String(result.buffer.length),
        "X-Document-SHA256": computedSha,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al descargar el documento de impresión.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
