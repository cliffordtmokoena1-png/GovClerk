#!/usr/bin/env node

import * as fs from "fs/promises";
import * as path from "path";

// Get the folder path from command line arguments
const folderPath = process.argv[2];

if (!folderPath) {
  console.error("Please provide a folder path as an argument");
  process.exit(1);
}

// Get the API key from environment variables
const apiKey = process.env.OPENROUTER_API_KEY;

if (!apiKey) {
  console.error("OPENROUTER_API_KEY environment variable is not set");
  process.exit(1);
}

console.log(`Processing folder: ${folderPath}`);

interface OpenRouterResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

async function processFolder(folderPath: string): Promise<void> {
  try {
    try {
      await fs.access(folderPath);
    } catch (e) {
      console.error(`The folder path does not exist: ${folderPath}`);
      console.error("Make sure to properly escape spaces in the path or use quotes.");
      process.exit(1);
    }

    const absolutePath = path.resolve(folderPath);
    console.log(`Absolute path: ${absolutePath}`);

    const files = await fs.readdir(folderPath);
    console.log(`Found ${files.length} files in folder`);

    const txtFile = files.find((file) => file.endsWith(".txt"));
    const mdFile = files.find((file) => file.endsWith(".md") && !file.endsWith("-fixed.md"));

    if (!txtFile || !mdFile) {
      console.error("Could not find both .txt and .md files in the specified folder");
      process.exit(1);
    }

    const txtContent = await fs.readFile(path.join(folderPath, txtFile), "utf8");
    const mdContent = await fs.readFile(path.join(folderPath, mdFile), "utf8");

    console.log(`Processing transcript: ${txtFile}`);
    console.log(`Processing minutes: ${mdFile}`);

    const response = await callOpenRouterAPI(txtContent, mdContent);

    const outputFilename = mdFile.replace(".md", "-fixed.md");
    await fs.writeFile(path.join(folderPath, outputFilename), response);

    console.log(`Successfully created: ${outputFilename}`);
  } catch (error) {
    console.error("Error processing folder:", (error as Error).message);
    process.exit(1);
  }
}

async function callOpenRouterAPI(
  transcriptContent: string,
  minutesContent: string
): Promise<string> {
  const url = "https://openrouter.ai/api/v1/chat/completions";

  const prompt = `
I need you to update a meeting minutes document based on a transcript.

Transcript:
${transcriptContent}

Current Minutes:
${minutesContent}

Instructions:
1. Do NOT change the structure or formatting of the minutes document.
2. Remove any content from the minutes that is NOT mentioned in the transcript.
3. Replace actual names with corresponding speaker labels from the transcript (e.g., {{A}}, {{B}}, etc.).
4. Preserve ALL markdown formatting.
5. Return ONLY the updated minutes content without any additional explanation.
`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://GovClerkMinutes.com",
        "X-Title": "GovClerkMinutes",
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

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenRouter API error: ${response.status} ${JSON.stringify(errorData)}`);
    }

    const data = (await response.json()) as OpenRouterResponse;

    if (data?.choices?.[0]?.message?.content) {
      return data.choices[0].message.content;
    } else {
      throw new Error("Invalid response structure from OpenRouter API");
    }
  } catch (error) {
    console.error("Error calling OpenRouter API:", (error as Error).message);
    throw error;
  }
}

processFolder(folderPath);
