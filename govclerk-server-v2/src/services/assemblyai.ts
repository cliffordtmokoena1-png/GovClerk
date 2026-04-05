import { AssemblyAI } from 'assemblyai';
import { getSignedAudioUrl } from './s3.js';

const client = new AssemblyAI({
  apiKey: process.env.ASSEMBLYAI_API_KEY!,
});

export interface DiarizationResult {
  transcript: string;                          // Full plain text transcript
  utterances: Array<{
    speaker: string;                           // "A", "B", "C", etc.
    text: string;
    start: number;                             // milliseconds
    end: number;
  }>;
  speakers: string[];                          // unique speaker labels
  audio_duration: number;                      // seconds
}

/**
 * Transcribes and diarizes an audio file stored in S3.
 * Uses AssemblyAI's speaker diarization feature — no GPU needed!
 *
 * @param s3Key - The S3 key of the audio file (e.g. "uploads/upload_12345")
 * @param region - AWS region the bucket is in
 * @param language - Optional BCP-47 language code (e.g. "en", "af", "zu")
 */
export async function transcribeAndDiarize(
  s3Key: string,
  region: string,
  language?: string,
): Promise<DiarizationResult> {
  // 1. Generate a short-lived presigned URL so AssemblyAI can fetch the audio
  const audioUrl = await getSignedAudioUrl(s3Key, region);

  // 2. Submit to AssemblyAI with speaker diarization enabled
  const config: Parameters<typeof client.transcripts.transcribe>[0] = {
    audio_url: audioUrl,
    speaker_labels: true,           // enables speaker diarization
    speakers_expected: undefined,   // let AssemblyAI auto-detect speaker count
    speech_models: ['universal-3-pro', 'universal-2'] as any,  // required: list of models in priority order
  };

  // Apply language code if provided (and not "auto")
  if (language && language !== 'auto') {
    config.language_code = language as any;
  } else {
    config.language_detection = true;  // auto-detect language
  }

  // 3. Wait for transcription to complete (AssemblyAI polls internally).
  // Wrap with a 60-minute timeout so the process doesn't hang indefinitely
  // for very large recordings.
  let transcript = await transcribeWithTimeout(config);

  // If language_detection fails (common with WebM recordings from the in-app recorder),
  // retry with explicit English as fallback to bypass language detection entirely.
  if (
    transcript.status === 'error' &&
    transcript.error?.includes('language_detection') &&
    transcript.error?.includes('no spoken audio')
  ) {
    console.warn(`[assemblyai] Language detection failed for ${s3Key}, retrying with language_code="en"`);
    const retryConfig = { ...config };
    delete (retryConfig as any).language_detection;
    (retryConfig as any).language_code = 'en';
    transcript = await transcribeWithTimeout(retryConfig);
  }

  if (transcript.status === 'error') {
    throw new Error(`AssemblyAI transcription failed: ${transcript.error}`);
  }

  // 4. Format utterances with speaker labels like the old system used (A, B, C...)
  const utterances = (transcript.utterances ?? []).map(u => ({
    speaker: u.speaker,   // already "A", "B", "C" format from AssemblyAI
    text: u.text,
    start: u.start ?? 0,
    end: u.end ?? 0,
  }));

  const speakers = [...new Set(utterances.map(u => u.speaker))];

  return {
    transcript: transcript.text ?? '',
    utterances,
    speakers,
    audio_duration: transcript.audio_duration ?? 0,
  };
}

/**
 * Submits a transcription config to AssemblyAI and waits for completion,
 * with a 60-minute timeout to prevent indefinite hangs on large recordings.
 */
async function transcribeWithTimeout(config: Parameters<typeof client.transcripts.transcribe>[0]) {
  const TRANSCRIPTION_TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes
  return Promise.race([
    client.transcripts.transcribe(config),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`AssemblyAI transcription timed out after ${TRANSCRIPTION_TIMEOUT_MS / 60_000} minutes`)),
        TRANSCRIPTION_TIMEOUT_MS
      )
    ),
  ]);
}

/**
 * Formats the diarized utterances into a readable transcript string
 * compatible with the existing minutes generation prompts.
 * Output format: "{{A}}: Hello everyone.\n{{B}}: Thanks for joining..."
 */
export function formatTranscriptForMinutes(result: DiarizationResult): string {
  return result.utterances
    .map(u => `{{${u.speaker}}}: ${u.text}`)
    .join('\n');
}