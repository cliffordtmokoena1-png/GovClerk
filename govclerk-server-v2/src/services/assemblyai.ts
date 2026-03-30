import { AssemblyAI } from 'assemblyai';
import { getSignedAudioUrl } from './s3.js';

const client = new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY! });

export interface DiarizationResult {
  transcript: string;
  utterances: Array<{ speaker: string; text: string; start: number; end: number; }>;
  speakers: string[];
  audio_duration: number;
}

export async function transcribeAndDiarize(
  s3Key: string,
  region: string,
  language?: string,
): Promise<DiarizationResult> {
  const audioUrl = await getSignedAudioUrl(s3Key, region);

  const config: Parameters<typeof client.transcripts.transcribe>[0] = {
    audio_url: audioUrl,
    speaker_labels: true,
  };

  if (language && language !== 'auto') {
    config.language_code = language as any;
  } else {
    config.language_detection = true;
  }

  const transcript = await client.transcripts.transcribe(config);

  if (transcript.status === 'error') {
    throw new Error(`AssemblyAI transcription failed: ${transcript.error}`);
  }

  const utterances = (transcript.utterances ?? []).map(u => ({
    speaker: u.speaker,
    text: u.text,
    start: u.start ?? 0,
    end: u.end ?? 0,
  }));

  return {
    transcript: transcript.text ?? '',
    utterances,
    speakers: [...new Set(utterances.map(u => u.speaker))],
    audio_duration: transcript.audio_duration ?? 0,
  };
}

export function formatTranscriptForMinutes(result: DiarizationResult): string {
  return result.utterances.map(u => `{{${u.speaker}}}: ${u.text}`).join('\n');
}
