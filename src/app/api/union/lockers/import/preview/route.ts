import { NextResponse } from "next/server";
import { requireUser } from "@/shared/server/auth/require-user";
import { requireUnionAdmin, getUnionMemberships } from "@/features/representacion/services/permissions";
import { parseAndPreviewLockerImport } from "@/features/representacion/services/worker-importer/locker-importer";
import { downloadAndValidateUnionExcel } from "@/features/representacion/services/worker-importer/upload-helper";

export const dynamic = "force-dynamic";

function noStore(res: NextResponse): NextResponse {
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

export async function POST(req: Request): Promise<NextResponse> {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  try {
    const contentType = req.headers.get("content-type") ?? "";
    let delegationId: string | null = null;
    let fileBuffer: Buffer | null = null;
    let fileName = "lockers.xlsx";
    let cleanUpFn: (() => Promise<void>) | null = null;

    if (contentType.includes("application/json")) {
      const body = (await req.json().catch(() => null)) as {
        objectPath?: string;
        fileName?: string;
        fileSize?: number;
        delegationId?: string;
      } | null;

      if (!body || !body.objectPath) {
        return noStore(
          NextResponse.json({ error: "Ruta de objeto temporal no proporcionada." }, { status: 400 })
        );
      }

      delegationId = body.delegationId ?? null;
      if (!delegationId) {
        const memberships = await getUnionMemberships();
        const adminMembership = memberships.find((m) => m.role === "union_admin");
        delegationId = adminMembership?.delegation_id ?? null;
      }

      if (!delegationId) {
        return noStore(
          NextResponse.json({ error: "No se identificó la delegación sindical." }, { status: 400 })
        );
      }

      await requireUnionAdmin(delegationId);

      const downloaded = await downloadAndValidateUnionExcel({
        objectPath: body.objectPath,
        delegationId,
        userId: auth.user.id,
        expectedSize: body.fileSize,
      });

      fileBuffer = downloaded.buffer;
      cleanUpFn = downloaded.cleanUp;
      if (body.fileName?.trim()) {
        fileName = body.fileName.trim();
      }
    } else {
      // multipart/form-data fallback
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      delegationId = formData.get("delegation_id") as string | null;

      if (!delegationId) {
        const memberships = await getUnionMemberships();
        const adminMembership = memberships.find((m) => m.role === "union_admin");
        delegationId = adminMembership?.delegation_id ?? null;
      }

      if (!delegationId) {
        return noStore(
          NextResponse.json({ error: "No se identificó la delegación sindical." }, { status: 400 })
        );
      }

      await requireUnionAdmin(delegationId);

      if (!file) {
        return noStore(
          NextResponse.json({ error: "No se proporcionó ningún archivo para procesar." }, { status: 400 })
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);
      fileName = file.name;
    }

    try {
      const preview = await parseAndPreviewLockerImport({
        fileBuffer,
        fileName,
        delegationId,
        userId: auth.user.id,
      });

      return noStore(NextResponse.json(preview));
    } finally {
      if (cleanUpFn) {
        await cleanUpFn();
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al procesar el archivo de lockers.";
    const status =
      message.includes("union_admin") || message.includes("autenticado") || message.includes("acceso")
        ? 403
        : 400;
    return noStore(NextResponse.json({ error: message }, { status }));
  }
}
