"use client";

import { createClient } from "@/lib/supabase/client";

export async function readApiResponse<T = unknown>(res: Response): Promise<T> {
  const contentType = res.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      throw new Error((data.error as string) ?? `Error HTTP ${res.status}`);
    }
    return data as T;
  }

  const text = await res.text();

  if (res.status === 413) {
    throw new Error(
      "No se pudo procesar el archivo porque es demasiado grande para el método de carga actual."
    );
  }

  throw new Error(text || `Error HTTP ${res.status}`);
}

export async function secureUnionExcelUpload(params: {
  file: File;
  uploadUrlEndpoint: string;
  onStageChange?: (msg: string) => void;
}): Promise<{ objectPath: string; fileName: string; fileSize: number }> {
  const { file, uploadUrlEndpoint, onStageChange } = params;

  // 1. Solicitar autorización de subida firmada
  onStageChange?.("Solicitando autorización de carga segura...");
  const uploadUrlRes = await fetch(uploadUrlEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      fileSize: file.size,
    }),
  });

  const uploadInfo = await readApiResponse<{
    objectPath: string;
    signedUrl: string;
    token: string;
  }>(uploadUrlRes);

  // 2. Subida directa a Supabase Storage (bucket privado union-private)
  onStageChange?.("Subiendo archivo a almacenamiento seguro...");
  const supabase = createClient();
  if (supabase.storage?.from) {
    const { error: uploadError } = await supabase.storage
      .from("union-private")
      .uploadToSignedUrl(uploadInfo.objectPath, uploadInfo.token, file);

    if (uploadError) {
      throw new Error(`Error al subir archivo a almacenamiento seguro: ${uploadError.message}`);
    }
  } else {
    // Fallback estándar
    const form = new FormData();
    form.append("cacheControl", "3600");
    form.append("", file);
    const putRes = await fetch(uploadInfo.signedUrl, {
      method: "POST",
      body: form,
    });
    if (!putRes.ok) {
      throw new Error(`Error al subir archivo a almacenamiento (HTTP ${putRes.status})`);
    }
  }

  return {
    objectPath: uploadInfo.objectPath,
    fileName: file.name,
    fileSize: file.size,
  };
}
