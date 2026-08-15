import path from "node:path";
import type { BootstrapManifest } from "../core/types";
import { NormativeDB } from "./db";
import { NormativeDownloader } from "./downloader";
import { bootstrapSource } from "./bootstrap";
import { daysUntil, nowIso } from "../core/hashing";
import { normativaRoot } from "../core/manifest";

export interface UpdateSummary {
  checkedAt: string;
  mode: string;
  checked: number;
  changed: number;
  unchanged: number;
  errors: number;
  alerts: Array<{ id: string; document: string; severity: "expiring" | "expired" | "changed"; message: string }>;
}

export async function runUpdate(
  repoRoot: string,
  manifest: BootstrapManifest,
  mode: "all" | "critical" | "expiring",
  opts: { log: (msg: string) => void } = { log: () => {} }
): Promise<UpdateSummary> {
  const root = normativaRoot(repoRoot);
  const db = new NormativeDB(path.join(root, "catalog.sqlite"));
  const downloader = new NormativeDownloader({
    timeoutMs: manifest.settings.download.timeoutMs,
    minDelayMs: manifest.settings.download.minDelayMs,
    maxRetries: manifest.settings.download.maxRetries,
    backoffBaseMs: manifest.settings.download.backoffBaseMs,
    allowlistDomains: manifest.settings.download.allowlistDomains,
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36 AILaVeinte/Normativa",
    logFile: path.join(root, "download-log.jsonl"),
  });

  const summary: UpdateSummary = { checkedAt: nowIso(), mode, checked: 0, changed: 0, unchanged: 0, errors: 0, alerts: [] };

  const specs = manifest.sources.filter((s) => {
    if (s.url == null) return false;
    if (mode === "critical") return (s.priority ?? "medium") === "critical";
    if (mode === "expiring") return s.effectiveUntil != null;
    return true;
  });

  for (const spec of specs) {
    try {
      const item = await bootstrapSource(db, downloader, spec, root, manifest.settings.download.allowlistDomains, opts);
      summary.checked++;
      if (item.status === "DOWNLOADED") {
        if (item.changed) {
          summary.changed++;
          summary.alerts.push({
            id: `CHANGED-${spec.id}`,
            document: spec.id,
            severity: "changed",
            message: `Cambió el contenido (SHA-256 ${item.sha256?.slice(0, 12)}…). Nueva versión en PENDING_REVIEW.`,
          });
        } else {
          summary.unchanged++;
        }
      } else if (item.status === "ERROR") {
        summary.errors++;
        summary.alerts.push({ id: `ERR-${spec.id}`, document: spec.id, severity: "expired", message: item.message ?? "error" });
      }
      db.insertUpdateCheck({
        id: "",
        documentId: spec.id,
        checkedAt: nowIso(),
        kind: mode === "all" ? "full" : mode,
        sha256: item.sha256 ?? null,
        etag: null,
        lastModified: null,
        changed: item.changed === true,
        lastReformDate: item.lastReformDate ?? null,
        expiresSoon: false,
        message: item.status === "DOWNLOADED" ? (item.changed ? "changed" : "unchanged") : item.message ?? item.status,
      });
    } catch (err) {
      summary.errors++;
      opts.log(`${spec.id}: ERROR — ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  for (const alert of manifest.settings.alerts) {
    const doc = db.getDocument(alert.document);
    if (!doc) continue;
    const days = daysUntil(alert.expiresOn);
    if (days <= alert.warnDaysBefore) {
      summary.alerts.push({
        id: alert.id,
        document: alert.document,
        severity: days < 0 ? "expired" : "expiring",
        message: `${alert.message} (${alert.expiresOn}, faltan ${days} días)`,
      });
    }
  }

  for (const doc of db.listDocuments()) {
    if (doc.effectiveUntil) {
      const days = daysUntil(doc.effectiveUntil);
      if (days <= 30) {
        summary.alerts.push({
          id: `VIG-${doc.id}`,
          document: doc.id,
          severity: days < 0 ? "expired" : "expiring",
          message: `Vigencia ${doc.effectiveUntil}: ${days < 0 ? `venció hace ${-days} días` : `vence en ${days} días`}`,
        });
      }
    }
  }

  return summary;
}
