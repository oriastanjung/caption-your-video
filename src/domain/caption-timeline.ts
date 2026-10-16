import { joinWords, type Caption, type PlannedCaption } from "./caption";
import type { Word } from "./word";

export const MAX_CAPTION_CHARACTERS = 26;
const KEYWORD_MARK = "*";
const CLAUSE_END = /[,.!?;:]$/;
const EARLY_CUT_FILL = 1 / 3;

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

export function splitLongCaptions(words: Word[], captions: Caption[], maxCharacters: number): Caption[] {
  return captions.flatMap((caption) => {
    const lines: Caption[] = [];
    let first = caption.first;
    const close = (last: number) => {
      lines.push({ first, last, keywords: caption.keywords.filter((index) => index >= first && index <= last) });
      first = last + 1;
    };
    const lineText = (last: number) => joinWords(words.slice(first, last + 1).map((word) => word.text));

    for (let index = caption.first; index <= caption.last; index++) {
      if (index > first && lineText(index).length > maxCharacters) close(index - 1);
      const endsClause = CLAUSE_END.test(words[index]!.text);
      if (index < caption.last && endsClause && lineText(index).length >= maxCharacters * EARLY_CUT_FILL) close(index);
    }
    if (first <= caption.last) close(caption.last);
    return lines;
  });
}
