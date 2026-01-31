import { getServerEnv } from "@/lib/env/server";
import type { ExtractedPreferences } from "@/lib/schemas/preferences";

type HyperspellPreferencesRecord = {
  user_id: string;
  preferences: ExtractedPreferences["preferences"];
  updated_at: string;
};

function hyperspellBaseUrl() {
  const env = getServerEnv();
  // Allow override; default keeps wiring simple for demo.
  return env.HYPERSPELL_BASE_URL ?? "https://api.hyperspell.com";
}

function hyperspellHeaders() {
  const env = getServerEnv();
  return {
    Authorization: `Bearer ${env.HYPERSPELL_API_KEY}`,
    "Content-Type": "application/json",
  };
}

export async function hyperspellGetPreferences(userId: string): Promise<HyperspellPreferencesRecord | null> {
  const url = `${hyperspellBaseUrl()}/v1/users/${encodeURIComponent(userId)}/preferences`;
  const res = await fetch(url, { headers: hyperspellHeaders(), method: "GET" });

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Hyperspell get preferences failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as HyperspellPreferencesRecord;
}

export async function hyperspellUpsertPreferences(
  userId: string,
  preferences: ExtractedPreferences["preferences"]
): Promise<HyperspellPreferencesRecord> {
  const url = `${hyperspellBaseUrl()}/v1/users/${encodeURIComponent(userId)}/preferences`;
  const res = await fetch(url, {
    headers: hyperspellHeaders(),
    method: "PUT",
    body: JSON.stringify({ user_id: userId, preferences }),
  });

  if (!res.ok) {
    throw new Error(`Hyperspell upsert preferences failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as HyperspellPreferencesRecord;
}

