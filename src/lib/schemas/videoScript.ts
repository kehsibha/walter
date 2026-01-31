import { z } from "zod";

export const VideoScriptSchema = z.object({
  duration_seconds_target: z.number().int().min(15).max(40),
  hook: z.string().min(1),
  voiceover: z.string().min(1),
  pacing_notes: z.string().optional(),
  background_music_tone: z.string().optional(),
  text_overlays: z.array(z.string().min(1)).max(8).optional(),
  scenes: z
    .array(
      z.object({
        seconds: z.number().int().min(1).max(15),
        description: z.string().min(1),
        overlay: z.string().optional(),
      })
    )
    .min(2)
    .max(6),
});

export type VideoScript = z.infer<typeof VideoScriptSchema>;

