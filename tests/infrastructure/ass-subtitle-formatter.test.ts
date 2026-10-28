import { describe, expect, test } from "bun:test";
import type { Caption } from "../../src/domain/caption";
import type { CaptionTheme } from "../../src/domain/caption-theme";
import type { Word } from "../../src/domain/word";
import { AssSubtitleFormatter, toAssColor, toAssTimestamp } from "../../src/infrastructure/ass-subtitle-formatter";

const theme: CaptionTheme = {
  box: { red: 0x4d, green: 0x5b, blue: 0x4a },
  boxOpacity: 0.95,
  upcoming: { red: 0xa8, green: 0xb0, blue: 0xa5 },
  active: { red: 0xf9, green: 0xd0, blue: 0x54 },
  spoken: { red: 0xfa, green: 0xfa, blue: 0xfa },
  keyword: { red: 0x11, green: 0x22, blue: 0x33 },
};
const charWidth = (text: string, size: number) => text.length * size * 0.5;
const frame = { width: 1920, height: 1080 };

const words: Word[] = [
  { text: "Halo", start: 1, end: 1.4 },
  { text: "semua", start: 1.5, end: 2 },
  { text: "teman", start: 2.1, end: 2.6 },
];
const captions: Caption[] = [{ first: 0, last: 2, keywords: [0] }];

const dialogues = (ass: string) => ass.split("\n").filter((line) => line.startsWith("Dialogue:"));
const ACTIVE = toAssColor(theme.active);
const KEYWORD = toAssColor(theme.keyword);
const UPCOMING = toAssColor(theme.upcoming);
const SPOKEN = toAssColor(theme.spoken);

describe("toAssColor", () => {
  test("writes &HAABBGGRR with alpha as transparency", () => {
    expect(toAssColor({ red: 0x4d, green: 0x5b, blue: 0x4a }, 0.95)).toBe("&H0D4A5B4D");
    expect(toAssColor({ red: 0xff, green: 0x00, blue: 0x10 })).toBe("&H001000FF");
  });
});

describe("toAssTimestamp", () => {
  test("writes h:mm:ss.cc", () => {
    expect(toAssTimestamp(0)).toBe("0:00:00.00");
    expect(toAssTimestamp(3725.456)).toBe("1:02:05.46");
  });
});

describe("AssSubtitleFormatter", () => {
  const ass = new AssSubtitleFormatter(theme, charWidth).format(captions, words, frame);
  const lines = dialogues(ass);

  test("sizes the script to the video frame", () => {
    expect(ass).toContain("PlayResX: 1920");
    expect(ass).toContain("PlayResY: 1080");
  });

  test("draws one rounded box for the whole caption on the bottom layer", () => {
    const box = lines[0]!;
    expect(box).toStartWith("Dialogue: 0,0:00:01.00,0:00:03.00,Box,");
    expect(box).toContain("\\p1}m ");
    expect(ass).toContain(`Style: Box,Geist Bold,54,${toAssColor(theme.box, 0.95)}`);
  });

  test("shows one text state per spoken word, back to back", () => {
    const states = lines.slice(1);
    expect(states.map((line) => line.split(",").slice(1, 3).join("-"))).toEqual([
      "0:00:01.00-0:00:01.50",
      "0:00:01.50-0:00:02.10",
      "0:00:02.10-0:00:03.00",
    ]);
  });

  test("colors the active word, keeps keywords highlighted and dims upcoming words", () => {
    const second = lines[2]!;
    expect(second).toContain(`{\\1c${KEYWORD}}Halo`);
    expect(second).toContain(`{\\1c${ACTIVE}}semua`);
    expect(second).toContain(`{\\1c${UPCOMING}}teman`);
  });

  test("turns spoken words that are not keywords to the spoken color", () => {
    const ass = new AssSubtitleFormatter(theme, charWidth).format([{ first: 0, last: 2, keywords: [] }], words, frame);
    expect(dialogues(ass)[3]).toContain(`{\\1c${SPOKEN}}semua`);
  });

  test("shrinks a caption that would overflow the frame", () => {
    const long = [{ text: "x".repeat(80), start: 0, end: 1 }];
    const ass = new AssSubtitleFormatter(theme, charWidth).format([{ first: 0, last: 0, keywords: [] }], long, frame);
    const fontSize = Number(/\\fs([\d.]+)/.exec(dialogues(ass)[1]!)![1]);
    expect(fontSize).toBeLessThan(54);
  });

  test("places the caption box center low in the frame", () => {
    expect(lines[0]).toContain("\\pos(960,939.6)");
  });

  test("swaps back-to-back captions without fading, so no see-through ghost shows between them", () => {
    const pair: Word[] = [
      { text: "satu", start: 0, end: 0.5 },
      { text: "dua", start: 0.5, end: 1 },
    ];
    const split = [
      { first: 0, last: 0, keywords: [] },
      { first: 1, last: 1, keywords: [] },
    ];
    const [firstBox, firstText, secondBox, secondText] = dialogues(
      new AssSubtitleFormatter(theme, charWidth).format(split, pair, frame),
    );
    expect(firstBox).toContain("\\fad(90,0)");
    expect(firstText).toContain("\\fad(90,0)");
    expect(secondBox).toContain("\\fad(0,90)");
    expect(secondText).toContain("\\fad(0,90)");
  });

  test("fades a caption in and out when silence surrounds it", () => {
    expect(lines[0]).toContain("\\fad(90,90)");
    expect(lines[1]).toContain("\\fad(90,0)");
    expect(lines[3]).toContain("\\fad(0,90)");
  });

  test("strips characters that would break ASS override tags", () => {
    const risky = [{ text: "a{\\b1}b", start: 0, end: 1 }];
    const ass = new AssSubtitleFormatter(theme, charWidth).format([{ first: 0, last: 0, keywords: [] }], risky, frame);
    expect(dialogues(ass)[1]).toEndWith("ab1b");
  });
});
