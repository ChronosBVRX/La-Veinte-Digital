/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/union/lockers/pendientes/route";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/shared/server/auth/require-user";
import { requireUnionMembership, requireUnionAdmin } from "@/features/representacion/services/permissions";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/shared/server/auth/require-user", () => ({
  requireUser: vi.fn(),
}));

vi.mock("@/features/representacion/services/permissions", () => ({
  requireUnionMembership: vi.fn(),
  requireUnionAdmin: vi.fn(),
}));

describe("API /api/union/lockers/pendientes (Reconciliation Cases & Transactional RPC)", () => {
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
    vi.mocked(requireUnionAdmin).mockResolvedValue(undefined as any);
  });

  it("GET: devuelve casos de conciliación agrupados con totalCases y totalReviewItems", async () => {
    const mockReviewItems = [
      {
        id: "item-1",
        delegation_id: mockDelegationId,
        locker_id: "l-547",
        locker_number: "547",
        source_batch_id: "b-1",
        source_row_number: 10,
        source_employee_number: "98178375",
        source_worker_name: "Rocío Ramírez",
        source_notes: "ACTUALIZADO 2024",
        reason: "WORKER_MULTIPLE_LOCKERS",
        status: "pending",
        created_at: "2026-09-01T00:00:00Z",
        updated_at: "2026-09-01T00:00:00Z",
      },
      {
        id: "item-2",
        delegation_id: mockDelegationId,
        locker_id: "l-625",
        locker_number: "625",
        source_batch_id: "b-1",
        source_row_number: 20,
        source_employee_number: "98178375",
        source_worker_name: "Rocío Ramírez",
        source_notes: "ACTUALIZADO 2025",
        reason: "WORKER_MULTIPLE_LOCKERS",
        status: "pending",
        created_at: "2026-09-01T00:00:00Z",
        updated_at: "2026-09-01T00:00:00Z",
      },
    ];

    const createChainable = (data: any[]) => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data, error: null }),
    });

    const mockSupabase: any = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "union_locker_review_items") return createChainable(mockReviewItems);
        if (table === "union_lockers") {
          return createChainable([
            { id: "l-547", locker_number: "547", status: "assigned", condition: "ok", zone_id: null, bank_id: null, notes: null },
            { id: "l-625", locker_number: "625", status: "available", condition: "ok", zone_id: null, bank_id: null, notes: null },
          ]);
        }
        if (table === "union_workers") {
          return createChainable([
            { id: "w-rocio", employee_number: "98178375", first_name: "Rocío", paternal_surname: "Ramírez", maternal_surname: "Cazarez" },
          ]);
        }
        return createChainable([]);
      }),
    };

    vi.mocked(createClient).mockResolvedValue(mockSupabase);

    const req = new Request(`https://la20.com.mx/api/union/lockers/pendientes?delegation_id=${mockDelegationId}`);
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.totalReviewItems).toBe(2);
    expect(json.totalCases).toBe(1);
    expect(json.cases).toHaveLength(1);
    expect(json.cases[0].type).toBe("WORKER_MULTIPLE_LOCKERS");
    expect(json.cases[0].candidates).toHaveLength(2);
    expect(json.cases[0].recommendation?.recommendedCandidateLabel).toBe("Casillero 625");
  });

  it("POST: resolve_case invoca RPC union_resolve_locker_review_case atómicamente", async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: {
        ok: true,
        action: "select_locker_for_worker",
        assignmentId: "asg-new-uuid",
        resolvedCount: 2,
      },
      error: null,
    });

    const mockSupabase: any = {
      rpc: mockRpc,
    };

    vi.mocked(createClient).mockResolvedValue(mockSupabase);

    const req = new Request(`https://la20.com.mx/api/union/lockers/pendientes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "resolve_case",
        caseType: "WORKER_MULTIPLE_LOCKERS",
        subAction: "select_locker_for_worker",
        reviewItemIds: ["99999999-9999-9999-9999-999999999991", "99999999-9999-9999-9999-999999999992"],
        selectedLockerId: "88888888-8888-8888-8888-888888888888",
        selectedWorkerId: "77777777-7777-7777-7777-777777777777",
        selectedLockerNumber: "625",
        selectedEmployeeNumber: "98178375",
        notes: "Resolución con evidencia temporal",
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(mockRpc).toHaveBeenCalledWith("union_resolve_locker_review_case", {
      p_delegation_id: mockDelegationId,
      p_case_type: "WORKER_MULTIPLE_LOCKERS",
      p_action: "select_locker_for_worker",
      p_review_item_ids: ["99999999-9999-9999-9999-999999999991", "99999999-9999-9999-9999-999999999992"],
      p_selected_locker_id: "88888888-8888-8888-8888-888888888888",
      p_selected_worker_id: "77777777-7777-7777-7777-777777777777",
      p_selected_locker_number: "625",
      p_selected_employee_number: "98178375",
      p_notes: "Resolución con evidencia temporal",
      p_user_id: "test-user-id",
    });
  });

  it("POST: batch_resolve_safe_matches invoca RPC union_batch_resolve_safe_matches", async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: {
        ok: true,
        linkedCount: 5,
        skippedCount: 0,
      },
      error: null,
    });

    const mockSupabase: any = {
      rpc: mockRpc,
    };

    vi.mocked(createClient).mockResolvedValue(mockSupabase);

    const req = new Request(`https://la20.com.mx/api/union/lockers/pendientes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "batch_resolve_safe_matches",
        matches: [
          {
            reviewItemId: "11111111-1111-1111-1111-111111111111",
            workerId: "22222222-2222-2222-2222-222222222222",
            lockerId: "33333333-3333-3333-3333-333333333333",
          },
        ],
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.linkedCount).toBe(5);
    expect(mockRpc).toHaveBeenCalledWith("union_batch_resolve_safe_matches", expect.any(Object));
  });
});
