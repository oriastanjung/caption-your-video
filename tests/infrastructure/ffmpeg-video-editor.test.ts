import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AssSubtitleFormatter } from "../../src/infrastructure/ass-subtitle-formatter";
import { FfmpegVideoEditor } from "../../src/infrastructure/ffmpeg-video-editor";
import { FONT_FILE, FONTS_DIR, createTextMeasurer } from "../../src/infrastructure/fontkit-text-measurer";

const theme = {
  box: { red: 0x4d, green: 0x5b, blue: 0x4a },
  boxOpacity: 0.95,
  upcoming: { red: 0xa8, green: 0xb0, blue: 0xa5 },
  active: { red: 0xf9, green: 0xd0, blue: 0x54 },
  spoken: { red: 0xfa, green: 0xfa, blue: 0xfa },
  keyword: { red: 0xf9, green: 0xd0, blue: 0x54 },
};

describe("FfmpegVideoEditor", () => {
  let dir: string;
  let input: string;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "caption-test-"));
    input = join(dir, "input.mp4");
    await $`ffmpeg -v error -f lavfi -i color=c=0x202020:s=640x360:d=1 -f lavfi -i anullsrc=r=44100:cl=mono -t 1 -c:v libx264 -c:a aac -shortest ${input}`;
  });

  afterAll(() => rm(dir, { recursive: true, force: true }));

  test("reads the frame size of a video", async () => {
    expect(await new FfmpegVideoEditor(FONTS_DIR).frameSize(input)).toEqual({ width: 640, height: 360 });
  });

  test("burns captions with the bundled font into a playable video", async () => {
    const editor = new FfmpegVideoEditor(FONTS_DIR);
    const words = [
      { text: "Halo", start: 0, end: 0.4 },
      { text: "dunia", start: 0.4, end: 0.9 },
    ];
    const subtitles = new AssSubtitleFormatter(theme, createTextMeasurer(FONT_FILE)).format(
      [{ first: 0, last: 1, keywords: [] }],
      words,
      { width: 640, height: 360 },
    );
    const output = join(dir, "output.mp4");

    await editor.burnSubtitles(input, subtitles, output);

    expect(await editor.frameSize(output)).toEqual({ width: 640, height: 360 });
    const plain = (await $`ffmpeg -v error -ss 0.5 -i ${input} -frames:v 1 -f rawvideo -pix_fmt gray -`.quiet()).stdout;
    const captioned = (await $`ffmpeg -v error -ss 0.5 -i ${output} -frames:v 1 -f rawvideo -pix_fmt gray -`.quiet()).stdout;
    const brightest = (frame: Buffer) => frame.reduce((max, value) => Math.max(max, value), 0);
    expect(brightest(captioned)).toBeGreaterThan(brightest(plain) + 100);
  });
});
