/**
 * Quick script to list available ElevenLabs voices for your account.
 * Run with: npx tsx scripts/list-voices.ts
 */

import path from "node:path";
import fs from "node:fs";

// Load .env.local manually (same as worker)
function loadEnv() {
  const p = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  const text = fs.readFileSync(p, "utf8");
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
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv();

async function main() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.error("ELEVENLABS_API_KEY not found in .env.local");
    process.exit(1);
  }

  console.log("Fetching available voices from ElevenLabs...\n");

  const res = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: {
      "xi-api-key": apiKey,
    },
  });

  if (!res.ok) {
    console.error(`Error: ${res.status} ${res.statusText}`);
    const text = await res.text();
    console.error(text);
    process.exit(1);
  }

  const data = await res.json();
  const voices = data.voices as Array<{
    voice_id: string;
    name: string;
    category: string;
    labels?: Record<string, string>;
  }>;

  console.log(`Found ${voices.length} voices:\n`);
  console.log("=" .repeat(80));
  
  for (const v of voices.slice(0, 20)) {
    console.log(`Voice ID: ${v.voice_id}`);
    console.log(`   Name: ${v.name}`);
    console.log(`   Category: ${v.category}`);
    if (v.labels) {
      console.log(`   Labels: ${JSON.stringify(v.labels)}`);
    }
    console.log("");
  }

  if (voices.length > 20) {
    console.log(`... and ${voices.length - 20} more voices`);
  }

  console.log("=" .repeat(80));
  console.log("\nTo use a voice, add to your .env.local:");
  console.log(`ELEVENLABS_VOICE_ID=${voices[0]?.voice_id ?? "YOUR_VOICE_ID"}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
