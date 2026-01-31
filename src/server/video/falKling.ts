import { falSubscribe } from "@/lib/integrations/fal";
import type { VideoScript } from "@/lib/schemas/videoScript";

type KlingOutput = {
  video: {
    url: string;
    content_type?: string;
    file_name?: string;
    file_size?: number;
  };
};

export async function generateKlingClips(script: VideoScript) {
  // Kling v2.6 supports 5s or 10s outputs. We'll use 5s scenes and stitch.
  const endpointId = "fal-ai/kling-video/v2.6/pro/text-to-video";

  const clips: Array<{ sceneIndex: number; url: string }> = [];

  for (let i = 0; i < script.scenes.length; i++) {
    const scene = script.scenes[i];
    const prompt = [
      scene.description,
      scene.overlay ? `On-screen text overlay: "${scene.overlay}"` : "",
      "Style: A warm, approachable presenter speaking directly to camera in a clean, modern setting. Natural lighting, minimal background distractions. The presenter has a friendly, confident demeanor—like a knowledgeable friend explaining something important. Think Mayor Zohran Mamdani's direct-to-camera TikTok style: authentic, conversational, not a traditional news anchor.",
      "Setting: Simple, tasteful background (apartment, office, or neutral modern space). Warm color tones.",
      "Framing: Medium close-up, presenter centered, making eye contact with camera.",
    ]
      .filter(Boolean)
      .join("\n");

    const res = await falSubscribe<KlingOutput>(
      endpointId,
      {
        prompt,
        duration: "5",
        aspect_ratio: "9:16",
        generate_audio: false,
        negative_prompt: "blur, distort, low quality, text errors, watermarks, logos, cheap stock footage, TV studio, news desk, formal suit, stiff posture, multiple people, busy background",
        cfg_scale: 0.55,
      },
      {
        onStatus: () => {
          // caller owns progress updates; we keep this quiet
        },
      }
    );

    const url = res.data?.video?.url;
    if (!url) throw new Error("fal Kling did not return video.url");
    clips.push({ sceneIndex: i, url });
  }

  return clips;
}

