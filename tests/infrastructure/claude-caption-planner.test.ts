import { describe, expect, test } from "bun:test";
import { InvalidCaptionPlanError, type PlannedCaption } from "../../src/domain/caption";
import type { Word } from "../../src/domain/word";
import { planInChunks, splitIntoChunks, type ChunkRequest } from "../../src/infrastructure/claude-caption-planner";

const toWords = (texts: string[]): Word[] => texts.map((text, index) => ({ text, start: index, end: index + 1 }));

describe("splitIntoChunks", () => {
  test("cuts after the first sentence end once the target size is reached", () => {
    const words = toWords(["a", "b", "c", "d.", "e", "f", "g"]);
    expect(splitIntoChunks(words, { targetWords: 3, maxWords: 5 })).toEqual([
      { first: 0, last: 3 },
      { first: 4, last: 6 },
    ]);
  });

  test("cuts at the target size when no sentence ends before the maximum", () => {
    const words = toWords(["a", "b", "c", "d", "e", "f", "g"]);
    expect(splitIntoChunks(words, { targetWords: 3, maxWords: 5 })).toEqual([
      { first: 0, last: 2 },
      { first: 3, last: 5 },
      { first: 6, last: 6 },
    ]);
  });
});

describe("planInChunks", () => {
  const words = toWords(["Halo", "semua.", "Ini", "video."]);
  const wholeChunk = ({ first, last }: ChunkRequest): PlannedCaption[] => [{ first, last, text: `${first}-${last}` }];

  test("plans each chunk with global indices and joins the results", async () => {
    const requests: ChunkRequest[] = [];
    const plan = await planInChunks(words, { targetWords: 2, maxWords: 2 }, async (request) => {
      requests.push(request);
      return wholeChunk(request);
    }, () => {});

    expect(requests.map((request) => request.transcript)).toEqual(["0|Halo\n1|semua.", "2|Ini\n3|video."]);
    expect(plan.captions.map((caption) => caption.text)).toEqual(["0-1", "2-3"]);
  });

  test("sends the captions planned so far with each chunk", async () => {
    const previous: string[][] = [];
    await planInChunks(words, { targetWords: 2, maxWords: 2 }, async (request) => {
      previous.push(request.previousCaptions);
      return wholeChunk(request);
    }, () => {});

    expect(previous).toEqual([[], ["0-1"]]);
  });

  test("reports each caption once its chunk is valid", async () => {
    const reported: string[] = [];
    await planInChunks(words, { targetWords: 2, maxWords: 2 }, async (request) => wholeChunk(request), (caption) =>
      reported.push(caption.text),
    );

    expect(reported).toEqual(["0-1", "2-3"]);
  });

  test("retries a chunk once when the model skips words", async () => {
    let calls = 0;
    const plan = await planInChunks(words, { targetWords: 4, maxWords: 4 }, async (request) => {
      calls += 1;
      return calls === 1 ? [{ first: 0, last: 1, text: "partial" }] : wholeChunk(request);
    }, () => {});

    expect(calls).toBe(2);
    expect(plan.captions).toEqual([{ first: 0, last: 3, text: "0-3" }]);
  });

  test("retries a chunk once when the model returns no captions", async () => {
    let calls = 0;
    const plan = await planInChunks(words, { targetWords: 4, maxWords: 4 }, async (request) => {
      calls += 1;
      if (calls === 1) throw new InvalidCaptionPlanError("no tool call");
      return wholeChunk(request);
    }, () => {});

    expect(plan.captions).toHaveLength(1);
  });

  test("fails when the retry is also invalid", async () => {
    const skipWords = async () => [{ first: 0, last: 0, text: "partial" }];

    await expect(planInChunks(words, { targetWords: 4, maxWords: 4 }, skipWords, () => {})).rejects.toThrow(
      InvalidCaptionPlanError,
    );
  });
});
