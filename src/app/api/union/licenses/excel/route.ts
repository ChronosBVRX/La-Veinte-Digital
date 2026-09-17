import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/shared/server/auth/require-user";
import { requireUnionMembership } from "@/features/representacion/services/permissions";
import { buildLicenseExcelDocument } from "@/features/representacion/services/license-excel";
import { buildUnionLicenseDocumentData } from "@/features/representacion/services/license-document-dto";
import { getActiveUnionDocumentTemplate, UnionTemplateError } from "@/features/representacion/services/union-document-template-repository";
import { addCaseEvent } from "@/features/representacion/services/cases";
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

    const template = await getActiveUnionDocumentTemplate({
      delegationId: docData.delegationId,
      templateKind: "license_excel",
      supabase,
    });

    const buf = await buildLicenseExcelDocument(docData, template.buffer);

    await addCaseEvent(
      parsed.data.case_id,
      "document",
      "Excel de licencia generado",
      `Clave institucional 1A74-009-036. Plantilla v${template.record.version} (${template.record.sha256.slice(0, 8)}). Formato generado a partir de plantilla oficial conservando fórmulas, estilos y macros VBA.`,
    );

    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.ms-excel.sheet.macroEnabled.12",
        "Content-Disposition": `attachment; filename="licencia-${docData.folio}.xlsm"`,
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

    const message = err instanceof Error ? err.message : "No se pudo generar el Excel";
    const status =
      message.includes("REQUIRED") || message.includes("INVALID") || message.includes("no encontrado")
        ? 422
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
