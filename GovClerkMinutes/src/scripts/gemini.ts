import { Command } from "commander";
import fs from "fs/promises";
import { assertString } from "@/utils/assert";

type Options = {
  file: string;
};

const PROMPT_TEMPLATE = `
Please analyze the following 1776 different WhatsApp conversations between GovClerkMinutes.com prospects and our SDR (Cliff, or sometimes called 'Operator'). GovClerkMinutes is a service that generates meeting minutes from an audio, video, text, Word, or Image upload.

Give a detailed answer with examples and numbers or statistics. Write a markdown-formatted report on this topic:

'What types of prospects consistently don’t convert? Why?'

Transcript:
{{FILE}}
`;

async function main(opts: Options): Promise<void> {
  const filePath = opts.file as string;
  const content = await fs.readFile(filePath, "utf8");

  const prompt = PROMPT_TEMPLATE.replace("{{FILE}}", content);

  const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${assertString(process.env.OPENROUTER_API_KEY)}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-pro",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    console.error(`OpenRouter responded with ${resp.status}: ${text}`);
    process.exit(2);
  }

  const data = await resp.json();
  const answer = data.choices?.[0]?.message?.content ?? JSON.stringify(data, null, 2);

  console.log(answer);

  const outputPath = `${new Date().toISOString()}.gemini_response.md`;

  await fs.writeFile(outputPath, answer, "utf8");
  console.log(`Wrote response to ${outputPath}`);
}

const program = new Command();

program
  .name("gemini")
  .description("Send a file's contents to Gemini 2.5 Pro and print the response")
  .requiredOption("-f, --file <path>", "Path to the file to include in the prompt")
  .parse(process.argv);

main(program.opts<Options>());
