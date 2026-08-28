"""
Translation helper using deep-translator (free, no API key required).
Falls back gracefully if translation fails.
"""
import logging

logger = logging.getLogger(__name__)

# Language code mapping
LANG_MAP = {
    "en": "english",
    "hi": "hindi",
    "te": "telugu",
    "ta": "tamil",
    "kn": "kannada",
    "mr": "marathi",
    "gu": "gujarati",
    "pa": "punjabi",
}

def translate_to_english(text: str, source_lang: str) -> str:
    """Translate text from source_lang to English."""
    if source_lang == "en" or not text.strip():
        return text
    try:
        from deep_translator import GoogleTranslator
        src = source_lang if source_lang in ["hi", "te", "ta", "kn", "mr", "gu", "pa"] else "auto"
        translated = GoogleTranslator(source=src, target="en").translate(text)
        return translated or text
    except Exception as e:
        logger.warning(f"Translation to English failed: {e}. Using original text.")
        return text


def translate_from_english(text: str, target_lang: str) -> str:
    """Translate text from English to target_lang."""
    if target_lang == "en" or not text.strip():
        return text
    try:
        from deep_translator import GoogleTranslator
        tgt = target_lang if target_lang in ["hi", "te", "ta", "kn", "mr", "gu", "pa"] else "en"
        if tgt == "en":
            return text
        # Split large text into chunks (GoogleTranslator has 5000 char limit)
        max_chunk = 4000
        if len(text) <= max_chunk:
            translated = GoogleTranslator(source="en", target=tgt).translate(text)
            return translated or text
        # Chunk-based translation
        chunks = [text[i:i+max_chunk] for i in range(0, len(text), max_chunk)]
        translated_chunks = []
        for chunk in chunks:
            t = GoogleTranslator(source="en", target=tgt).translate(chunk)
            translated_chunks.append(t or chunk)
        return "".join(translated_chunks)
    except Exception as e:
        logger.warning(f"Translation from English failed: {e}. Using English text.")
        return text
