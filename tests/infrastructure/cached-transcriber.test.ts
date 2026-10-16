import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Transcriber } from "../../src/application/ports";
import type { Word } from "../../src/domain/word";
import { CachedTranscriber } from "../../src/infrastructure/cached-transcriber";

const words: Word[] = [{ text: "Halo", start: 0, end: 0.5 }];

describe("CachedTranscriber", () => {
  let dir: string;
  let video: string;
  let cache: string;
  let calls: number;
  let logs: string[];
  const whisper: Transcriber = {
    transcribe: async () => {
      calls += 1;
      return words;
    },
  };
  const cached = (settings = "large-v3-turbo") =>
    new CachedTranscriber(whisper, cache, settings, (message) => logs.push(message));

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "transcript-cache-"));
    video = join(dir, "input.mp4");
    cache = join(dir, "transcript.json");
    await Bun.write(video, "video bytes");
    calls = 0;
    logs = [];
  });

  afterEach(() => rm(dir, { recursive: true, force: true }));

  test("transcribes and saves the result the first time", async () => {
    expect(await cached().transcribe(video)).toEqual(words);
    expect(calls).toBe(1);
    expect(await Bun.file(cache).exists()).toBe(true);
  });

  test("reuses the saved transcript for the same video and settings", async () => {
    await cached().transcribe(video);

    expect(await cached().transcribe(video)).toEqual(words);
    expect(calls).toBe(1);
    expect(logs).toEqual([`Using cached transcript ${cache}`]);
  });

  test("transcribes again when the video changes", async () => {
    await cached().transcribe(video);
    await Bun.write(video, "another video");
    await utimes(video, new Date(), new Date(Date.now() + 5000));

    await cached().transcribe(video);
    expect(calls).toBe(2);
  });

  test("transcribes again when the Whisper settings change", async () => {
    await cached().transcribe(video);
    await cached("small").transcribe(video);
    await cached("small").transcribe(video);

    expect(calls).toBe(2);
  });
});
