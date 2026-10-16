export type Color = { red: number; green: number; blue: number };

export type CaptionTheme = {
  box: Color;
  boxOpacity: number;
  upcoming: Color;
  active: Color;
  spoken: Color;
  keyword: Color;
};

export class InvalidColorError extends Error {
  override name = "InvalidColorError";
}

const HEX_COLOR = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;

export function parseHexColor(value: string): Color {
  const match = HEX_COLOR.exec(value.trim());
  if (!match) throw new InvalidColorError(`"${value}" is not a #RRGGBB color`);
  const [red, green, blue] = match.slice(1).map((pair) => Number.parseInt(pair, 16)) as [number, number, number];
  return { red, green, blue };
}

export function parseOpacity(value: string): number {
  const opacity = Number(value.trim());
  if (value.trim() === "" || !Number.isFinite(opacity) || opacity < 0 || opacity > 1) {
    throw new InvalidColorError(`"${value}" is not an opacity from 0 to 1`);
  }
  return opacity;
}
