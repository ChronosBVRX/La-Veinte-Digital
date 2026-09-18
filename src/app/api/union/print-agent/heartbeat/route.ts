import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { authenticatePrintStation } from "@/features/representacion/services/print-token";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const heartbeatSchema = z.object({
  printer_name: z.string().max(100).optional(),
  agent_version: z.string().max(30).optional(),
});

export async function POST(req: Request): Promise<NextResponse> {
  const supabase = await createClient();
  const { station, errorResponse } = await authenticatePrintStation(req, supabase);
  if (errorResponse || !station) return errorResponse!;

  try {
    const body: unknown = await req.json().catch(() => ({}));
    const parsed = heartbeatSchema.safeParse(body);

    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      null;

    const updatePayload: {
      last_seen_at: string;
      updated_at: string;
      printer_name?: string;
      agent_version?: string;
      ip_address?: string;
    } = {
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (parsed.success && parsed.data.printer_name !== undefined) {
      updatePayload.printer_name = parsed.data.printer_name.trim();
    }
    if (parsed.success && parsed.data.agent_version !== undefined) {
      updatePayload.agent_version = parsed.data.agent_version.trim();
    }
    if (clientIp) {
      updatePayload.ip_address = clientIp;
    }

    await supabase
      .from("union_print_stations")
      .update(updatePayload)
      .eq("id", station.id);

    return NextResponse.json({
      success: true,
      station_id: station.id,
      station_name: station.name,
      printer_name: parsed.success && parsed.data.printer_name ? parsed.data.printer_name : station.printer_name,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al procesar latido.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
