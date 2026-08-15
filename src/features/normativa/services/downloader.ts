import fs from "node:fs";
import path from "node:path";
import { appendFile } from "node:fs/promises";
import type { DownloadRecord, SourceSpec } from "../core/types";
import { isChallengePage, isPdfBuffer, looksLikeHtml, nowIso, sha256Hex } from "../core/hashing";
import { versionDirFor } from "../core/manifest";

export type DownloadErrorCode = "WAF_BLOCK" | "HTTP_403" | "NOT_FOUND" | "BAD_CONTENT" | "NETWORK";

export class DownloadError extends Error {
  constructor(public code: DownloadErrorCode, message: string) {
    super(message);
    this.name = "DownloadError";
  }
}

export interface DownloadOptions {
  timeoutMs: number;
  minDelayMs: number;
  maxRetries: number;
  backoffBaseMs: number;
  allowlistDomains: string[];
  userAgent: string;
  logFile: string;
}

export interface DownloadResult {
  record: DownloadRecord;
  versionLabel: string;
  versionDir: string;
  filePath: string;
  reused: boolean;
  changed: boolean;
}

let lastRequestAt = 0;

async function politeDelay(minDelayMs: number) {
  const wait = lastRequestAt + minDelayMs - Date.now();
  if (wait > 0) {
    await new Promise((r) => setTimeout(r, wait));
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function isDomainAllowed(url: string, allowlist: string[]): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return allowlist.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

export class NormativeDownloader {
  constructor(private opts: DownloadOptions) {}

  private async fetchWithRetries(url: string, headers: Record<string, string>): Promise<Response> {
    let lastErr: unknown = null;
    const attempts = Math.max(1, Math.min(this.opts.maxRetries, 3));
    for (let attempt = 0; attempt < attempts; attempt++) {
      if (attempt > 0) {
        await sleep(this.opts.backoffBaseMs * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 2000));
      }
      try {
        await politeDelay(this.opts.minDelayMs);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.opts.timeoutMs);
        try {
          const res = await fetch(url, { headers, redirect: "follow", signal: controller.signal });
          lastRequestAt = Date.now();
          if (res.status === 200) return res;
          if (res.status === 403) throw new DownloadError("HTTP_403", `HTTP 403 (${url})`);
          if (res.status === 404) throw new DownloadError("NOT_FOUND", `HTTP 404 (${url})`);
          if (res.status >= 500) {
            lastErr = new Error(`HTTP ${res.status}`);
            continue;
          }
          throw new DownloadError("BAD_CONTENT", `HTTP ${res.status} (${url})`);
        } finally {
          clearTimeout(timer);
        }
      } catch (err) {
        if (err instanceof DownloadError) throw err;
        lastErr = err;
      }
    }
    throw lastErr instanceof Error ? new DownloadError("NETWORK", lastErr.message) : new DownloadError("NETWORK", "descarga fallida");
  }

  async download(spec: SourceSpec, root: string): Promise<DownloadResult> {
    const url = spec.url ?? spec.landingPage;
    if (!url) throw new DownloadError("BAD_CONTENT", `Fuente ${spec.id} sin URL`);
    if (!isDomainAllowed(url, this.opts.allowlistDomains)) {
      throw new DownloadError("BAD_CONTENT", `Dominio fuera de allowlist: ${url}`);
    }

    const headers: Record<string, string> = {
      "User-Agent": this.opts.userAgent,
      Accept: "application/pdf,text/html,application/xhtml+xml,*/*;q=0.8",
      "Accept-Language": "es-MX,es;q=0.9",
      Referer: new URL(url).origin + "/",
    };

    const expected = spec.format === "html" || spec.format === "page" ? "html" : "pdf";

    const res = await this.fetchWithRetries(url, headers);
    const buf = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") ?? "";
    const etag = res.headers.get("etag");
    const lastModified = res.headers.get("last-modified");
    const resolvedUrl = res.url || url;
    const sha256 = sha256Hex(buf);

    if (expected === "pdf" && isChallengePage(buf)) {
      const record: DownloadRecord = {
        url, resolvedUrl, downloadedAt: nowIso(), etag, lastModified, sha256,
        size: buf.length, contentType, redirects: 0,
        status: "CHALLENGE", kind: "html",
        error: "Incapsula challenge (WAF)",
      };
      await this.log(record);
      throw new DownloadError("WAF_BLOCK", `Bloqueo WAF (Incapsula) en ${spec.id}`);
    }

    let kind: DownloadRecord["kind"] = expected === "pdf" ? "pdf" : spec.format === "page" ? "page" : "html";

    if (expected === "pdf") {
      if (!isPdfBuffer(buf)) {
        const record: DownloadRecord = {
          url, resolvedUrl, downloadedAt: nowIso(), etag, lastModified, sha256,
          size: buf.length, contentType, redirects: 0,
          status: "ERROR", kind: looksLikeHtml(buf) ? "html" : "pdf",
          error: `No es PDF (content-type=${contentType})`,
        };
        await this.log(record);
        throw new DownloadError("BAD_CONTENT", `Contenido no es PDF para ${spec.id}: ${contentType} (${buf.length} bytes)`);
      }
      kind = "pdf";
    } else if (expected === "html" && looksLikeHtml(buf) === false) {
      const record: DownloadRecord = {
        url, resolvedUrl, downloadedAt: nowIso(), etag, lastModified, sha256,
        size: buf.length, contentType, redirects: 0,
        status: "ERROR", kind,
        error: "Se esperaba HTML",
      };
      await this.log(record);
      throw new DownloadError("BAD_CONTENT", `Contenido no es HTML para ${spec.id}`);
    }

    const record: DownloadRecord = {
      url,
      resolvedUrl,
      downloadedAt: nowIso(),
      etag: etag ?? null,
      lastModified: lastModified ?? null,
      sha256,
      size: buf.length,
      contentType,
      redirects: 0,
      status: "OK",
      kind,
    };

    const category = spec.category ?? "otros";
    const docBase = path.dirname(versionDirFor(root, spec.id, category, "probe"));
    fs.mkdirSync(docBase, { recursive: true });

    const existingLabels = fs.existsSync(docBase)
      ? fs.readdirSync(docBase, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
      : [];

    const metaFile = (label: string) => path.join(docBase, label, "metadata.json");
    for (const label of existingLabels) {
      const p = metaFile(label);
      if (fs.existsSync(p)) {
        try {
          const meta = JSON.parse(fs.readFileSync(p, "utf8")) as { sha256?: string };
          if (meta.sha256 === sha256) {
            record.status = "NOT_MODIFIED";
            await this.log(record);
            const dir = path.join(docBase, label);
            const ext = kind === "pdf" ? "pdf" : "html";
            return {
              record,
              versionLabel: label,
              versionDir: dir,
              filePath: path.join(dir, `original.${ext}`),
              reused: true,
              changed: false,
            };
          }
        } catch {
          /* ignorar metadata corrupta */
        }
      }
    }

    const firstLabel =
      spec.effectiveFrom && spec.effectiveUntil
        ? `${spec.effectiveFrom.slice(0, 4)}-${spec.effectiveUntil.slice(0, 4)}`
        : "V1";
    const label = existingLabels.length === 0 ? firstLabel : `V${existingLabels.length + 1}`;
    const dir = path.join(docBase, label);
    fs.mkdirSync(dir, { recursive: true });

    const ext = kind === "pdf" ? "pdf" : "html";
    const filePath = path.join(dir, `original.${ext}`);
    fs.writeFileSync(filePath, buf);
    fs.writeFileSync(path.join(dir, "sha256.txt"), sha256 + "\n");
    fs.writeFileSync(
      path.join(dir, "metadata.json"),
      JSON.stringify(
        {
          ...record,
          documentId: spec.id,
          versionLabel: label,
          status: "PENDING_REVIEW",
          sourceSpec: {
            id: spec.id,
            key: spec.key ?? null,
            title: spec.title,
            organization: spec.organization,
            type: spec.type,
            canonical: spec.canonical ?? false,
            priority: spec.priority ?? "medium",
            effectiveFrom: spec.effectiveFrom ?? null,
            effectiveUntil: spec.effectiveUntil ?? null,
            verificationStatus: spec.verificationStatus ?? null,
            warning: spec.warning ?? null,
          },
        },
        null,
        2
      )
    );

    await this.log(record);
    return { record, versionLabel: label, versionDir: dir, filePath, reused: false, changed: true };
  }

  async logError(spec: SourceSpec, message: string) {
    const url = spec.url ?? spec.landingPage ?? "sin-url";
    await this.log({
      url,
      resolvedUrl: url,
      downloadedAt: nowIso(),
      etag: null,
      lastModified: null,
      sha256: "",
      size: 0,
      contentType: "",
      redirects: 0,
      status: "ERROR",
      kind: "pdf",
      error: message,
    });
  }

  private async log(record: DownloadRecord) {
    if (!this.opts.logFile) return;
    await appendFile(this.opts.logFile, JSON.stringify(record) + "\n");
  }
}
