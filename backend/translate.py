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

# Pre-cached instant accurate translations for common BIS system responses
SYSTEM_TRANSLATIONS = {
    "insufficient": {
        "hi": "विश्वसनीय उत्तर देने के लिए पर्याप्त आधिकारिक साक्ष्य प्राप्त नहीं हुए। कृपया आधिकारिक भारतीय मानक ब्यूरो से https://www.bis.gov.in पर परामर्श लें या बीआईएस हेल्पलाइन: 1800-11-4070 (टोल फ्री) पर कॉल करें।",
        "te": "విశ్వసనీయంగా సమాధానం ఇవ్వడానికి తగిన అధికారిక ఆధారాలు లభించలేదు. దయచేసి అధికారిక భారతీయ ప్రమాణాల బ్యూరోను https://www.bis.gov.in లో సంప్రదించండి లేదా BIS హెల్ప్‌లైన్: 1800-11-4070 (టోల్ ఫ్రీ)కి కాల్ చేయండి.",
        "ta": "நம்பகமான பதிலளிக்க போதுமான அதிகாரப்பூர்வ சான்றுகள் பெறப்படவில்லை. அதிகாரப்பூர்வ இந்திய தரநிலைகள் பணியகத்தை https://www.bis.gov.in இல் அணுகவும் அல்லது BIS உதவி எண்: 1800-11-4070 (கட்டணமில்லா எண்) ஐ அழைக்கவும்.",
        "kn": "ವಿಶ್ವಾಸಾರ್ಹ ಉತ್ತರ ನೀಡಲು ಸಾಕಷ್ಟು ಅಧಿಕೃತ ಪುರಾವೆಗಳು ಲಭ್ಯವಾಗಿಲ್ಲ. ದಯವಿಟ್ಟು ಅಧಿಕೃತ ಭಾರತೀಯ ಮಾನದಂಡಗಳ ಬ್ಯೂರೋವನ್ನು https://www.bis.gov.in ನಲ್ಲಿ ಸಂಪರ್ಕಿಸಿ ಅಥವಾ BIS ಸಹಾಯವಾಣಿ: 1800-11-4070 (ಟೋಲ್ ಫ್ರೀ) ಗೆ ಕರೆ ಮಾಡಿ.",
        "mr": "विश्वासार्ह उत्तर देण्यासाठी पुरेसे अधिकृत पुरावे मिळाले नाहीत. कृपया अधिकृत भारतीय मानक ब्युरोशी https://www.bis.gov.in वर संपर्क साधा किंवा बीआयएस हेल्पलाइन: 1800-11-4070 (टोल फ्री) वर कॉल करा.",
    }
}

def _translate_with_llm(text: str, target_lang_name: str) -> str:
    """Translate text using Groq LLM when GoogleTranslator is rate-limited."""
    try:
        import os

        from groq import Groq
        key = os.getenv("GROQ_API_KEY", "")
        if not key:
            return ""
        model = os.getenv("LLM_MODEL", "llama-3.3-70b-versatile")
        client = Groq(api_key=key)
        prompt = (
            f"Translate the following text into {target_lang_name}. "
            f"Output ONLY the translated sentence, without quotation marks, markdown preamble, or explanation:\n\n{text}"
        )
        resp = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=1000,
        )
        ans = (resp.choices[0].message.content or "").strip()
        return ans
    except Exception as e:
        logger.debug(f"LLM translation fallback error: {e}")
        return ""


def translate_to_english(text: str, source_lang: str) -> str:
    """Translate text from source_lang to English."""
    if source_lang == "en" or not text.strip():
        return text
    try:
        from deep_translator import GoogleTranslator
        src = source_lang if source_lang in ["hi", "te", "ta", "kn", "mr", "gu", "pa"] else "auto"
        translated = GoogleTranslator(source=src, target="en").translate(text)
        if translated and translated.strip():
            return translated
    except Exception as e:
        logger.warning(f"GoogleTranslator to English failed ({e}). Trying LLM fallback...")

    # LLM fallback
    llm_translated = _translate_with_llm(text, "English")
    if llm_translated:
        return llm_translated
    return text


def translate_from_english(text: str, target_lang: str) -> str:
    """Translate text from English to target_lang."""
    if target_lang == "en" or not text.strip():
        return text
    tgt_name = LANG_MAP.get(target_lang, target_lang)

    # Fast-path for common system messages
    if "insufficient authoritative evidence" in text.lower():
        cached = SYSTEM_TRANSLATIONS.get("insufficient", {}).get(target_lang)
        if cached:
            return cached

    try:
        from deep_translator import GoogleTranslator
        tgt = target_lang if target_lang in ["hi", "te", "ta", "kn", "mr", "gu", "pa"] else "en"
        if tgt == "en":
            return text
        max_chunk = 4000
        if len(text) <= max_chunk:
            translated = GoogleTranslator(source="en", target=tgt).translate(text)
            if translated and translated.strip():
                return translated
        else:
            chunks = [text[i:i+max_chunk] for i in range(0, len(text), max_chunk)]
            translated_chunks = []
            for chunk in chunks:
                t = GoogleTranslator(source="en", target=tgt).translate(chunk)
                translated_chunks.append(t or chunk)
            return "".join(translated_chunks)
    except Exception as e:
        logger.warning(f"GoogleTranslator from English failed ({e}). Trying LLM fallback...")

    # LLM fallback
    llm_translated = _translate_with_llm(text, tgt_name)
    if llm_translated:
        return llm_translated
    return text
