import type { Transcriber } from "../application/ports";
import type { Word } from "../domain/word";

const SCRIPT = "scripts/transcribe.py";
const AUTO_LANGUAGE = "auto";
// Whisper only reads about 224 prompt tokens, so the start of the context (names, terms) is what counts.
const MAX_PROMPT_CHARACTERS = 600;

export type WhisperSettings = { model: string; python: string | undefined; language: string | undefined };

export function whisperPrompt(context: string): string {
  const flat = context.replace(/\s+/g, " ").trim();
  if (flat.length <= MAX_PROMPT_CHARACTERS) return flat;
  const cut = flat.slice(0, MAX_PROMPT_CHARACTERS);
  return cut.slice(0, cut.lastIndexOf(" ")).trim();
}

export function whisperCommand(videoPath: string, settings: WhisperSettings, prompt: string): string[] {
  const runner = settings.python ? [settings.python] : ["uv", "run", "--quiet", "--script"];
  return [...runner, SCRIPT, videoPath, settings.model, settings.language ?? AUTO_LANGUAGE, prompt];
}

export class WhisperTranscriber implements Transcriber {
  constructor(private readonly settings: WhisperSettings) {}

  async transcribe(videoPath: string, context: string): Promise<Word[]> {
    const process = Bun.spawn(whisperCommand(videoPath, this.settings, whisperPrompt(context)), {
      stdout: "pipe",
      stderr: "inherit",
    });
    const output = await new Response(process.stdout).text();
    const exitCode = await process.exited;
    if (exitCode !== 0) throw new Error(`Whisper exited with code ${exitCode}`);
    return (JSON.parse(output) as { words: Word[] }).words;
  }
}
