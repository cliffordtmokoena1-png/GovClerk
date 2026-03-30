import OpenAI from 'openai';

const client = new OpenAI({ apiKey: process.env.OPENAI_KEY! });

const FINETUNED_MODEL = 'ft:gpt-4.1-2025-04-14:GovClerkMinutes:mg-051925-r27:BYvmGnuK:ckpt-step-29';
const FALLBACK_MODEL = 'gpt-4o';

const SYSTEM_PROMPT = `You are an expert meeting minutes writer. You will be given a transcript of a meeting and must produce professional, well-structured meeting minutes. Use {{A}}, {{B}}, {{C}} etc. to refer to speakers. Format the minutes in clean Markdown with sections for: Date/Time, Attendees, Agenda Items, Discussion Points, Decisions Made, Action Items, and Next Steps.`;

export async function generateMinutes(transcriptStr: string): Promise<string> {
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `Please generate professional meeting minutes from this transcript:\n\n${transcriptStr}` },
  ];

  try {
    const response = await client.chat.completions.create({ model: FINETUNED_MODEL, messages, temperature: 0.2 });
    return response.choices[0]?.message?.content ?? '';
  } catch {
    const response = await client.chat.completions.create({ model: FALLBACK_MODEL, messages, temperature: 0.2 });
    return response.choices[0]?.message?.content ?? '';
  }
}

export async function regenerateMinutes(transcriptStr: string, previousMinutes: string, feedback: string): Promise<string> {
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `Please generate professional meeting minutes from this transcript:\n\n${transcriptStr}` },
    { role: 'assistant', content: previousMinutes },
    { role: 'user', content: `Please improve the minutes based on this feedback: ${feedback}` },
  ];
  const response = await client.chat.completions.create({ model: FALLBACK_MODEL, messages, temperature: 0.3 });
  return response.choices[0]?.message?.content ?? '';
}
