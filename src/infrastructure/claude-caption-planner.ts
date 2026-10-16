import Anthropic from "@anthropic-ai/sdk";
import type { CaptionPlanner } from "../application/ports";
import type { CaptionPlan, PlannedCaption } from "../domain/caption";
import type { Word } from "../domain/word";

const MAX_OUTPUT_TOKENS = 32000;
const TOOL_NAME = "save_captions";

const saveCaptionsTool: Anthropic.Tool = {
  name: TOOL_NAME,
  description: "Save the caption plan for the transcript.",
  input_schema: {
    type: "object",
    properties: {
      captions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            first: { type: "integer" },
            last: { type: "integer" },
            text: { type: "string" },
          },
          required: ["first", "last", "text"],
        },
      },
    },
    required: ["captions"],
  },
};

export class CaptionStreamTracker {
  private emitted = 0;

  completed(snapshot: Partial<CaptionPlan>): PlannedCaption[] {
    const captions = snapshot.captions ?? [];
    return this.takeUpTo(captions, captions.length - 1);
  }

  remaining(captions: PlannedCaption[]): PlannedCaption[] {
    return this.takeUpTo(captions, captions.length);
  }

  private takeUpTo(captions: PlannedCaption[], end: number): PlannedCaption[] {
    if (end <= this.emitted) return [];
    const fresh = captions.slice(this.emitted, end);
    this.emitted = end;
    return fresh;
  }
}

export class ClaudeCaptionPlanner implements CaptionPlanner {
  constructor(
    private readonly client: Anthropic,
    private readonly model: string,
    private readonly systemPrompt: string,
  ) {}

  async plan(words: Word[], onCaption: (caption: PlannedCaption) => void): Promise<CaptionPlan> {
    const tracker = new CaptionStreamTracker();
    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: this.systemPrompt,
      tools: [saveCaptionsTool],
      tool_choice: { type: "tool", name: TOOL_NAME },
      messages: [{ role: "user", content: words.map((word, index) => `${index}|${word.text}`).join("\n") }],
    });
    stream.on("inputJson", (_delta, snapshot) => {
      tracker.completed(snapshot as Partial<CaptionPlan>).forEach(onCaption);
    });

    const message = await stream.finalMessage();
    const toolUse = message.content.find((block) => block.type === "tool_use");
    if (!toolUse) throw new Error(`Model ${this.model} returned no caption plan`);
    const plan = toolUse.input as CaptionPlan;
    tracker.remaining(plan.captions).forEach(onCaption);
    return plan;
  }
}
