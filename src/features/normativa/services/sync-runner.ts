import fs from "node:fs";
import path from "node:path";
import type { BootstrapManifest, SourceSpec } from "../core/types";
import { NormativeDB } from "./db";
import { NormativeDownloader } from "./downloader";
import { bootstrapSource } from "./bootstrap";
import { normativaRoot } from "../core/manifest";
import { nowIso } from "../core/hashing";

export interface SyncJob {
  running: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  done: number;
  total: number;
  current: string | null;
  recentLog: string[];
}

export interface SyncJobInput {
  repoRoot: string;
  manifest: BootstrapManifest;
  ids?: string[];
  force?: boolean;
}

const JOB_FILE = "sync-job.json";
const LOG_KEEP = 200;

const globalKey = Symbol.for("normativa.sync.job");
type GlobalState = { job: SyncJob; lastWrite: number; writeTimer: NodeJS.Timeout | null };
const g = globalThis as unknown as Record<symbol, GlobalState | undefined>;

export function readJob(root: string): SyncJob | null {
  const p = path.join(root, JOB_FILE);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as SyncJob;
  } catch {
    return null;
  }
}

function writeJob(root: string, job: SyncJob) {
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, JOB_FILE), JSON.stringify(job, null, 2));
}

export function currentJob(repoRoot: string): SyncJob | null {
  const root = normativaRoot(repoRoot);
  return readJob(root);
}

export async function startSyncJob(input: SyncJobInput): Promise<{ started: boolean; reason?: string }> {
  const root = normativaRoot(input.repoRoot);
  fs.mkdirSync(root, { recursive: true });

  const existing = readJob(root);
  if (existing?.running) {
    return { started: false, reason: "Ya hay una sincronización en curso." };
  }

  const specs = input.ids
    ? input.manifest.sources.filter((s) => input.ids!.includes(s.id))
    : input.manifest.sources;

  if (specs.length === 0) {
    return { started: false, reason: "No hay fuentes que procesar." };
  }

  const job: SyncJob = {
    running: true,
    startedAt: nowIso(),
    finishedAt: null,
    done: 0,
    total: specs.length,
    current: null,
    recentLog: [],
  };
  writeJob(root, job);

  const state: GlobalState = { job, lastWrite: Date.now(), writeTimer: null };
  g[globalKey] = state;

  const throttledWrite = () => {
    const now = Date.now();
    if (now - state.lastWrite < 1500) {
      if (!state.writeTimer) {
        state.writeTimer = setTimeout(() => {
          state.writeTimer = null;
          state.lastWrite = Date.now();
          writeJob(root, state.job);
        }, 1600);
      }
      return;
    }
    state.lastWrite = now;
    writeJob(root, state.job);
  };

  void (async () => {
    const downloader = new NormativeDownloader({
      timeoutMs: input.manifest.settings.download.timeoutMs,
      minDelayMs: input.manifest.settings.download.minDelayMs,
      maxRetries: 2,
      backoffBaseMs: input.manifest.settings.download.backoffBaseMs,
      allowlistDomains: input.manifest.settings.download.allowlistDomains,
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36 AILaVeinte/Normativa",
      logFile: path.join(root, "download-log.jsonl"),
    });
    const db = new NormativeDB(path.join(root, "catalog.sqlite"));

    for (const spec of specs) {
      state.job.current = spec.id;
      const logLine = (msg: string) => {
        state.job.recentLog.push(msg);
        if (state.job.recentLog.length > LOG_KEEP) state.job.recentLog.shift();
        throttledWrite();
      };
      try {
        await bootstrapSource(db, downloader, spec, root, input.manifest.settings.download.allowlistDomains, {
          log: logLine,
          force: input.force === true,
        });
      } catch (err) {
        logLine(`${spec.id}: ERROR — ${err instanceof Error ? err.message : String(err)}`);
      }
      state.job.done++;
      state.job.current = null;
      throttledWrite();
    }

    state.job.running = false;
    state.job.finishedAt = nowIso();
    writeJob(root, state.job);
  })();

  return { started: true };
}

export function availableSourcesForRetry(manifest: BootstrapManifest, db: NormativeDB): SourceSpec[] {
  return manifest.sources.filter((s) => {
    if (!s.url && !s.landingPage) return false;
    const doc = db.getDocument(s.id);
    if (!doc?.currentVersion) return true;
    const st = db.getSourceState(s.id);
    return st && st.state !== "AVAILABLE" && st.state !== "MANUAL_REVIEW";
  });
}
