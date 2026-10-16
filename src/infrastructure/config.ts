import { InvalidColorError, parseHexColor, parseOpacity, type CaptionTheme } from "../domain/caption-theme";

export class ConfigError extends Error {
  override name = "ConfigError";
}

export type Config = {
  anthropic: { apiKey: string; baseURL: string | undefined; model: string };
  whisper: { model: string; python: string | undefined; language: string | undefined };
  theme: CaptionTheme;
};

type Env = Record<string, string | undefined>;

const DEFAULTS = {
  ANTHROPIC_MODEL: "claude-haiku-5-5",
  WHISPER_MODEL: "large-v3-turbo",
  CAPTION_BOX_COLOR: "#4D5B4A",
  CAPTION_BOX_OPACITY: "0.95",
  CAPTION_UPCOMING_COLOR: "#A8B0A5",
  CAPTION_ACTIVE_COLOR: "#F9D054",
  CAPTION_SPOKEN_COLOR: "#FAFAFA",
  CAPTION_KEYWORD_COLOR: "#F9D054",
};

export function loadConfig(env: Env): Config {
  const read = (name: string): string | undefined => {
    const value = env[name]?.trim();
    return value ? value : undefined;
  };
  const withDefault = (name: keyof typeof DEFAULTS) => read(name) ?? DEFAULTS[name];
  const parse = <T>(name: keyof typeof DEFAULTS, parser: (value: string) => T): T => {
    try {
      return parser(withDefault(name));
    } catch (error) {
      if (error instanceof InvalidColorError) throw new ConfigError(`${name}: ${error.message}`);
      throw error;
    }
  };

  const apiKey = read("ANTHROPIC_API_KEY");
  if (!apiKey) throw new ConfigError("ANTHROPIC_API_KEY is missing. Copy .env.example to .env and set it.");

  return {
    anthropic: { apiKey, baseURL: read("ANTHROPIC_BASE_URL"), model: withDefault("ANTHROPIC_MODEL") },
    whisper: { model: withDefault("WHISPER_MODEL"), python: read("WHISPER_PYTHON"), language: read("WHISPER_LANGUAGE") },
    theme: {
      box: parse("CAPTION_BOX_COLOR", parseHexColor),
      boxOpacity: parse("CAPTION_BOX_OPACITY", parseOpacity),
      upcoming: parse("CAPTION_UPCOMING_COLOR", parseHexColor),
      active: parse("CAPTION_ACTIVE_COLOR", parseHexColor),
      spoken: parse("CAPTION_SPOKEN_COLOR", parseHexColor),
      keyword: parse("CAPTION_KEYWORD_COLOR", parseHexColor),
    },
  };
}
