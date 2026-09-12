/**
 * Contratos de producción visual, dirección editorial, assets y referencias reales.
 */
import { z } from "zod";

export const OutputFormatSchema = z.enum(["preview", "16x9", "9x16"]);
export type OutputFormat = z.infer<typeof OutputFormatSchema>;

export const VideoQualitySchema = z.enum(["rapida", "produccion", "maxima"]);
export type VideoQuality = z.infer<typeof VideoQualitySchema>;

export const VisualStyleSchema = z.enum(["sobrio", "equilibrado", "dinamico"]);
export type VisualStyle = z.infer<typeof VisualStyleSchema>;

export const VisualFidelitySchema = z.enum(["referencias_reales", "contextual"]);
export type VisualFidelity = z.infer<typeof VisualFidelitySchema>;

export const SourcesPrioritySchema = z.enum(["oficiales", "amplias"]);
export type SourcesPriority = z.infer<typeof SourcesPrioritySchema>;

export const AssetTypeSchema = z.enum(["official", "reference_based", "generic", "user_provided"]);
export type AssetType = z.infer<typeof AssetTypeSchema>;

export const ProductionPreferencesSchema = z.object({
  mode: z.enum(["audio", "audio_video"]).default("audio_video"),
  outputFormats: z.array(OutputFormatSchema).default(["preview", "16x9", "9x16"]),
  videoQuality: VideoQualitySchema.default("produccion"),
  visualStyle: VisualStyleSchema.default("equilibrado"),
  visualElements: z
    .object({
      realReferences: z.boolean().default(true),
      illustrations: z.boolean().default(true),
      buildings: z.boolean().default(true),
      documents: z.boolean().default(true),
      logos: z.boolean().default(true),
      charts: z.boolean().default(true),
      timelines: z.boolean().default(true),
      diagrams: z.boolean().default(true),
      keyStats: z.boolean().default(true),
    })
    .default({
      realReferences: true,
      illustrations: true,
      buildings: true,
      documents: true,
      logos: true,
      charts: true,
      timelines: true,
      diagrams: true,
      keyStats: true,
    }),
  researchReferences: z.boolean().default(true),
  visualFidelity: VisualFidelitySchema.default("referencias_reales"),
  sourcesPriority: SourcesPrioritySchema.default("oficiales"),
  showSources: z.boolean().default(true),
  autoApproveVerified: z.boolean().default(true),
  participantsMode: z.enum(["auto", "manual"]).default("auto"),
  selectedParticipants: z.array(z.string()).default(["EDUARDO", "ANDREA", "JAVIER RÍOS", "RODRIGO TORRES"]),
  customDocuments: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        path: z.string().optional(),
        type: z.string().default("document"),
      })
    )
    .default([]),
  customVisualReferences: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        path: z.string().optional(),
        usage: z.enum(["reference", "direct"]).default("reference"),
      })
    )
    .default([]),
});
export type ProductionPreferences = z.infer<typeof ProductionPreferencesSchema>;

export const VisualBeatSchema = z.object({
  beat_id: z.string(),
  turn_id: z.string(),
  speaker: z.string(),
  start_s: z.number(),
  end_s: z.number(),
  duration_s: z.number(),
  scene_type: z.string(),
  resolved_asset: z.record(z.string(), z.unknown()).nullable().optional(),
  chart_type: z.string().nullable().optional(),
  editorial_reason: z.string(),
  display_text: z.string(),
  overlay_logos: z.array(z.string()).default([]),
});
export type VisualBeat = z.infer<typeof VisualBeatSchema>;

export const VisualPlanSchema = z.object({
  project_id: z.string(),
  duration_s: z.number(),
  total_beats: z.number(),
  visual_mix: z.record(z.string(), z.number()).default({}),
  beats: z.array(VisualBeatSchema),
});
export type VisualPlan = z.infer<typeof VisualPlanSchema>;

export const AssetItemSchema = z.object({
  id: z.string(),
  file: z.string(),
  type: AssetTypeSchema,
  entity: z.string(),
  category: z.string(),
  tags: z.array(z.string()).default([]),
  orientation: z.array(z.string()).default(["16:9", "9:16"]),
  based_on_verified_references: z.boolean().default(false),
  reference_ids: z.array(z.string()).default([]),
  style_version: z.string().default("lv-editorial-v1"),
  meta: z
    .object({
      source: z.string().optional(),
      license: z.string().optional(),
    })
    .default({}),
  favorite: z.boolean().optional(),
  blocked: z.boolean().optional(),
  timesUsed: z.number().optional(),
});
export type AssetItem = z.infer<typeof AssetItemSchema>;

export const ReferenceItemSchema = z.object({
  id: z.string(),
  entity: z.string(),
  type: z.string(),
  research_date: z.string().optional(),
  sources: z
    .array(
      z.object({
        url: z.string(),
        title: z.string().optional(),
        source_type: z.string().optional(),
        license: z.string().optional(),
      })
    )
    .default([]),
  verified_characteristics: z.record(z.string(), z.unknown()).default({}),
  status: z.enum(["verified", "unverified", "contextual"]).default("verified"),
});
export type ReferenceItem = z.infer<typeof ReferenceItemSchema>;
