import { NextResponse } from "next/server";
import { requireUser } from "@/shared/server/auth/require-user";
import { requireUnionAdmin, getUnionMemberships } from "@/features/representacion/services/permissions";
import { parseAndPreviewMasterImport } from "@/features/representacion/services/worker-importer/batch-executor";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB

function noStore(res: NextResponse): NextResponse {
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

export async function POST(req: Request): Promise<NextResponse> {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return noStore(
        NextResponse.json({ error: "Cuerpo de solicitud JSON inválido." }, { status: 400 })
      );
    }

    const { objectPath, fileName, fileSize, delegationId: requestedDelegationId } = body as {
      objectPath?: unknown;
      fileName?: unknown;
      fileSize?: unknown;
      delegationId?: unknown;
    };

    // 1. Validar presencia y formato de objectPath
    if (typeof objectPath !== "string" || !objectPath.trim()) {
      return noStore(
        NextResponse.json({ error: "Ruta de objeto temporal no proporcionada." }, { status: 400 })
      );
    }

    const cleanPath = objectPath.trim();

    // 2. Seguridad: Prevención estricta de Path Traversal
    if (
      cleanPath.includes("..") ||
      cleanPath.includes("//") ||
      cleanPath.includes("\\") ||
      cleanPath.startsWith("/")
    ) {
      return noStore(
        NextResponse.json({ error: "Ruta de objeto no válida o sospechosa." }, { status: 400 })
      );
    }

    if (!cleanPath.toLowerCase().endsWith(".xlsx")) {
      return noStore(
        NextResponse.json({ error: "El objeto debe tener extensión .xlsx." }, { status: 400 })
      );
    }

    // 3. Resolver y validar delegación sindical
    let delegationId = typeof requestedDelegationId === "string" ? requestedDelegationId : null;
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

    // 4. Seguridad: El objectPath DEBE pertenecer exactamente a la delegación actual y al usuario actual
    const expectedPrefix = `imports/${delegationId}/${auth.user.id}/`;
    if (!cleanPath.startsWith(expectedPrefix)) {
      return noStore(
        NextResponse.json(
          { error: "Acceso no autorizado: la ruta del archivo no coincide con su usuario o delegación." },
          { status: 403 }
        )
      );
    }

    // 5. Validar tamaño declarado si está presente
    if (typeof fileSize === "number" && fileSize > MAX_FILE_SIZE) {
      return noStore(
        NextResponse.json(
          { error: "El archivo declarado excede el límite máximo de 15 MB." },
          { status: 400 }
        )
      );
    }

    // 6. Descargar el archivo desde el bucket privado en Supabase Storage
    const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createSupabaseClient<Database>(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY,
          { auth: { persistSession: false } }
        )
      : await createServerClient();

    try {
      const { data: fileData, error: downloadError } = await supabase.storage
        .from("union-private")
        .download(cleanPath);

      if (downloadError || !fileData) {
        return noStore(
          NextResponse.json(
            {
              error: `No se pudo descargar el archivo de almacenamiento temporal: ${downloadError?.message || "Archivo no encontrado"}`,
            },
            { status: 400 }
          )
        );
      }

      // Validar tamaño real descargado
      const arrayBuffer = await fileData.arrayBuffer();
      if (arrayBuffer.byteLength > MAX_FILE_SIZE) {
        return noStore(
          NextResponse.json(
            {
              error: `El archivo descargado excede el tamaño máximo permitido de 15 MB (${(arrayBuffer.byteLength / (1024 * 1024)).toFixed(2)} MB).`,
            },
            { status: 400 }
          )
        );
      }

      const buffer = Buffer.from(arrayBuffer);

      // 7. Reutilizar SIN CAMBIAR la lógica de parsing y preview
      const preview = await parseAndPreviewMasterImport({
        fileBuffer: buffer,
        fileName: typeof fileName === "string" && fileName.trim() ? fileName.trim() : "base-sindical.xlsx",
        delegationId,
        userId: auth.user.id,
      });

      return noStore(NextResponse.json(preview));
    } finally {
      // 8. Limpieza obligatoria: Eliminar el objeto temporal de Supabase Storage para no acumular PII
      try {
        await supabase.storage.from("union-private").remove([cleanPath]);
      } catch (cleanupErr) {
        console.error("Error al eliminar objeto temporal de Storage:", cleanupErr);
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al procesar el archivo.";
    const status =
      message.includes("union_admin") || message.includes("autenticado") || message.includes("acceso")
        ? 403
        : 400;
    return noStore(NextResponse.json({ error: message }, { status }));
  }
}
