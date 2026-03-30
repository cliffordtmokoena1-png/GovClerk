import { GoogleGenerativeAI } from '@google/generative-ai';
import { SYSTEM_PROMPT } from './openai.js';

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

/**
 * Generates meeting minutes from a formatted transcript string using Google Gemini.
 */
export async function generateMinutesWithGemini(transcriptStr: string): Promise<string> {
  console.log('[minutes] Using provider: gemini');
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: SYSTEM_PROMPT,
  });

  const result = await model.generateContent(
    `Please generate professional meeting minutes from this transcript:\n\n${transcriptStr}`
  );
  return result.response.text();
}
