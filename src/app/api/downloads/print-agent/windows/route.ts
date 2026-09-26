import { NextResponse } from "next/server";
import {
  resolvePrintAgentDownloadUrl,
  getPrintAgentReleaseInfo,
  verifyPrintAgentAssetAvailability,
  PRINT_AGENT_FILENAME,
} from "@/features/representacion/services/print-agent-release";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function renderUnavailableHtml(releaseTag: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Instalador no disponible · La Veinte Digital</title>
  <style>
    body {
      margin: 0;
      padding: 2rem 1rem;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #f8fafc;
      color: #0f172a;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 80vh;
    }
    .card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 0.75rem;
      padding: 2rem;
      max-width: 480px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
      text-align: center;
    }
    .icon {
      font-size: 2.5rem;
      margin-bottom: 1rem;
    }
    h1 {
      font-size: 1.25rem;
      margin: 0 0 0.75rem 0;
      color: #0f172a;
    }
    p {
      margin: 0 0 1.5rem 0;
      font-size: 0.9375rem;
      color: #64748b;
      line-height: 1.5;
    }
    .tag {
      display: inline-block;
      padding: 0.25rem 0.5rem;
      background: #f1f5f9;
      border-radius: 0.25rem;
      font-family: monospace;
      font-size: 0.8125rem;
      color: #334155;
      margin-bottom: 1.5rem;
    }
    a.btn {
      display: inline-block;
      background: #2563eb;
      color: #ffffff;
      padding: 0.625rem 1.25rem;
      border-radius: 0.375rem;
      text-decoration: none;
      font-weight: 600;
      font-size: 0.875rem;
    }
    a.btn:hover {
      background: #1d4ed8;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">⚠️</div>
    <h1>No fue posible descargar La Veinte Print en este momento</h1>
    <p>El instalador todavía no está disponible en los servidores de distribución. Por favor intenta más tarde o comunícate con la oficina sindical.</p>
    <div class="tag">Release: ${releaseTag} · ${PRINT_AGENT_FILENAME}</div>
    <div>
      <a class="btn" href="/representacion/impresion">Volver al panel de impresión</a>
    </div>
  </div>
</body>
</html>`;
}

export async function GET(req: Request): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const wantsJson = searchParams.get("json") === "true";
  const checkOnly = searchParams.get("check") === "true";

  const resolved = resolvePrintAgentDownloadUrl();

  // Logging diagnóstico server-side seguro (sin secretos ni tokens)
  console.info("[print-agent-download] Request received", {
    release_tag: resolved.releaseTag,
    asset: PRINT_AGENT_FILENAME,
    is_override: resolved.isOverride,
    is_valid: resolved.isValid,
    wants_json: wantsJson,
    check_only: checkOnly,
  });

  if (!resolved.isValid) {
    console.error("[print-agent-download] Invalid download configuration", {
      release_tag: resolved.releaseTag,
      asset: PRINT_AGENT_FILENAME,
      error: resolved.error,
    });

    const errorMsg =
      "No fue posible descargar La Veinte Print en este momento. El instalador todavía no está disponible.";

    if (wantsJson || checkOnly) {
      return NextResponse.json(
        { error: errorMsg, details: resolved.error, release_tag: resolved.releaseTag },
        { status: 503 }
      );
    }

    return new NextResponse(renderUnavailableHtml(resolved.releaseTag), {
      status: 503,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  // Si el cliente solicita metadatos en JSON (?json=true)
  if (wantsJson) {
    const metadata = getPrintAgentReleaseInfo();
    return NextResponse.json(metadata);
  }

  // Si el cliente solicita pre-verificación rápida (?check=true)
  if (checkOnly) {
    const check = await verifyPrintAgentAssetAvailability(resolved.downloadUrl);
    if (!check.available) {
      console.warn("[print-agent-download] Pre-check failed: asset unavailable", {
        release_tag: resolved.releaseTag,
        asset: PRINT_AGENT_FILENAME,
        upstream_status: check.status,
      });

      return NextResponse.json(
        {
          ok: false,
          error:
            "No fue posible descargar La Veinte Print en este momento. El instalador todavía no está disponible.",
          release_tag: resolved.releaseTag,
          upstream_status: check.status,
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      ok: true,
      available: true,
      release_tag: resolved.releaseTag,
      download_url: resolved.downloadUrl,
    });
  }

  // Comprobar disponibilidad antes de redirigir para no enviar al usuario a un 404 de GitHub
  const check = await verifyPrintAgentAssetAvailability(resolved.downloadUrl);
  if (!check.available) {
    console.warn("[print-agent-download] Asset unavailable on remote", {
      release_tag: resolved.releaseTag,
      asset: PRINT_AGENT_FILENAME,
      upstream_status: check.status,
    });

    const acceptHeader = req.headers.get("accept") || "";
    if (acceptHeader.includes("application/json")) {
      return NextResponse.json(
        {
          error:
            "No fue posible descargar La Veinte Print en este momento. El instalador todavía no está disponible.",
          release_tag: resolved.releaseTag,
          asset: PRINT_AGENT_FILENAME,
        },
        { status: 503 }
      );
    }

    return new NextResponse(renderUnavailableHtml(resolved.releaseTag), {
      status: 503,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  // Redirigir al archivo ejecutable para descarga directa
  return NextResponse.redirect(resolved.downloadUrl, 302);
}
