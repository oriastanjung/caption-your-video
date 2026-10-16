import { describe, expect, test } from "bun:test";
import { whisperCommand } from "../../src/infrastructure/whisper-transcriber";

const settings = { model: "small", python: undefined, language: undefined };

describe("whisperCommand", () => {
  test("runs the script through uv so it installs its own dependencies", () => {
    expect(whisperCommand("in.mp4", settings)).toEqual([
      "uv",
      "run",
      "--quiet",
      "--script",
      "scripts/transcribe.py",
      "in.mp4",
      "small",
      "auto",
    ]);
  });

  test("runs the script with a given Python that already has the dependencies", () => {
    expect(whisperCommand("in.mp4", { ...settings, python: "python3" })).toEqual([
      "python3",
      "scripts/transcribe.py",
      "in.mp4",
      "small",
      "auto",
    ]);
  });

  test("passes the spoken language when it is set", () => {
    expect(whisperCommand("in.mp4", { ...settings, language: "id" }).at(-1)).toBe("id");
  });
});
