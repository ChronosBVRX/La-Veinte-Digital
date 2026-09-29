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
export const PRINT_AGENT_FILENAME_X64 = "LaVeintePrint-Setup-x64.exe";
export const PRINT_AGENT_FILENAME_X86 = "LaVeintePrint-Setup-x86.exe";
export const GITHUB_REPO_OWNER = "ChronosBVRX";
export const GITHUB_REPO_NAME = "La-Veinte-Digital";
export const GITHUB_RELEASES_BASE_URL = `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/download`;

export type PrintAgentArch = "x64" | "x86";

export interface PrintAgentVariantInfo {
  arch: PrintAgentArch;
  label: string;
  filename: string;
  download_url: string;
  upstream_url: string;
}

export interface PrintAgentReleaseInfo {
  name: string;
  version: string;
  platform: string;
  arch: PrintAgentArch;
  filename: string;
  release_tag: string;
  download_url: string;
  server_download_url: string;
  variants: {
    x64: PrintAgentVariantInfo;
    x86: PrintAgentVariantInfo;
  };
  instructions: string[];
}

export interface ResolvedPrintAgentDownload {
  downloadUrl: string;
  serverDownloadPath: string;
  filename: string;
  arch: PrintAgentArch;
  releaseTag: string;
  version: string;
  isOverride: boolean;
  isValid: boolean;
  error?: string;
}

/**
 * Normaliza el parámetro de arquitectura ('x64' / '64' vs 'x86' / 'ia32' / '32').
 * Si no se especifica, retorna undefined para preservar el nombre clásico por defecto.
 */
export function normalizePrintAgentArch(archParam?: string | null): PrintAgentArch | undefined {
  if (!archParam) return undefined;
  const cleaned = archParam.trim().toLowerCase();
  if (cleaned === "x86" || cleaned === "ia32" || cleaned === "32" || cleaned === "32bit") {
    return "x86";
  }
  if (cleaned === "x64" || cleaned === "64" || cleaned === "64bit" || cleaned === "amd64") {
    return "x64";
  }
  return undefined;
}

export function getPrintAgentFilename(arch?: PrintAgentArch): string {
  if (arch === "x86") return PRINT_AGENT_FILENAME_X86;
  if (arch === "x64") return PRINT_AGENT_FILENAME_X64;
  return PRINT_AGENT_FILENAME;
}

export function getServerDownloadPath(arch?: PrintAgentArch): string {
  if (arch === "x86") return "/api/downloads/print-agent/windows?arch=x86";
  if (arch === "x64") return "/api/downloads/print-agent/windows?arch=x64";
  return "/api/downloads/print-agent/windows";
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
 * 1. PRINT_AGENT_DOWNLOAD_URL[_X64|_X86] si está definido (override absoluto en Vercel/entorno)
 * 2. PRINT_AGENT_RELEASE_TAG (construye URL al tag indicado)
 * 3. Fallback seguro a DEFAULT_PRINT_AGENT_RELEASE_TAG (print-agent-v1.0.0)
 * 
 * Garantía: NUNCA genera ni permite '/releases/latest/'.
 */
export function resolvePrintAgentDownloadUrl(
  env: Partial<NodeJS.ProcessEnv> = process.env,
  archParam?: string | null
): ResolvedPrintAgentDownload {
  const normalizedArch = normalizePrintAgentArch(archParam);
  const effectiveArch: PrintAgentArch = normalizedArch || "x64";
  const targetFilename = getPrintAgentFilename(normalizedArch);
  const serverDownloadPath = getServerDownloadPath(normalizedArch);

  const archSpecificOverride =
    normalizedArch === "x86"
      ? env.PRINT_AGENT_DOWNLOAD_URL_X86?.trim()
      : normalizedArch === "x64"
        ? env.PRINT_AGENT_DOWNLOAD_URL_X64?.trim()
        : undefined;
  const explicitDownloadUrl = archSpecificOverride || env.PRINT_AGENT_DOWNLOAD_URL?.trim();
  const configuredTag = env.PRINT_AGENT_RELEASE_TAG?.trim();

  // 1. Override explícito por URL
  if (explicitDownloadUrl) {
    if (explicitDownloadUrl.includes("/releases/latest/")) {
      return {
        downloadUrl: explicitDownloadUrl,
        serverDownloadPath,
        filename: targetFilename,
        arch: effectiveArch,
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
          serverDownloadPath,
          filename: targetFilename,
          arch: effectiveArch,
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
        serverDownloadPath,
        filename: targetFilename,
        arch: effectiveArch,
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

    // Si se solicitó arquitectura explícita (ej. x86) y el override genérico termina en LaVeintePrint-Setup.exe
    let finalOverrideUrl = explicitDownloadUrl;
    if (!archSpecificOverride && normalizedArch && explicitDownloadUrl.endsWith(`/${PRINT_AGENT_FILENAME}`)) {
      finalOverrideUrl = explicitDownloadUrl.replace(new RegExp(`/${PRINT_AGENT_FILENAME}$`), `/${targetFilename}`);
    }

    return {
      downloadUrl: finalOverrideUrl,
      serverDownloadPath,
      filename: targetFilename,
      arch: effectiveArch,
      releaseTag: deducedTag,
      version: extractVersionFromTag(deducedTag),
      isOverride: true,
      isValid: true,
    };
  }

  // 2. Variable PRINT_AGENT_RELEASE_TAG
  const activeTag = configuredTag || DEFAULT_PRINT_AGENT_RELEASE_TAG;
  const downloadUrl = `${GITHUB_RELEASES_BASE_URL}/${activeTag}/${targetFilename}`;

  return {
    downloadUrl,
    serverDownloadPath,
    filename: targetFilename,
    arch: effectiveArch,
    releaseTag: activeTag,
    version: extractVersionFromTag(activeTag),
    isOverride: false,
    isValid: true,
  };
}

/**
 * Devuelve el contrato estructurado de metadatos para '?json=true'.
 */
export function getPrintAgentReleaseInfo(
  env: Partial<NodeJS.ProcessEnv> = process.env,
  archParam?: string | null
): PrintAgentReleaseInfo {
  const resolved = resolvePrintAgentDownloadUrl(env, archParam);
  const resolvedX64 = resolvePrintAgentDownloadUrl(env, "x64");
  const resolvedX86 = resolvePrintAgentDownloadUrl(env, "x86");

  return {
    name: "La Veinte Print para Windows",
    version: resolved.version,
    platform: "win32",
    arch: resolved.arch,
    filename: resolved.filename,
    release_tag: resolved.releaseTag,
    download_url: resolved.downloadUrl,
    server_download_url: resolved.serverDownloadPath,
    variants: {
      x64: {
        arch: "x64",
        label: "Windows 64 bits (x64)",
        filename: PRINT_AGENT_FILENAME_X64,
        download_url: resolvedX64.serverDownloadPath,
        upstream_url: resolvedX64.downloadUrl,
      },
      x86: {
        arch: "x86",
        label: "Windows 32 bits (x86)",
        filename: PRINT_AGENT_FILENAME_X86,
        download_url: resolvedX86.serverDownloadPath,
        upstream_url: resolvedX86.downloadUrl,
      },
    },
    instructions: [
      `1. Descarga ${resolved.filename} desde nuestro servidor y ejecútalo con doble clic.`,
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
