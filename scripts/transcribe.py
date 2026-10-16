# /// script
# requires-python = ">=3.10"
# dependencies = ["faster-whisper>=1.1", "av<19"]
# ///
import json
import sys

from faster_whisper import WhisperModel


def main() -> None:
    if len(sys.argv) != 5:
        print("usage: transcribe.py <video> <whisper-model> <language|auto> <prompt>", file=sys.stderr)
        sys.exit(2)
    video_path, model_name, language, prompt = sys.argv[1:5]

    model = WhisperModel(model_name, device="cpu", compute_type="int8")
    segments, info = model.transcribe(
        video_path,
        language=None if language == "auto" else language,
        initial_prompt=prompt or None,
        word_timestamps=True,
        vad_filter=True,
        # Feeding earlier text back in makes Whisper repeat itself over silence and noise.
        condition_on_previous_text=False,
        beam_size=5,
    )

    words = []
    for segment in segments:
        print(f"  {segment.end:7.1f}s  {segment.text.strip()}", file=sys.stderr)
        for word in segment.words:
            text = word.word.strip()
            if text:
                words.append({"text": text, "start": round(word.start, 3), "end": round(word.end, 3)})

    json.dump({"language": info.language, "words": words}, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()
