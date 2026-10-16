import { describe, expect, test } from "bun:test";
import { ConfigError, loadConfig } from "../../src/infrastructure/config";

const required = { ANTHROPIC_API_KEY: "sk-test" };

describe("loadConfig", () => {
  test("uses defaults when only the API key is set", () => {
    const config = loadConfig(required);

    expect(config.anthropic).toEqual({ apiKey: "sk-test", baseURL: undefined, model: "claude-haiku-5-5" });
    expect(config.whisper).toEqual({ model: "large-v3-turbo", python: undefined, language: undefined });
    expect(config.theme.active).toEqual({ red: 0xf9, green: 0xd0, blue: 0x54 });
    expect(config.theme.boxOpacity).toBe(0.95);
  });

  test("reads a custom base URL, such as a 9router endpoint", () => {
    const config = loadConfig({
      ...required,
      ANTHROPIC_BASE_URL: "https://9router.example/v1",
      ANTHROPIC_MODEL: "willow",
    });

    expect(config.anthropic.baseURL).toBe("https://9router.example/v1");
    expect(config.anthropic.model).toBe("willow");
  });

  test("reads the Whisper model, language and an optional Python with Whisper preinstalled", () => {
    const config = loadConfig({ ...required, WHISPER_MODEL: "small", WHISPER_PYTHON: "python3", WHISPER_LANGUAGE: "id" });

    expect(config.whisper).toEqual({ model: "small", python: "python3", language: "id" });
  });

  test("reads caption colors from the environment", () => {
    const config = loadConfig({
      ...required,
      CAPTION_BOX_COLOR: "#112233",
      CAPTION_BOX_OPACITY: "0.5",
      CAPTION_UPCOMING_COLOR: "#445566",
      CAPTION_ACTIVE_COLOR: "#778899",
      CAPTION_SPOKEN_COLOR: "#AABBCC",
      CAPTION_KEYWORD_COLOR: "#DDEEFF",
    });

    expect(config.theme).toEqual({
      box: { red: 0x11, green: 0x22, blue: 0x33 },
      boxOpacity: 0.5,
      upcoming: { red: 0x44, green: 0x55, blue: 0x66 },
      active: { red: 0x77, green: 0x88, blue: 0x99 },
      spoken: { red: 0xaa, green: 0xbb, blue: 0xcc },
      keyword: { red: 0xdd, green: 0xee, blue: 0xff },
    });
  });

  test("treats empty values as unset", () => {
    const config = loadConfig({ ...required, ANTHROPIC_BASE_URL: "", CAPTION_ACTIVE_COLOR: "" });

    expect(config.anthropic.baseURL).toBeUndefined();
    expect(config.theme.active).toEqual({ red: 0xf9, green: 0xd0, blue: 0x54 });
  });

  test("fails fast without an API key", () => {
    expect(() => loadConfig({})).toThrow(ConfigError);
  });

  test("names the variable that holds a bad color", () => {
    expect(() => loadConfig({ ...required, CAPTION_BOX_COLOR: "green" })).toThrow(/CAPTION_BOX_COLOR/);
  });
});
