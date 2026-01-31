import { z } from "zod";

export const ExtractedPreferenceSchema = z.object({
  topic: z.string().min(1),
  category: z.string().min(1).optional(),
  geographic_scope: z.enum(["local", "state", "federal", "international"]).optional(),
  priority: z.number().int().min(1).max(10),
});

export const ExtractedPreferencesSchema = z.object({
  preferences: z.array(ExtractedPreferenceSchema).min(1).max(30),
});

export type ExtractedPreferences = z.infer<typeof ExtractedPreferencesSchema>;

