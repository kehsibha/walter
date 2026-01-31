import { z } from "zod";

function emptyToUndefined(v: unknown) {
  return typeof v === "string" && v.trim() === "" ? undefined : v;
}

const ServerEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  OPENAI_API_KEY: z.string().min(1),
  EXA_API_KEY: z.string().min(1),

  FAL_KEY: z.string().min(1),
  ELEVENLABS_API_KEY: z.string().min(1),

  HYPERSPELL_API_KEY: z.string().min(1),
  HYPERSPELL_BASE_URL: z.string().url().optional(),
});

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

let cached: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cached) return cached;

  const parsed = ServerEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,

    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    EXA_API_KEY: process.env.EXA_API_KEY,

    FAL_KEY: process.env.FAL_KEY,
    ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,

    HYPERSPELL_API_KEY: process.env.HYPERSPELL_API_KEY,
    HYPERSPELL_BASE_URL: emptyToUndefined(process.env.HYPERSPELL_BASE_URL),
  });

  if (!parsed.success) {
    throw new Error(
      `Missing/invalid server env: ${parsed.error.issues
        .map((i) => i.path.join("."))
        .join(", ")}`
    );
  }

  cached = parsed.data;
  return parsed.data;
}

