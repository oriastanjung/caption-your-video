import type { ProgressReporter } from "../application/ports";
import type { Caption } from "../domain/caption";
import type { Word } from "../domain/word";

export class ConsoleProgressReporter implements ProgressReporter {
  private captionNumber = 0;

  stage(message: string): void {
    console.log(`\n> ${message}`);
  }

  captionPlanned(caption: Caption, words: Word[]): void {
    this.captionNumber += 1;
    const line = words
      .slice(caption.first, caption.last + 1)
      .map((word, offset) => (caption.keywords.includes(caption.first + offset) ? `[${word.text}]` : word.text))
      .join(" ");
    console.log(`  ${String(this.captionNumber).padStart(3)}. ${line}`);
  }
}
