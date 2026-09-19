import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_RELEASE_URL =
  process.env.PRINT_AGENT_DOWNLOAD_URL ||
  "https://github.com/ChronosBVRX/La-Veinte-Digital/releases/latest/download/LaVeintePrint-Setup.exe";

export async function GET(req: Request): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const wantsJson = searchParams.get("json") === "true";

  if (wantsJson) {
    return NextResponse.json({
      name: "La Veinte Print para Windows",
      version: "1.0.0",
      platform: "win32",
      arch: "x64",
      filename: "LaVeintePrint-Setup.exe",
      download_url: DEFAULT_RELEASE_URL,
      instructions: [
        "1. Descarga LaVeintePrint-Setup.exe y ejecútalo con doble clic.",
        "2. Introduce el código de 6 dígitos generado en el portal web.",
        "3. Selecciona tu impresora y finaliza. La PC imprimirá automáticamente en segundo plano.",
      ],
    });
  }

  // Redirigir directamente al archivo ejecutable para descarga inmediata en 1 clic
  return NextResponse.redirect(DEFAULT_RELEASE_URL, 302);
}
