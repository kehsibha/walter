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
  // Daniel - "Steady Broadcaster" - British, formal, perfect for news narration
  const voiceId = opts?.voiceId ?? process.env.ELEVENLABS_VOICE_ID ?? "onwK4e9ZLuTAKqWW03F9";
  const modelId = opts?.modelId ?? "eleven_multilingual_v2";
  const outputFormat = opts?.outputFormat ?? "mp3_44100_128";

  // #region agent log
  fetch('http://127.0.0.1:7244/ingest/55549a8d-5769-478c-90a5-de122fed8ee6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'elevenlabs.ts:textToSpeech:before',message:'Calling ElevenLabs TTS',data:{voiceId,modelId,textLength:text.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'ElevenLabs'})}).catch(()=>{});
  // #endregion

  try {
    const stream = await client.textToSpeech.convert(voiceId, {
      text,
      modelId,
      outputFormat,
      optimizeStreamingLatency: 1,
    });

    const audio = await streamToBuffer(stream);
    
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/55549a8d-5769-478c-90a5-de122fed8ee6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'elevenlabs.ts:textToSpeech:success',message:'ElevenLabs TTS succeeded',data:{voiceId,audioSize:audio.byteLength},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'ElevenLabs'})}).catch(()=>{});
    // #endregion
    
    return { audio, mime: "audio/mpeg" };
  } catch (err) {
    // #region agent log
    const errMsg = (err as Error)?.message ?? String(err);
    fetch('http://127.0.0.1:7244/ingest/55549a8d-5769-478c-90a5-de122fed8ee6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'elevenlabs.ts:textToSpeech:error',message:'ElevenLabs TTS FAILED',data:{voiceId,modelId,error:errMsg},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'ElevenLabs'})}).catch(()=>{});
    // #endregion
    throw err;
  }
}

