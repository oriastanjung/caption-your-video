import type { ProgressReporter } from "../application/ports";
import type { PlannedCaption } from "../domain/caption";

export class ConsoleProgressReporter implements ProgressReporter {
  private captionNumber = 0;

  stage(message: string): void {
    console.log(`\n> ${message}`);
  }

  captionPlanned(caption: PlannedCaption): void {
    this.captionNumber += 1;
    const line = caption.text.trim() === "" ? "(dropped)" : caption.text;
    console.log(`  ${String(this.captionNumber).padStart(3)}. ${line}`);
  }
}
