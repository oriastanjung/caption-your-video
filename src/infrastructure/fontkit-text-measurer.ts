import * as fontkit from "fontkit";

export type TextMeasurer = (text: string, fontSize: number) => number;

export const FONTS_DIR = "fonts";
export const FONT_FILE = `${FONTS_DIR}/Geist-Bold.ttf`;
export const FONT_FAMILY = "Geist Bold";

// libass sizes a font so that winAscent + winDescent equals the ASS font size.
export function createTextMeasurer(fontFile: string): TextMeasurer {
  const font = fontkit.openSync(fontFile) as fontkit.Font;
  const { winAscent, winDescent } = font["OS/2"] as { winAscent: number; winDescent: number };
  return (text, fontSize) => (font.layout(text).advanceWidth / (winAscent + winDescent)) * fontSize;
}
