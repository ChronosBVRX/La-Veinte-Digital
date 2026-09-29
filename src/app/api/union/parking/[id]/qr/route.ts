import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/shared/server/auth/require-user";
import { requireUnionMembership } from "@/features/representacion/services/permissions";
import {
  dispatchCavBridgeCommand,
  fetchCavQrPdfBuffer,
} from "@/features/representacion/services/parking/cav-hgr1-client";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  try {
    const { id } = await context.params;
    const url = new URL(req.url);
    const delegationId = url.searchParams.get("delegation_id");
    const memberships = await requireUnionMembership(delegationId ?? undefined);
    const depId = delegationId ?? memberships[0]?.delegation_id;
    if (!depId) {
      return NextResponse.json({ error: "Sin delegación" }, { status: 403 });
    }

    const supabase = await createClient();
    let externalIdReg = Number(id);
    if (!Number.isFinite(externalIdReg) || externalIdReg <= 0) {
      const { data: rec } = await supabase
        .from("union_parking_records")
        .select("external_id_reg")
        .eq("id", id)
        .eq("delegation_id", depId)
        .maybeSingle();

      if (!rec || rec.external_id_reg <= 0) {
        return NextResponse.json(
          { error: "No se encontró el identificador CAV del registro para generar el QR" },
          { status: 404 },
        );
      }
      externalIdReg = rec.external_id_reg;
    }

    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await fetchCavQrPdfBuffer(externalIdReg);
    } catch {
      const bridgeRes = await dispatchCavBridgeCommand<{ pdf_base64?: string }>(supabase, {
        delegationId: depId,
        action: "download_qr",
        payload: { external_id_reg: externalIdReg },
        userId: auth.user.id,
        timeoutMs: 12_000,
        leaveQueuedOnTimeout: false,
      });

      if (!bridgeRes.executedLive || !bridgeRes.result?.pdf_base64) {
        return NextResponse.json(
          {
            error: "No se pudo obtener el tarjetón QR en tiempo real. Verifique que La Veinte Print v1.1.0 esté activo en la PC de la oficina.",
          },
          { status: 502 },
        );
      }
      pdfBuffer = Buffer.from(bridgeRes.result.pdf_base64, "base64");
    }

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="tarjeton-qr-hgr1-${externalIdReg}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        error: `No se pudo descargar el tarjetón QR desde CAV HGR 1 (11.1.17.44:8080). (${message})`,
      },
      { status: 502 },
    );
  }
}

