import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { authenticatePrintStation } from "@/features/representacion/services/print-token";
import { buildUnionLicenseDocumentData } from "@/features/representacion/services/license-document-dto";
import { buildLicensePrintPackage } from "@/features/representacion/services/license-print-package";

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
      .select("id, station_id, case_id, document_type, document_revision, status, document_sha256, document_size_bytes, document_storage_path")
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

    // Cliente privilegiado server-only para recuperar del bucket privado union-private tras validar Station Token
    const storageClient =
      process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL
        ? createSupabaseClient<Database>(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY,
            { auth: { persistSession: false, autoRefreshToken: false } },
          )
        : supabase;

    // 1. Jobs con PDF almacenado inmutable (modelo estándar)
    if (job.document_storage_path) {
      const { data: blob, error: dlErr } = await storageClient.storage
        .from("union-private")
        .download(job.document_storage_path);

      if (dlErr || !blob) {
        return NextResponse.json(
          { error: `Error al recuperar el documento desde almacenamiento: ${dlErr?.message || "Archivo no disponible"}` },
          { status: 500 },
        );
      }

      const arrayBuffer = await blob.arrayBuffer();
      const pdfBuffer = Buffer.from(arrayBuffer);
      const computedSha = crypto.createHash("sha256").update(pdfBuffer).digest("hex");

      // Validar integridad estricta del hash
      if (job.document_sha256 && computedSha.toLowerCase() !== job.document_sha256.toLowerCase()) {
        return NextResponse.json(
          {
            error: "DOCUMENT_INTEGRITY_MISMATCH",
            detail: "El checksum SHA-256 del documento almacenado no coincide con el registrado en la cola.",
          },
          { status: 422 },
        );
      }

      // Validar tamaño si está registrado
      if (job.document_size_bytes && pdfBuffer.length !== job.document_size_bytes) {
        return NextResponse.json(
          {
            error: "DOCUMENT_INTEGRITY_MISMATCH",
            detail: "El tamaño del documento almacenado no coincide con el registrado en la cola.",
          },
          { status: 422 },
        );
      }

      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="job-${job.id}-rev${job.document_revision}.pdf"`,
          "Content-Length": String(pdfBuffer.length),
          "X-Document-SHA256": computedSha,
          "Cache-Control": "private, no-store",
        },
      });
    }

    // 2. Retrocompatibilidad para jobs legacy sin document_storage_path
    if (!job.case_id) {
      return NextResponse.json({ error: "El trabajo no tiene un expediente asociado." }, { status: 422 });
    }

    if (job.document_type === "license_package") {
      const docData = await buildUnionLicenseDocumentData(supabase, job.case_id);
      const result = await buildLicensePrintPackage(docData, { supabase });
      const computedSha = crypto.createHash("sha256").update(result.buffer).digest("hex");

      if (job.document_sha256 && computedSha.toLowerCase() !== job.document_sha256.toLowerCase()) {
        return NextResponse.json(
          {
            error: "LEGACY_DOCUMENT_CHANGED",
            detail: "Los datos del expediente han cambiado desde la creación del trabajo legacy. Genera una nueva impresión.",
          },
          { status: 422 },
        );
      }

      // Materializar en union-private para futuros accesos
      const storagePath = `print-jobs/${docData.delegationId}/${job.case_id}/${job.id}.pdf`;
      try {
        await storageClient.storage
          .from("union-private")
          .upload(storagePath, result.buffer, { contentType: "application/pdf", upsert: true });

        await supabase
          .from("union_print_jobs")
          .update({
            document_storage_path: storagePath,
            document_size_bytes: result.buffer.length,
            document_sha256: computedSha,
          })
          .eq("id", job.id);
      } catch {
        // Ignorar fallas al materializar el fallback legacy
      }

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
    }

    return NextResponse.json(
      {
        error: "DOCUMENT_NOT_STORED",
        detail: "El trabajo no cuenta con archivo almacenado y no es reconstruible.",
      },
      { status: 422 },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al descargar el documento de impresión.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
