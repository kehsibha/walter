import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { getServerEnv } from "@/lib/env/server";

let cached: ElevenLabsClient | null = null;

export function getElevenLabs() {
  if (cached) return cached;
  const env = getServerEnv();
  cached = new ElevenLabsClient({
    apiKey: env.ELEVENLABS_API_KEY,
  });
  return cached;
}

async function streamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  const total = chunks.reduce((n, c) => n + c.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return Buffer.from(out.buffer);
}

export async function elevenlabsTextToSpeech(
  text: string,
  opts?: {
    voiceId?: string;
    modelId?: string;
    outputFormat?: "mp3_44100_128" | "mp3_22050_32";
  }
): Promise<{ audio: Buffer; mime: string }> {
  const client = getElevenLabs();
  const voiceId = opts?.voiceId ?? process.env.ELEVENLABS_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM";
  const modelId = opts?.modelId ?? "eleven_multilingual_v2";
  const outputFormat = opts?.outputFormat ?? "mp3_44100_128";

  const stream = await client.textToSpeech.convert(voiceId, {
    text,
    modelId,
    outputFormat,
    optimizeStreamingLatency: 1,
  });

  const audio = await streamToBuffer(stream);
  return { audio, mime: "audio/mpeg" };
}

