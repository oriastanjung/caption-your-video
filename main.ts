import Anthropic from "@anthropic-ai/sdk";
import { CaptionVideo } from "./src/application/caption-video";
import { AssSubtitleFormatter } from "./src/infrastructure/ass-subtitle-formatter";
import { CachedTranscriber } from "./src/infrastructure/cached-transcriber";
import { ClaudeCaptionPlanner } from "./src/infrastructure/claude-caption-planner";
import { loadConfig } from "./src/infrastructure/config";
import { readContextFiles } from "./src/infrastructure/context-files";
import { ConsoleProgressReporter } from "./src/infrastructure/console-progress-reporter";
import { FfmpegVideoEditor } from "./src/infrastructure/ffmpeg-video-editor";
import { FONT_FILE, FONTS_DIR, createTextMeasurer } from "./src/infrastructure/fontkit-text-measurer";
import { WHISPER_SCRIPT, WhisperTranscriber } from "./src/infrastructure/whisper-transcriber";

const INPUT = "input/input.mp4";
const OUTPUT = "output/output.mp4";
const TRANSCRIPT_CACHE = "output/transcript.json";
const CONTEXT_FILES = ["input/context.txt", "input/story.md"];
const SYSTEM_PROMPT = "prompts/segment.md";

if (!(await Bun.file(INPUT).exists())) {
  console.error(`Missing ${INPUT}. Put your video there and run again.`);
  process.exit(1);
}

const config = loadConfig(Bun.env);
const client = new Anthropic({ apiKey: config.anthropic.apiKey, baseURL: config.anthropic.baseURL });

const captionVideo = new CaptionVideo({
  transcriber: new CachedTranscriber(
    new WhisperTranscriber(config.whisper),
    TRANSCRIPT_CACHE,
    JSON.stringify({
      model: config.whisper.model,
      language: config.whisper.language,
      script: Bun.hash(await Bun.file(WHISPER_SCRIPT).text()).toString(),
    }),
    (message) => console.log(message),
  ),
  planner: new ClaudeCaptionPlanner(client, config.anthropic.model, await Bun.file(SYSTEM_PROMPT).text()),
  formatter: new AssSubtitleFormatter(config.theme, createTextMeasurer(FONT_FILE)),
  videoEditor: new FfmpegVideoEditor(FONTS_DIR),
  reporter: new ConsoleProgressReporter(),
});

const context = await readContextFiles(CONTEXT_FILES);
if (context) console.log(`Using context from ${CONTEXT_FILES.join(" and ")}`);

const { captionCount } = await captionVideo.execute({ input: INPUT, output: OUTPUT, context });
console.log(`\nDone: ${OUTPUT} (${captionCount} captions)`);
