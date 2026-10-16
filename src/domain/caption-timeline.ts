import type { Caption, PlannedCaption } from "./caption";
import type { Word } from "./word";

const KEYWORD_MARK = "*";

export function buildCaptionTimeline(
  transcript: Word[],
  planned: PlannedCaption[],
): { words: Word[]; captions: Caption[] } {
  const words: Word[] = [];
  const captions: Caption[] = [];

  for (const { first, last, text } of planned) {
    const tokens = parseTokens(text);
    if (tokens.length === 0) continue;

    const span = transcript.slice(first, last + 1);
    const timings = tokens.length === span.length ? span : spreadByLength(tokens, span);
    const captionFirst = words.length;
    const keywords: number[] = [];
    tokens.forEach((token, index) => {
      if (token.keyword) keywords.push(words.length);
      words.push({ text: token.text, start: timings[index]!.start, end: timings[index]!.end });
    });
    captions.push({ first: captionFirst, last: words.length - 1, keywords });
  }

  return { words, captions };
}

function parseTokens(text: string): { text: string; keyword: boolean }[] {
  let insideKeyword = false;
  return text
    .split(/\s+/)
    .filter((token) => token.replaceAll(KEYWORD_MARK, "") !== "")
    .map((token) => {
      const marks = token.split(KEYWORD_MARK).length - 1;
      const keyword = insideKeyword || marks > 0;
      if (marks % 2 === 1) insideKeyword = !insideKeyword;
      return { text: token.replaceAll(KEYWORD_MARK, ""), keyword };
    });
}

function spreadByLength(tokens: { text: string }[], span: Word[]): { start: number; end: number }[] {
  const start = span[0]!.start;
  const duration = span.at(-1)!.end - start;
  const totalLength = tokens.reduce((sum, token) => sum + token.text.length, 0);
  let cursor = start;
  return tokens.map((token) => {
    const timing = { start: cursor, end: cursor + (duration * token.text.length) / totalLength };
    cursor = timing.end;
    return timing;
  });
}
