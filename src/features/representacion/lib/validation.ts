// Validación rigurosa con Zod (frontend + server comparten estos esquemas).

import { z } from "zod";

export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (yyyy-mm-dd)");

export const workerSchema = z.object({
  employee_number: z.string().trim().min(1, "Matrícula requerida").max(20, "Matrícula demasiado larga"),
  first_name: z.string().trim().min(1, "Nombre requerido").max(80),
  paternal_surname: z.string().trim().min(1, "Apellido paterno requerido").max(80),
  maternal_surname: z.string().trim().max(80).default(""),
  category: z.string().trim().min(1, "Categoría requerida").max(120),
  assignment: z.string().trim().min(1, "Adscripción requerida").max(160),
  turn: z.string().trim().min(1, "Turno requerido").max(40),
  schedule: z.string().trim().max(60).default(""),
  rest_days: z.string().trim().max(60).default(""),
  phone: z.string().trim().max(20).default(""),
  notes: z.string().trim().max(1000).default(""),
});

export const maternityInputSchema = z.object({
  worker_id: z.string().uuid(),
  incapacity_start: isoDateSchema,
  notes: z.string().max(1000).default(""),
});

export const lactationInputSchema = z.object({
  worker_id: z.string().uuid(),
  return_to_work: isoDateSchema,
  workday_type: z.enum(["8h", "lte6_5h", "accumulated"]),
  selected_modality: z.string().max(80).default(""),
  notes: z.string().max(1000).default(""),
});

export const passageAddressSchema = z.object({
  street: z.string().trim().max(160).default(""),
  neighborhood: z.string().trim().max(120).default(""),
  postalCode: z.string().trim().max(12).default(""),
  municipality: z.string().trim().max(120).default(""),
  state: z.string().trim().max(80).default(""),
});

export const passage026Schema = z.object({
  worker_id: z.string().uuid(),
  ooad: z.string().trim().min(1).max(160),
  request_date: isoDateSchema,
  control_number: z.string().trim().max(40).default(""),
  extramural_functions: z.string().trim().min(1).max(500),
  transfer_period: z.string().trim().min(1).max(200),
  observations: z.string().trim().max(1000).default(""),
});

export const passage027Schema = z.object({
  worker_id: z.string().uuid(),
  ooad: z.string().trim().min(1).max(160),
  request_date: isoDateSchema,
  control_number: z.string().trim().max(40).default(""),
  discontinuous_schedule: z.enum(["Si", "No"]),
  worker_address: passageAddressSchema,
  assignment_address: passageAddressSchema,
  phone: z.string().trim().max(20).default(""),
  observations: z.string().trim().max(1000).default(""),
});

export const licenseInputSchema = z
  .object({
    worker_id: z.string().uuid(),
    with_pay: z.boolean(),
    start_date: isoDateSchema,
    end_date: isoDateSchema,
    previous_license_start: isoDateSchema.optional().or(z.literal("")),
    previous_license_end: isoDateSchema.optional().or(z.literal("")),
    is_extension: z.boolean().default(false),
    reason: z.string().trim().min(1, "Motivo requerido").max(500),
    proof_description: z.string().trim().max(300).default(""),
    debt_control_required: z.boolean().default(false),
    notes: z.string().trim().max(1000).default(""),
  })
  .refine((v) => v.end_date >= v.start_date, {
    message: "La fecha de término debe ser igual o posterior al inicio.",
    path: ["end_date"],
  });

export const lockerCreateSchema = z.object({
  locker_number: z.string().trim().min(1, "El identificador es obligatorio").max(20),
  physical_code: z.string().trim().max(50).optional().nullable(),
  zone_id: z.string().uuid().optional().nullable(),
  bank_id: z.string().uuid().optional().nullable(),
  row_position: z.number().int().min(1).optional().nullable(),
  column_position: z.number().int().min(1).optional().nullable(),
  position_label: z.string().trim().max(50).optional().nullable(),
  condition: z.enum(["ok", "maintenance", "blocked", "damaged"]).default("ok"),
  location: z.string().trim().max(160).default(""),
  section: z.string().trim().max(80).default(""),
  notes: z.string().trim().max(500).default(""),
});

export const lockerUpdateSchema = z.object({
  locker_id: z.string().uuid(),
  locker_number: z.string().trim().min(1, "El identificador es obligatorio").max(20),
  physical_code: z.string().trim().max(50).optional().nullable(),
  zone_id: z.string().uuid().optional().nullable(),
  bank_id: z.string().uuid().optional().nullable(),
  row_position: z.number().int().min(1).optional().nullable(),
  column_position: z.number().int().min(1).optional().nullable(),
  position_label: z.string().trim().max(50).optional().nullable(),
  condition: z.enum(["ok", "maintenance", "blocked", "damaged"]).optional(),
  maintenance_reason: z.string().trim().max(500).optional().nullable(),
  notes: z.string().trim().max(500).optional(),
  renumber_reason: z.string().trim().max(500).optional(),
});

export const lockerArchiveSchema = z.object({
  locker_id: z.string().uuid(),
  reason: z.string().trim().min(1, "El motivo de retiro es obligatorio").max(500),
});

export const lockerRestoreSchema = z.object({
  locker_id: z.string().uuid(),
});

export const lockerDeleteUnusedSchema = z
  .object({
    locker_id: z.string().uuid(),
    confirm_number: z.string().trim().min(1, "Escribe el número del casillero para confirmar").optional(),
    confirm_locker_number: z.string().trim().min(1, "Escribe el número del casillero para confirmar").optional(),
  })
  .refine((data) => Boolean(data.confirm_number || data.confirm_locker_number), {
    message: "Escribe el número del casillero para confirmar",
    path: ["confirm_number"],
  })
  .transform((data) => ({
    locker_id: data.locker_id,
    confirm_number: (data.confirm_number || data.confirm_locker_number)!,
  }));

export const lockerBulkActionSchema = z
  .object({
    locker_ids: z.array(z.string().uuid()).min(1, "Selecciona al menos un casillero"),
    bulk_action: z.enum(["assign_zone", "assign_bank", "set_condition", "archive_empty"]).optional(),
    action: z.string().optional(),
    params: z.record(z.string(), z.unknown()).default({}),
    zone_id: z.string().uuid().optional().nullable(),
    bank_id: z.string().uuid().optional().nullable(),
    condition: z.enum(["ok", "maintenance", "blocked", "damaged"]).optional(),
    maintenance_reason: z.string().optional(),
    archive_reason: z.string().optional(),
  })
  .transform((data) => {
    let bulkAction = data.bulk_action;
    if (!bulkAction) {
      if (data.zone_id !== undefined) bulkAction = "assign_zone";
      else if (data.bank_id !== undefined) bulkAction = "assign_bank";
      else if (data.condition !== undefined) bulkAction = "set_condition";
      else if (data.archive_reason !== undefined) bulkAction = "archive_empty";
      else if (data.action && ["assign_zone", "assign_bank", "set_condition", "archive_empty"].includes(data.action)) {
        bulkAction = data.action as "assign_zone" | "assign_bank" | "set_condition" | "archive_empty";
      } else {
        bulkAction = "assign_zone";
      }
    }
    const params = { ...data.params };
    if (data.zone_id !== undefined) params.zone_id = data.zone_id;
    if (data.bank_id !== undefined) params.bank_id = data.bank_id;
    if (data.condition !== undefined) params.condition = data.condition;
    if (data.maintenance_reason !== undefined) params.maintenance_reason = data.maintenance_reason;
    if (data.archive_reason !== undefined) params.reason = data.archive_reason;

    return {
      locker_ids: data.locker_ids,
      action: bulkAction,
      bulk_action: bulkAction,
      params,
    };
  });

export const caseStatusSchema = z.enum([
  "draft",
  "ready",
  "submitted",
  "under_review",
  "approved",
  "rejected",
  "completed",
  "cancelled",
  "archived",
]);

export type WorkerInput = z.infer<typeof workerSchema>;
export type LicenseInput = z.infer<typeof licenseInputSchema>;
