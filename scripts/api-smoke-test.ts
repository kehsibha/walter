/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import fs from "node:fs/promises";
import path from "node:path";

import OpenAI from "openai";
import Exa from "exa-js";
import { ApiError, fal } from "@fal-ai/client";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

type TestResult = { ok: true } | { ok: false; error: string };
type SmokeLevel = "basic" | "deep";

function redactError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  // Avoid leaking obvious secrets if an SDK includes request info.
  return msg
    .replaceAll(process.env.OPENAI_API_KEY ?? "", "[REDACTED]")
    .replaceAll(process.env.EXA_API_KEY ?? "", "[REDACTED]")
    .replaceAll(process.env.FAL_KEY ?? "", "[REDACTED]")
    .replaceAll(process.env.ELEVENLABS_API_KEY ?? "", "[REDACTED]")
    .replaceAll(process.env.HYPERSPELL_API_KEY ?? "", "[REDACTED]");
}

async function tryLoadDotEnvFile(filename: string) {
  const p = path.join(process.cwd(), filename);
  try {
    const text = await fs.readFile(p, "utf8");
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      // Do not override process env already provided by the shell.
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // ignore missing files
  }
}

function getSmokeLevel(): SmokeLevel {
  const raw = (process.env.SMOKE_LEVEL ?? "basic").toLowerCase();
  return raw === "deep" ? "deep" : "basic";
}

async function testOpenAI(level: SmokeLevel): Promise<TestResult> {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return { ok: false, error: "Missing OPENAI_API_KEY" };
    const client = new OpenAI({ apiKey });
    const models = await client.models.list();
    const first = models.data?.[0]?.id ?? "(no models returned)";

    if (level === "basic") {
      console.log(`OpenAI: OK (models.list -> ${first})`);
      return { ok: true };
    }

    // Deep check: a tiny chat completion.
    const preferredModels = [
      process.env.OPENAI_SMOKE_MODEL,
      "gpt-4o-mini",
      "gpt-4.1-mini",
      "gpt-4.1",
      first,
    ].filter(Boolean) as string[];

    let lastErr: unknown = null;
    for (const model of preferredModels) {
      try {
        const res = await client.chat.completions.create({
          model,
          messages: [{ role: "user", content: 'Reply with exactly: {"pong":true}' }],
          temperature: 0,
          max_tokens: 20,
        });
        const content = res.choices[0]?.message?.content?.trim() ?? "";
        const ok = content.includes(`"pong"`) && content.includes("true");
        if (!ok) return { ok: false, error: `Unexpected response content: ${content.slice(0, 120)}` };
        console.log(`OpenAI: OK (chat.completions.create -> ${model})`);
        return { ok: true };
      } catch (e) {
        lastErr = e;
      }
    }

    return { ok: false, error: `OpenAI deep test failed: ${redactError(lastErr)}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: redactError(e) };
  }
}

async function testElevenLabs(level: SmokeLevel): Promise<TestResult> {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) return { ok: false, error: "Missing ELEVENLABS_API_KEY" };
    const client = new ElevenLabsClient({ apiKey });
    const voices = await client.voices.search();
    const maybeVoices = voices as unknown as { voices?: unknown[] };
    const count = Array.isArray(maybeVoices.voices) ? maybeVoices.voices.length : undefined;

    if (level === "basic") {
      console.log(`ElevenLabs: OK (voices.search${typeof count === "number" ? ` -> ${count} voices` : ""})`);
      return { ok: true };
    }

    // Deep check: avoid consuming character credits by default.
    // This validates auth + account access.
    const me = await client.user.get();
    const sub = await client.user.subscription.get();
    const id = (me as any)?.user_id ?? (me as any)?.id ?? "(unknown-user)";
    const tier = (sub as any)?.tier ?? (sub as any)?.subscription_tier ?? "(unknown-tier)";
    console.log(`ElevenLabs: OK (user.get + subscription.get -> ${id}, ${tier})`);

    // Optional: run a real TTS request (may consume credits). Enable explicitly.
    const shouldRunTts = process.env.ELEVENLABS_DEEP_TTS === "1";
    if (shouldRunTts) {
      const voiceId =
        process.env.ELEVENLABS_VOICE_ID ||
        // Default used elsewhere in repo.
        "21m00Tcm4TlvDq8ikWAM";
      const text = (process.env.ELEVENLABS_SMOKE_TEXT || "Hi.").slice(0, 80);
      // Use a cheaper low-latency model by default to reduce credit burn.
      const modelId = process.env.ELEVENLABS_SMOKE_TTS_MODEL || "eleven_flash_v2_5";
      const stream = await client.textToSpeech.convert(voiceId, {
        text,
        modelId,
        outputFormat: "mp3_22050_32",
        optimizeStreamingLatency: 1,
      });
      const reader = stream.getReader();
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) total += value.byteLength;
        if (total > 8_000) break; // enough to prove audio is streaming
      }
      if (total <= 0) return { ok: false, error: "No audio bytes received from ElevenLabs TTS" };
      console.log(`ElevenLabs: OK (optional TTS -> ${modelId}, ~${total} bytes)`);
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: redactError(e) };
  }
}

async function testExa(level: SmokeLevel): Promise<TestResult> {
  try {
    const apiKey = process.env.EXA_API_KEY;
    if (!apiKey) return { ok: false, error: "Missing EXA_API_KEY" };
    const exa = new Exa(apiKey);
    if (level === "basic") {
      const res = await exa.search("smoke test", { numResults: 1 });
      const maybeResults = res as unknown as { results?: Array<{ url?: string }> };
      const firstUrl = maybeResults.results?.[0]?.url ?? "(no results)";
      console.log(`Exa: OK (search -> ${firstUrl})`);
      return { ok: true };
    }

    const res = await exa.searchAndContents("what is smoke testing", {
      numResults: 1,
      text: { maxCharacters: 400 },
      highlights: false,
    } as any);
    const firstText = (res as any)?.results?.[0]?.text;
    if (typeof firstText !== "string" || firstText.trim().length < 40) {
      return { ok: false, error: "Exa deep test returned no usable text content" };
    }
    console.log("Exa: OK (searchAndContents -> text snippet returned)");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: redactError(e) };
  }
}

async function testFal(level: SmokeLevel): Promise<TestResult> {
  try {
    const key = process.env.FAL_KEY;
    if (!key) return { ok: false, error: "Missing FAL_KEY" };

    fal.config({ credentials: key });

    if (level === "basic") {
      // This validates auth without running a model job.
      const blob = new Blob([`walter smoke test ${new Date().toISOString()}`], { type: "text/plain" });
      const url = await fal.storage.upload(blob, { lifecycle: { expiresIn: "immediate" } });
      console.log(`fal.ai: OK (storage.upload -> ${url})`);
      return { ok: true };
    }

    // Deep check: by default we *still* avoid running a model job (cost).
    // To force an actual model run, set `FAL_DEEP_RUN_MODEL=1`.
    const shouldRunModel = process.env.FAL_DEEP_RUN_MODEL === "1";
    if (!shouldRunModel) {
      const blob = new Blob([`walter smoke test ${new Date().toISOString()}`], { type: "text/plain" });
      const url = await fal.storage.upload(blob, { lifecycle: { expiresIn: "immediate" } });
      console.log(`fal.ai: OK (deep via storage.upload; set FAL_DEEP_RUN_MODEL=1 to run a model)`);
      return { ok: true };
    }

    const prompt =
      process.env.FAL_SMOKE_PROMPT ||
      "A minimal black square on a white background. Studio lighting. Clean.";

    // Some accounts/keys may not have access to specific endpoints.
    // We try a small set of common/cheap endpoints and stop on first success.
    const candidates: Array<{ endpointId: string; input: Record<string, unknown> }> = [
      {
        endpointId: "fal-ai/fast-lightning-sdxl",
        input: {
          prompt,
          image_size: "square",
          num_inference_steps: "1",
          num_images: 1,
          enable_safety_checker: true,
          format: "jpeg",
        },
      },
      {
        endpointId: "fal-ai/stable-diffusion-v15",
        input: {
          prompt,
          image_size: "square",
          num_inference_steps: 5,
          num_images: 1,
          enable_safety_checker: true,
          format: "jpeg",
        },
      },
      {
        endpointId: "fal-ai/fast-sdxl",
        input: {
          prompt,
          image_size: "square",
          num_inference_steps: 5,
          num_images: 1,
          enable_safety_checker: true,
          format: "jpeg",
        },
      },
      {
        endpointId: "fal-ai/realistic-vision",
        input: {
          prompt,
          image_size: "square",
          num_inference_steps: 8,
          num_images: 1,
          enable_safety_checker: true,
          format: "jpeg",
        },
      },
    ];

    let lastErr: unknown = null;
    for (const c of candidates) {
      try {
        const res = await fal.run(c.endpointId as any, { input: c.input as any });
        const firstUrl = (res as any)?.images?.[0]?.url;
        if (typeof firstUrl !== "string" || !firstUrl.startsWith("http")) {
          return { ok: false, error: `fal.ai deep model run (${c.endpointId}) returned no image URL` };
        }
        console.log(`fal.ai: OK (run ${c.endpointId} -> ${firstUrl})`);
        return { ok: true };
      } catch (e) {
        lastErr = e;
        const msg =
          e instanceof ApiError
            ? `HTTP ${e.status}${e.requestId ? ` (requestId=${e.requestId})` : ""}: ${JSON.stringify(
                e.body
              ).slice(0, 600)}`
            : redactError(e);
        // If access is forbidden for this endpoint, try the next candidate.
        if (msg.includes("Forbidden") || msg.includes("Unauthorized")) {
          continue;
        }
        return { ok: false, error: msg };
      }
    }

    return { ok: false, error: `fal.ai deep test failed for all candidate endpoints: ${redactError(lastErr)}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: redactError(e) };
  }
}

async function testHyperspell(level: SmokeLevel): Promise<TestResult> {
  try {
    const apiKey = process.env.HYPERSPELL_API_KEY;
    if (!apiKey) return { ok: false, error: "Missing HYPERSPELL_API_KEY" };

    const baseUrl = (process.env.HYPERSPELL_BASE_URL?.trim() || "https://api.hyperspell.com").replace(/\/$/, "");

    if (level === "deep") {
      const userId = process.env.HYPERSPELL_SMOKE_USER_ID || "walter-smoke-test";

      // Some Hyperspell endpoints require `as-user` header OR a user token.
      // We'll get a user token (documented endpoint: POST /auth/user_token) and then call GET /auth/me with it.
      const tokenRes = await fetch(`${baseUrl}/auth/user_token`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ user_id: userId }),
      });
      if (!tokenRes.ok) {
        const body = await tokenRes.text();
        return { ok: false, error: `user_token HTTP ${tokenRes.status}: ${body.slice(0, 500)}` };
      }
      const tokenJson = (await tokenRes.json()) as any;
      const userToken = tokenJson?.token;
      if (typeof userToken !== "string" || userToken.length < 10) {
        return { ok: false, error: "Hyperspell /auth/user_token returned unexpected JSON (missing token)" };
      }

      const meRes = await fetch(`${baseUrl}/auth/me`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${userToken}`,
          "Content-Type": "application/json",
        },
      });
      if (!meRes.ok) {
        const body = await meRes.text();
        return { ok: false, error: `me HTTP ${meRes.status}: ${body.slice(0, 500)}` };
      }
      const meJson = (await meRes.json()) as any;
      const id = meJson?.id;
      if (typeof id !== "string" || id.length < 3) {
        return { ok: false, error: "Hyperspell /auth/me returned unexpected JSON (missing id)" };
      }

      console.log(`Hyperspell: OK (auth.userToken + auth.me -> ${id})`);
      return { ok: true };
    }

    // Basic (existing wiring used by this repo today): preferences endpoint.
    const userId = "walter-smoke-test";
    const url = `${baseUrl}/v1/users/${encodeURIComponent(userId)}/preferences`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    // 404 is fine here: it proves auth + routing is working but the user doesn't exist yet.
    if (res.status === 404) {
      console.log("Hyperspell: OK (GET preferences -> 404 not found, expected for new user)");
      return { ok: true };
    }

    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `HTTP ${res.status}: ${body.slice(0, 500)}` };
    }

    console.log("Hyperspell: OK (GET preferences -> 200)");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: redactError(e) };
  }
}

async function main() {
  // Next.js auto-loads env for dev/build, but standalone scripts do not.
  // We keep this script isolated by loading `.env.local` if present.
  await tryLoadDotEnvFile(".env.local");
  await tryLoadDotEnvFile(".env");

  const level = getSmokeLevel();
  const tests: Array<[name: string, fn: () => Promise<TestResult>]> = [
    ["OpenAI", () => testOpenAI(level)],
    ["ElevenLabs", () => testElevenLabs(level)],
    ["Hyperspell", () => testHyperspell(level)],
    ["Exa", () => testExa(level)],
    ["fal.ai", () => testFal(level)],
  ];

  console.log(`API smoke tests (${level})\n--------------`);
  const failures: Array<{ name: string; error: string }> = [];

  for (const [name, fn] of tests) {
    const res = await fn();
    if (!res.ok) {
      failures.push({ name, error: res.error });
      console.log(`${name}: FAIL (${res.error})`);
    }
  }

  if (failures.length) {
    process.exitCode = 1;
  } else {
    console.log("All API smoke tests passed.");
  }
}

main().catch((e) => {
  console.error("Smoke test script failed:", redactError(e));
  process.exit(1);
});
