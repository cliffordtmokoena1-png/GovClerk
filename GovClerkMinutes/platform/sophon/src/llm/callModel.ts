import { assertString } from "../../../../src/utils/assert.ts";

// Generic structured model invocation with json_schema response_format
export async function callModel<T>(
  model: "openai/gpt-5",
  schemaName: string,
  jsonSchema: Record<string, any>,
  payload: any,
  maxTokens = 50000
): Promise<T> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${assertString(process.env.OPENROUTER_API_KEY)}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://GovClerkMinutes.com",
      "X-Title": "GovClerkMinutes",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: payload,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: schemaName,
          schema: jsonSchema,
          strict: true,
        },
      },
      max_tokens: maxTokens,
      reasoning: { effort: "minimal" },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`OpenRouter error ${res.status}: ${errText}`);
  }
  const data = await res.json();
  console.info("[LLM] Raw response data:", JSON.stringify(data, null, 2));
  const content: string | undefined = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Model returned no content");
  }
  const raw = content.replace(/```(?:json)?\n([\s\S]*?)\n```/i, "$1").trim();
  return JSON.parse(raw) as T;
}
