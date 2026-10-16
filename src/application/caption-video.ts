import { assertValidCaptionPlan } from "../domain/caption";
import { buildCaptionTimeline } from "../domain/caption-timeline";
import type { CaptionPlanner, ProgressReporter, SubtitleFormatter, Transcriber, VideoEditor } from "./ports";

export class NoSpeechFoundError extends Error {
  override name = "NoSpeechFoundError";
}

type Dependencies = {
  transcriber: Transcriber;
  planner: CaptionPlanner;
  formatter: SubtitleFormatter;
  videoEditor: VideoEditor;
  reporter: ProgressReporter;
};

export class CaptionVideo {
  constructor(private readonly deps: Dependencies) {}

  async execute({ input, output }: { input: string; output: string }): Promise<{ captionCount: number }> {
    const { transcriber, planner, formatter, videoEditor, reporter } = this.deps;

    reporter.stage("Transcribing speech");
    const words = await transcriber.transcribe(input);
    if (words.length === 0) throw new NoSpeechFoundError(`No speech found in ${input}`);

    reporter.stage(`Planning captions for ${words.length} words`);
    const plan = await planner.plan(words, (caption) => reporter.captionPlanned(caption));
    assertValidCaptionPlan(plan, words.length);
    const timeline = buildCaptionTimeline(words, plan.captions);

    reporter.stage(`Rendering ${timeline.captions.length} captions`);
    const frame = await videoEditor.frameSize(input);
    const subtitles = formatter.format(timeline.captions, timeline.words, frame);
    await videoEditor.burnSubtitles(input, subtitles, output);

    return { captionCount: timeline.captions.length };
  }
}
