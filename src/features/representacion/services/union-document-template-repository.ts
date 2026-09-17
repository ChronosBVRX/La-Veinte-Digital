import crypto from "node:crypto";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

export type UnionDocumentTemplateKind =
  | "license_word"
  | "license_excel"
  | "license_word_print"
  | "license_excel_print"
  | "passage_026"
  | "passage_027";

export interface UnionDocumentTemplateRecord {
  id: string;
  delegation_id: string;
  template_kind: string;
  version: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string;
  sha256: string;
  file_size: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface ResolvedUnionTemplate {
  record: UnionDocumentTemplateRecord;
  buffer: Buffer;
  sha256: string;
}

export type UnionTemplateErrorCode =
  | "UNION_TEMPLATE_NOT_FOUND"
  | "UNION_TEMPLATE_DOWNLOAD_ERROR"
  | "UNION_TEMPLATE_INTEGRITY_ERROR";

export class UnionTemplateError extends Error {
  readonly code: UnionTemplateErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    code: UnionTemplateErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "UnionTemplateError";
    this.code = code;
    this.details = details;
  }
}

interface CacheEntry {
  buffer: Buffer;
  sha256: string;
  cachedAt: number;
}

// Caché en memoria para evitar descargas redundantes en workers concurrentes
const templateCache = new Map<string, CacheEntry>();

export function clearUnionTemplateCache(): void {
  templateCache.clear();
}

async function resolveSupabaseClient(
  client?: SupabaseClient<Database>,
): Promise<SupabaseClient<Database>> {
  if (client) return client;

  if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return createSupabaseClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }

  return await createClient();
}

export interface GetActiveTemplateOptions {
  delegationId: string;
  templateKind: UnionDocumentTemplateKind;
  supabase?: SupabaseClient<Database>;
}

/**
 * Obtiene la plantilla activa oficial para una delegación y tipo de documento.
 * Consulta la base de datos para la versión activa, descarga el binario de Supabase Storage,
 * y verifica de forma estricta su integridad SHA-256 antes de devolverlo.
 */
export async function getActiveUnionDocumentTemplate(
  options: GetActiveTemplateOptions,
): Promise<ResolvedUnionTemplate> {
  const { delegationId, templateKind } = options;
  const client = await resolveSupabaseClient(options.supabase);

  // 1. Consultar registro activo en union_document_templates
  const { data: record, error: queryError } = await client
    .from("union_document_templates")
    .select("*")
    .eq("delegation_id", delegationId)
    .eq("template_kind", templateKind)
    .eq("is_active", true)
    .maybeSingle();

  if (queryError) {
    throw new UnionTemplateError(
      "UNION_TEMPLATE_DOWNLOAD_ERROR",
      `Error al consultar plantilla activa (${templateKind}): ${queryError.message}`,
      { queryError },
    );
  }

  if (!record) {
    throw new UnionTemplateError(
      "UNION_TEMPLATE_NOT_FOUND",
      `No se encontró ninguna plantilla activa para el tipo "${templateKind}" en la delegación ${delegationId}.`,
      { delegationId, templateKind },
    );
  }

  const typedRecord = record as UnionDocumentTemplateRecord;
  const cacheKey = `${typedRecord.storage_bucket}:${typedRecord.storage_path}:${typedRecord.sha256}`;

  // 2. Verificar caché en memoria
  const cached = templateCache.get(cacheKey);
  if (cached && cached.sha256 === typedRecord.sha256) {
    return {
      record: typedRecord,
      buffer: cached.buffer,
      sha256: cached.sha256,
    };
  }

  // 3. Descargar desde Supabase Storage
  const { data: blob, error: downloadError } = await client.storage
    .from(typedRecord.storage_bucket)
    .download(typedRecord.storage_path);

  if (downloadError || !blob) {
    throw new UnionTemplateError(
      "UNION_TEMPLATE_DOWNLOAD_ERROR",
      `Error al descargar la plantilla desde Storage (${typedRecord.storage_bucket}/${typedRecord.storage_path}): ${downloadError?.message ?? "Archivo vacío"}`,
      { bucket: typedRecord.storage_bucket, path: typedRecord.storage_path, downloadError },
    );
  }

  const arrayBuffer = await blob.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // 4. Verificación criptográfica estricta de SHA-256
  const computedSha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  if (computedSha256.toLowerCase() !== typedRecord.sha256.toLowerCase()) {
    throw new UnionTemplateError(
      "UNION_TEMPLATE_INTEGRITY_ERROR",
      `Violación de integridad SHA-256 en plantilla "${templateKind}" (v${typedRecord.version}). Esperado: ${typedRecord.sha256}, Calculado: ${computedSha256}`,
      {
        expectedSha256: typedRecord.sha256,
        computedSha256,
        templateKind,
        version: typedRecord.version,
      },
    );
  }

  // 5. Guardar en caché y retornar
  templateCache.set(cacheKey, {
    buffer,
    sha256: computedSha256,
    cachedAt: Date.now(),
  });

  return {
    record: typedRecord,
    buffer,
    sha256: computedSha256,
  };
}
