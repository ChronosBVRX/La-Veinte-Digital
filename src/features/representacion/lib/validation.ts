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
  locker_number: z.string().trim().min(1).max(20),
  location: z.string().trim().max(160).default(""),
  section: z.string().trim().max(80).default(""),
  notes: z.string().trim().max(500).default(""),
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
