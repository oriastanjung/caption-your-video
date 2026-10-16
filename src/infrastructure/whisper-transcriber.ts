import type { Transcriber } from "../application/ports";
import type { Word } from "../domain/word";

const SCRIPT = "scripts/transcribe.py";

export function whisperCommand(videoPath: string, model: string, python: string | undefined): string[] {
  const runner = python ? [python] : ["uv", "run", "--quiet", "--script"];
  return [...runner, SCRIPT, videoPath, model];
}

export class WhisperTranscriber implements Transcriber {
  constructor(private readonly settings: { model: string; python: string | undefined }) {}

  async transcribe(videoPath: string): Promise<Word[]> {
    const process = Bun.spawn(whisperCommand(videoPath, this.settings.model, this.settings.python), {
      stdout: "pipe",
      stderr: "inherit",
    });
    const output = await new Response(process.stdout).text();
    const exitCode = await process.exited;
    if (exitCode !== 0) throw new Error(`Whisper exited with code ${exitCode}`);
    return (JSON.parse(output) as { words: Word[] }).words;
  }
}
