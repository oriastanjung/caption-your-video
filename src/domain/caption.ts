import type { Word } from "./word";

export type Caption = { first: number; last: number; keywords: number[] };
export type Correction = { index: number; text: string };
export type CaptionPlan = { captions: Caption[]; corrections: Correction[] };
export type WordState = "upcoming" | "active" | "spoken" | "keyword";

export class InvalidCaptionPlanError extends Error {
  override name = "InvalidCaptionPlanError";
}

const ATTACHES_TO_PREVIOUS = /^[-,.!?;:)%]/;

export function assertValidCaptionPlan(plan: CaptionPlan, wordCount: number): void {
  let expectedFirst = 0;
  for (const caption of plan.captions) {
    if (caption.first !== expectedFirst || caption.last < caption.first) {
      throw new InvalidCaptionPlanError(`Captions have a gap or overlap at word ${expectedFirst}`);
    }
    const strayKeyword = caption.keywords.find((index) => index < caption.first || index > caption.last);
    if (strayKeyword !== undefined) {
      throw new InvalidCaptionPlanError(`Keyword ${strayKeyword} is outside caption ${caption.first}-${caption.last}`);
    }
    expectedFirst = caption.last + 1;
  }
  if (expectedFirst !== wordCount) {
    throw new InvalidCaptionPlanError(`Captions cover ${expectedFirst} of ${wordCount} words`);
  }
  const strayCorrection = plan.corrections.find(({ index }) => index < 0 || index >= wordCount);
  if (strayCorrection) {
    throw new InvalidCaptionPlanError(`Correction index ${strayCorrection.index} is outside the transcript`);
  }
}

export function applyCorrections(words: Word[], corrections: Correction[]): Word[] {
  const corrected = words.map((word) => ({ ...word }));
  for (const { index, text } of corrections) corrected[index]!.text = text;
  return corrected;
}

export function wordState(caption: Caption, index: number, active: number): WordState {
  if (index === active) return "active";
  if (index > active) return "upcoming";
  return caption.keywords.includes(index) ? "keyword" : "spoken";
}

export function captionWindow(captions: Caption[], words: Word[], index: number, hold: number) {
  const caption = captions[index]!;
  const next = captions[index + 1];
  const nextStart = next ? words[next.first]!.start : Infinity;
  return {
    start: words[caption.first]!.start,
    end: Math.min(nextStart, words[caption.last]!.end + hold),
  };
}

export function separatorBefore(word: string): string {
  return ATTACHES_TO_PREVIOUS.test(word) ? "" : " ";
}

export function joinWords(texts: string[]): string {
  return texts.map((text, index) => (index === 0 ? text : separatorBefore(text) + text)).join("");
}
