import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import { validateExcelSecurity } from "@/features/representacion/services/worker-importer/excel-security";
import { parseAndPreviewLockerImport } from "@/features/representacion/services/worker-importer/locker-importer";

// Mock Supabase Server Client
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/features/representacion/services/audit", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

import { createClient } from "@/lib/supabase/server";

describe("Real Workbook Test: Copia de Copia de Copia de LOKER 2025.xlsx", () => {
  const realFilePath = "D:/Copia de Copia de Copia de LOKER 2025.xlsx";
  const fileExists = fs.existsSync(realFilePath);
  const testReal = fileExists ? it : it.skip;

  testReal("extracts and validates real workbook security metrics", () => {
    const buffer = fs.readFileSync(realFilePath);
    const fileName = "Copia de Copia de Copia de LOKER 2025.xlsx";
    console.log("=== 1. ARCHIVO REAL INFORMACIÓN ===");
    console.log("Compressed size:", buffer.length, "bytes (", (buffer.length / (1024 * 1024)).toFixed(2), "MB)");

    let eocdOffset = -1;
    for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
      if (buffer[i] === 0x50 && buffer[i + 1] === 0x4b && buffer[i + 2] === 0x05 && buffer[i + 3] === 0x06) {
        eocdOffset = i;
        break;
      }
    }
    const cdOffset = buffer.readUInt32LE(eocdOffset + 16);
    let curr = cdOffset;
    let totalUncompressed = 0;
    const entries: Array<{ name: string; comp: number; uncomp: number; ratio: number }> = [];

    while (curr + 46 <= buffer.length) {
      if (buffer.readUInt32LE(curr) !== 0x02014b50) break;
      const compSize = buffer.readUInt32LE(curr + 20);
      const uncompSize = buffer.readUInt32LE(curr + 24);
      const fnLen = buffer.readUInt16LE(curr + 28);
      const exLen = buffer.readUInt16LE(curr + 30);
      const cmLen = buffer.readUInt16LE(curr + 32);
      const name = buffer.toString("utf8", curr + 46, curr + 46 + fnLen);
      totalUncompressed += uncompSize;
      const ratio = compSize > 0 ? uncompSize / compSize : 0;
      entries.push({ name, comp: compSize, uncomp: uncompSize, ratio });
      curr += 46 + fnLen + exLen + cmLen;
    }

    entries.sort((a, b) => b.uncomp - a.uncomp);
    const largestEntry = entries[0];
    const largestRatioEntry = [...entries].sort((a, b) => b.ratio - a.ratio)[0];

    console.log("Largest entry:", largestEntry.name);
    console.log("Largest entry size:", (largestEntry.uncomp / (1024 * 1024)).toFixed(2), "MB");
    console.log("Total uncompressed:", (totalUncompressed / (1024 * 1024)).toFixed(2), "MB");
    console.log("Largest ratio:", largestRatioEntry.ratio.toFixed(1) + ":1 (" + largestRatioEntry.name + ")");

    const secResult = validateExcelSecurity(buffer, fileName);
    console.log("Security Result:", secResult.valid ? "PASS" : "FAIL");
    expect(secResult.valid).toBe(true);
  });

  testReal("parses real workbook into locker preview without errors", async () => {
    const buffer = fs.readFileSync(realFilePath);
    const fileName = "Copia de Copia de Copia de LOKER 2025.xlsx";
    const mockBatchId = "11111111-1111-1111-1111-111111111111";
    const mockSupabase = {
      from: (table: string) => {
        if (table === "union_workers") {
          return {
            select: () => ({
              eq: () => Promise.resolve({ data: [], error: null }),
            }),
          };
        }
        if (table === "union_lockers") {
          return {
            select: () => ({
              eq: () => Promise.resolve({ data: [], error: null }),
            }),
          };
        }
        if (table === "union_locker_assignments") {
          return {
            select: () => ({
              eq: () => ({
                is: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          };
        }
        if (table === "union_worker_import_batches") {
          return {
            insert: () => ({
              select: () => ({
                single: () => Promise.resolve({ data: { id: mockBatchId }, error: null }),
              }),
            }),
            update: () => ({
              eq: () => Promise.resolve({ data: null, error: null }),
            }),
          };
        }
        if (table === "union_worker_import_rows" || table === "union_locker_import_source_rows") {
          return {
            insert: () => Promise.resolve({ error: null }),
          };
        }
        return {
          select: () => Promise.resolve({ data: [], error: null }),
        };
      },
    };

    vi.mocked(createClient).mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>);

    const preview = await parseAndPreviewLockerImport({
      fileBuffer: buffer,
      fileName,
      delegationId: "00000000-0000-0000-0000-000000000000",
      userId: "00000000-0000-0000-0000-000000000000",
    });

    console.log("\n=== LOCKER PREVIEW RESULTS ===");
    console.log("Locker Preview: PASS");
    console.log("Total rows in file:", preview.summary.totalRows);
    console.log("Lockers detected:", preview.summary.lockersDetected);
    console.log("Unique physical lockers:", preview.summary.uniquePhysicalLockers);
    console.log("Safe direct assignments:", preview.summary.safeAssignmentsCount);
    console.log("Lockers without worker:", preview.summary.lockersWithoutWorkerCount);
    console.log("Historical superseded:", preview.summary.historicalSupersededCount);
    console.log("Real conflicts:", preview.summary.realConflictsCount);
    console.log("Mathematical account:", preview.summary.totalRowsAccounted);

    expect(preview.batchId).toBe(mockBatchId);
    expect(preview.summary.totalRows).toBeGreaterThan(0);
    expect(preview.rows.length).toBe(preview.summary.totalRows);
  }, 60000);
});
