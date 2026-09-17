import { describe, expect, it, beforeEach, vi } from "vitest";
import crypto from "node:crypto";
import {
  getActiveUnionDocumentTemplate,
  clearUnionTemplateCache,
  UnionTemplateError,
} from "../services/union-document-template-repository";
import type { Database } from "@/lib/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("union-document-template-repository", () => {
  const delegationId = "25c737ef-7475-4515-a4b5-347a5dcf7c15";
  const fakeContent = Buffer.from("fake-official-template-bytes-content");
  const validSha256 = crypto.createHash("sha256").update(fakeContent).digest("hex");

  beforeEach(() => {
    clearUnionTemplateCache();
    vi.clearAllMocks();
  });

  function createMockSupabase(overrides?: {
    record?: Record<string, unknown> | null;
    queryError?: Error | null;
    downloadBlob?: Blob | null;
    downloadError?: Error | null;
  }) {
    const record =
      overrides?.record !== undefined
        ? overrides.record
        : {
            id: "template-123",
            delegation_id: delegationId,
            template_kind: "license_word",
            version: "2026.09.17-v1",
            storage_bucket: "union-private",
            storage_path: "templates/licencias/oficio/2026.09.17-v1/oficio.docx",
            mime_type:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            sha256: validSha256,
            file_size: fakeContent.length,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            created_by: null,
          };

    const downloadBlob =
      overrides?.downloadBlob !== undefined
        ? overrides.downloadBlob
        : new Blob([fakeContent]);

    const downloadFn = vi.fn().mockResolvedValue({
      data: downloadBlob,
      error: overrides?.downloadError ?? null,
    });

    const mockClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: record,
          error: overrides?.queryError ?? null,
        }),
      }),
      storage: {
        from: vi.fn().mockReturnValue({
          download: downloadFn,
        }),
      },
    } as unknown as SupabaseClient<Database>;

    return { mockClient, downloadFn };
  }

  it("successfully retrieves, verifies SHA-256 and returns template", async () => {
    const { mockClient, downloadFn } = createMockSupabase();

    const result = await getActiveUnionDocumentTemplate({
      delegationId,
      templateKind: "license_word",
      supabase: mockClient,
    });

    expect(result.record.id).toBe("template-123");
    expect(result.record.version).toBe("2026.09.17-v1");
    expect(result.buffer.equals(fakeContent)).toBe(true);
    expect(result.sha256).toBe(validSha256);
    expect(downloadFn).toHaveBeenCalledTimes(1);
  });

  it("serves subsequent requests from memory cache when sha256 matches", async () => {
    const { mockClient, downloadFn } = createMockSupabase();

    const res1 = await getActiveUnionDocumentTemplate({
      delegationId,
      templateKind: "license_word",
      supabase: mockClient,
    });
    expect(downloadFn).toHaveBeenCalledTimes(1);

    const res2 = await getActiveUnionDocumentTemplate({
      delegationId,
      templateKind: "license_word",
      supabase: mockClient,
    });
    // downloadFn must NOT be called again due to memory cache
    expect(downloadFn).toHaveBeenCalledTimes(1);
    expect(res2.sha256).toBe(res1.sha256);
    expect(res2.buffer.equals(res1.buffer)).toBe(true);
  });

  it("throws UNION_TEMPLATE_NOT_FOUND when template is not registered or active", async () => {
    const { mockClient } = createMockSupabase({ record: null });

    await expect(
      getActiveUnionDocumentTemplate({
        delegationId,
        templateKind: "license_excel",
        supabase: mockClient,
      }),
    ).rejects.toThrowError(UnionTemplateError);

    try {
      await getActiveUnionDocumentTemplate({
        delegationId,
        templateKind: "license_excel",
        supabase: mockClient,
      });
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(UnionTemplateError);
      expect((err as UnionTemplateError).code).toBe("UNION_TEMPLATE_NOT_FOUND");
    }
  });

  it("throws UNION_TEMPLATE_DOWNLOAD_ERROR when storage download fails", async () => {
    const { mockClient } = createMockSupabase({
      downloadBlob: null,
      downloadError: new Error("Storage object not accessible"),
    });

    await expect(
      getActiveUnionDocumentTemplate({
        delegationId,
        templateKind: "license_word",
        supabase: mockClient,
      }),
    ).rejects.toThrowError(UnionTemplateError);

    try {
      await getActiveUnionDocumentTemplate({
        delegationId,
        templateKind: "license_word",
        supabase: mockClient,
      });
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(UnionTemplateError);
      expect((err as UnionTemplateError).code).toBe("UNION_TEMPLATE_DOWNLOAD_ERROR");
    }
  });

  it("throws UNION_TEMPLATE_INTEGRITY_ERROR when downloaded SHA-256 does not match DB hash", async () => {
    const tamperedContent = Buffer.from("tampered-corrupted-file-bytes");
    const { mockClient } = createMockSupabase({
      downloadBlob: new Blob([tamperedContent]),
    });

    await expect(
      getActiveUnionDocumentTemplate({
        delegationId,
        templateKind: "license_word",
        supabase: mockClient,
      }),
    ).rejects.toThrowError(UnionTemplateError);

    try {
      await getActiveUnionDocumentTemplate({
        delegationId,
        templateKind: "license_word",
        supabase: mockClient,
      });
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(UnionTemplateError);
      expect((err as UnionTemplateError).code).toBe("UNION_TEMPLATE_INTEGRITY_ERROR");
      expect((err as Error).message).toContain("Violación de integridad SHA-256");
    }
  });
});
