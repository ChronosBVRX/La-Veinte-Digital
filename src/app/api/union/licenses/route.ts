import { NextResponse } from "next/server";
import { requireUser } from "@/shared/server/auth/require-user";
import { requireUnionMembership } from "@/features/representacion/services/permissions";
import {
  saveLicenseDraft,
  updateCompletedLicense,
  getLicenseCaseDetail,
  listLicenseCases,
  softDeleteLicenseCase,
  ConcurrencyConflictError,
} from "@/features/representacion/services/license-management";
import { z } from "zod";

export const dynamic = "force-dynamic";

function noStore(res: NextResponse): NextResponse {
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

const draftBodySchema = z.object({
  case_id: z.string().uuid().optional().nullable(),
  worker_id: z.string().uuid().optional().nullable(),
  current_step: z.number().int().min(1).max(3).optional(),
  with_pay: z.boolean().optional(),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  is_extension: z.boolean().optional(),
  previous_start_date: z.string().optional().nullable(),
  previous_end_date: z.string().optional().nullable(),
  reason: z.string().optional().nullable(),
  proof_description: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  delegation_id: z.string().uuid().optional(),
});

const patchBodySchema = z.object({
  case_id: z.string().uuid(),
  expected_revision: z.number().int().min(1),
  change_summary: z.string().max(300).optional(),
  worker_id: z.string().uuid().optional(),
  with_pay: z.boolean(),
  start_date: z.string().min(1, "Fecha de inicio requerida"),
  end_date: z.string().min(1, "Fecha de término requerida"),
  is_extension: z.boolean().optional(),
  previous_start_date: z.string().optional().nullable(),
  previous_end_date: z.string().optional().nullable(),
  reason: z.string().min(1, "Motivo requerido"),
  proof_description: z.string().optional(),
  notes: z.string().optional(),
});

const deleteBodySchema = z.object({
  case_id: z.string().uuid(),
});

export async function GET(req: Request): Promise<NextResponse> {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const url = new URL(req.url);
  const caseId = url.searchParams.get("case_id");

  try {
    if (caseId) {
      // Consulta de detalle de un expediente individual
      const detail = await getLicenseCaseDetail(caseId, {
        includeDeleted: url.searchParams.get("include_deleted") === "true",
      });
      await requireUnionMembership(detail.delegationId);
      return noStore(NextResponse.json({ case: detail }));
    }

    // Consulta de listado de expedientes con filtros
    const delegationIdParam = url.searchParams.get("delegation_id");
    const memberships = await requireUnionMembership(delegationIdParam ?? undefined);
    const delegationId = delegationIdParam ?? memberships[0]?.delegation_id;
    if (!delegationId) {
      return noStore(NextResponse.json({ error: "Sin delegación asignada" }, { status: 403 }));
    }

    const statusFilter = url.searchParams.get("status") ?? "all";
    const searchQuery = url.searchParams.get("search") ?? "";
    const limit = url.searchParams.get("limit") ? parseInt(url.searchParams.get("limit")!, 10) : 50;
    const offset = url.searchParams.get("offset") ? parseInt(url.searchParams.get("offset")!, 10) : 0;

    const result = await listLicenseCases({
      delegationId,
      status: statusFilter,
      search: searchQuery,
      limit,
      offset,
    });

    return noStore(NextResponse.json(result));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al consultar expedientes";
    const status = message.includes("Sin acceso") ? 403 : message.includes("no encontrado") ? 404 : 500;
    return noStore(NextResponse.json({ error: message }, { status }));
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  try {
    const rawBody: unknown = await req.json();
    const parsed = draftBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return noStore(NextResponse.json({ error: "Datos de borrador inválidos", issues: parsed.error.issues }, { status: 400 }));
    }

    const data = parsed.data;
    const memberships = await requireUnionMembership(data.delegation_id);
    const delegationId = data.delegation_id ?? memberships[0]?.delegation_id;
    const delegationCode = memberships.find((m) => m.delegation_id === delegationId)?.delegation_code ?? "XXI";

    if (!delegationId) {
      return noStore(NextResponse.json({ error: "Sin delegación autorizada" }, { status: 403 }));
    }

    const result = await saveLicenseDraft({
      delegationId,
      delegationCode,
      userId: auth.user.id,
      caseId: data.case_id,
      workerId: data.worker_id,
      currentStep: data.current_step,
      withPay: data.with_pay,
      startDate: data.start_date,
      endDate: data.end_date,
      isExtension: data.is_extension,
      previousStartDate: data.previous_start_date,
      previousEndDate: data.previous_end_date,
      reason: data.reason,
      proofDescription: data.proof_description,
      notes: data.notes,
      phone: data.phone,
    });

    return noStore(NextResponse.json(result));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "No se pudo guardar el borrador";
    const status = message.includes("Sin acceso") ? 403 : 500;
    return noStore(NextResponse.json({ error: message }, { status }));
  }
}

export async function PATCH(req: Request): Promise<NextResponse> {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  try {
    const rawBody: unknown = await req.json();
    const parsed = patchBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return noStore(NextResponse.json({ error: "Datos de actualización inválidos", issues: parsed.error.issues }, { status: 400 }));
    }

    const data = parsed.data;
    // Resolver delegación desde el caso para no confiar en el cliente
    const detail = await getLicenseCaseDetail(data.case_id);
    await requireUnionMembership(detail.delegationId);

    const result = await updateCompletedLicense({
      caseId: data.case_id,
      userId: auth.user.id,
      expectedRevision: data.expected_revision,
      changeSummary: data.change_summary,
      workerId: data.worker_id,
      withPay: data.with_pay,
      startDate: data.start_date,
      endDate: data.end_date,
      isExtension: data.is_extension,
      previousStartDate: data.previous_start_date,
      previousEndDate: data.previous_end_date,
      reason: data.reason,
      proofDescription: data.proof_description,
      notes: data.notes,
    });

    return noStore(NextResponse.json(result));
  } catch (err: unknown) {
    if (err instanceof ConcurrencyConflictError) {
      return noStore(NextResponse.json({ error: err.message, code: err.code }, { status: 409 }));
    }
    const message = err instanceof Error ? err.message : "Error al actualizar la licencia";
    const status = message.includes("Sin acceso") ? 403 : message.includes("no encontrado") ? 404 : 500;
    return noStore(NextResponse.json({ error: message }, { status }));
  }
}

export async function DELETE(req: Request): Promise<NextResponse> {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  try {
    const rawBody: unknown = await req.json();
    const parsed = deleteBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return noStore(NextResponse.json({ error: "case_id requerido" }, { status: 400 }));
    }

    // Resolver delegación para autorización estricta
    const detail = await getLicenseCaseDetail(parsed.data.case_id);
    await requireUnionMembership(detail.delegationId);

    await softDeleteLicenseCase(parsed.data.case_id, auth.user.id);

    return noStore(NextResponse.json({ success: true, caseId: parsed.data.case_id }));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al eliminar el expediente";
    const status = message.includes("Sin acceso") ? 403 : message.includes("no encontrado") ? 404 : 500;
    return noStore(NextResponse.json({ error: message }, { status }));
  }
}
