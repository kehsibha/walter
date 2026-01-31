import { z } from "zod";

export const AxiosSummarySchema = z.object({
  headline: z.string().min(1).max(80),
  lede: z.string().min(1).max(220),
  why_it_matters: z.string().min(1).max(420),
  key_facts: z.array(z.string().min(1)).min(3).max(6),
  the_big_picture: z.string().min(1).max(520),
  what_to_watch: z.array(z.string().min(1)).max(4).optional(),
  sources: z
    .array(
      z.object({
        title: z.string().min(1),
        url: z.string().url(),
        outlet: z.string().min(1).optional(),
      })
    )
    .min(1)
    .max(12),
});

export type AxiosSummary = z.infer<typeof AxiosSummarySchema>;

