/**
 * Configuración centralizada de distribución para el cliente Windows de La Veinte Print.
 * 
 * Regla de gobernanza:
 * El Print Agent es un producto de distribución independiente de la app Android.
 * Nunca debe referenciar '/releases/latest/' porque los releases de Android comparten
 * el repositorio y pueden usurpar 'latest' en GitHub.
 */

export const DEFAULT_PRINT_AGENT_VERSION = "1.0.0";
export const DEFAULT_PRINT_AGENT_RELEASE_TAG = `print-agent-v${DEFAULT_PRINT_AGENT_VERSION}`;
export const PRINT_AGENT_FILENAME = "LaVeintePrint-Setup.exe";
export const GITHUB_REPO_OWNER = "ChronosBVRX";
export const GITHUB_REPO_NAME = "La-Veinte-Digital";
export const GITHUB_RELEASES_BASE_URL = `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/download`;

export interface PrintAgentReleaseInfo {
  name: string;
  version: string;
  platform: string;
  arch: string;
  filename: string;
  release_tag: string;
  download_url: string;
  instructions: string[];
}

export interface ResolvedPrintAgentDownload {
  downloadUrl: string;
  releaseTag: string;
  version: string;
  isOverride: boolean;
  isValid: boolean;
  error?: string;
}

/**
 * Extrae la versión numérica a partir de un tag tipo 'print-agent-v1.0.0' o 'v1.0.0'.
 */
export function extractVersionFromTag(tag: string): string {
  const cleaned = tag.replace(/^print-agent-v/, "").replace(/^v/, "");
  return cleaned || DEFAULT_PRINT_AGENT_VERSION;
}

/**
 * Resuelve la URL de descarga siguiendo la jerarquía estricta:
 * 1. PRINT_AGENT_DOWNLOAD_URL si está definido (override absoluto en Vercel/entorno)
 * 2. PRINT_AGENT_RELEASE_TAG (construye URL al tag indicado)
 * 3. Fallback seguro a DEFAULT_PRINT_AGENT_RELEASE_TAG (print-agent-v1.0.0)
 * 
 * Garantía: NUNCA genera ni permite '/releases/latest/'.
 */
export function resolvePrintAgentDownloadUrl(env: Partial<NodeJS.ProcessEnv> = process.env): ResolvedPrintAgentDownload {
  const explicitDownloadUrl = env.PRINT_AGENT_DOWNLOAD_URL?.trim();
  const configuredTag = env.PRINT_AGENT_RELEASE_TAG?.trim();

  // 1. Override explícito por URL
  if (explicitDownloadUrl) {
    if (explicitDownloadUrl.includes("/releases/latest/")) {
      return {
        downloadUrl: explicitDownloadUrl,
        releaseTag: configuredTag || DEFAULT_PRINT_AGENT_RELEASE_TAG,
        version: extractVersionFromTag(configuredTag || DEFAULT_PRINT_AGENT_RELEASE_TAG),
        isOverride: true,
        isValid: false,
        error: "PRINT_AGENT_DOWNLOAD_URL no debe usar '/releases/latest/' para evitar colisiones con Android.",
      };
    }

    try {
      const parsed = new URL(explicitDownloadUrl);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        return {
          downloadUrl: explicitDownloadUrl,
          releaseTag: configuredTag || DEFAULT_PRINT_AGENT_RELEASE_TAG,
          version: extractVersionFromTag(configuredTag || DEFAULT_PRINT_AGENT_RELEASE_TAG),
          isOverride: true,
          isValid: false,
          error: "PRINT_AGENT_DOWNLOAD_URL debe ser una URL HTTP/HTTPS válida.",
        };
      }
    } catch {
      return {
        downloadUrl: explicitDownloadUrl,
        releaseTag: configuredTag || DEFAULT_PRINT_AGENT_RELEASE_TAG,
        version: extractVersionFromTag(configuredTag || DEFAULT_PRINT_AGENT_RELEASE_TAG),
        isOverride: true,
        isValid: false,
        error: "PRINT_AGENT_DOWNLOAD_URL tiene un formato de URL inválido.",
      };
    }

    // Intentar deducir tag de la URL si no viene en env
    let deducedTag = configuredTag;
    if (!deducedTag) {
      const tagMatch = explicitDownloadUrl.match(/\/releases\/download\/([^/]+)\//);
      deducedTag = tagMatch ? tagMatch[1] : DEFAULT_PRINT_AGENT_RELEASE_TAG;
    }

    return {
      downloadUrl: explicitDownloadUrl,
      releaseTag: deducedTag,
      version: extractVersionFromTag(deducedTag),
      isOverride: true,
      isValid: true,
    };
  }

  // 2. Variable PRINT_AGENT_RELEASE_TAG
  const activeTag = configuredTag || DEFAULT_PRINT_AGENT_RELEASE_TAG;
  const downloadUrl = `${GITHUB_RELEASES_BASE_URL}/${activeTag}/${PRINT_AGENT_FILENAME}`;

  return {
    downloadUrl,
    releaseTag: activeTag,
    version: extractVersionFromTag(activeTag),
    isOverride: false,
    isValid: true,
  };
}

/**
 * Devuelve el contrato estructurado de metadatos para '?json=true'.
 */
export function getPrintAgentReleaseInfo(env: Partial<NodeJS.ProcessEnv> = process.env): PrintAgentReleaseInfo {
  const resolved = resolvePrintAgentDownloadUrl(env);

  return {
    name: "La Veinte Print para Windows",
    version: resolved.version,
    platform: "win32",
    arch: "x64",
    filename: PRINT_AGENT_FILENAME,
    release_tag: resolved.releaseTag,
    download_url: resolved.downloadUrl,
    instructions: [
      "1. Descarga LaVeintePrint-Setup.exe y ejecútalo con doble clic.",
      "2. Introduce el código de 6 dígitos generado en el portal web.",
      "3. Selecciona tu impresora y finaliza. La PC imprimirá automáticamente en segundo plano.",
    ],
  };
}

export interface AssetAvailabilityResult {
  available: boolean;
  status?: number;
  error?: string;
}

/**
 * Comprueba si el binario del instalador está disponible upstream en GitHub Releases.
 * En tests unitarios (a menos que se active PRINT_AGENT_FORCE_REMOTE_CHECK) o si
 * PRINT_AGENT_SKIP_REMOTE_CHECK=true, omite la consulta de red.
 */
export async function verifyPrintAgentAssetAvailability(
  downloadUrl: string,
  env: Partial<NodeJS.ProcessEnv> = process.env
): Promise<AssetAvailabilityResult> {
  const isTest = env.NODE_ENV === "test";
  const forceCheck = env.PRINT_AGENT_FORCE_REMOTE_CHECK === "true";
  const skipCheck = env.PRINT_AGENT_SKIP_REMOTE_CHECK === "true";

  if (skipCheck || (isTest && !forceCheck)) {
    return { available: true, status: 200 };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);

    const res = await fetch(downloadUrl, {
      method: "HEAD",
      redirect: "manual",
      signal: controller.signal,
    });
    clearTimeout(timeout);

    // GitHub releases responde 302 Found redirigiendo a release-assets.githubusercontent.com cuando existe.
    // En algunos servidores de assets directos puede responder 200 OK.
    if (res.status === 200 || res.status === 302) {
      return { available: true, status: res.status };
    }

    if (res.status === 404) {
      return { available: false, status: 404, error: "Asset no encontrado en el release (HTTP 404)" };
    }

    return { available: false, status: res.status, error: `Upstream status no esperado: ${res.status}` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { available: false, error: msg };
  }
}
