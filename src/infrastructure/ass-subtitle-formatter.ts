import type { SubtitleFormatter } from "../application/ports";
import {
  captionWindow,
  joinWords,
  separatorBefore,
  wordState,
  type Caption,
  type WordState,
} from "../domain/caption";
import type { CaptionTheme, Color } from "../domain/caption-theme";
import type { FrameSize } from "../domain/frame-size";
import type { Word } from "../domain/word";
import { FONT_FAMILY, type TextMeasurer } from "./fontkit-text-measurer";

const HOLD_AFTER_LAST_WORD_SECONDS = 0.4;
const FADE_MS = 90;
const POP_MS = 140;
const POP_FROM_PERCENT = 92;

const FONT_SIZE_OF_SHORT_SIDE = 0.05;
const BOX_PADDING_X = 0.68;
const BOX_HEIGHT = 1.6;
const BOX_RADIUS = 0.36;
const MAX_BOX_WIDTH_OF_FRAME = 0.9;
const CAPTION_CENTER_Y_OF_FRAME = 0.82;

export function toAssColor({ red, green, blue }: Color, opacity = 1): string {
  const hex = (value: number) => value.toString(16).padStart(2, "0").toUpperCase();
  return `&H${hex(Math.round((1 - opacity) * 255))}${hex(blue)}${hex(green)}${hex(red)}`;
}

export function toAssTimestamp(seconds: number): string {
  const centiseconds = Math.round(seconds * 100);
  const pad = (value: number) => String(value).padStart(2, "0");
  const hours = Math.floor(centiseconds / 360000);
  const minutes = Math.floor((centiseconds % 360000) / 6000);
  const secs = Math.floor((centiseconds % 6000) / 100);
  return `${hours}:${pad(minutes)}:${pad(secs)}.${pad(centiseconds % 100)}`;
}

export class AssSubtitleFormatter implements SubtitleFormatter {
  constructor(
    private readonly theme: CaptionTheme,
    private readonly measureText: TextMeasurer,
  ) {}

  format(captions: Caption[], words: Word[], frame: FrameSize): string {
    const fontSize = Math.min(frame.width, frame.height) * FONT_SIZE_OF_SHORT_SIDE;
    const boxColor = toAssColor(this.theme.box, this.theme.boxOpacity);
    const style = (name: string, color: string) =>
      `Style: ${name},${FONT_FAMILY},${round(fontSize)},${color},${color},${boxColor},${boxColor},0,0,0,0,100,100,0,0,1,0,0,5,0,0,0,1`;

    return [
      "[Script Info]",
      "ScriptType: v4.00+",
      `PlayResX: ${frame.width}`,
      `PlayResY: ${frame.height}`,
      "WrapStyle: 2",
      "ScaledBorderAndShadow: yes",
      "",
      "[V4+ Styles]",
      "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
      style("Box", boxColor),
      style("Text", toAssColor(this.theme.spoken)),
      "",
      "[Events]",
      "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
      ...captions.flatMap((_, index) => this.captionEvents(captions, words, index, frame, fontSize)),
      "",
    ].join("\n");
  }

  private captionEvents(captions: Caption[], words: Word[], index: number, frame: FrameSize, fontSize: number) {
    const caption = captions[index]!;
    const { start, end } = captionWindow(captions, words, index, HOLD_AFTER_LAST_WORD_SECONDS);
    const texts = words.slice(caption.first, caption.last + 1).map((word) => word.text);

    const naturalWidth = this.measureText(joinWords(texts), fontSize) + fontSize * BOX_PADDING_X * 2;
    const scale = Math.min(1, (frame.width * MAX_BOX_WIDTH_OF_FRAME) / naturalWidth);
    const position = `\\an5\\pos(${round(frame.width / 2)},${round(frame.height * CAPTION_CENTER_Y_OF_FRAME)})`;
    const pop = `\\fscx${POP_FROM_PERCENT}\\fscy${POP_FROM_PERCENT}\\t(0,${POP_MS},\\fscx100\\fscy100)`;
    const shape = roundedRect(naturalWidth * scale, fontSize * BOX_HEIGHT * scale, fontSize * BOX_RADIUS * scale);
    const box = dialogue(0, start, end, "Box", `{${position}${pop}\\fad(${FADE_MS},${FADE_MS})\\p1}${shape}`);

    const states = [];
    for (let active = caption.first; active <= caption.last; active++) {
      const stateStart = active === caption.first ? start : words[active]!.start;
      const stateEnd = active === caption.last ? end : words[active + 1]!.start;
      if (stateEnd <= stateStart) continue;
      const enter = active === caption.first ? `${pop}\\fad(${FADE_MS},0)` : "";
      const leave = active === caption.last ? `\\fad(0,${FADE_MS})` : "";
      const tags = `{${position}\\fs${round(fontSize * scale)}${enter}${leave}}`;
      states.push(dialogue(1, stateStart, stateEnd, "Text", tags + this.coloredText(caption, words, active)));
    }
    return [box, ...states];
  }

  private coloredText(caption: Caption, words: Word[], active: number): string {
    const colors: Record<WordState, Color> = {
      upcoming: this.theme.upcoming,
      active: this.theme.active,
      spoken: this.theme.spoken,
      keyword: this.theme.keyword,
    };
    let text = "";
    for (let index = caption.first; index <= caption.last; index++) {
      const word = words[index]!.text;
      const separator = index === caption.first ? "" : separatorBefore(word);
      text += `${separator}{\\1c${toAssColor(colors[wordState(caption, index, active)])}}${escapeAss(word)}`;
    }
    return text;
  }
}

function dialogue(layer: number, start: number, end: number, style: string, text: string): string {
  return `Dialogue: ${layer},${toAssTimestamp(start)},${toAssTimestamp(end)},${style},,0,0,0,,${text}`;
}

function roundedRect(width: number, height: number, radius: number): string {
  const [w, h, r] = [width, height, radius].map(round) as [number, number, number];
  const k = round(r * 0.45);
  return [
    `m ${r} 0`,
    `l ${round(w - r)} 0`,
    `b ${round(w - k)} 0 ${w} ${k} ${w} ${r}`,
    `l ${w} ${round(h - r)}`,
    `b ${w} ${round(h - k)} ${round(w - k)} ${h} ${round(w - r)} ${h}`,
    `l ${r} ${h}`,
    `b ${k} ${h} 0 ${round(h - k)} 0 ${round(h - r)}`,
    `l 0 ${r}`,
    `b 0 ${k} ${k} 0 ${r} 0`,
  ].join(" ");
}

function escapeAss(text: string): string {
  return text.replace(/[\\{}]/g, "");
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
