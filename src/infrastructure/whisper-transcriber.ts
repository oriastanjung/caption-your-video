import type { Transcriber } from "../application/ports";
import type { Word } from "../domain/word";

const SCRIPT = "scripts/transcribe.py";
const AUTO_LANGUAGE = "auto";

export type WhisperSettings = { model: string; python: string | undefined; language: string | undefined };

export function whisperCommand(videoPath: string, settings: WhisperSettings): string[] {
  const runner = settings.python ? [settings.python] : ["uv", "run", "--quiet", "--script"];
  return [...runner, SCRIPT, videoPath, settings.model, settings.language ?? AUTO_LANGUAGE];
}

export class WhisperTranscriber implements Transcriber {
  constructor(private readonly settings: WhisperSettings) {}

  async transcribe(videoPath: string): Promise<Word[]> {
    const process = Bun.spawn(whisperCommand(videoPath, this.settings), { stdout: "pipe", stderr: "inherit" });
    const output = await new Response(process.stdout).text();
    const exitCode = await process.exited;
    if (exitCode !== 0) throw new Error(`Whisper exited with code ${exitCode}`);
    return (JSON.parse(output) as { words: Word[] }).words;
  }
}
