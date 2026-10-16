import { describe, expect, test } from "bun:test";
import {
  InvalidCaptionPlanError,
  applyCorrections,
  assertValidCaptionPlan,
  captionWindow,
  joinWords,
  separatorBefore,
  wordState,
  type Caption,
} from "../../src/domain/caption";
import type { Word } from "../../src/domain/word";

const words: Word[] = [
  { text: "Hari", start: 0, end: 0.3 },
  { text: "ini", start: 0.3, end: 0.5 },
  { text: "kita", start: 0.6, end: 0.9 },
  { text: "ngobrol", start: 1.5, end: 2 },
];

describe("assertValidCaptionPlan", () => {
  const valid = {
    captions: [
      { first: 0, last: 1, keywords: [1] },
      { first: 2, last: 3, keywords: [] },
    ],
    corrections: [{ index: 3, text: "ngobrol" }],
  };

  test("accepts a plan that covers every word in order", () => {
    expect(() => assertValidCaptionPlan(valid, words.length)).not.toThrow();
  });

  test("rejects a gap between captions", () => {
    const plan = { ...valid, captions: [{ first: 0, last: 1, keywords: [] }, { first: 3, last: 3, keywords: [] }] };
    expect(() => assertValidCaptionPlan(plan, words.length)).toThrow(InvalidCaptionPlanError);
  });

  test("rejects overlapping captions", () => {
    const plan = { ...valid, captions: [{ first: 0, last: 2, keywords: [] }, { first: 2, last: 3, keywords: [] }] };
    expect(() => assertValidCaptionPlan(plan, words.length)).toThrow(InvalidCaptionPlanError);
  });

  test("rejects a plan that stops before the last word", () => {
    const plan = { ...valid, captions: [{ first: 0, last: 2, keywords: [] }] };
    expect(() => assertValidCaptionPlan(plan, words.length)).toThrow(InvalidCaptionPlanError);
  });

  test("rejects a keyword outside its caption", () => {
    const plan = { ...valid, captions: [{ first: 0, last: 1, keywords: [2] }, { first: 2, last: 3, keywords: [] }] };
    expect(() => assertValidCaptionPlan(plan, words.length)).toThrow(InvalidCaptionPlanError);
  });

  test("rejects a correction outside the transcript", () => {
    const plan = { ...valid, corrections: [{ index: 9, text: "x" }] };
    expect(() => assertValidCaptionPlan(plan, words.length)).toThrow(InvalidCaptionPlanError);
  });
});

describe("applyCorrections", () => {
  test("replaces word text without mutating the input", () => {
    const corrected = applyCorrections(words, [{ index: 2, text: "kami" }]);
    expect(corrected[2]!.text).toBe("kami");
    expect(corrected[2]!.start).toBe(0.6);
    expect(words[2]!.text).toBe("kita");
  });
});

describe("wordState", () => {
  const caption: Caption = { first: 0, last: 3, keywords: [1] };

  test("marks words before, at and after the active word", () => {
    expect(wordState(caption, 0, 2)).toBe("spoken");
    expect(wordState(caption, 2, 2)).toBe("active");
    expect(wordState(caption, 3, 2)).toBe("upcoming");
  });

  test("keeps a spoken keyword highlighted", () => {
    expect(wordState(caption, 1, 2)).toBe("keyword");
    expect(wordState(caption, 1, 0)).toBe("upcoming");
  });
});

describe("captionWindow", () => {
  const captions: Caption[] = [
    { first: 0, last: 2, keywords: [] },
    { first: 3, last: 3, keywords: [] },
  ];

  test("holds the caption after the last word until the next caption starts", () => {
    expect(captionWindow(captions, words, 0, 0.4)).toEqual({ start: 0, end: 1.3 });
  });

  test("cuts the hold short when the next caption starts sooner", () => {
    expect(captionWindow(captions, words, 0, 5)).toEqual({ start: 0, end: 1.5 });
  });

  test("holds the last caption for the full hold time", () => {
    expect(captionWindow(captions, words, 1, 0.4)).toEqual({ start: 1.5, end: 2.4 });
  });
});

describe("joinWords", () => {
  test("puts punctuation and hyphen fragments against the previous word", () => {
    expect(separatorBefore("-kira")).toBe("");
    expect(separatorBefore(",")).toBe("");
    expect(separatorBefore("kita")).toBe(" ");
    expect(joinWords(["kira", "-kira", "kita", "."])).toBe("kira-kira kita.");
  });
});
