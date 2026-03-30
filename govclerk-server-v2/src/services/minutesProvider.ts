import { generateMinutes as generateMinutesWithOpenAI } from './openai.js';
import { generateMinutesWithGemini } from './gemini.js';

const PROVIDER = process.env.MINUTES_PROVIDER ?? 'auto';

/**
 * Generates meeting minutes using the configured provider.
 * MINUTES_PROVIDER env var: 'openai' | 'gemini' | 'auto' (default: 'auto')
 *
 * In 'auto' mode: prefers Gemini if GEMINI_API_KEY is set, otherwise uses OpenAI.
 * If the preferred provider fails, falls back to the other.
 */
export async function generateMinutes(transcriptStr: string): Promise<string> {
  if (PROVIDER === 'openai') {
    return generateMinutesWithOpenAI(transcriptStr);
  }

  if (PROVIDER === 'gemini') {
    return generateMinutesWithGemini(transcriptStr);
  }

  // 'auto' mode
  const preferGemini = Boolean(process.env.GEMINI_API_KEY);

  if (preferGemini) {
    try {
      return await generateMinutesWithGemini(transcriptStr);
    } catch (err) {
      console.error('[minutes] Gemini failed, falling back to OpenAI:', err);
      if (!process.env.OPENAI_KEY) {
        throw new Error('Gemini failed and OPENAI_KEY is not set — no fallback available');
      }
      return generateMinutesWithOpenAI(transcriptStr);
    }
  } else {
    try {
      return await generateMinutesWithOpenAI(transcriptStr);
    } catch (err) {
      console.error('[minutes] OpenAI failed, falling back to Gemini:', err);
      if (!process.env.GEMINI_API_KEY) {
        throw new Error('OpenAI failed and GEMINI_API_KEY is not set — no fallback available');
      }
      return generateMinutesWithGemini(transcriptStr);
    }
  }
}
