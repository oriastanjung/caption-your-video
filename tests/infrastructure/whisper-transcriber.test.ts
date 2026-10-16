import { describe, expect, test } from "bun:test";
import { whisperCommand } from "../../src/infrastructure/whisper-transcriber";

describe("whisperCommand", () => {
  test("runs the script through uv so it installs its own dependencies", () => {
    expect(whisperCommand("in.mp4", "small", undefined)).toEqual([
      "uv",
      "run",
      "--quiet",
      "--script",
      "scripts/transcribe.py",
      "in.mp4",
      "small",
    ]);
  });

  test("runs the script with a given Python that already has the dependencies", () => {
    expect(whisperCommand("in.mp4", "small", "python3")).toEqual(["python3", "scripts/transcribe.py", "in.mp4", "small"]);
  });
});
