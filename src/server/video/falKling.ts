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
      scene.overlay ? `On-screen text: ${scene.overlay}` : "",
      "Style: clean modern news graphics, subtle depth, infographic cues, high-contrast text-friendly compositions.",
      "Avoid: talking heads, cheesy stock footage, sensational visuals, cluttered backgrounds.",
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
        negative_prompt: "blur, distort, low quality, text errors, watermarks, logos, faces, talking head, cheap stock footage",
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

