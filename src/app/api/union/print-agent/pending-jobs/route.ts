import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { authenticatePrintStation } from "@/features/representacion/services/print-token";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request): Promise<NextResponse> {
  const supabase = await createClient();
  const { station, errorResponse } = await authenticatePrintStation(req, supabase);
  if (errorResponse || !station) return errorResponse!;

  try {
    const { data: jobs, error } = await supabase
      .from("union_print_jobs")
      .select(`
        id,
        station_id,
        case_id,
        document_type,
        document_revision,
        status,
        copies,
        duplex,
        document_sha256,
        document_size_bytes,
        created_at,
        union_cases (
          folio
        )
      `)
      .eq("station_id", station.id)
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(20);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const formatted = (jobs || []).map((raw) => {
      const j = raw as unknown as {
        id: string;
        case_id: string | null;
        document_type: string;
        document_revision: number;
        status: string;
        copies: number;
        duplex: boolean;
        document_sha256: string | null;
        document_size_bytes: number | null;
        created_at: string;
        union_cases?: { folio: string } | null;
      };
      return {
        id: j.id,
        case_id: j.case_id,
        folio: j.union_cases?.folio || null,
        document_type: j.document_type,
        document_revision: j.document_revision,
        status: j.status,
        copies: j.copies,
        duplex: j.duplex,
        document_sha256: j.document_sha256,
        document_size_bytes: j.document_size_bytes,
        created_at: j.created_at,
      };
    });

    return NextResponse.json({
      success: true,
      station_id: station.id,
      count: formatted.length,
      jobs: formatted,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al obtener trabajos pendientes.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
