import { z } from "zod";

function emptyToUndefined(v: unknown) {
  return typeof v === "string" && v.trim() === "" ? undefined : v;
}

const ClientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
});

export type ClientEnv = z.infer<typeof ClientEnvSchema>;

export function getClientEnv(): ClientEnv {
  const parsed = ClientEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: emptyToUndefined(process.env.NEXT_PUBLIC_SITE_URL),
  });
  if (!parsed.success) {
    throw new Error(
      `Missing/invalid client env: ${parsed.error.issues
        .map((i) => i.path.join("."))
        .join(", ")}`
    );
  }
  return parsed.data;
}

