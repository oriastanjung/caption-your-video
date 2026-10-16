import { describe, expect, test } from "bun:test";
import { buildCaptionTimeline } from "../../src/domain/caption-timeline";
import type { Word } from "../../src/domain/word";

const transcript: Word[] = [
  { text: "Halo", start: 0, end: 0.5 },
  { text: "saya", start: 0.5, end: 1 },
  { text: "Dena", start: 1, end: 2 },
  { text: "Kuber", start: 2, end: 2.4 },
  { text: "Netes", start: 2.4, end: 3 },
  { text: "Hmm.", start: 3, end: 4 },
];

describe("buildCaptionTimeline", () => {
  test("keeps Whisper timing when the text has the same number of words", () => {
    const { words, captions } = buildCaptionTimeline(transcript, [
      { first: 0, last: 2, text: "Halo saya *Dina*" },
      { first: 3, last: 5, text: "" },
    ]);

    expect(words).toEqual([
      { text: "Halo", start: 0, end: 0.5 },
      { text: "saya", start: 0.5, end: 1 },
      { text: "Dina", start: 1, end: 2 },
    ]);
    expect(captions).toEqual([{ first: 0, last: 2, keywords: [2] }]);
  });

  test("spreads the span's time by word length when words are merged", () => {
    const { words } = buildCaptionTimeline(transcript, [
      { first: 0, last: 2, text: "" },
      { first: 3, last: 4, text: "Kubernetes" },
      { first: 5, last: 5, text: "" },
    ]);

    expect(words).toEqual([{ text: "Kubernetes", start: 2, end: 3 }]);
  });

  test("spreads the span's time by word length when words are split", () => {
    const { words } = buildCaptionTimeline(transcript, [
      { first: 0, last: 4, text: "" },
      { first: 5, last: 5, text: "ab abcd" },
    ]);

    expect(words.map((word) => [word.text, word.start, word.end])).toEqual([
      ["ab", 3, 3 + 1 / 3],
      ["abcd", 3 + 1 / 3, 4],
    ]);
  });

  test("drops spans with empty text, such as words Whisper made up", () => {
    const { words, captions } = buildCaptionTimeline(transcript, [
      { first: 0, last: 4, text: "Halo saya Dina, Kubernetes" },
      { first: 5, last: 5, text: "  " },
    ]);

    expect(captions).toHaveLength(1);
    expect(words.at(-1)!.text).toBe("Kubernetes");
  });

  test("marks every word inside asterisks as a keyword", () => {
    const { words, captions } = buildCaptionTimeline(transcript, [
      { first: 0, last: 5, text: "Pakai *Docker Compose*, oke" },
    ]);

    expect(words.map((word) => word.text)).toEqual(["Pakai", "Docker", "Compose,", "oke"]);
    expect(captions[0]!.keywords).toEqual([1, 2]);
  });
});
