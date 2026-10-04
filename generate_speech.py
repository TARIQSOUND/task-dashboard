import argparse
from pathlib import Path

from pydub import AudioSegment


def normalize_reference(input_path: str, output_path: str):
    audio = AudioSegment.from_file(input_path)
    audio = audio.set_channels(1)
    audio = audio.set_frame_rate(16000)
    audio.export(output_path, format="wav")


def main():
    parser = argparse.ArgumentParser(description="Generate speech from text using a custom voice reference.")
    parser.add_argument("--text", required=True, help="Text to synthesize.")
    parser.add_argument("--reference", required=True, help="Reference .wav audio file for the voice.")
    parser.add_argument("--output", default="output.wav", help="Output file path.")
    parser.add_argument("--language", default="ar", help="Language code, e.g. ar or en.")
    parser.add_argument("--gpu", action="store_true", help="Use GPU if available.")
    args = parser.parse_args()

    ref_in = Path(args.reference)
    if not ref_in.exists():
        raise FileNotFoundError(f"Reference file not found: {ref_in}")

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    normalized = output_path.with_name(f"{output_path.stem}_normalized.wav")
    normalize_reference(str(ref_in), str(normalized))

    print(f"[1/2] Normalized reference: {normalized}")

    try:
        from TTS.api import TTS
    except Exception as exc:
        raise RuntimeError("Install requirements first: pip install -r requirements.txt") from exc

    print(f"[2/2] Generating speech for text: {args.text[:80]}...")
    tts = TTS(
        model_name="tts_models/multilingual/multi-dataset/xtts_v2",
        progress_bar=False,
        gpu=args.gpu,
    )

    tts.tts_to_file(
        text=args.text,
        speaker_wav=str(normalized),
        language=args.language,
        file_path=str(output_path),
    )

    print(f"Done: {output_path}")


if __name__ == "__main__":
    main()
