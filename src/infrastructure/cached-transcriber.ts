import { stat } from "node:fs/promises";
import type { Transcriber } from "../application/ports";
import type { Word } from "../domain/word";

type CachedTranscript = { key: string; words: Word[] };

export class CachedTranscriber implements Transcriber {
  constructor(
    private readonly inner: Transcriber,
    private readonly cachePath: string,
    private readonly settingsKey: string,
    private readonly log: (message: string) => void,
  ) {}

  async transcribe(videoPath: string, context: string): Promise<Word[]> {
    const key = await this.cacheKey(videoPath, context);
    const cached = await this.read();
    if (cached?.key === key) {
      this.log(`Using cached transcript ${this.cachePath}`);
      return cached.words;
    }

    const words = await this.inner.transcribe(videoPath, context);
    await Bun.write(this.cachePath, JSON.stringify({ key, words } satisfies CachedTranscript));
    return words;
  }

  private async cacheKey(videoPath: string, context: string): Promise<string> {
    const { size, mtimeMs } = await stat(videoPath);
    return String(Bun.hash(JSON.stringify({ size, mtimeMs, settings: this.settingsKey, context })));
  }

  private async read(): Promise<CachedTranscript | undefined> {
    const file = Bun.file(this.cachePath);
    if (!(await file.exists())) return undefined;
    return (await file.json()) as CachedTranscript;
  }
}
