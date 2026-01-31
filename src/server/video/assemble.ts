import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";

function mustFfmpeg() {
  if (!ffmpegPath) throw new Error("ffmpeg-static did not provide a binary path");
  return ffmpegPath;
}

async function downloadToFile(url: string, destPath: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download: ${url} (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(destPath, buf);
}

function runFfmpeg(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const p = spawn(mustFfmpeg(), args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    p.stderr.on("data", (d) => (stderr += d.toString()));
    p.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg failed (${code}): ${stderr.slice(-2000)}`));
    });
  });
}

export async function stitchClipsToMp4(
  clipUrls: string[],
  opts?: { headlineOverlay?: string; voiceoverMp3?: Buffer }
): Promise<{ mp4: Buffer; thumbnailPng: Buffer }> {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "walter-"));
  try {
    const clipPaths: string[] = [];
    for (let i = 0; i < clipUrls.length; i++) {
      const p = path.join(tmp, `clip-${i}.mp4`);
      await downloadToFile(clipUrls[i], p);
      clipPaths.push(p);
    }

    const listFile = path.join(tmp, "concat.txt");
    await fs.writeFile(
      listFile,
      clipPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n")
    );

    const concatenated = path.join(tmp, "concat.mp4");
    await runFfmpeg([
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listFile,
      "-c",
      "copy",
      concatenated,
    ]);

    const voiced = path.join(tmp, "voiced.mp4");
    if (opts?.voiceoverMp3) {
      const audioPath = path.join(tmp, "voiceover.mp3");
      await fs.writeFile(audioPath, opts.voiceoverMp3);
      await runFfmpeg([
        "-y",
        "-i",
        concatenated,
        "-i",
        audioPath,
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-shortest",
        voiced,
      ]);
    } else {
      await fs.copyFile(concatenated, voiced);
    }

    // Lightweight headline overlay (top-left). Keep it subtle.
    const finalPath = path.join(tmp, "final.mp4");
    if (opts?.headlineOverlay) {
      // Use drawtext; font will vary by host. This is demo-grade but deterministic.
      const text = opts.headlineOverlay.replace(/:/g, "\\:").replace(/'/g, "\\'");
      await runFfmpeg([
        "-y",
        "-i",
        voiced,
        "-vf",
        `drawtext=text='${text}':x=54:y=70:fontsize=42:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=18`,
        "-c:a",
        "copy",
        finalPath,
      ]);
    } else {
      await fs.copyFile(voiced, finalPath);
    }

    const thumbPath = path.join(tmp, "thumb.png");
    await runFfmpeg(["-y", "-i", finalPath, "-vframes", "1", "-q:v", "2", thumbPath]);

    const mp4 = await fs.readFile(finalPath);
    const thumbnailPng = await fs.readFile(thumbPath);
    return { mp4, thumbnailPng };
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
}

