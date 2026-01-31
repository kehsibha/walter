import OpenAI from "openai";
import { z } from "zod";
import { getServerEnv } from "@/lib/env/server";

let cached: OpenAI | null = null;

export function getOpenAI() {
  if (cached) return cached;
  const env = getServerEnv();
  cached = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  return cached;
}

export type OpenAIJsonOptions = {
  model?: string;
  temperature?: number;
};

export async function openaiJson<T>(
  schema: z.ZodType<T>,
  input: {
    system: string;
    user: string;
  },
  opts: OpenAIJsonOptions = {}
): Promise<T> {
  const client = getOpenAI();

  // We keep this intentionally robust: ask for JSON, parse, then validate with Zod.
  // (Response-formatting APIs vary by model family; this approach works across them.)
  const res = await client.chat.completions.create({
    model: opts.model ?? "gpt-5.2",
    temperature: opts.temperature ?? 0.2,
    messages: [
      { role: "system", content: `${input.system}\n\nReturn ONLY valid JSON.` },
      { role: "user", content: input.user },
    ],
  });

  const content = res.choices[0]?.message?.content ?? "";
  const firstBrace = content.indexOf("{");
  const lastBrace = content.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error(`OpenAI did not return JSON. Received: ${content.slice(0, 400)}`);
  }

  const jsonText = content.slice(firstBrace, lastBrace + 1);
  let parsedUnknown: unknown;
  try {
    parsedUnknown = JSON.parse(jsonText);
  } catch (e) {
    throw new Error(
      `Failed to parse OpenAI JSON: ${(e as Error).message}\n\nRaw: ${jsonText.slice(
        0,
        700
      )}`
    );
  }

  const validated = schema.safeParse(parsedUnknown);
  if (!validated.success) {
    throw new Error(
      `OpenAI JSON failed schema validation: ${validated.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`
    );
  }

  return validated.data;
}

