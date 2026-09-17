import { NextResponse } from "next/server";
import { requireUser } from "@/shared/server/auth/require-user";
import { requireUnionAdmin, getUnionMemberships } from "@/features/representacion/services/permissions";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export const MAX_EXCEL_FILE_SIZE = 15 * 1024 * 1024; // 15 MB

function noStore(res: NextResponse): NextResponse {
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

export async function handleUnionExcelUploadUrlRequest(req: Request): Promise<NextResponse> {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return noStore(
        NextResponse.json({ error: "Cuerpo de solicitud inválido." }, { status: 400 })
      );
    }

    const { fileName, fileSize, delegationId: requestedDelegationId } = body as {
      fileName?: unknown;
      fileSize?: unknown;
      delegationId?: unknown;
    };

    // 1. Validar nombre y extensión .xlsx
    if (typeof fileName !== "string" || !fileName.trim()) {
      return noStore(
        NextResponse.json({ error: "Nombre de archivo requerido." }, { status: 400 })
      );
    }
    const cleanFileName = fileName.trim();
    if (!cleanFileName.toLowerCase().endsWith(".xlsx")) {
      return noStore(
        NextResponse.json(
          { error: "Solo se admiten archivos en formato Excel estándar (.xlsx)." },
          { status: 400 }
        )
      );
    }

    // 2. Validar tamaño máximo (15 MB)
    if (typeof fileSize !== "number" || fileSize <= 0) {
      return noStore(
        NextResponse.json({ error: "Tamaño de archivo inválido." }, { status: 400 })
      );
    }
    if (fileSize > MAX_EXCEL_FILE_SIZE) {
      return noStore(
        NextResponse.json(
          {
            error: `El archivo excede el tamaño máximo permitido de 15 MB (${(fileSize / (1024 * 1024)).toFixed(2)} MB).`,
          },
          { status: 400 }
        )
      );
    }

    // 3. Localizar delegación y validar rol union_admin
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

    // 4. Generar UUID seguro y construir objectPath acotado a la delegación y usuario
    const uploadId = crypto.randomUUID();
    const objectPath = `imports/${delegationId}/${auth.user.id}/${uploadId}.xlsx`;

    // 5. Generar signed upload URL en Supabase Storage (bucket union-private)
    const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createSupabaseClient<Database>(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY,
          { auth: { persistSession: false } }
        )
      : await createServerClient();

    const { data, error } = await supabase.storage
      .from("union-private")
      .createSignedUploadUrl(objectPath, { upsert: true });

    if (error || !data) {
      return noStore(
        NextResponse.json(
          { error: `Error al generar autorización de subida: ${error?.message || "Desconocido"}` },
          { status: 500 }
        )
      );
    }

    return noStore(
      NextResponse.json({
        objectPath,
        signedUrl: data.signedUrl,
        token: data.token,
      })
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al procesar la solicitud.";
    const status =
      message.includes("union_admin") || message.includes("autenticado") || message.includes("acceso")
        ? 403
        : 400;
    return noStore(NextResponse.json({ error: message }, { status }));
  }
}

export async function downloadAndValidateUnionExcel(params: {
  objectPath: string;
  delegationId: string;
  userId: string;
  expectedSize?: number;
}): Promise<{ buffer: Buffer; cleanUp: () => Promise<void> }> {
  const { objectPath, delegationId, userId, expectedSize } = params;

  const cleanPath = objectPath.trim();

  // Prevención estricta de Path Traversal
  if (
    cleanPath.includes("..") ||
    cleanPath.includes("//") ||
    cleanPath.includes("\\") ||
    cleanPath.startsWith("/")
  ) {
    throw new Error("Ruta de objeto no válida o sospechosa.");
  }

  if (!cleanPath.toLowerCase().endsWith(".xlsx")) {
    throw new Error("El objeto debe tener extensión .xlsx.");
  }

  // Verificar que el objectPath pertenezca a la delegación y usuario
  const expectedPrefix = `imports/${delegationId}/${userId}/`;
  if (!cleanPath.startsWith(expectedPrefix)) {
    throw new Error("Acceso no autorizado: la ruta del archivo no coincide con su usuario o delegación.");
  }

  if (typeof expectedSize === "number" && expectedSize > MAX_EXCEL_FILE_SIZE) {
    throw new Error("El archivo declarado excede el límite máximo de 15 MB.");
  }

  const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createSupabaseClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false } }
      )
    : await createServerClient();

  const { data: fileData, error: downloadError } = await supabase.storage
    .from("union-private")
    .download(cleanPath);

  if (downloadError || !fileData) {
    throw new Error(`No se pudo descargar el archivo de almacenamiento temporal: ${downloadError?.message || "Archivo no encontrado"}`);
  }

  const arrayBuffer = await fileData.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_EXCEL_FILE_SIZE) {
    throw new Error(`El archivo descargado excede el tamaño máximo permitido de 15 MB (${(arrayBuffer.byteLength / (1024 * 1024)).toFixed(2)} MB).`);
  }

  const buffer = Buffer.from(arrayBuffer);

  const cleanUp = async () => {
    try {
      await supabase.storage.from("union-private").remove([cleanPath]);
    } catch (cleanupErr) {
      console.error("Error al eliminar objeto temporal de Storage:", cleanupErr);
    }
  };

  return { buffer, cleanUp };
}
