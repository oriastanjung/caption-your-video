import { describe, expect, test } from "bun:test";
import { CaptionVideo, NoSpeechFoundError } from "../../src/application/caption-video";
import type {
  CaptionPlanner,
  ProgressReporter,
  SubtitleFormatter,
  Transcriber,
  VideoEditor,
} from "../../src/application/ports";
import { InvalidCaptionPlanError, type Caption, type CaptionPlan, type PlannedCaption } from "../../src/domain/caption";
import type { FrameSize } from "../../src/domain/frame-size";
import type { Word } from "../../src/domain/word";

const words: Word[] = [
  { text: "Halo", start: 0, end: 0.4 },
  { text: "dunai", start: 0.5, end: 0.9 },
];
const plan: CaptionPlan = { captions: [{ first: 0, last: 1, text: "Halo *dunia*" }] };

function setup(overrides: { transcribed?: Word[]; plan?: CaptionPlan } = {}) {
  const calls: string[] = [];
  const formatted: { captions: Caption[]; words: Word[]; frame: FrameSize }[] = [];
  const burned: { input: string; subtitles: string; output: string }[] = [];

  const transcriber: Transcriber = {
    transcribe: async (path) => {
      calls.push(`transcribe ${path}`);
      return overrides.transcribed ?? words;
    },
  };
  const planner: CaptionPlanner = {
    plan: async (input, onCaption) => {
      calls.push(`plan ${input.length}`);
      const result = overrides.plan ?? plan;
      result.captions.forEach(onCaption);
      return result;
    },
  };
  const formatter: SubtitleFormatter = {
    format: (captions, corrected, frame) => {
      formatted.push({ captions, words: corrected, frame });
      return "SUBTITLES";
    },
  };
  const videoEditor: VideoEditor = {
    frameSize: async () => ({ width: 1920, height: 1080 }),
    burnSubtitles: async (input, subtitles, output) => {
      burned.push({ input, subtitles, output });
    },
  };
  const planned: PlannedCaption[] = [];
  const reporter: ProgressReporter = {
    stage: (message) => calls.push(`stage ${message}`),
    captionPlanned: (caption) => planned.push(caption),
  };

  const useCase = new CaptionVideo({ transcriber, planner, formatter, videoEditor, reporter });
  return { useCase, calls, formatted, burned, planned };
}

describe("CaptionVideo", () => {
  test("transcribes, plans, formats and burns captions into the output video", async () => {
    const { useCase, formatted, burned } = setup();

    const result = await useCase.execute({ input: "in.mp4", output: "out.mp4" });

    expect(result).toEqual({ captionCount: 1 });
    expect(formatted[0]!.frame).toEqual({ width: 1920, height: 1080 });
    expect(burned).toEqual([{ input: "in.mp4", subtitles: "SUBTITLES", output: "out.mp4" }]);
  });

  test("formats the planned caption text with the transcript's timing", async () => {
    const { useCase, formatted } = setup();

    await useCase.execute({ input: "in.mp4", output: "out.mp4" });

    expect(formatted[0]!.words).toEqual([
      { text: "Halo", start: 0, end: 0.4 },
      { text: "dunia", start: 0.5, end: 0.9 },
    ]);
    expect(formatted[0]!.captions).toEqual([{ first: 0, last: 1, keywords: [1] }]);
  });

  test("streams every planned caption to the reporter", async () => {
    const { useCase, planned } = setup();

    await useCase.execute({ input: "in.mp4", output: "out.mp4" });

    expect(planned).toEqual(plan.captions);
  });

  test("stops before planning when the video has no speech", async () => {
    const { useCase, calls, burned } = setup({ transcribed: [] });

    await expect(useCase.execute({ input: "in.mp4", output: "out.mp4" })).rejects.toThrow(NoSpeechFoundError);
    expect(calls.some((call) => call.startsWith("plan"))).toBe(false);
    expect(burned).toEqual([]);
  });

  test("refuses to render a plan that skips words", async () => {
    const { useCase, burned } = setup({ plan: { captions: [{ first: 0, last: 0, text: "Halo" }] } });

    await expect(useCase.execute({ input: "in.mp4", output: "out.mp4" })).rejects.toThrow(InvalidCaptionPlanError);
    expect(burned).toEqual([]);
  });
});
