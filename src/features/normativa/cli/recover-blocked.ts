import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { chromium, type BrowserContext } from "playwright";
import { loadBootstrapManifest, REPO_ROOT } from "./shared";
import type { DownloadRecord, SourceSpec } from "../core/types";
import { isChallengePage, isPdfBuffer, nowIso, sha256Hex } from "../core/hashing";
import { ensureDirs, normativaRoot, versionDirFor } from "../core/manifest";
import { NormativeDB } from "../services/db";
import { bootstrapSource } from "../services/bootstrap";
import { NormativeDownloader } from "../services/downloader";

const execFileAsync = promisify(execFile);

interface Args {
  ids: string[];
  limit: number;
  headed: boolean;
  waitMs: number;
  manualDir: string | null;
}

interface Candidate {
  label: string;
  url: string;
  filePath: string;
  bytes: number;
  sha256: string;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const out: Args = { ids: [], limit: 0, headed: false, waitMs: 10000, manualDir: null };
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === "--ids") out.ids = (args[++i] ?? "").split(",").map((x) => x.trim()).filter(Boolean);
    else if (a === "--limit") out.limit = Number(args[++i] ?? "0");
    else if (a === "--headed") out.headed = true;
    else if (a === "--wait-ms") out.waitMs = Number(args[++i] ?? "10000");
    else if (a === "--manual-dir") out.manualDir = path.resolve(args[++i] ?? "");
  }
  return out;
}

function isBlocked(state: string | null | undefined): boolean {
  return state === "HTTP_403" || state === "WAF_BLOCK" || state === "TEMPORARY_BLOCK" || state === "RETRY_AFTER";
}

function sourceUrls(spec: SourceSpec): string[] {
  const urls = [spec.url, spec.mirror, spec.landingPage].filter((x): x is string => !!x);
  if (spec.url?.includes("/sites/all/statics/pdf/procedimientos/")) {
    const file = spec.url.split("/").pop();
    if (file) urls.push(`https://reposipot.imss.gob.mx/normatividad/DNMR/Procedimiento/${file}`);
  }
  return [...new Set(urls)];
}

function validPdf(buf: Buffer): boolean {
  return isPdfBuffer(buf) && !isChallengePage(buf);
}

function refererFor(url: string): string {
  if (url.includes("imss.gob.mx/sites/all/statics/pdf/procedimientos/")) {
    return "https://www.imss.gob.mx/conoce-al-imss/marco-normativo";
  }
  return new URL(url).origin + "/";
}

function writeProbe(root: string, specId: string, label: string, buf: Buffer): string {
  const dir = path.join(root, "recovery-probes", specId);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${label}-${Date.now()}.bin`);
  fs.writeFileSync(file, buf);
  return file;
}

async function downloadWithFetch(url: string, out: string): Promise<Candidate | null> {
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
      Accept: "application/pdf,*/*",
      "Accept-Language": "es-MX,es;q=0.9",
      Referer: refererFor(url),
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "same-origin",
    },
  });
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(out, buf);
  if (!validPdf(buf)) return null;
  return { label: "fetch", url: res.url || url, filePath: out, bytes: buf.length, sha256: sha256Hex(buf) };
}

async function downloadWithCurl(url: string, out: string): Promise<Candidate | null> {
  await execFileAsync("curl.exe", [
    "-L",
    "--retry", "2",
    "--connect-timeout", "20",
    "--max-time", "120",
    "-A", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
    "--compressed",
    "--http1.1",
    "-H", "Accept: application/pdf,*/*",
    "-H", "Accept-Language: es-MX,es;q=0.9",
    "-H", `Referer: ${refererFor(url)}`,
    "-H", "Sec-Fetch-Dest: document",
    "-H", "Sec-Fetch-Mode: navigate",
    "-H", "Sec-Fetch-Site: same-origin",
    url,
    "-o", out,
  ], { timeout: 150000 });
  const buf = fs.readFileSync(out);
  if (!validPdf(buf)) return null;
  return { label: "curl", url, filePath: out, bytes: buf.length, sha256: sha256Hex(buf) };
}

async function downloadWithPlaywright(
  context: BrowserContext,
  url: string,
  out: string,
  waitMs: number
): Promise<Candidate | null> {
  const page = await context.newPage();
  try {
    const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => null);
    if (waitMs > 0) await page.waitForTimeout(waitMs);
    const buf = res ? Buffer.from(await res.body()) : Buffer.from(await page.content(), "utf8");
    fs.writeFileSync(out, buf);
    if (!validPdf(buf)) return null;
    return { label: "playwright", url: page.url(), filePath: out, bytes: buf.length, sha256: sha256Hex(buf) };
  } finally {
    await page.close().catch(() => {});
  }
}

function findManualCandidate(spec: SourceSpec, manualDir: string | null): Candidate | null {
  if (!manualDir || !fs.existsSync(manualDir)) return null;
  const names = [
    `${spec.id}.pdf`,
    spec.key ? `${spec.key}.pdf` : "",
    spec.url ? spec.url.split("/").pop() ?? "" : "",
  ].filter(Boolean);
  for (const name of names) {
    const file = path.join(manualDir, name);
    if (!fs.existsSync(file)) continue;
    const buf = fs.readFileSync(file);
    if (!validPdf(buf)) continue;
    return {
      label: "manual",
      url: spec.url ?? spec.landingPage ?? file,
      filePath: file,
      bytes: buf.length,
      sha256: sha256Hex(buf),
    };
  }
  return null;
}

class RecoveredFileDownloader extends NormativeDownloader {
  constructor(private candidate: Candidate, allowlistDomains: string[]) {
    super({
      timeoutMs: 0,
      minDelayMs: 0,
      maxRetries: 1,
      backoffBaseMs: 0,
      allowlistDomains,
      userAgent: "",
      logFile: "",
    });
  }

  async download(spec: SourceSpec, root: string) {
    const buf = fs.readFileSync(this.candidate.filePath);
    if (!validPdf(buf)) throw new Error(`recuperación inválida para ${spec.id}: no es PDF oficial`);

    const category = spec.category ?? "otros";
    const docBase = path.dirname(versionDirFor(root, spec.id, category, "probe"));
    fs.mkdirSync(docBase, { recursive: true });
    const existingLabels = fs.existsSync(docBase)
      ? fs.readdirSync(docBase, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
      : [];

    const sha256 = sha256Hex(buf);
    for (const label of existingLabels) {
      const metaFile = path.join(docBase, label, "metadata.json");
      if (!fs.existsSync(metaFile)) continue;
      try {
        const meta = JSON.parse(fs.readFileSync(metaFile, "utf8")) as { sha256?: string };
        if (meta.sha256 === sha256) {
          const dir = path.join(docBase, label);
          const record = this.record(spec, sha256, buf.length, "NOT_MODIFIED");
          return { record, versionLabel: label, versionDir: dir, filePath: path.join(dir, "original.pdf"), reused: true, changed: false };
        }
      } catch {
        // metadata corrupta; se ignora y se crea versión nueva.
      }
    }

    const firstLabel =
      spec.effectiveFrom && spec.effectiveUntil
        ? `${spec.effectiveFrom.slice(0, 4)}-${spec.effectiveUntil.slice(0, 4)}`
        : "V1";
    const label = existingLabels.length === 0 ? firstLabel : `V${existingLabels.length + 1}`;
    const dir = path.join(docBase, label);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "original.pdf"), buf);
    fs.writeFileSync(path.join(dir, "sha256.txt"), sha256 + "\n");
    const record = this.record(spec, sha256, buf.length, "OK");
    fs.writeFileSync(
      path.join(dir, "metadata.json"),
      JSON.stringify({ ...record, documentId: spec.id, versionLabel: label, status: "PENDING_REVIEW", recovery: this.candidate }, null, 2)
    );
    return { record, versionLabel: label, versionDir: dir, filePath: path.join(dir, "original.pdf"), reused: false, changed: true };
  }

  override async logError() {
    // bootstrapSource registra el estado; las pruebas fallidas quedan en recovery-probes.
  }

  private record(spec: SourceSpec, sha256: string, size: number, status: DownloadRecord["status"]): DownloadRecord {
    const url = spec.url ?? spec.landingPage ?? this.candidate.url;
    return {
      url,
      resolvedUrl: this.candidate.url,
      downloadedAt: nowIso(),
      etag: null,
      lastModified: null,
      sha256,
      size,
      contentType: "application/pdf",
      redirects: 0,
      status,
      kind: "pdf",
    };
  }
}

async function main() {
  const args = parseArgs();
  const manifest = loadBootstrapManifest();
  const root = normativaRoot(REPO_ROOT);
  ensureDirs(root);
  const db = new NormativeDB(path.join(root, "catalog.sqlite"));
  const states = new Map(db.listSourceStates().map((s) => [s.id, s]));
  const docs = new Map(db.listDocuments().map((d) => [d.id, d]));

  let specs = manifest.sources.filter((s) => {
    if (args.ids.length > 0) return args.ids.includes(s.id);
    const doc = docs.get(s.id);
    const state = states.get(s.id);
    return !doc?.currentVersion || isBlocked(state?.state);
  });
  if (args.limit > 0) specs = specs.slice(0, args.limit);
  if (specs.length === 0) {
    console.log("No hay fuentes bloqueadas o faltantes en el manifiesto.");
    return;
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "normativa-recover-"));
  const context = await chromium.launchPersistentContext(path.join(root, ".playwright-profile"), {
    headless: !args.headed,
    acceptDownloads: true,
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
    locale: "es-MX",
  });

  const recovered: string[] = [];
  const failed: string[] = [];
  try {
    for (const spec of specs) {
      const urls = sourceUrls(spec);
      let candidate: Candidate | null = findManualCandidate(spec, args.manualDir);
      if (candidate) {
        console.log(`${spec.id}: PDF local encontrado en carpeta manual`);
      }
      if (urls.length === 0) {
        if (!candidate) {
          failed.push(`${spec.id}: sin URL`);
          console.log(`${spec.id}: sin URL recuperable`);
          continue;
        }
      }
      for (const url of candidate ? [] : urls) {
        const safe = spec.id.replace(/[^A-Za-z0-9_-]/g, "_");
        const fetchOut = path.join(tmp, `${safe}-fetch.pdf`);
        const curlOut = path.join(tmp, `${safe}-curl.pdf`);
        const pwOut = path.join(tmp, `${safe}-playwright.pdf`);
        for (const [label, fn] of [
          ["fetch", () => downloadWithFetch(url, fetchOut)],
          ["curl", () => downloadWithCurl(url, curlOut)],
          ["playwright", () => downloadWithPlaywright(context, url, pwOut, args.waitMs)],
        ] as const) {
          try {
            candidate = await fn();
            if (candidate) break;
            const probe = label === "fetch" ? fetchOut : label === "curl" ? curlOut : pwOut;
            if (fs.existsSync(probe)) writeProbe(root, spec.id, label, fs.readFileSync(probe));
          } catch (e) {
            writeProbe(root, spec.id, label, Buffer.from(e instanceof Error ? e.message : String(e)));
          }
        }
        if (candidate) break;
      }

      if (!candidate) {
        failed.push(`${spec.id}: no se obtuvo PDF real`);
        console.log(`${spec.id}: no se obtuvo PDF real`);
        continue;
      }

      const downloader = new RecoveredFileDownloader(candidate, manifest.settings.download.allowlistDomains);
      const item = await bootstrapSource(db, downloader, spec, root, manifest.settings.download.allowlistDomains, {
        force: true,
        log: (msg) => console.log(msg),
      });
      if (item.status === "DOWNLOADED") recovered.push(`${spec.id}: ${item.pages ?? "?"} pags, ${item.chunks ?? 0} chunks`);
      else failed.push(`${spec.id}: ${item.message ?? item.status}`);
    }
  } finally {
    await context.close().catch(() => {});
  }

  const report = {
    generatedAt: nowIso(),
    recovered,
    failed,
    counts: db.counts(),
  };
  const reportPath = path.join(root, "normativa-recovery-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nRecuperados: ${recovered.length}`);
  console.log(`Fallidos: ${failed.length}`);
  console.log(`Reporte: ${reportPath}`);
  if (failed.length > 0) process.exitCode = 2;
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
