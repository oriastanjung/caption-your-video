import { describe, expect, test } from "bun:test";
import { buildCaptionTimeline, splitLongCaptions } from "../../src/domain/caption-timeline";
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

describe("splitLongCaptions", () => {
  const timed = (texts: string[]): Word[] => texts.map((text, index) => ({ text, start: index, end: index + 1 }));
  const lines = (words: Word[], captions: { first: number; last: number }[]) =>
    captions.map(({ first, last }) => words.slice(first, last + 1).map((word) => word.text).join(" "));

  test("keeps captions that fit", () => {
    const words = timed(["Halo", "semua"]);
    expect(splitLongCaptions(words, [{ first: 0, last: 1, keywords: [] }], 26)).toEqual([
      { first: 0, last: 1, keywords: [] },
    ]);
  });

  test("splits a long caption at word boundaries so every line fits", () => {
    const words = timed(["Di", "diagram", "entitas", "digambar", "pakai", "persegi", "panjang"]);
    const result = splitLongCaptions(words, [{ first: 0, last: 6, keywords: [] }], 26);

    expect(lines(words, result)).toEqual(["Di diagram entitas", "digambar pakai persegi", "panjang"]);
    expect(lines(words, result).every((line) => line.length <= 26)).toBe(true);
  });

  test("prefers to cut after punctuation once a line is a third full", () => {
    const words = timed(["Di", "diagram,", "entitas", "digambar", "pakai", "persegi."]);
    const result = splitLongCaptions(words, [{ first: 0, last: 5, keywords: [] }], 26);

    expect(lines(words, result)).toEqual(["Di diagram,", "entitas digambar pakai", "persegi."]);
  });

  test("keeps each keyword with the line that holds its word", () => {
    const words = timed(["Di", "diagram", "entitas", "digambar", "pakai", "persegi", "panjang"]);
    const result = splitLongCaptions(words, [{ first: 0, last: 6, keywords: [2, 5] }], 26);

    expect(result.map((caption) => caption.keywords)).toEqual([[2], [5], []]);
  });
});
