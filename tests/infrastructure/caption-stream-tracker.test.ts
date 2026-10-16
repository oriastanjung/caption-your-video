import { describe, expect, test } from "bun:test";
import { CaptionStreamTracker } from "../../src/infrastructure/claude-caption-planner";

const caption = (first: number) => ({ first, last: first, keywords: [] });

describe("CaptionStreamTracker", () => {
  test("emits a caption only once the next one has started streaming", () => {
    const tracker = new CaptionStreamTracker();

    expect(tracker.completed({ captions: [caption(0)] })).toEqual([]);
    expect(tracker.completed({ captions: [caption(0), caption(1)] })).toEqual([caption(0)]);
    expect(tracker.completed({ captions: [caption(0), caption(1)] })).toEqual([]);
  });

  test("flushes the remaining captions when the stream ends", () => {
    const tracker = new CaptionStreamTracker();
    tracker.completed({ captions: [caption(0), caption(1)] });

    expect(tracker.remaining([caption(0), caption(1), caption(2)])).toEqual([caption(1), caption(2)]);
  });

  test("ignores snapshots without captions yet", () => {
    expect(new CaptionStreamTracker().completed({})).toEqual([]);
  });
});
