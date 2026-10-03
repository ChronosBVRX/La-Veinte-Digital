/**
 * ProgressManager — Single Source of Truth para el progreso de producción
 * de episodios en AI Radio Studio V1.1 (Wave Studio).
 *
 * Calcula el progreso real determinista a partir de los artefactos en disco
 * y el estado de los workers (audio y video), sin falsos temporizadores.
 */
import fs from "node:fs";
import path from "node:path";
import {
  type EpisodeProductionProgress,
  type CanonicalProgressState,
  type ProductionPhase,
  type ResearchBundle,
  calculateOverallPercent,
  CANONICAL_PROGRESS_LABELS,
} from "@la-veinte/studio-contract";
import type { ProjectStore } from "./project-store";
import { leerJob, resumenJob } from "../../worker/job-store";
import { leerVisualJob } from "../../worker/visual-job-store";

export class ProgressManager {
  constructor(private store: ProjectStore, private repoRoot: string) {}

  /**
   * Obtiene o calcula el progreso canónico del proyecto.
   */
  public getProgress(projectId: string): EpisodeProductionProgress {
    const project = this.store.get(projectId);
    const now = new Date().toISOString();

    if (!project) {
      return {
        projectId,
        state: "error",
        phase: "investigacion",
        overallPercent: 0,
        currentStagePercent: 0,
        currentAction: "Proyecto no encontrado",
        timings: { updatedAt: now, elapsedSeconds: 0 },
        format: "audio_video",
        error: {
          stage: "investigacion",
          message: "El proyecto no existe en el almacén local",
          recoverable: false,
          actionSuggested: "Crea un nuevo proyecto desde el inicio",
        },
      };
    }

    const format = project.config?.productionPreferences?.mode === "audio" ? "audio_only" : "audio_video";
    const phaseProgress: Record<ProductionPhase, number> = {
      investigacion: 0,
      guion: 0,
      voces: 0,
      audio: 0,
      visual: 0,
      video: 0,
      exportacion: 0,
    };

    // 1. Fase Investigación
    let claimsCount = 0;
    let sourcesCount = 0;
    const research = project.research || this.store.readArtifact<ResearchBundle>(projectId, "research.json");
    if (research && Array.isArray(research.claims) && research.claims.length > 0) {
      phaseProgress.investigacion = 1.0;
      claimsCount = research.claims.length;
      sourcesCount = Array.isArray(research.documents) ? research.documents.length : 0;
    } else if (project.state === "RESEARCHING") {
      phaseProgress.investigacion = 0.5;
    }

    // 2. Fase Guion
    let turnsCount = 0;
    const script = project.script || this.store.readScript(projectId);
    if (script && Array.isArray(script.turns) && script.turns.length > 0) {
      phaseProgress.investigacion = 1.0;
      phaseProgress.guion = 1.0;
      turnsCount = script.turns.length;
    } else if (
      project.state === "SCRIPT_GENERATING" ||
      project.state === "GENERATING_PROPOSALS" ||
      project.state === "PROPOSAL_READY" ||
      project.state === "PROPOSAL_APPROVED"
    ) {
      phaseProgress.guion = 0.5;
    }

    // 3. Fase Voces y 4. Fase Audio
    let completedTurns = 0;
    let totalSpeechTurns = turnsCount;
    const audioJob = leerJob();
    const isAudioJobActive = audioJob && audioJob.id === projectId;

    if (isAudioJobActive && Array.isArray(audioJob.bloques)) {
      totalSpeechTurns = audioJob.bloques.length;
      completedTurns = audioJob.bloques.filter((b) => b.estado === "generado").length;
      phaseProgress.voces = totalSpeechTurns > 0 ? Math.min(1.0, completedTurns / totalSpeechTurns) : 0;
    } else if (project.master?.master || this.hasMasterAudio(projectId)) {
      phaseProgress.voces = 1.0;
      completedTurns = totalSpeechTurns;
    }

    // ETA real de audio (RTF medido) y voz en curso, desde el job persistente
    let audioEtaSec: number | undefined;
    let currentVoice: string | null = null;
    if (isAudioJobActive && audioJob && audioJob.estado !== "DONE") {
      try {
        const resumen = resumenJob(audioJob);
        const etaMin = typeof resumen.etaMin === "number" ? resumen.etaMin : 0;
        if (etaMin > 0) audioEtaSec = Math.round(etaMin * 60);
      } catch {
        // Sin métricas suficientes: no se muestra ETA
      }
      const bloques = audioJob.bloques ?? [];
      if (bloques.length > 0) {
        const idx = Math.max(0, Math.min(audioJob.bloqueActual ?? 0, bloques.length - 1));
        currentVoice = bloques[idx]?.locutor ?? null;
      }
    }

    // Comprobar si el master de audio existe físicamente
    const hasMaster = this.hasMasterAudio(projectId);
    if (hasMaster) {
      phaseProgress.voces = 1.0;
      phaseProgress.audio = 1.0;
    } else if (isAudioJobActive && audioJob.estado === "DONE") {
      phaseProgress.audio = 0.8;
    }

    // 5. Fase Visual (solo si audio_video)
    let totalScenes = turnsCount;
    let completedScenes = 0;
    let visualEtaSec: number | undefined;
    const visualJob = leerVisualJob(projectId);
    const hasVisualPlan = fs.existsSync(path.join(this.repoRoot, "data", "projects", projectId, "visual-plan.json"));

    if (format === "audio_video") {
      if (hasVisualPlan || (project.visual && project.visual.status === "READY")) {
        phaseProgress.visual = 1.0;
      } else if (visualJob && (visualJob.status === "RENDERING" || visualJob.status === "READY")) {
        phaseProgress.visual = 1.0;
      }

      // 6. Fase Video
      const videoFiles = this.getRenderedVideoFiles(projectId);
      if (videoFiles.video9x16 || videoFiles.video16x9) {
        phaseProgress.visual = 1.0;
        phaseProgress.video = 1.0;
        phaseProgress.exportacion = 1.0;
      } else if (visualJob && visualJob.status === "RENDERING") {
        phaseProgress.visual = 1.0;
        const progressPercent = visualJob.progress?.overallPercent ?? visualJob.progress?.percent ?? 0;
        phaseProgress.video = Math.max(0.05, Math.min(0.99, progressPercent / 100));
        if (visualJob.progress?.totalFrames && visualJob.progress.totalFrames > 0) {
          totalScenes = visualJob.progress.totalFrames;
          completedScenes = visualJob.progress.frame;
        }
        if (typeof visualJob.progress?.etaSec === "number" && visualJob.progress.etaSec > 0) {
          visualEtaSec = visualJob.progress.etaSec;
        } else if (progressPercent > 0) {
          const elapsed = visualJob.progress?.elapsedSec ?? 0;
          visualEtaSec = Math.max(0, Math.round((elapsed * (100 - progressPercent)) / progressPercent));
        }
      }
    } else {
      // audio_only
      if (hasMaster) {
        phaseProgress.exportacion = 1.0;
      }
    }

    // Calcular porcentaje global
    const overallPercent = calculateOverallPercent(format, phaseProgress);

    // Determinar fase y estado canónico
    let state: CanonicalProgressState = "idle";
    let phase: ProductionPhase = "investigacion";
    let currentStagePercent = 0;
    let currentAction = CANONICAL_PROGRESS_LABELS.idle;
    let counts: EpisodeProductionProgress["counts"] = undefined;
    let error: EpisodeProductionProgress["error"] = undefined;

    // Detectar errores o cancelaciones
    if (project.state === "FAILED" || (visualJob && visualJob.status === "FAILED")) {
      state = "error";
      const failedStage: ProductionPhase = visualJob?.status === "FAILED" ? "video" : "guion";
      phase = failedStage;
      const errDetail = project.error || visualJob?.error || "Error durante el procesamiento";
      error = {
        stage: failedStage,
        message: errDetail,
        recoverable: true,
        actionSuggested: "Reintentar desde la última etapa guardada",
      };
      currentAction = "Producción detenida — " + errDetail;
    } else if (visualJob && visualJob.status === "CANCELLED") {
      state = "cancelado";
      currentAction = "Producción de video cancelada";
    } else if (overallPercent >= 100) {
      state = "completado";
      phase = "exportacion";
      currentStagePercent = 100;
      currentAction = "Episodio producido al 100% y listo para reproducir";
    } else if (format === "audio_video" && visualJob && visualJob.status === "RENDERING") {
      state = "renderizando_video";
      phase = "video";
      currentStagePercent = Math.round(phaseProgress.video * 100);
      const vp = visualJob.progress;
      counts = {
        current: vp?.frame ?? completedScenes,
        total: vp?.totalFrames ?? totalScenes,
        unit: vp?.unit ?? "fotogramas",
      };
      currentAction = vp
        ? `Renderizando video Wave Premium · formato ${vp.format} al ${vp.percent}% (${Math.round(phaseProgress.video * 100)}% de la fase de video)`
        : "Preparando storyboard y primer fotograma del video Wave Premium...";
    } else if (format === "audio_video" && hasMaster && phaseProgress.visual < 1.0) {
      state = "planificando_visuales";
      phase = "visual";
      currentStagePercent = Math.round(phaseProgress.visual * 100);
      currentAction = "Planificando storyboard Wave Premium...";
    } else if (isAudioJobActive && audioJob.estado === "RUNNING") {
      state = "generando_voces";
      phase = "voces";
      currentStagePercent = Math.round(phaseProgress.voces * 100);
      counts = {
        current: completedTurns,
        total: totalSpeechTurns,
        unit: "turnos",
      };
      currentAction = currentVoice
        ? `Sintetizando locución: ${completedTurns}/${totalSpeechTurns} turnos · voz ${currentVoice}`
        : `Sintetizando locución: ${completedTurns} de ${totalSpeechTurns} turnos...`;
    } else if (isAudioJobActive && audioJob.estado === "DONE" && !hasMaster) {
      state = "mezclando_audio";
      phase = "audio";
      currentStagePercent = 90;
      currentAction = "Ensamblando master final y cortinillas...";
    } else if (phaseProgress.guion < 1.0 && project.state === "SCRIPT_GENERATING") {
      state = "generando_guion";
      phase = "guion";
      currentStagePercent = 50;
      currentAction = "Escribiendo guion y diálogos normativos...";
    } else if (phaseProgress.investigacion < 1.0 && project.state === "RESEARCHING") {
      state = "investigando";
      phase = "investigacion";
      currentStagePercent = 50;
      currentAction = "Consultando biblioteca normativa...";
    } else if (phaseProgress.guion >= 1.0 && !hasMaster) {
      state = "idle";
      phase = "voces";
      currentStagePercent = 0;
      currentAction = `Guion listo (${turnsCount} turnos). Listo para producir audio.`;
    } else if (phaseProgress.investigacion >= 1.0 && phaseProgress.guion < 1.0) {
      state = "idle";
      phase = "guion";
      currentStagePercent = 0;
      currentAction = `Investigación completada (${sourcesCount} fuentes, ${claimsCount} hechos). Listo para generar guion.`;
    } else if (hasMaster && format === "audio_video" && phaseProgress.video < 1.0) {
      state = "idle";
      phase = "video";
      currentStagePercent = 0;
      currentAction = "Master de audio listo. Listo para renderizar video.";
    }

    const startedAt = project.createdAt;
    const elapsedSeconds = Math.max(0, Math.round((Date.now() - new Date(startedAt).getTime()) / 1000));
    const estimatedRemainingSeconds =
      phase === "video" && visualEtaSec !== undefined
        ? visualEtaSec
        : phase === "voces" && audioEtaSec !== undefined
        ? audioEtaSec
        : undefined;

    // Rutas de salida
    const outFiles = this.getRenderedVideoFiles(projectId);
    const audioMasterPath = this.getMasterAudioPath(projectId);
    const folderPath = path.join(this.repoRoot, "data", "tts", "video", projectId);

    const progress: EpisodeProductionProgress = {
      projectId,
      state,
      phase,
      overallPercent,
      currentStagePercent,
      currentAction,
      counts,
      timings: {
        startedAt,
        updatedAt: now,
        elapsedSeconds,
        ...(estimatedRemainingSeconds !== undefined && estimatedRemainingSeconds > 0
          ? { estimatedRemainingSeconds }
          : {}),
      },
      format,
      orientation: project.config?.productionPreferences?.outputFormats?.includes("9:16") ? "9:16" : "16:9",
      error,
      outputs: {
        audioMasterPath: audioMasterPath || undefined,
        videoPath9x16: outFiles.video9x16 || undefined,
        videoPath16x9: outFiles.video16x9 || undefined,
        previewPath: outFiles.preview || undefined,
        folderPath,
      },
    };

    // Guardar copia atómica en disco
    this.saveProgress(projectId, progress);
    return progress;
  }

  public saveProgress(projectId: string, progress: EpisodeProductionProgress): void {
    const projectDir = path.join(this.repoRoot, "data", "projects", projectId);
    try {
      fs.mkdirSync(projectDir, { recursive: true });
      const filePath = path.join(projectDir, "progress.json");
      const tmpPath = filePath + "." + process.pid + ".tmp";
      fs.writeFileSync(tmpPath, JSON.stringify(progress, null, 2), "utf8");
      try {
        fs.renameSync(tmpPath, filePath);
      } catch {
        fs.copyFileSync(tmpPath, filePath);
        fs.rmSync(tmpPath, { force: true });
      }
    } catch {
      // Mejor esfuerzo en persistencia
    }
  }

  private hasMasterAudio(projectId: string): boolean {
    const p1 = path.join(this.repoRoot, "data", "tts", "master", `programa-${projectId}.mp3`);
    const p2 = path.join(this.repoRoot, "data", "tts", "master", `programa-${projectId}.wav`);
    const p3 = path.join(this.repoRoot, "data", "projects", projectId, "master", "master.mp3");
    return (fs.existsSync(p1) && fs.statSync(p1).size > 1000) ||
           (fs.existsSync(p2) && fs.statSync(p2).size > 1000) ||
           (fs.existsSync(p3) && fs.statSync(p3).size > 1000);
  }

  private getMasterAudioPath(projectId: string): string | null {
    const p1 = path.join(this.repoRoot, "data", "tts", "master", `programa-${projectId}.mp3`);
    if (fs.existsSync(p1)) return p1;
    const p2 = path.join(this.repoRoot, "data", "tts", "master", `programa-${projectId}.wav`);
    if (fs.existsSync(p2)) return p2;
    return null;
  }

  private getRenderedVideoFiles(projectId: string): { preview?: string; video9x16?: string; video16x9?: string } {
    const videoDir = path.join(this.repoRoot, "data", "tts", "video", projectId);
    const res: { preview?: string; video9x16?: string; video16x9?: string } = {};

    const p9x16 = path.join(videoDir, `episodio-${projectId}-9x16.mp4`);
    if (fs.existsSync(p9x16) && fs.statSync(p9x16).size > 50000) {
      res.video9x16 = p9x16;
    }

    const p16x9 = path.join(videoDir, `episodio-${projectId}-16x9.mp4`);
    if (fs.existsSync(p16x9) && fs.statSync(p16x9).size > 50000) {
      res.video16x9 = p16x9;
    }

    const pPrev = path.join(videoDir, `episodio-${projectId}-preview.mp4`);
    if (fs.existsSync(pPrev) && fs.statSync(pPrev).size > 20000) {
      res.preview = pPrev;
    } else if (res.video9x16) {
      res.preview = res.video9x16;
    }

    return res;
  }
}
