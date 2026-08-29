"""
Voice features:
  - Transcription: openai-whisper (local, free)
  - Text-to-Speech: gTTS (free, Google TTS via HTTP)
"""

import os
import io
import logging
import tempfile
from pathlib import Path

logger = logging.getLogger(__name__)

# Lazy-load Whisper to avoid slow startup
_whisper_model = None

LANG_CODE_MAP = {
    "en": "en",
    "hi": "hi",
    "te": "te",
    "ta": "ta",
    "kn": "kn",
    "mr": "mr",
}


def get_whisper_model():
    global _whisper_model
    if _whisper_model is None:
        try:
            import whisper  # type: ignore
            logger.info("Loading Whisper model (base)...")
            _whisper_model = whisper.load_model("base")
            logger.info("Whisper model loaded.")
        except Exception as e:
            logger.warning(f"Whisper not available ({e}).")
            _whisper_model = "failed"
    return _whisper_model


def transcribe_audio(audio_bytes: bytes, filename: str = "audio.webm") -> str:
    """
    Transcribe audio bytes using local Whisper model.
    Returns the transcribed text string.
    """
    model = get_whisper_model()
    if model == "failed":
        return "Voice input received."

    # Write audio to a temp file (Whisper needs a file path)
    suffix = Path(filename).suffix or ".webm"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        result = model.transcribe(tmp_path, fp16=False)
        text = result.get("text", "").strip()
        logger.info(f"Whisper transcription: '{text[:80]}...' " if len(text) > 80 else f"Whisper transcription: '{text}'")
        return text
    except Exception as e:
        logger.error(f"Whisper transcription error: {e}")
        return "Voice input received."
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass


def text_to_speech(text: str, language: str = "en") -> bytes:
    """
    Convert text to speech using gTTS.
    Returns MP3 audio bytes.
    """
    try:
        from gtts import gTTS
        lang_code = LANG_CODE_MAP.get(language, "en")
        tts = gTTS(text=text[:500], lang=lang_code, slow=False)  # limit to 500 chars
        audio_buffer = io.BytesIO()
        tts.write_to_fp(audio_buffer)
        audio_buffer.seek(0)
        return audio_buffer.read()
    except Exception as e:
        logger.error(f"gTTS error: {e}")
        raise RuntimeError(f"Text-to-speech failed: {str(e)}")
