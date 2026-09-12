/**
 * visual-job-store.ts — Persistencia y reconciliación de jobs de renderizado visual.
 * Garantiza que el render sea recuperable tras caídas o reinicios del sidecar.
 */
import fs from "node:fs";
import path from "node:path";
import type { ProjectStore } from "../src/services/project-store";

export type VisualJobStatus =
  | "QUEUED"
  | "RENDERING"
  | "READY"
  | "FAILED"
  | "INTERRUPTED";

export interface VisualJob {
  projectId: string;
  status: VisualJobStatus;
  pid?: number;
  startedAt: string;
  updatedAt: string;
  formats: string[];
  outputDir: string;
  alignmentPath: string;
  masterPath: string;
  files: { preview?: string; video16x9?: string; video9x16?: string };
  report?: unknown;
  error?: string | null;
  progress?: {
    format: string;
    frame: number;
    totalFrames: number;
    percent: number;
    elapsedSec: number;
  };
}

const VISUAL_JOBS_DIR = path.join(
  process.cwd().includes("radio-studio") ? path.resolve(process.cwd(), "../../..") : process.cwd(),
  "data",
  "tts",
  "jobs",
  "visual"
);

function getVisualJobPath(projectId: string): string {
  return path.join(VISUAL_JOBS_DIR, `visual-${projectId}.json`);
}

export function isProcessAlive(pid?: number): boolean {
  if (!pid || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e: unknown) {
    if (typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "EPERM") {
      return true;
    }
    return false;
  }
}

export function guardarVisualJob(job: VisualJob): void {
  fs.mkdirSync(VISUAL_JOBS_DIR, { recursive: true });
  job.updatedAt = new Date().toISOString();
  const target = getVisualJobPath(job.projectId);
  const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(job, null, 2), "utf8");
  for (let i = 0; i < 5; i++) {
    try {
      fs.renameSync(tmp, target);
      return;
    } catch {
      // Reintentar brevemente en Windows
    }
  }
  try {
    fs.copyFileSync(tmp, target);
    fs.unlinkSync(tmp);
  } catch {}
}

export function leerVisualJob(projectId: string): VisualJob | null {
  try {
    const p = getVisualJobPath(projectId);
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, "utf8")) as VisualJob;
  } catch {
    return null;
  }
}

export function listarVisualJobs(): VisualJob[] {
  if (!fs.existsSync(VISUAL_JOBS_DIR)) return [];
  const list: VisualJob[] = [];
  for (const f of fs.readdirSync(VISUAL_JOBS_DIR)) {
    if (f.startsWith("visual-") && f.endsWith(".json")) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(VISUAL_JOBS_DIR, f), "utf8")) as VisualJob;
        list.push(data);
      } catch {}
    }
  }
  return list;
}

export function eliminarVisualJob(projectId: string): void {
  try {
    const p = getVisualJobPath(projectId);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch {}
}

/**
 * Reconcilia los trabajos visuales al arrancar el sidecar.
 * Si encuentra un job en RENDERING cuyo PID ya no existe, comprueba si los archivos
 * finales están completos (-> READY) o si el proceso fue interrumpido (-> INTERRUPTED).
 */
export function reconciliarVisualJobs(repoRoot: string, projectStore: ProjectStore): void {
  const jobs = listarVisualJobs();
  for (const j of jobs) {
    if (j.status === "RENDERING") {
      const vivo = isProcessAlive(j.pid);
      if (!vivo) {
        const previewPath = path.join(repoRoot, "data", "tts", "video", j.projectId, `episodio-${j.projectId}-preview.mp4`);
        const vid16x9Path = path.join(repoRoot, "data", "tts", "video", j.projectId, `episodio-${j.projectId}-16x9.mp4`);
        const vid9x16Path = path.join(repoRoot, "data", "tts", "video", j.projectId, `episodio-${j.projectId}-9x16.mp4`);

        const allExist = [previewPath, vid16x9Path, vid9x16Path].every(
          (f) => fs.existsSync(f) && fs.statSync(f).size > 0
        );

        if (allExist) {
          j.status = "READY";
          j.files = {
            preview: path.join("data", "tts", "video", j.projectId, `episodio-${j.projectId}-preview.mp4`).replace(/\\/g, "/"),
            video16x9: path.join("data", "tts", "video", j.projectId, `episodio-${j.projectId}-16x9.mp4`).replace(/\\/g, "/"),
            video9x16: path.join("data", "tts", "video", j.projectId, `episodio-${j.projectId}-9x16.mp4`).replace(/\\/g, "/"),
          };
          guardarVisualJob(j);
          projectStore.update(j.projectId, {
            visual: {
              status: "READY",
              renderedAt: j.updatedAt,
              files: j.files,
              report: j.report,
              error: null,
            },
          });
        } else {
          j.status = "INTERRUPTED";
          j.error = "Renderizado visual interrumpido (el proceso finalizó antes de completar los videos)";
          guardarVisualJob(j);
          projectStore.update(j.projectId, {
            visual: {
              status: "FAILED",
              renderedAt: j.updatedAt,
              files: {},
              report: null,
              error: j.error,
            },
          });
        }
      }
    }
  }
}
