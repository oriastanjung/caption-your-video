import Anthropic from "@anthropic-ai/sdk";
import type { CaptionPlanner } from "../application/ports";
import { assertCaptionsCover, InvalidCaptionPlanError, type CaptionPlan, type PlannedCaption } from "../domain/caption";
import type { Word } from "../domain/word";

const MAX_OUTPUT_TOKENS = 8192;
const TOOL_NAME = "save_captions";
const CHUNK_SIZE = { targetWords: 120, maxWords: 160 };
const PREVIOUS_CAPTIONS_SENT = 8;
const ATTEMPTS_PER_CHUNK = 2;
const SENTENCE_END = /[.?!]$/;

type ChunkSize = { targetWords: number; maxWords: number };
type Range = { first: number; last: number };

export type ChunkRequest = Range & { transcript: string; previousCaptions: string[] };
type RequestChunk = (request: ChunkRequest) => Promise<PlannedCaption[]>;

const saveCaptionsTool: Anthropic.Tool = {
  name: TOOL_NAME,
  description: "Save the captions for this part of the transcript.",
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

export function splitIntoChunks(words: Word[], { targetWords, maxWords }: ChunkSize): Range[] {
  const chunks: Range[] = [];
  let first = 0;
  while (first < words.length) {
    const lastAllowed = Math.min(first + maxWords - 1, words.length - 1);
    const fallback = Math.min(first + targetWords - 1, words.length - 1);
    let last = fallback;
    for (let index = fallback; index <= lastAllowed; index++) {
      if (SENTENCE_END.test(words[index]!.text)) {
        last = index;
        break;
      }
    }
    chunks.push({ first, last });
    first = last + 1;
  }
  return chunks;
}

export async function planInChunks(
  words: Word[],
  size: ChunkSize,
  requestChunk: RequestChunk,
  onCaption: (caption: PlannedCaption) => void,
): Promise<CaptionPlan> {
  const captions: PlannedCaption[] = [];
  for (const { first, last } of splitIntoChunks(words, size)) {
    const request: ChunkRequest = {
      first,
      last,
      transcript: words
        .slice(first, last + 1)
        .map((word, offset) => `${first + offset}|${word.text}`)
        .join("\n"),
      previousCaptions: captions.slice(-PREVIOUS_CAPTIONS_SENT).map((caption) => caption.text),
    };
    const planned = await planChunkWithRetry(request, requestChunk);
    planned.forEach(onCaption);
    captions.push(...planned);
  }
  return { captions };
}

async function planChunkWithRetry(request: ChunkRequest, requestChunk: RequestChunk): Promise<PlannedCaption[]> {
  let lastError: InvalidCaptionPlanError | undefined;
  for (let attempt = 0; attempt < ATTEMPTS_PER_CHUNK; attempt++) {
    try {
      const planned = await requestChunk(request);
      assertCaptionsCover(planned, request.first, request.last);
      return planned;
    } catch (error) {
      if (!(error instanceof InvalidCaptionPlanError)) throw error;
      lastError = error;
    }
  }
  throw lastError;
}

export class ClaudeCaptionPlanner implements CaptionPlanner {
  constructor(
    private readonly client: Anthropic,
    private readonly model: string,
    private readonly systemPrompt: string,
  ) {}

  plan(words: Word[], onCaption: (caption: PlannedCaption) => void): Promise<CaptionPlan> {
    return planInChunks(words, CHUNK_SIZE, (request) => this.requestChunk(request), onCaption);
  }

  private async requestChunk(request: ChunkRequest): Promise<PlannedCaption[]> {
    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: this.systemPrompt,
      tools: [saveCaptionsTool],
      tool_choice: { type: "tool", name: TOOL_NAME },
      messages: [{ role: "user", content: chunkMessage(request) }],
    });
    const toolUse = message.content.find((block) => block.type === "tool_use");
    if (!toolUse) throw new InvalidCaptionPlanError(`Model ${this.model} returned no captions`);
    return (toolUse.input as { captions?: PlannedCaption[] }).captions ?? [];
  }
}

function chunkMessage({ first, last, transcript, previousCaptions }: ChunkRequest): string {
  const previous = previousCaptions.length > 0 ? previousCaptions.join("\n") : "(none, this is the start)";
  return [
    "<captions_so_far>",
    previous,
    "</captions_so_far>",
    "",
    `<transcript first="${first}" last="${last}">`,
    transcript,
    "</transcript>",
    "",
    `Caption every index from ${first} to ${last}. Do not repeat the captions so far.`,
  ].join("\n");
}
