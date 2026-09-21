/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCanonicalLockerSummary } from "../services/lockers-summary";
import { GET as getMap } from "@/app/api/union/lockers/map/route";
import { GET as getExport } from "@/app/api/union/lockers/export/route";
import { GET as getLockers } from "@/app/api/union/lockers/route";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/shared/server/auth/require-user";
import { requireUnionMembership } from "@/features/representacion/services/permissions";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/shared/server/auth/require-user", () => ({
  requireUser: vi.fn(),
}));

vi.mock("@/features/representacion/services/permissions", () => ({
  requireUnionMembership: vi.fn(),
}));

describe("Lockers Pagination & Canonical Metrics (>1000 records)", () => {
  const mockDelegationId = "25c737ef-7475-4515-a4b5-347a5dcf7c15";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireUser).mockResolvedValue({
      user: { id: "test-user-id" } as any,
      response: null,
    });
    vi.mocked(requireUnionMembership).mockResolvedValue([
      { id: "mem-1", delegation_id: mockDelegationId, role: "admin", active: true } as any,
    ]);
  });

  it("TEST 1201: summary.total is exactly 1201 when delegacion has 1201 physical lockers (NOT truncated to 1000)", async () => {
    const totalLockers = 1201;
    const mockLockers = Array.from({ length: totalLockers }, (_, i) => ({
      id: `locker-uuid-${i + 1}`,
      locker_number: `${i + 1}`,
      status: i < 969 ? "assigned" : "available",
      condition: "ok",
      zone_id: null,
      bank_id: null,
      row_position: null,
      column_position: null,
      position_label: null,
      sort_order: i + 1,
      physical_code: null,
      notes: null,
      maintenance_reason: null,
      maintenance_notes: null,
    }));

    const createChainable = (resolved: any) => {
      const builder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockImplementation((from: number, to: number) => {
          if (Array.isArray(resolved?.data)) {
            return Promise.resolve({ data: resolved.data.slice(from, to + 1), error: null });
          }
          return Promise.resolve(resolved);
        }),
        in: vi.fn().mockResolvedValue(resolved),
        then: (onfulfilled: any) => Promise.resolve(resolved).then(onfulfilled),
      };
      return builder;
    };

    const mockSupabase: any = {
      rpc: vi.fn().mockImplementation((fnName: string) => {
        if (fnName === "union_get_locker_summary") {
          return Promise.resolve({
            data: {
              total: 1201,
              assigned: 969,
              available: 232,
              maintenance: 0,
              blocked: 0,
              reserved: 0,
              unlocated: 1201,
              pending_review: 1899,
              pendingReview: 1899,
              affected_lockers: 842,
              affectedLockers: 842,
              issue_count: 1899,
              issueCount: 1899,
              waitlist: 0,
              waitlistCount: 0,
            },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      }),
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "union_lockers") {
          return createChainable({ data: mockLockers, error: null });
        }
        return createChainable({ data: [], error: null });
      }),
    };

    vi.mocked(createClient).mockResolvedValue(mockSupabase);

    const req = new Request(`https://la20.com.mx/api/union/lockers/map?delegation_id=${mockDelegationId}`);
    const res = await getMap(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.summary.total).toBe(1201);
    expect(json.counts.total).toBe(1201);
    expect(json.summary.unlocated).toBe(1201);
    expect(json.lockers).toHaveLength(1201);
  });

  it("TEST >1000 ASSIGNMENTS: assigned count reflects 1050 active assignments accurately", async () => {
    const totalAssignments = 1050;
    const mockSupabase: any = {
      rpc: vi.fn().mockResolvedValue({
        data: {
          total: 1201,
          assigned: totalAssignments,
          available: 1201 - totalAssignments,
          maintenance: 0,
          blocked: 0,
          reserved: 0,
          unlocated: 1201,
          pending_review: 0,
          pendingReview: 0,
          affected_lockers: 0,
          affectedLockers: 0,
          issue_count: 0,
          issueCount: 0,
          waitlist: 0,
          waitlistCount: 0,
        },
        error: null,
      }),
      from: vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: [], error: null }),
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
    };

    vi.mocked(createClient).mockResolvedValue(mockSupabase);

    const summary = await getCanonicalLockerSummary(mockSupabase, mockDelegationId);
    expect(summary.assigned).toBe(1050);
    expect(summary.total).toBe(1201);
    expect(summary.available).toBe(151);
  });

  it("TEST >1000 PENDING: pendingReview reflects 1100 items without truncation", async () => {
    const totalPending = 1100;
    const mockSupabase: any = {
      rpc: vi.fn().mockResolvedValue({
        data: {
          total: 1201,
          assigned: 969,
          available: 232,
          maintenance: 0,
          blocked: 0,
          reserved: 0,
          unlocated: 1201,
          pending_review: totalPending,
          pendingReview: totalPending,
          affected_lockers: 800,
          affectedLockers: 800,
          issue_count: totalPending,
          issueCount: totalPending,
          waitlist: 0,
          waitlistCount: 0,
        },
        error: null,
      }),
      from: vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: [], error: null }),
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
    };

    vi.mocked(createClient).mockResolvedValue(mockSupabase);

    const summary = await getCanonicalLockerSummary(mockSupabase, mockDelegationId);
    expect(summary.pendingReview).toBe(1100);
    expect(summary.issueCount).toBe(1100);
    expect(summary.affectedLockers).toBe(800);
  });

  it("EXPORT CSV: exports all 1201 lockers producing 1201 data rows (+ 1 header row)", async () => {
    const totalLockers = 1201;
    const mockLockers = Array.from({ length: totalLockers }, (_, i) => ({
      id: `locker-export-${i + 1}`,
      locker_number: `${i + 1}`,
      status: "available",
      condition: "ok",
      location: null,
      section: null,
      row_position: null,
      column_position: null,
      position_label: null,
      notes: null,
      maintenance_reason: null,
      zone_id: null,
      bank_id: null,
    }));

    const mockSupabase: any = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "union_lockers") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            range: vi.fn().mockImplementation((from: number, to: number) => {
              return Promise.resolve({
                data: mockLockers.slice(from, to + 1),
                error: null,
              });
            }),
          };
        }
        if (table === "union_locker_zones" || table === "union_locker_banks") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }
        if (table === "union_locker_assignments" || table === "union_locker_review_items") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            range: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          range: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }),
    };

    vi.mocked(createClient).mockResolvedValue(mockSupabase);

    const req = new Request(`https://la20.com.mx/api/union/lockers/export?delegation_id=${mockDelegationId}`);
    const res = await getExport(req);
    expect(res.status).toBe(200);

    const csvText = await res.text();
    const lines = csvText.trim().split("\n");

    // 1 header row + 1201 data rows = 1202 lines
    expect(lines).toHaveLength(1202);
    expect(lines[0]).toContain("Casillero");
    // Verify first data row and last data row
    expect(lines[1]).toContain('"1"');
    expect(lines[1201]).toContain('"1201"');
  });

  it("TEST INVENTORY API >1000: GET page=1&pageSize=25 returns 200, rows=25, pagination.total=1201 without 500 error", async () => {
    const totalLockers = 1201;
    const mockLockers = Array.from({ length: totalLockers }, (_, i) => ({
      id: `locker-inv-${i + 1}`,
      locker_number: `${i + 1}`,
      status: i < 969 ? "assigned" : "available",
      condition: "ok",
      physical_code: null,
      location: null,
      section: null,
      notes: null,
      maintenance_reason: null,
      maintenance_notes: null,
      updated_at: "2026-09-20T00:00:00Z",
      created_at: "2026-09-20T00:00:00Z",
      zone_id: null,
      bank_id: null,
      row_position: null,
      column_position: null,
      position_label: null,
      source: "manual",
      archived_at: null,
      archived_by: null,
      archive_reason: null,
      archive_source: null,
    }));

    const mockSupabase: any = {
      rpc: vi.fn().mockResolvedValue({
        data: {
          total: 1201,
          active_inventory: 1201,
          archived: 0,
          assigned: 969,
          available: 232,
          maintenance: 0,
          blocked: 0,
          reserved: 0,
          unlocated: 1201,
          pending_review: 58,
          pendingReview: 58,
          affected_lockers: 52,
          affectedLockers: 52,
          issue_count: 58,
          issueCount: 58,
        },
        error: null,
      }),
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "union_lockers") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            range: vi.fn().mockImplementation((from: number, to: number) => {
              return Promise.resolve({
                data: mockLockers.slice(from, to + 1),
                error: null,
              });
            }),
          };
        }
        if (table === "union_locker_zones" || table === "union_locker_banks") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }
        if (table === "union_locker_assignments" || table === "union_locker_review_items") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            range: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          range: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }),
    };

    vi.mocked(createClient).mockResolvedValue(mockSupabase);

    const req = new Request(
      `https://la20.com.mx/api/union/lockers?inventory=active&page=1&pageSize=25&delegation_id=${mockDelegationId}`
    );
    const res = await getLockers(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.lockers).toHaveLength(25);
    expect(json.pagination.total).toBe(1201);
    expect(json.pagination.page).toBe(1);
    expect(json.pagination.pageSize).toBe(25);
    expect(json.pagination.totalPages).toBe(49);
    expect(json.counts.activeInventory).toBe(1201);
    expect(json.counts.assigned).toBe(969);
    expect(json.counts.available).toBe(232);
  });

  it("TEST REVIEW ITEMS SELECT: queries source_notes and NOT the non-existent reason_details", async () => {
    let reviewItemsSelectQuery = "";

    const mockSupabase: any = {
      rpc: vi.fn().mockResolvedValue({
        data: {
          total: 10,
          active_inventory: 10,
          archived: 0,
          assigned: 5,
          available: 5,
          maintenance: 0,
          blocked: 0,
          reserved: 0,
          unlocated: 10,
          pending_review: 1,
          pendingReview: 1,
          affected_lockers: 1,
          affectedLockers: 1,
          issue_count: 1,
          issueCount: 1,
        },
        error: null,
      }),
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "union_locker_review_items") {
          return {
            select: vi.fn().mockImplementation((columns: string) => {
              reviewItemsSelectQuery = columns;
              return {
                eq: vi.fn().mockReturnThis(),
                range: vi.fn().mockResolvedValue({ data: [], error: null }),
              };
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          range: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }),
    };

    vi.mocked(createClient).mockResolvedValue(mockSupabase);

    const req = new Request(
      `https://la20.com.mx/api/union/lockers?inventory=active&page=1&pageSize=25&delegation_id=${mockDelegationId}`
    );
    const res = await getLockers(req);
    expect(res.status).toBe(200);
    expect(reviewItemsSelectQuery).toContain("source_notes");
    expect(reviewItemsSelectQuery).not.toContain("reason_details");
  });

  it("TEST ERROR HANDLING: returns 500 with sanitized error and errorCode on query failure", async () => {
    const mockSupabase: any = {
      rpc: vi.fn().mockResolvedValue({
        data: {
          total: 10,
          active_inventory: 10,
          archived: 0,
          assigned: 5,
          available: 5,
          maintenance: 0,
          blocked: 0,
          reserved: 0,
          unlocated: 10,
          pending_review: 0,
          pendingReview: 0,
          affected_lockers: 0,
          affectedLockers: 0,
          issue_count: 0,
          issueCount: 0,
        },
        error: null,
      }),
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "union_locker_review_items") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            range: vi.fn().mockResolvedValue({
              data: null,
              error: {
                code: "42703",
                message: "column union_locker_review_items.reason_details does not exist",
              },
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          range: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }),
    };

    vi.mocked(createClient).mockResolvedValue(mockSupabase);

    const req = new Request(
      `https://la20.com.mx/api/union/lockers?inventory=active&page=1&pageSize=25&delegation_id=${mockDelegationId}`
    );
    const res = await getLockers(req);
    expect(res.status).toBe(500);

    const json = await res.json();
    expect(json.error).toBe("No se pudo cargar el inventario de casilleros.");
    expect(json.errorCode).toBe("42703");
  });
});
