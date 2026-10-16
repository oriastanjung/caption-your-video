import type { Caption, CaptionPlan, PlannedCaption } from "../domain/caption";
import type { FrameSize } from "../domain/frame-size";
import type { Word } from "../domain/word";

export interface Transcriber {
  transcribe(videoPath: string): Promise<Word[]>;
}

export interface CaptionPlanner {
  plan(words: Word[], context: string, onCaption: (caption: PlannedCaption) => void): Promise<CaptionPlan>;
}

export interface SubtitleFormatter {
  format(captions: Caption[], words: Word[], frame: FrameSize): string;
}

export interface VideoEditor {
  frameSize(videoPath: string): Promise<FrameSize>;
  burnSubtitles(input: string, subtitles: string, output: string): Promise<void>;
}

export interface ProgressReporter {
  stage(message: string): void;
  captionPlanned(caption: PlannedCaption): void;
}
