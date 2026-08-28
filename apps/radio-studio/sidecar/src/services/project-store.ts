/**
 * ProjectStore — persistencia de proyectos de episodio.
 *
 * Estructura en disco:
 *   <baseDir>/projects/<project-id>/
 *       project.json      (estado + config + referencia a artefactos)
 *       research.json     (bundle de investigación)
 *       claims.json       (Claim Ledger)
 *       coverage.json     (cobertura)
 *       proposal.json     (propuesta editorial)
 *       script.json       (guion)
 *       production.json   (estado de producción)
 *       commercials.json  (colocaciones comerciales)
 *       master.json       (resultado del máster)
 *       logs.json         (log de eventos)
 *
 * Escrituras atómicas: escribir .tmp + rename (con retry para Windows).
 * El proyecto sobrevive cierre, reinicio, crash y sidecar restart.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  ProjectSchema,
  type Project,
  type ProjectState,
  type ResearchBundle,
  type Proposal,
  type Script,
  type ProductionState,
  type MasterResult,
  type CommercialPlacement,
} from "@la-veinte/studio-contract";

export const DEFAULT_ARTIFACTS = [
  "research.json",
  "claims.json",
  "coverage.json",
  "proposal.json",
  "script.json",
  "production.json",
  "commercials.json",
  "master.json",
  "logs.json",
] as const;

function atomicWrite(file: string, data: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + "." + process.pid + "." + Date.now() + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  let lastErr: unknown = null;
  for (let i = 0; i < 5; i++) {
    try {
      fs.renameSync(tmp, file);
      return;
    } catch (e) {
      lastErr = e;
      if (i < 4) {
        const ms = 50 + i * 150;
        const t = Date.now() + ms;
        while (Date.now() < t) { /* espera activa breve (Windows EPERM) */ }
      }
    }
  }
  try {
    fs.copyFileSync(tmp, file);
    fs.rmSync(tmp, { force: true });
  } catch (e2) {
    throw lastErr ?? e2;
  }
}

function readJson<T>(file: string): T | null {
  try {
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

export interface CreateProjectInput {
  topic: string;
  titulo?: string;
  config?: Project["config"];
}

export class ProjectStore {
  constructor(private baseDir: string) {}

  private projectsDir(): string {
    return path.join(this.baseDir, "projects");
  }

  private dir(id: string): string {
    return path.join(this.projectsDir(), id);
  }

  private file(id: string, name: string): string {
    return path.join(this.dir(id), name);
  }

  list(): Project[] {
    try {
      const dir = this.projectsDir();
      if (!fs.existsSync(dir)) return [];
      const out: Project[] = [];
      for (const entry of fs.readdirSync(dir)) {
        const p = this.get(entry);
        if (p) out.push(p);
      }
      return out.sort((a, b) => {
        if (a.updatedAt !== b.updatedAt) return a.updatedAt < b.updatedAt ? 1 : -1;
        // tiebreaker determinista para escrituras en el mismo milisegundo
        if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
        return a.id < b.id ? 1 : -1;
      });
    } catch {
      return [];
    }
  }

  has(id: string): boolean {
    return fs.existsSync(this.file(id, "project.json"));
  }

  get(id: string): Project | null {
    const raw = readJson<Project>(this.file(id, "project.json"));
    if (!raw) return null;
    try {
      return ProjectSchema.parse(raw);
    } catch {
      // tolerar artefactos antiguos: devolver tal cual para no perder trabajo
      return raw;
    }
  }

  create(input: CreateProjectInput): Project {
    const id = crypto.randomUUID().slice(0, 8);
    const now = new Date().toISOString();
    const config = input.config ?? {
      duracionMin: 15,
      profundidad: "estandar",
      nivel: "natural",
      contextoExtra: "",
      modo: "ia",
      comerciales: { enabled: false, ids: [], allowDirectorChoice: true, count: "auto", ubicacion: "auto", interaccion: "natural", duracionSec: 30 },
    };
    const project: Project = {
      id,
      titulo: input.titulo ?? input.topic,
      topic: input.topic,
      state: "DRAFT",
      createdAt: now,
      updatedAt: now,
      config,
      research: null,
      proposal: null,
      script: null,
      production: null,
      master: null,
      error: null,
    };
    this.save(project);
    this.writeArtifact(id, "logs.json", []);
    return project;
  }

  save(project: Project): Project {
    atomicWrite(this.file(project.id, "project.json"), project);
    return project;
  }

  updateState(id: string, state: ProjectState): Project | null {
    const p = this.get(id);
    if (!p) return null;
    p.state = state;
    p.updatedAt = new Date().toISOString();
    return this.save(p);
  }

  update(id: string, patch: Partial<Project>): Project | null {
    const p = this.get(id);
    if (!p) return null;
    const next = { ...p, ...patch, id: p.id };
    next.updatedAt = new Date().toISOString();
    return this.save(next);
  }

  writeArtifact(id: string, name: (typeof DEFAULT_ARTIFACTS)[number], data: unknown): void {
    atomicWrite(this.file(id, name), data);
  }

  readArtifact<T = unknown>(id: string, name: (typeof DEFAULT_ARTIFACTS)[number]): T | null {
    return readJson<T>(this.file(id, name));
  }

  /** Conveniencias semánticas de artefactos. */
  writeResearch(id: string, r: ResearchBundle): void {
    this.writeArtifact(id, "research.json", r);
    this.writeArtifact(id, "claims.json", { claims: r.claims, evidence: r.evidence });
    this.writeArtifact(id, "coverage.json", r.coverage);
  }
  readClaims(id: string): { claims: unknown[]; evidence: unknown[] } | null {
    return this.readArtifact(id, "claims.json");
  }
  writeProposal(id: string, p: Proposal): void {
    this.writeArtifact(id, "proposal.json", p);
  }
  writeScript(id: string, s: Script): void {
    this.writeArtifact(id, "script.json", s);
  }
  writeProduction(id: string, p: ProductionState): void {
    this.writeArtifact(id, "production.json", p);
  }
  writeCommercials(id: string, placements: CommercialPlacement[]): void {
    this.writeArtifact(id, "commercials.json", placements);
  }
  writeMaster(id: string, m: MasterResult): void {
    this.writeArtifact(id, "master.json", m);
  }

  logEvent(id: string, event: { type: string; data?: unknown }): void {
    const logs = this.readArtifact<Array<{ type: string; ts: string; data?: unknown }>>(id, "logs.json") ?? [];
    logs.push({ ...event, ts: new Date().toISOString() });
    const trimmed = logs.slice(-200);
    this.writeArtifact(id, "logs.json", trimmed);
  }

  delete(id: string): void {
    try {
      fs.rmSync(this.dir(id), { recursive: true, force: true });
    } catch { /* mejor esfuerzo */ }
  }

  /** Directorios de salida de un proyecto. */
  artifactPaths(id: string): { audioDir: string; masterDir: string; logsDir: string } {
    const root = this.dir(id);
    return {
      audioDir: path.join(root, "audio"),
      masterDir: path.join(root, "master"),
      logsDir: path.join(root, "logs"),
    };
  }
}

export function makeProjectStoreForRepo(repoRoot: string): ProjectStore {
  return new ProjectStore(path.join(repoRoot, "data"));
}
