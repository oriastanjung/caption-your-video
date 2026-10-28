# /// script
# requires-python = ">=3.10"
# dependencies = ["faster-whisper>=1.1", "av<19", "numpy"]
# ///
import json
import subprocess
import sys

import numpy as np
from faster_whisper import WhisperModel

SAMPLE_RATE = 16000
INT16_SCALE = 32768


def load_leveled_audio(video_path: str) -> np.ndarray:
    # Quiet speech next to loud typing gets dropped by VAD and Whisper unless levels are evened out first.
    pcm = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", video_path, "-vn", "-af", "dynaudnorm", "-ac", "1", "-ar", str(SAMPLE_RATE), "-f", "s16le", "-"],
        capture_output=True,
        check=True,
    ).stdout
    return np.frombuffer(pcm, np.int16).astype(np.float32) / INT16_SCALE


def main() -> None:
    if len(sys.argv) != 4:
        print("usage: transcribe.py <video> <whisper-model> <language|auto>", file=sys.stderr)
        sys.exit(2)
    video_path, model_name, language = sys.argv[1:4]

    model = WhisperModel(model_name, device="cpu", compute_type="int8")
    segments, info = model.transcribe(
        load_leveled_audio(video_path),
        language=None if language == "auto" else language,
        word_timestamps=True,
        vad_filter=True,
        # Feeding earlier text back in makes Whisper repeat itself over silence and noise.
        condition_on_previous_text=False,
        # VAD already drops silence; this second check skipped whole 30 s windows of quiet speech.
        no_speech_threshold=None,
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
