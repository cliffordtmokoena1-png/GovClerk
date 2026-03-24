use crate::media_file::MediaFile;
use crate::SharedRequestState;
use std::sync::Arc;

const WHISPER_SUPPORTED_CONFIDENCE_THRESHOLD: f64 = 0.4;

/// Returns true if Whisper can understand the language.
/// There are many "long tail" languages that Whisper does not support.
pub async fn is_whisper_supported(
  state: Arc<SharedRequestState>,
  media_file: &MediaFile,
) -> anyhow::Result<bool> {
  let bytes = media_file.slice(0.0, media_file.duration)?;
  let detected_language = state.python.lock().await.detect_language(&bytes)?;

  // 0.4 was determined experimentally from production.  The overall quality,
  // noise and volume level of the recording have an impact on Whisper's
  // confidence.
  return Ok(detected_language.confidence >= WHISPER_SUPPORTED_CONFIDENCE_THRESHOLD);
}

/// Returns true if the language is supported by Scribe with "good" accuracy or better (≤25% WER),
/// or if it's English (supported by Whisper).
///
/// This includes:
/// - Excellent (≤5% WER): 31 languages
/// - High Accuracy (>5% to ≤10% WER): 19 languages
/// - Good (>10% to ≤25% WER): 30 languages
pub fn is_whisper_supported_for_language(language: &str) -> bool {
  let language_prefix = language.split('-').next().unwrap_or(language);
  matches!(
    language_prefix,
    // Excellent (≤5% WER)
    "bg"  | // Bulgarian (bul)
    "ca"  | // Catalan (cat)
    "cs"  | // Czech (ces)
    "da"  | // Danish (dan)
    "nl"  | // Dutch (nld)
    "en"  | // English (eng)
    "fi"  | // Finnish (fin)
    "fr"  | // French (fra)
    "gl"  | // Galician (glg)
    "de"  | // German (deu)
    "el"  | // Greek (ell)
    "hi"  | // Hindi (hin)
    "id"  | // Indonesian (ind)
    "it"  | // Italian (ita)
    "ja"  | // Japanese (jpn)
    "kn"  | // Kannada (kan)
    "ms"  | // Malay (msa)
    "ml"  | // Malayalam (mal)
    "mk"  | // Macedonian (mkd)
    "no"  | // Norwegian (nor)
    "pl"  | // Polish (pol)
    "pt"  | // Portuguese (por)
    "ro"  | // Romanian (ron)
    "ru"  | // Russian (rus)
    "sr"  | // Serbian (srp)
    "sk"  | // Slovak (slk)
    "es"  | // Spanish (spa)
    "sv"  | // Swedish (swe)
    "tr"  | // Turkish (tur)
    "uk"  | // Ukrainian (ukr)
    "vi"  | // Vietnamese (vie)
    // High Accuracy (>5% to ≤10% WER)
    "bn"  | // Bengali (ben)
    "be"  | // Belarusian (bel)
    "bs"  | // Bosnian (bos)
    "yue" | // Cantonese (yue)
    "et"  | // Estonian (est)
    "fil" | // Filipino (fil)
    "gu"  | // Gujarati (guj)
    "hu"  | // Hungarian (hun)
    "kk"  | // Kazakh (kaz)
    "lv"  | // Latvian (lav)
    "lt"  | // Lithuanian (lit)
    "cmn" | // Mandarin (cmn)
    "mr"  | // Marathi (mar)
    "ne"  | // Nepali (nep)
    "or"  | // Odia (ori)
    "fa"  | // Persian (fas)
    "sl"  | // Slovenian (slv)
    "ta"  | // Tamil (tam)
    "te"  | // Telugu (tel)
    // Good (>10% to ≤25% WER)
    "af"  | // Afrikaans (afr)
    "ar"  | // Arabic (ara)
    "hy"  | // Armenian (hye)
    "as"  | // Assamese (asm)
    "ast" | // Asturian (ast)
    "az"  | // Azerbaijani (aze)
    "my"  | // Burmese (mya)
    "ceb" | // Cebuano (ceb)
    "hr"  | // Croatian (hrv)
    "ka"  | // Georgian (kat)
    "ha"  | // Hausa (hau)
    "iw"  | // Hebrew (heb)
    "is"  | // Icelandic (isl)
    "jv"  | // Javanese (jav)
    "kea" | // Kabuverdianu (kea)
    "ko"  | // Korean (kor)
    "ky"  | // Kyrgyz (kir)
    "ln"  | // Lingala (lin)
    "mt"  | // Maltese (mlt)
    "mn"  | // Mongolian (mon)
    "mi"  | // Māori (mri)
    "oc"  | // Occitan (oci)
    "pa"  | // Punjabi (pan)
    "sd"  | // Sindhi (snd)
    "sw"  | // Swahili (swa)
    "tg"  | // Tajik (tgk)
    "th"  | // Thai (tha)
    "ur"  | // Urdu (urd)
    "uz"  | // Uzbek (uzb)
    "cy" // Welsh (cym)
  )
}
