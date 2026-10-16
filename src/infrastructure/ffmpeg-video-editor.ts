import { $ } from "bun";
import type { VideoEditor } from "../application/ports";
import type { FrameSize } from "../domain/frame-size";

export class FfmpegVideoEditor implements VideoEditor {
  constructor(private readonly fontsDir: string) {}

  async frameSize(videoPath: string): Promise<FrameSize> {
    const probe = await $`ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of json ${videoPath}`
      .quiet()
      .json();
    const [stream] = probe.streams as FrameSize[];
    if (!stream) throw new Error(`No video stream in ${videoPath}`);
    return { width: stream.width, height: stream.height };
  }

  async burnSubtitles(input: string, subtitles: string, output: string): Promise<void> {
    const subtitlesPath = output.replace(/\.[^./]+$/, "") + ".ass";
    await Bun.write(subtitlesPath, subtitles);
    const filter = `ass=${subtitlesPath}:fontsdir=${this.fontsDir}`;
    await $`ffmpeg -v error -stats -y -i ${input} -vf ${filter} -c:v libx264 -preset medium -crf 18 -c:a copy ${output}`;
  }
}

