import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/shared/server/auth/require-user";
import { requireUnionMembership } from "@/features/representacion/services/permissions";
import { buildUnionLicenseDocumentData } from "@/features/representacion/services/license-document-dto";
import { buildLicensePrintPackage } from "@/features/representacion/services/license-print-package";
import { UnionTemplateError } from "@/features/representacion/services/union-document-template-repository";
import { addCaseEvent } from "@/features/representacion/services/cases";
import { markLicenseDocumentsGenerated } from "@/features/representacion/services/license-management";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({ case_id: z.string().uuid() });

export async function POST(req: Request): Promise<NextResponse> {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  try {
    const body: unknown = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "case_id inválido" }, { status: 400 });
    }

    const supabase = await createClient();
    const docData = await buildUnionLicenseDocumentData(supabase, parsed.data.case_id);

    await requireUnionMembership(docData.delegationId);

    const result = await buildLicensePrintPackage(docData, { supabase });

    await markLicenseDocumentsGenerated(parsed.data.case_id);

    // Audit event without sensitive worker data
    await addCaseEvent(
      parsed.data.case_id,
      "document",
      "Paquete de licencia generado para impresión",
      `Comité Delegacional ${docData.delegationCode}. Paquete unificado de ${result.pageCount} páginas (Oficio Word v${result.wordVersion ?? "n/a"} + Formato 1A74-009-036 v${result.excelVersion ?? "n/a"}).`,
    );

    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="expediente-licencia-${docData.folio}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err: unknown) {
    if (err instanceof UnionTemplateError) {
      const status =
        err.code === "UNION_TEMPLATE_NOT_FOUND"
          ? 404
          : err.code === "UNION_TEMPLATE_DOWNLOAD_ERROR"
            ? 502
            : 500;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }

    const message =
      err instanceof Error ? err.message : "No se pudo generar el paquete de impresión de licencia";
    const status =
      message.includes("REQUIRED") || message.includes("INVALID") || message.includes("no encontrado")
        ? 422
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
