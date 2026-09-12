/**
 * Servicio de Assets Visuales, Referencias Reales y Dirección de Arte para AI Radio Studio.
 * Abstrae proveedores de investigación y generación con fallbacks desacoplados.
 */
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import type { AssetItem, ReferenceItem, VisualBeat, VisualPlan } from "@la-veinte/studio-contract";

export interface VisualAssetFilter {
  category?: string;
  type?: "official" | "reference_based" | "generic" | "user_provided";
  query?: string;
  tag?: string;
  onlyFavorites?: boolean;
}

export interface UserAssetPreferences {
  favorites: string[];
  blocked: string[];
}

export interface GenerateAssetRequest {
  entity: string;
  category?: string;
  investigateReferences?: boolean;
  orientations?: string[];
  stylePrompt?: string;
}

export interface GenerateAssetResult {
  ok: boolean;
  providerStatus: "READY" | "UNAVAILABLE" | "PENDING";
  asset?: AssetItem;
  userMessage?: string;
  suggestedAssets?: AssetItem[];
}

export interface VisualAssetGenerator {
  research(entity: string): Promise<ReferenceItem | null>;
  generate(request: GenerateAssetRequest): Promise<GenerateAssetResult>;
  status(jobId: string): Promise<{ status: string; progress: number }>;
}

export class VisualAssetService implements VisualAssetGenerator {
  private repoDir: string;
  private assetRegistryPath: string;
  private referenceRegistryPath: string;
  private userPrefsPath: string;
  private uploadsDir: string;

  constructor(repoDir: string) {
    this.repoDir = repoDir;
    this.assetRegistryPath = path.join(repoDir, "assets", "editorial", "asset-registry.json");
    this.referenceRegistryPath = path.join(repoDir, "assets", "editorial", "reference-registry.json");
    this.userPrefsPath = path.join(repoDir, "assets", "editorial", "user-preferences.json");
    this.uploadsDir = path.join(repoDir, "assets", "editorial", "user_uploads");
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  // ── Preferencias de Usuario (Favoritos y Bloqueados) ──
  private readUserPrefs(): UserAssetPreferences {
    try {
      if (fs.existsSync(this.userPrefsPath)) {
        return JSON.parse(fs.readFileSync(this.userPrefsPath, "utf-8")) as UserAssetPreferences;
      }
    } catch { /* fallback */ }
    return { favorites: [], blocked: [] };
  }

  private writeUserPrefs(prefs: UserAssetPreferences): void {
    try {
      fs.writeFileSync(this.userPrefsPath, JSON.stringify(prefs, null, 2), "utf-8");
    } catch (err) {
      console.error("[VisualAssetService] Error guardando user-preferences:", err);
    }
  }

  // ── Lectura de Registros ──
  public listAssets(filter?: VisualAssetFilter): AssetItem[] {
    if (!fs.existsSync(this.assetRegistryPath)) return [];
    try {
      const data = JSON.parse(fs.readFileSync(this.assetRegistryPath, "utf-8"));
      const rawAssets: AssetItem[] = data.assets || [];
      const prefs = this.readUserPrefs();

      let assets = rawAssets.map((a) => ({
        ...a,
        favorite: prefs.favorites.includes(a.id),
        blocked: prefs.blocked.includes(a.id),
      }));

      if (filter) {
        if (filter.category && filter.category !== "all" && filter.category !== "todo") {
          assets = assets.filter((a) => a.category.toLowerCase() === filter.category!.toLowerCase());
        }
        if (filter.type) {
          assets = assets.filter((a) => a.type === filter.type);
        }
        if (filter.tag) {
          assets = assets.filter((a) => a.tags?.some((t) => t.toLowerCase() === filter.tag!.toLowerCase()));
        }
        if (filter.onlyFavorites) {
          assets = assets.filter((a) => a.favorite);
        }
        if (filter.query && filter.query.trim()) {
          const q = filter.query.toLowerCase().trim();
          assets = assets.filter(
            (a) =>
              a.id.toLowerCase().includes(q) ||
              a.entity.toLowerCase().includes(q) ||
              a.category.toLowerCase().includes(q) ||
              a.tags?.some((t) => t.toLowerCase().includes(q))
          );
        }
      }

      return assets;
    } catch (err) {
      console.error("[VisualAssetService] Error listando assets:", err);
      return [];
    }
  }

  public getAsset(id: string): AssetItem | null {
    const assets = this.listAssets();
    return assets.find((a) => a.id === id) ?? null;
  }

  public toggleFavorite(assetId: string): { assetId: string; favorite: boolean } {
    const prefs = this.readUserPrefs();
    const isFav = prefs.favorites.includes(assetId);
    if (isFav) {
      prefs.favorites = prefs.favorites.filter((x) => x !== assetId);
    } else {
      prefs.favorites.push(assetId);
    }
    this.writeUserPrefs(prefs);
    return { assetId, favorite: !isFav };
  }

  public toggleBlock(assetId: string): { assetId: string; blocked: boolean } {
    const prefs = this.readUserPrefs();
    const isBlocked = prefs.blocked.includes(assetId);
    if (isBlocked) {
      prefs.blocked = prefs.blocked.filter((x) => x !== assetId);
    } else {
      prefs.blocked.push(assetId);
    }
    this.writeUserPrefs(prefs);
    return { assetId, blocked: !isBlocked };
  }

  public saveUploadedAsset(
    filename: string,
    fileBuffer: Buffer,
    meta: {
      entity: string;
      category?: string;
      type?: "user_provided" | "reference_based";
      tags?: string[];
      source?: string;
    }
  ): AssetItem {
    const cleanName = `${Date.now()}_${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const destPath = path.join(this.uploadsDir, cleanName);
    fs.writeFileSync(destPath, fileBuffer);

    const relFile = `user_uploads/${cleanName}`;
    const newAsset: AssetItem = {
      id: `user_${Date.now()}`,
      file: relFile,
      type: meta.type || "user_provided",
      entity: meta.entity || "Material propio",
      category: meta.category || "general",
      tags: meta.tags || ["propio", meta.entity.toLowerCase()],
      orientation: ["16:9", "9:16"],
      based_on_verified_references: false,
      reference_ids: [],
      style_version: "lv-editorial-v1",
      meta: {
        source: meta.source || "Aportado por el usuario",
        license: "user-provided",
      },
      favorite: false,
      blocked: false,
      timesUsed: 0,
    };

    if (fs.existsSync(this.assetRegistryPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(this.assetRegistryPath, "utf-8"));
        data.assets = data.assets || [];
        data.assets.push(newAsset);
        data.count = data.assets.length;
        fs.writeFileSync(this.assetRegistryPath, JSON.stringify(data, null, 2), "utf-8");
      } catch (err) {
        console.error("[VisualAssetService] Error actualizando asset registry con upload:", err);
      }
    }

    return newAsset;
  }

  // ── Referencias Reales ──
  public listReferences(): ReferenceItem[] {
    if (!fs.existsSync(this.referenceRegistryPath)) return [];
    try {
      const data = JSON.parse(fs.readFileSync(this.referenceRegistryPath, "utf-8"));
      return data.references || [];
    } catch {
      return [];
    }
  }

  public async research(entity: string): Promise<ReferenceItem | null> {
    const refs = this.listReferences();
    const existing = refs.find((r) => r.entity.toLowerCase() === entity.toLowerCase() || r.id.toLowerCase() === entity.toLowerCase());
    if (existing) return existing;

    // Ejecución de script de investigación factual Python bajo demanda
    return new Promise((resolve) => {
      const scriptCode = `
import json, sys
from pathlib import Path
REPO = Path(r"${this.repoDir}")
sys.path.insert(0, str(REPO / "backend"))
from app.visual.editorial.reference_research import ReferenceResearcher
res = ReferenceResearcher()
ref = res.get_reference("${entity.replace(/"/g, '\\"')}")
if ref:
    print(json.dumps(ref.to_dict()))
else:
    print("{}")
`;
      const proc = spawn("python", ["-c", scriptCode], { cwd: this.repoDir });
      let out = "";
      proc.stdout.on("data", (d) => { out += d.toString(); });
      proc.on("close", (code) => {
        if (code === 0 && out.trim() && out.trim() !== "{}") {
          try {
            resolve(JSON.parse(out.trim()) as ReferenceItem);
          } catch {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      });
    });
  }

  // ── Generación de Asset (Desacoplada y con Fallback Seguro) ──
  public async generate(request: GenerateAssetRequest): Promise<GenerateAssetResult> {
    // 1. Buscar si ya existe una referencia o asset exacto
    const existingAssets = this.listAssets({ query: request.entity });
    if (existingAssets.length > 0) {
      return {
        ok: true,
        providerStatus: "READY",
        asset: existingAssets[0],
        userMessage: `Se encontró un asset coincidente en la biblioteca: ${existingAssets[0].entity}`,
        suggestedAssets: existingAssets.slice(0, 4),
      };
    }

    // 2. Investigar referencias factuales si se solicitó
    let foundRef: ReferenceItem | null = null;
    if (request.investigateReferences !== false) {
      foundRef = await this.research(request.entity);
    }

    // 3. Fallback claro y transparente si no hay provider generativo activo
    const suggestedGeneric = this.listAssets({ type: "generic" });
    return {
      ok: false,
      providerStatus: "UNAVAILABLE",
      userMessage: `Generación automática no disponible para "${request.entity}". Puedes seleccionar una imagen genérica contextual, elegir un asset existente o subir una fotografía/documento de referencia propio.`,
      suggestedAssets: suggestedGeneric.slice(0, 4),
    };
  }

  public async status(_jobId: string): Promise<{ status: string; progress: number }> {
    return { status: "IDLE", progress: 100 };
  }

  // ── Plan Visual del Proyecto ──
  public getProjectVisualPlan(projectId: string): VisualPlan | null {
    const projectDir = path.join(this.repoDir, "data", "projects", projectId);
    const planP = path.join(projectDir, "visual-plan.json");
    if (!fs.existsSync(planP)) {
      // Si no existe pero existe en data/tts/video/:id/
      const videoPlanP = path.join(this.repoDir, "data", "tts", "video", projectId, "visual-plan.json");
      if (fs.existsSync(videoPlanP)) {
        try {
          return JSON.parse(fs.readFileSync(videoPlanP, "utf-8")) as VisualPlan;
        } catch { return null; }
      }
      return null;
    }
    try {
      return JSON.parse(fs.readFileSync(planP, "utf-8")) as VisualPlan;
    } catch {
      return null;
    }
  }

  public updateProjectVisualBeat(projectId: string, beatId: string, patch: Partial<VisualBeat>): VisualPlan | null {
    const projectDir = path.join(this.repoDir, "data", "projects", projectId);
    const planP = path.join(projectDir, "visual-plan.json");
    const plan = this.getProjectVisualPlan(projectId);
    if (!plan) return null;

    const idx = plan.beats.findIndex((b) => b.beat_id === beatId);
    if (idx === -1) return null;

    plan.beats[idx] = {
      ...plan.beats[idx],
      ...patch,
      beat_id: beatId, // Inmutable
      start_s: plan.beats[idx].start_s, // Temporalmente canónico
      end_s: plan.beats[idx].end_s,
      duration_s: plan.beats[idx].duration_s,
    };

    // Recalcular visual_mix
    const total = Math.max(1, plan.beats.length);
    const spk = plan.beats.filter((b) => b.scene_type === "speaker_focus").length;
    const broll = plan.beats.filter((b) => ["real_building", "document_cover", "topic_image", "photo"].includes(b.scene_type)).length;
    const charts = plan.beats.filter((b) => ["stat_card", "comparison", "payroll_visual", "number"].includes(b.scene_type)).length;
    const brand = plan.beats.filter((b) => ["brand_opening", "brand_closing", "brand"].includes(b.scene_type)).length;

    plan.visual_mix = {
      speaker_focus_pct: Math.round((spk / total) * 1000) / 10,
      real_reference_broll_pct: Math.round((broll / total) * 1000) / 10,
      cards_charts_pct: Math.round((charts / total) * 1000) / 10,
      brand_identity_pct: Math.round((brand / total) * 1000) / 10,
    };

    fs.writeFileSync(planP, JSON.stringify(plan, null, 2), "utf-8");

    // También actualizar en data/tts/video/:id/ si existe
    const videoDir = path.join(this.repoDir, "data", "tts", "video", projectId);
    if (fs.existsSync(videoDir)) {
      fs.writeFileSync(path.join(videoDir, "visual-plan.json"), JSON.stringify(plan, null, 2), "utf-8");
    }

    return plan;
  }

  public getProjectReferences(projectId: string): Record<string, unknown> | null {
    const projectDir = path.join(this.repoDir, "data", "projects", projectId);
    const refP = path.join(projectDir, "reference-research.json");
    if (!fs.existsSync(refP)) {
      const videoRefP = path.join(this.repoDir, "data", "tts", "video", projectId, "reference-research.json");
      if (fs.existsSync(videoRefP)) {
        try { return JSON.parse(fs.readFileSync(videoRefP, "utf-8")); } catch { return null; }
      }
      return null;
    }
    try {
      return JSON.parse(fs.readFileSync(refP, "utf-8"));
    } catch {
      return null;
    }
  }
}
