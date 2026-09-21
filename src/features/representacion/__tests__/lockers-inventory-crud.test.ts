import { describe, expect, it } from "vitest";
import { normalizeLockerNumber } from "@/features/representacion/lib/lockers";
import {
  lockerCreateSchema,
  lockerUpdateSchema,
  lockerArchiveSchema,
  lockerRestoreSchema,
  lockerDeleteUnusedSchema,
  lockerBulkActionSchema,
} from "@/features/representacion/lib/validation";

describe("Locker Physical Inventory CRUD & Governance", () => {
  describe("1. Normalization & Canonical Identity (Preserves Suffixes)", () => {
    it("preserves alphanumeric suffixes like 200-B and 427-B", () => {
      expect(normalizeLockerNumber("200-B")).toBe("200-B");
      expect(normalizeLockerNumber("427-B")).toBe("427-B");
      expect(normalizeLockerNumber("12-A")).toBe("12-A");
    });

    it("strips leading zeros while keeping the suffix intact", () => {
      expect(normalizeLockerNumber("00200-B")).toBe("200-B");
      expect(normalizeLockerNumber("01-A")).toBe("1-A");
    });

    it("canonicalizes case and spacing for duplicate prevention", () => {
      const canonical = normalizeLockerNumber("200-B");
      expect(normalizeLockerNumber(" 200-b ")).toBe(canonical);
      expect(normalizeLockerNumber("200 - B")).toBe(canonical);
      expect(normalizeLockerNumber("200 - b")).toBe(canonical);
    });

    it("distinguishes locker 200 from locker 200-B as separate physical entities", () => {
      expect(normalizeLockerNumber("200")).toBe("200");
      expect(normalizeLockerNumber("200-B")).toBe("200-B");
      expect(normalizeLockerNumber("200")).not.toBe(normalizeLockerNumber("200-B"));
    });
  });

  describe("2. Creation Validation (Zero Worker Selection on Creation)", () => {
    it("accepts valid physical creation payload without worker", () => {
      const parsed = lockerCreateSchema.safeParse({
        action: "create",
        locker_number: "247-B",
        physical_code: "C-247-B",
        zone_id: "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
        condition: "ok",
        notes: "Casillero nuevo instalado en pasillo",
      });

      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.locker_number).toBe("247-B");
        expect(parsed.data.condition).toBe("ok");
      }
    });

    it("rejects empty or whitespace-only locker numbers", () => {
      const parsed = lockerCreateSchema.safeParse({
        action: "create",
        locker_number: "   ",
      });
      expect(parsed.success).toBe(false);
    });

    it("validates allowed physical condition values", () => {
      const okParsed = lockerCreateSchema.safeParse({
        action: "create",
        locker_number: "100",
        condition: "ok",
      });
      expect(okParsed.success).toBe(true);

      const maintParsed = lockerCreateSchema.safeParse({
        action: "create",
        locker_number: "101",
        condition: "maintenance",
        maintenance_reason: "Chapa rota",
      });
      expect(maintParsed.success).toBe(true);

      const invalidParsed = lockerCreateSchema.safeParse({
        action: "create",
        locker_number: "102",
        condition: "unknown_status",
      });
      expect(invalidParsed.success).toBe(false);
    });
  });

  describe("3. Edit & Renumbering (Preserves UUID, Requires Audit)", () => {
    it("allows updating physical attributes without renumbering", () => {
      const parsed = lockerUpdateSchema.safeParse({
        action: "update",
        locker_id: "550e8400-e29b-41d4-a716-446655440000",
        locker_number: "247-B",
        physical_code: "PLACA-247B",
        row_position: 2,
        column_position: 3,
        condition: "ok",
      });

      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.renumber_reason).toBeUndefined();
      }
    });

    it("accepts renumbering with audit reason", () => {
      const parsed = lockerUpdateSchema.safeParse({
        action: "update",
        locker_id: "550e8400-e29b-41d4-a716-446655440000",
        locker_number: "247-C",
        renumber_reason: "Corrección física de numeración por rotulación nueva",
      });

      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.locker_number).toBe("247-C");
        expect(parsed.data.renumber_reason).toBe(
          "Corrección física de numeración por rotulación nueva"
        );
      }
    });
  });

  describe("4. Archive & Restore Validation", () => {
    it("validates archive request requiring a non-empty reason", () => {
      const valid = lockerArchiveSchema.safeParse({
        action: "archive",
        locker_id: "550e8400-e29b-41d4-a716-446655440000",
        reason: "Mueble desmantelado para remodelación",
      });
      expect(valid.success).toBe(true);

      const invalidEmptyReason = lockerArchiveSchema.safeParse({
        action: "archive",
        locker_id: "550e8400-e29b-41d4-a716-446655440000",
        reason: "  ",
      });
      expect(invalidEmptyReason.success).toBe(false);
    });

    it("validates restore request with valid locker UUID", () => {
      const valid = lockerRestoreSchema.safeParse({
        action: "restore",
        locker_id: "550e8400-e29b-41d4-a716-446655440000",
      });
      expect(valid.success).toBe(true);

      const invalidId = lockerRestoreSchema.safeParse({
        action: "restore",
        locker_id: "not-a-uuid",
      });
      expect(invalidId.success).toBe(false);
    });
  });

  describe("5. Hard Delete Safety Restrictions", () => {
    it("requires exact locker confirmation string matching", () => {
      const valid = lockerDeleteUnusedSchema.safeParse({
        action: "delete_unused",
        locker_id: "550e8400-e29b-41d4-a716-446655440000",
        confirm_locker_number: "247-B",
      });
      expect(valid.success).toBe(true);

      const missingConfirm = lockerDeleteUnusedSchema.safeParse({
        action: "delete_unused",
        locker_id: "550e8400-e29b-41d4-a716-446655440000",
        confirm_locker_number: "   ",
      });
      expect(missingConfirm.success).toBe(false);
    });
  });

  describe("6. Bulk Action Validation", () => {
    it("validates bulk zone assignment on a set of lockers", () => {
      const parsed = lockerBulkActionSchema.safeParse({
        action: "bulk_update",
        locker_ids: [
          "550e8400-e29b-41d4-a716-446655440001",
          "550e8400-e29b-41d4-a716-446655440002",
        ],
        zone_id: "550e8400-e29b-41d4-a716-446655440003",
      });
      expect(parsed.success).toBe(true);
    });

    it("validates bulk condition change with reason", () => {
      const parsed = lockerBulkActionSchema.safeParse({
        action: "bulk_update",
        locker_ids: ["550e8400-e29b-41d4-a716-446655440001"],
        condition: "maintenance",
        maintenance_reason: "Fumigación de bloque",
      });
      expect(parsed.success).toBe(true);
    });

    it("rejects bulk actions with empty locker list", () => {
      const parsed = lockerBulkActionSchema.safeParse({
        action: "bulk_update",
        locker_ids: [],
        condition: "ok",
      });
      expect(parsed.success).toBe(false);
    });
  });
});
