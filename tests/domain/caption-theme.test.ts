import { describe, expect, test } from "bun:test";
import { InvalidColorError, parseHexColor, parseOpacity } from "../../src/domain/caption-theme";

describe("parseHexColor", () => {
  test("reads #RRGGBB in any case", () => {
    expect(parseHexColor("#F9d054")).toEqual({ red: 0xf9, green: 0xd0, blue: 0x54 });
  });

  test("reads RRGGBB without the hash", () => {
    expect(parseHexColor("4d5b4a")).toEqual({ red: 0x4d, green: 0x5b, blue: 0x4a });
  });

  test("rejects anything that is not six hex digits", () => {
    for (const value of ["#fff", "#GG0000", "red", "", "#1234567"]) {
      expect(() => parseHexColor(value)).toThrow(InvalidColorError);
    }
  });
});

describe("parseOpacity", () => {
  test("reads a number from 0 to 1", () => {
    expect(parseOpacity("0.95")).toBe(0.95);
    expect(parseOpacity("0")).toBe(0);
    expect(parseOpacity("1")).toBe(1);
  });

  test("rejects values outside 0 to 1", () => {
    for (const value of ["1.2", "-0.1", "abc", ""]) {
      expect(() => parseOpacity(value)).toThrow(InvalidColorError);
    }
  });
});
