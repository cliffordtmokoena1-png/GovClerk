import { AssemblyAI } from 'assemblyai';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { promises as fsp } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { getSignedAudioUrl, downloadS3Object } from './s3.js';

const execFileAsync = promisify(execFile);

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
  // 1. Determine the audio URL to submit to AssemblyAI.
  //    WebM files from the in-app recorder are assembled from chunked MediaRecorder parts.
  //    Concatenated WebM chunks lack valid cluster sync points, causing AssemblyAI to
  //    produce empty transcripts even though the file has audio duration.
  //    Fix: download the file, detect WebM by content-type, convert to WAV via ffmpeg,
  //    then upload the clean WAV directly to AssemblyAI instead of using a presigned URL.
  let audioUrl: string;

  const { buffer, contentType } = await downloadS3Object(s3Key, region);
  const isWebM = (contentType ?? '').toLowerCase().includes('webm');

  if (isWebM) {
    console.log(`[assemblyai] WebM detected for ${s3Key} (content-type: ${contentType}) — converting to WAV via ffmpeg`);
    const wavBuffer = await convertWebmToWav(buffer);
    audioUrl = await client.files.upload(wavBuffer);
    console.log(`[assemblyai] WAV uploaded to AssemblyAI for ${s3Key}: ${audioUrl}`);
  } else {
    // Non-WebM formats (m4a, mp3, wav, etc.) are already clean — use presigned URL.
    audioUrl = await getSignedAudioUrl(s3Key, region);
  }

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
    transcript.error != null &&
    (
      transcript.error.includes('spoken audio') ||
      (transcript.error.includes('audio') && transcript.error.includes('duration'))
    )
  ) {
    console.warn(`[assemblyai] Language detection failed for ${s3Key}, retrying with language_code="en"`);
    // Omit language_detection and replace with an explicit language code
    const { language_detection: _, ...retryBase } = config;
    const retryConfig: Parameters<typeof client.transcripts.transcribe>[0] = {
      ...retryBase,
      language_code: 'en' as any,
    };
    transcript = await transcribeWithTimeout(retryConfig);
  }

  if (transcript.status === 'error') {
    throw new Error(`AssemblyAI transcription failed: ${transcript.error}`);
  }

  // 4. Format utterances with speaker labels like the old system used (A, B, C...)
  const rawUtterances = (transcript.utterances ?? []).map(u => ({
    speaker: u.speaker,   // already "A", "B", "C" format from AssemblyAI
    text: u.text ?? '',
    start: u.start ?? 0,
    end: u.end ?? 0,
  }));

  // Fallback: if speaker diarization returned no utterances but we have transcript text,
  // synthesize a single-speaker utterance so the pipeline doesn't fail.
  const shouldSynthesizeUtterance = rawUtterances.length === 0 && Boolean(transcript.text?.trim());
  if (shouldSynthesizeUtterance) {
    console.warn(`[assemblyai] No utterances from diarization for ${s3Key}, falling back to full transcript text as single speaker`);
  }
  const utterances = shouldSynthesizeUtterance
    ? [{
        speaker: 'A',
        text: transcript.text ?? '',
        start: 0,
        end: (transcript.audio_duration ?? 0) * 1000, // convert seconds to ms
      }]
    : rawUtterances;

  const speakers = [...new Set(utterances.map(u => u.speaker))];

  return {
    transcript: transcript.text ?? '',
    utterances,
    speakers,
    audio_duration: transcript.audio_duration ?? 0,
  };
}

/**
 * Converts a WebM audio buffer to a WAV buffer using ffmpeg.
 * This is necessary because chunked WebM recordings from MediaRecorder lack
 * valid cluster sync points at chunk boundaries, making the concatenated file
 * undecodable by AssemblyAI. Converting to WAV produces a clean, fully decodable file.
 */
async function convertWebmToWav(inputBuffer: Buffer): Promise<Buffer> {
  const tmpDir = os.tmpdir();
  const id = randomUUID();
  const inputPath = path.join(tmpDir, `govclerk_audio_${id}.webm`);
  const outputPath = path.join(tmpDir, `govclerk_audio_${id}.wav`);
  try {
    await fsp.writeFile(inputPath, inputBuffer);
    // -y: overwrite output; -acodec pcm_s16le: lossless PCM; -ar 16000: 16 kHz sample rate;
    // -ac 1: mono (sufficient for speech transcription, halves file size)
    await execFileAsync('ffmpeg', ['-y', '-i', inputPath, '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1', outputPath]);
    return await fsp.readFile(outputPath);
  } finally {
    await fsp.unlink(inputPath).catch(() => { /* ignore */ });
    await fsp.unlink(outputPath).catch(() => { /* ignore */ });
  }
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