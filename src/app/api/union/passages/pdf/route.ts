import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/shared/server/auth/require-user";
import { requireUnionMembership } from "@/features/representacion/services/permissions";
import { buildPassageDocument } from "@/features/representacion/services/passage-document-service";
import { UnionTemplateError } from "@/features/representacion/services/union-document-template-repository";
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
    const result = await buildPassageDocument(supabase, parsed.data.case_id);

    await requireUnionMembership(result.delegationId);

    await addCaseEvent(
      result.caseId,
      "document",
      "PDF de pasaje generado",
      `Concepto 0${result.concept}. Formato oficial completado listo para revisión.`,
    );

    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err: unknown) {
    if (err instanceof UnionTemplateError) {
      if (err.code === "UNION_TEMPLATE_NOT_FOUND") {
        return NextResponse.json(
          { error: "No se encontró la plantilla oficial activa de este formato. Contacta al administrador sindical." },
          { status: 404 },
        );
      }
      return NextResponse.json(
        { error: "Error de integridad o descarga de la plantilla oficial. Contacta al administrador sindical." },
        { status: 500 },
      );
    }
    const msg = err instanceof Error ? err.message : "No se pudo generar el PDF";
    const status = msg.includes("no encontrado") ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
