import { describe, expect, test } from "bun:test";
import { whisperCommand, whisperPrompt } from "../../src/infrastructure/whisper-transcriber";

const settings = { model: "small", python: undefined, language: undefined };

describe("whisperCommand", () => {
  test("runs the script through uv so it installs its own dependencies", () => {
    expect(whisperCommand("in.mp4", settings, "")).toEqual([
      "uv",
      "run",
      "--quiet",
      "--script",
      "scripts/transcribe.py",
      "in.mp4",
      "small",
      "auto",
      "",
    ]);
  });

  test("runs the script with a given Python that already has the dependencies", () => {
    expect(whisperCommand("in.mp4", { ...settings, python: "python3" }, "")).toEqual([
      "python3",
      "scripts/transcribe.py",
      "in.mp4",
      "small",
      "auto",
      "",
    ]);
  });

  test("passes the language and the vocabulary prompt", () => {
    expect(whisperCommand("in.mp4", { ...settings, language: "id" }, "Dina, Kubernetes").slice(-2)).toEqual([
      "id",
      "Dina, Kubernetes",
    ]);
  });
});

describe("whisperPrompt", () => {
  test("uses short context as it is", () => {
    expect(whisperPrompt("Dina, Kubernetes, Docker Compose")).toBe("Dina, Kubernetes, Docker Compose");
  });

  test("keeps only the start of a long context, cut at a word boundary", () => {
    const prompt = whisperPrompt(`${"kata ".repeat(300)}akhir`);
    expect(prompt.length).toBeLessThanOrEqual(600);
    expect(prompt.endsWith("kata")).toBe(true);
  });

  test("flattens line breaks so the prompt reads as running text", () => {
    expect(whisperPrompt("Nama: Dina\nTopik: Kubernetes")).toBe("Nama: Dina Topik: Kubernetes");
  });
});
