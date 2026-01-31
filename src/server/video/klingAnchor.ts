import { falSubscribe } from "@/lib/integrations/fal";

/**
 * Available English voice IDs for Kling lipsync TTS.
 * uk_man2 is a mature British male voice.
 */
export const KLING_VOICE_IDS = {
  uk_boy: "uk_boy1",
  uk_man: "uk_man2",
  uk_oldman: "uk_oldman3",
} as const;

export type KlingVoiceId = (typeof KLING_VOICE_IDS)[keyof typeof KLING_VOICE_IDS];

type KlingVideoOutput = {
  video: {
    url: string;
    content_type?: string;
    file_name?: string;
    file_size?: number;
  };
};

type KlingLipsyncOutput = {
  video: {
    url: string;
    content_type?: string;
  };
};

const LIPSYNC_TEXT_LIMIT = 115; // Leave buffer from 120 char limit

/**
 * Split text into chunks that fit within the lipsync character limit.
 * Tries to split at sentence boundaries, then word boundaries.
 */
function splitVoiceoverIntoChunks(text: string, maxLen = LIPSYNC_TEXT_LIMIT): string[] {
  const chunks: string[] = [];
  let remaining = text.trim();

  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }

    // Try to find a sentence boundary within the limit
    let splitIdx = -1;
    const sentenceEnders = [". ", "! ", "? ", ".\n", "!\n", "?\n"];
    for (const ender of sentenceEnders) {
      const lastIdx = remaining.lastIndexOf(ender, maxLen);
      if (lastIdx > 0 && lastIdx > splitIdx) {
        splitIdx = lastIdx + ender.length - 1; // Include the punctuation
      }
    }

    // If no sentence boundary, try comma or word boundary
    if (splitIdx <= 0) {
      const commaIdx = remaining.lastIndexOf(", ", maxLen);
      if (commaIdx > maxLen * 0.4) {
        splitIdx = commaIdx + 1;
      } else {
        // Fall back to last space
        splitIdx = remaining.lastIndexOf(" ", maxLen);
        if (splitIdx <= 0) {
          // No good break point, force split
          splitIdx = maxLen;
        }
      }
    }

    const chunk = remaining.slice(0, splitIdx + 1).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
    remaining = remaining.slice(splitIdx + 1).trim();
  }

  return chunks;
}

/**
 * Generate a base video of a professional news anchor.
 * This creates a 10-second silent video of an anchor ready to speak.
 */
export async function generateAnchorBaseVideo(opts?: {
  duration?: "5" | "10";
  aspectRatio?: "16:9" | "9:16" | "1:1";
  gender?: "male" | "female";
  onStatus?: (s: unknown) => void;
}): Promise<string> {
  const duration = opts?.duration ?? "10";
  const aspectRatio = opts?.aspectRatio ?? "16:9";
  const gender = opts?.gender ?? "male";

  const genderPrompt =
    gender === "male"
      ? "A distinguished British gentleman in his 40s wearing a tailored navy suit and burgundy tie"
      : "An elegant British woman in her 40s wearing a sophisticated blouse and blazer";

  const prompt = [
    genderPrompt,
    "sitting at an elegant mahogany news desk.",
    "Warm professional studio lighting, modern broadcast backdrop.",
    "Looking directly at camera with a composed, authoritative expression.",
    "Subtle natural movements, ready to deliver news.",
    "Professional broadcast quality, BBC style.",
  ].join(" ");

  const res = await falSubscribe<KlingVideoOutput>(
    "fal-ai/kling-video/v2.5-turbo/pro/text-to-video",
    {
      prompt,
      duration,
      aspect_ratio: aspectRatio,
      negative_prompt: "blur, distorted, low quality, cartoon, anime, casual clothes, unprofessional",
    },
    { onStatus: opts?.onStatus }
  );

  const url = res.data?.video?.url;
  if (!url) throw new Error("Kling anchor base video did not return video.url");
  return url;
}

/**
 * Apply Kling lipsync to a base video with built-in TTS.
 */
export async function applyKlingLipsync(
  baseVideoUrl: string,
  text: string,
  opts?: {
    voiceId?: KlingVoiceId;
    voiceSpeed?: number;
    onStatus?: (s: unknown) => void;
  }
): Promise<string> {
  if (text.length > 120) {
    throw new Error(`Lipsync text exceeds 120 char limit: ${text.length} chars`);
  }

  const voiceId = opts?.voiceId ?? KLING_VOICE_IDS.uk_man;
  const voiceSpeed = opts?.voiceSpeed ?? 0.95;

  const res = await falSubscribe<KlingLipsyncOutput>(
    "fal-ai/kling-video/lipsync/text-to-video",
    {
      video_url: baseVideoUrl,
      text,
      voice_id: voiceId,
      voice_language: "en",
      voice_speed: voiceSpeed,
    },
    { onStatus: opts?.onStatus }
  );

  const url = res.data?.video?.url;
  if (!url) throw new Error("Kling lipsync did not return video.url");
  return url;
}

/**
 * Generate a complete talking anchor video from voiceover text.
 * This handles:
 * 1. Generating a base anchor video
 * 2. Splitting voiceover into chunks
 * 3. Applying lipsync to each chunk
 * 4. Returning all clip URLs for stitching
 */
export async function generateTalkingAnchorClips(
  voiceover: string,
  opts?: {
    voiceId?: KlingVoiceId;
    voiceSpeed?: number;
    aspectRatio?: "16:9" | "9:16" | "1:1";
    gender?: "male" | "female";
    onStatus?: (status: { step: string; progress: number; message: string }) => void;
  }
): Promise<{ clips: Array<{ chunkIndex: number; url: string }>; baseVideoUrl: string }> {
  const chunks = splitVoiceoverIntoChunks(voiceover);
  const totalSteps = chunks.length + 1; // +1 for base video generation

  opts?.onStatus?.({
    step: "base",
    progress: 0,
    message: `Generating anchor base video...`,
  });

  // Generate base video (10s to have enough footage for lipsync)
  const baseVideoUrl = await generateAnchorBaseVideo({
    duration: "10",
    aspectRatio: opts?.aspectRatio,
    gender: opts?.gender,
    onStatus: () => {}, // Suppress per-frame updates
  });

  opts?.onStatus?.({
    step: "base",
    progress: Math.round(100 / totalSteps),
    message: `Base video ready. Generating ${chunks.length} speech segments...`,
  });

  const clips: Array<{ chunkIndex: number; url: string }> = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const progress = Math.round(((i + 2) / totalSteps) * 100);

    opts?.onStatus?.({
      step: `lipsync:${i}`,
      progress,
      message: `Recording segment ${i + 1}/${chunks.length}: "${chunk.slice(0, 40)}..."`,
    });

    const clipUrl = await applyKlingLipsync(baseVideoUrl, chunk, {
      voiceId: opts?.voiceId,
      voiceSpeed: opts?.voiceSpeed,
    });

    clips.push({ chunkIndex: i, url: clipUrl });
  }

  opts?.onStatus?.({
    step: "done",
    progress: 100,
    message: `All ${chunks.length} segments recorded`,
  });

  return { clips, baseVideoUrl };
}
