/**
 * alignment.ts — Esquema canónico de alineación temporal física generado por SmartMixer.
 * Es la ÚNICA fuente de verdad temporal para el renderizador visual y la UI.
 */
import { z } from "zod";

export const TimelineBlockTypeSchema = z.enum([
  "opening",
  "silence",
  "mic_click",
  "identity",
  "speech",
  "outro",
]);
export type TimelineBlockType = z.infer<typeof TimelineBlockTypeSchema>;

export const MixTimelineBlockSchema = z.object({
  type: TimelineBlockTypeSchema,
  startMs: z.number(),
  endMs: z.number(),
  durationMs: z.number(),
  turnId: z.string().nullable().optional(),
  speaker: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
});
export type MixTimelineBlock = z.infer<typeof MixTimelineBlockSchema>;

export const TurnAlignmentSchema = z.object({
  turnId: z.string(),
  speaker: z.string(),
  startMs: z.number(),
  endMs: z.number(),
  durationMs: z.number(),
});
export type TurnAlignment = z.infer<typeof TurnAlignmentSchema>;

export const MixAlignmentManifestSchema = z.object({
  version: z.literal(1).default(1),
  masterPath: z.string(),
  durationMs: z.number(),
  blocks: z.array(MixTimelineBlockSchema),
  turns: z.array(TurnAlignmentSchema),
});
export type MixAlignmentManifest = z.infer<typeof MixAlignmentManifestSchema>;
