/**
 * Training Data Preparation Script
 *
 * This script processes transcript and minutes files to create training data in JSONL format
 * for fine-tuning language models. It skips any files that exceed size limits instead of truncating.
 */

import * as fs from "fs";
import * as path from "path";
import * as glob from "glob";

// The prompt to include before each transcript
const PROMPT = `Generate the final, formal meeting minutes in **Markdown format** based *only* on the provided transcript and any explicit meeting details given (like meeting notes/outline). **Focus on summarizing the substantive core of the discussion objectively, using a narrative paragraph style.** Adhere precisely to the requested structure and style using Markdown syntax. **CRITICAL: Stick strictly to information explicitly present in the transcript. DO NOT assume, infer, add parenthetical explanations/notes, add examples unless verbatim, guess roles/status, or over-explain.** Report *only* what was stated. Use clear and simple language.

If you are continuing from a previous response, do NOT write any meta commentary or transition text. Continue the output seamlessly as if writing a single, uninterrupted document.

**Inputs Provided (Potentially Incomplete):**
*   Meeting Transcript (Primary source)
*   Meeting Notes/Outline (For structure and key points reference)
*   Attendee Information (Context ONLY. DO NOT include real names.)
*   Speaker Mapping Context (Context ONLY. Connecting {{A}}, {{B}} to roles like 'Chair', 'Staff', 'Guest', if available)
*   Meeting Details Context (Organization, Committee Name, Date, Time, Location, if available)
*   Meeting Agenda (If available)
*   (Optional) Previous Minutes details if approved.

**Output Requirements (Markdown Format):**

1.  **Headers:**
    *   Use Markdown H2/H3. **DO NOT bold header text.** Include all available details (e.g Org, Committee, Location, Date, Time). Use placeholders if unknown, these can also be excluded and be made into a simpler header depending on the amount of information available.
2.  **Attendance Section (Integrates Roll Call Status - No Notes/Inference):**
    *   Use Markdown H3 or bold text (\`**Section Title**\`) for section titles (e.g "**Committee Members**", "**Staff**", "**Guests**", replace if appropriate).
    *   Use standard Markdown bullet points (\`* \`) for attendees. **List ALL attendees mentioned or provided.**
    *   **CRITICAL: List using ONLY speaker labels ({{A}}, {{B}}, etc.). NO real names.** Add role in parentheses if known from explicit context, e.g. '{{A}} (e.g. Chair)'.
    *   Append attendance marker \` - P\` or \` - A\` *only if explicitly stated during roll call*. **If status unknown, list only label/role.** DO NOT add notes.
3.  **Body Structure (CRITICAL - No Separate Roll Call Item, No Extra Headers):**
    *   **CRITICAL: Flow directly from Attendance to the first numbered list item.** No intermediate headers.
    *   Use **standard Markdown numbered lists** (\`1.\`, \`2.\`, \`3.\`) for main sections/topics.
    *   Start each main list item with the descriptive title using **double asterisk bolding (\`**Title**\`)**.
    *   **CRITICAL: Content following other main titles MUST primarily use narrative paragraphs on a double new line (\\n\\n).** Summarize the discussion for the topic in a flowing paragraph format. Standard Markdown bullet points (\`- \` or \`* \`) should be used *sparingly* within paragraphs only if essential for listing distinct items clearly (e.g., multiple specific recommendations from one proposal).
    *   **Standard Markdown nested bullet points (\`  - \` or \`  * \`) MAY be used if bullets are necessary.** **Limit nesting to ONE level deep (ONE-SPACE indent).** Use only standard markers.
    *   Ensure consistent indentation (one space per level).
4.  **Content Style (CRITICAL - Narrative, Substantive Completeness, Limited Attribution, NO Added Explanations):**
    *   Write in formal, objective, third-person narrative. **Use clear, simple, direct language.**
    *   **CRITICAL: Summarize discussions using a narrative style.** Connect different points and proposals logically within paragraphs. Use transition phrases to create a smooth flow.
    *   **CRITICAL FOR COMPLETENESS: Ensure the narrative includes the **substantive core** of discussion points, key proposals, specific examples *used to illustrate main points*, essential data (figures like '$3.5 million', '$80,000'), important context, major concerns raised, decisions made, and official updates mentioned in the transcript. Focus on information crucial for an accurate record of proceedings.**
    *   **CRITICAL: Avoid including minor conversational details, subjective descriptions of speaker tone (e.g., "frustration was expressed"), or meta-commentary on the discussion itself, unless quoting a particularly impactful statement verbatim.** Focus on *what* was discussed and decided, not *how* it felt.
    *   **Use separate sentences or distinct bullet points for separate ideas.** Avoid cramming.
    *   **Attribute statements using speaker labels ({{A}}, {{B}}, etc.) SPARINGLY within the narrative, only when necessary for clarity or context.** (Criteria: motions, specific distinct proposals attributed to an individual, official updates/data presentations, strong dissenting opinions, public comments). Integrate attribution smoothly.
    *   **CRITICAL: DO NOT add explanatory text, examples (using "e.g."), or clarifications in parentheses or otherwise, unless explicitly spoken.** Report *only* what was stated.
    *   Record motions accurately, including maker and seconder if specified:
        \`\`\`markdown
        **Motion:** Made by {{A}}, seconded by {{B}} *(or "an unspecified speaker" if not explicitly stated)*, to [Action/Details of Motion].
        *(Include brief discussion summary here if applicable)*
        The motion passed/failed [Details of vote]. *(If outcome unclear, state: Outcome not specified.)*
        \`\`\`
5.  **Tone:** Maintain a professional, formal, and strictly **objective tone**. **NO INTERPRETATION, OPINION, EDITORIALIZING, ASSUMPTIONS, INFERENCES.**
6.  **Closing:**
    *   Use a numbered list item for Adjournment: \`10. **Adjournment**\`
    *   State the exact time of adjournment *only if explicitly mentioned*. If not, state \`The meeting concluded.\`
    *   Include next meeting details (Date/Time) *only if explicitly mentioned*. If not, state \`**The next meeting date was not specified.**\`
7.  **Markdown Purity:**
    *   Use only standard Markdown syntax. Indentation: **one space** per level. Use **double asterisks (\`**text**\`)** for all bolding.
    *   **Ensure paragraphs are separated by a blank line (two newlines) for readability.**
    *   **DO NOT** include the final output within a Markdown code block.

**Strict Constraints:**
*   Adhere *exactly* to the specified Markdown structure and formatting. **No extra headers.**
*   **ABSOLUTELY NO REAL NAMES. Use ONLY speaker labels like {{A}}, {{B}}.**
*   Use *only* information explicitly present. **DO NOT infer, assume, editorialize, or add ANY explanatory text/examples not explicitly spoken.** **Avoid minor conversational details and subjective tone descriptions.**
*   **CRITICAL: Ensure content completeness focusing on the substantive core of the discussion, key data, proposals, and decisions.**
*   Attribute statements appropriately within the narrative for clarity and context. Include motion seconders if stated.
*   Use standard Markdown lists/indentation (one space). No detailed Roll Call body item. Use \`**text**\` for bolding. Do not bold header text. **Primarily use paragraphs for discussions, using bullets sparingly. Separate paragraphs with a blank line.**

**The meeting transcript, meeting notes/outline, and any available contextual details are as follows:**`;

// Function to clean up common unnecessarily escaped characters in Markdown
function cleanMarkdownEscapes(str: string): string {
  return (
    str
      // Remove unnecessary escapes for these characters in Markdown
      .replace(/\\\$/g, "$") // Dollar signs don't need escaping in normal text
      .replace(/\\#/g, "#") // Hash marks only need escaping at start of lines
      .replace(/\\_/g, "_") // Underscores only need escaping when part of word
      .replace(/\\\*/g, "*") // Asterisks only need escaping in certain contexts
      .replace(/\\\[/g, "[") // Square brackets don't need escaping in normal text
      .replace(/\\\]/g, "]") // Square brackets don't need escaping in normal text
      .replace(/\\\(/g, "(") // Parentheses don't need escaping
      .replace(/\\\)/g, ")") // Parentheses don't need escaping
    // Keep escapes for characters that might affect JSON parsing
    // We don't need to handle quotes, newlines, etc. here as JSON.stringify does that
  );
}

// Function to check the status of all transcript folders
async function checkTranscriptStatus(rootDir: string): Promise<void> {
  try {
    // Find all potential transcript folders (all directories in the root dir)
    const allItems = glob.sync(path.join(rootDir, "*"));
    const transcriptFolders = allItems.filter((folderPath) =>
      fs.lstatSync(folderPath).isDirectory()
    );
    const folderResults = transcriptFolders.map((folderPath) => {
      const folderName = path.basename(folderPath);
      const transcriptFiles = glob.sync(path.join(folderPath, "*.txt"));
      const minutesFiles = glob.sync(path.join(folderPath, "*.md"));

      return {
        folder: folderName,
        hasTranscript: transcriptFiles.length > 0,
        transcriptFile: transcriptFiles.length > 0 ? path.basename(transcriptFiles[0]) : "",
        hasMinutes: minutesFiles.length > 0,
        minutesFile: minutesFiles.length > 0 ? path.basename(minutesFiles[0]) : "",
        isReady: transcriptFiles.length > 0 && minutesFiles.length > 0,
      };
    });

    // Count statistics
    const totalFolders = folderResults.length;
    const foldersWithTranscript = folderResults.filter((r) => r.hasTranscript).length;
    const foldersWithMinutes = folderResults.filter((r) => r.hasMinutes).length;
    const foldersReady = folderResults.filter((r) => r.isReady).length;

    // Print summary
    console.log("\n====== TRANSCRIPT FOLDERS STATUS ======");
    console.log(`Total folders: ${totalFolders}`);
    console.log(
      `Folders with transcripts: ${foldersWithTranscript} (${Math.round((foldersWithTranscript / totalFolders) * 100)}%)`
    );
    console.log(
      `Folders with minutes: ${foldersWithMinutes} (${Math.round((foldersWithMinutes / totalFolders) * 100)}%)`
    );
    console.log(
      `Folders ready for processing: ${foldersReady} (${Math.round((foldersReady / totalFolders) * 100)}%)`
    );
    console.log("\n====== DETAILED FOLDER STATUS ======");

    // Group by status for better readability
    console.log("\n[READY - Both transcript and minutes files available]");
    folderResults
      .filter((r) => r.isReady)
      .forEach((r) => {
        console.log(`✅ ${r.folder}`);
        console.log(`   Transcript: ${r.transcriptFile}`);
        console.log(`   Minutes: ${r.minutesFile}`);
      });

    console.log("\n[PENDING - Only transcript file available]");
    folderResults
      .filter((r) => r.hasTranscript && !r.hasMinutes)
      .forEach((r) => {
        console.log(`⏳ ${r.folder}`);
        console.log(`   Transcript: ${r.transcriptFile}`);
        console.log(`   Minutes: Missing`);
      });

    console.log("\n[INCOMPLETE - Only minutes file available]");
    folderResults
      .filter((r) => !r.hasTranscript && r.hasMinutes)
      .forEach((r) => {
        console.log(`❓ ${r.folder}`);
        console.log(`   Transcript: Missing`);
        console.log(`   Minutes: ${r.minutesFile}`);
      });

    console.log("\n[EMPTY - No transcript or minutes files available]");
    folderResults
      .filter((r) => !r.hasTranscript && !r.hasMinutes)
      .forEach((r) => {
        console.log(`❌ ${r.folder}`);
      });
  } catch (error) {
    console.error(
      "Error checking transcript status:",
      error instanceof Error ? error.message : String(error)
    );
    throw error;
  }
}

// Main function to process all transcript folders
async function processTranscriptFolders(
  rootDir: string,
  outputFile: string,
  options: ProcessOptions
): Promise<void> {
  try {
    // Find all potential transcript folders (all directories in the root dir)
    const allItems = glob.sync(path.join(rootDir, "*"));
    const transcriptFolders = allItems.filter((item) => fs.lstatSync(item).isDirectory());

    if (transcriptFolders.length === 0) {
      console.log("No transcript folders found.");
      return;
    }

    console.log(`Found ${transcriptFolders.length} transcript folders.`);

    // Create a writable stream to the output file
    const outputStream = fs.createWriteStream(outputFile);

    // Track statistics
    let processedCount = 0;
    let skippedCount = 0;

    // Process each transcript folder
    for (const folderPath of transcriptFolders) {
      const folderName = path.basename(folderPath);
      console.log(`Processing ${folderName}...`);

      // Find transcript file (.txt)
      const transcriptFiles = glob.sync(path.join(folderPath, "*.txt"));
      if (transcriptFiles.length === 0) {
        console.log(`  SKIPPING: No transcript file found in ${folderName}`);
        skippedCount++;
        continue;
      }
      if (transcriptFiles.length > 1) {
        console.log(`  Multiple transcript files found in ${folderName}, using the first one...`);
      }

      // Find minutes file (.md)
      const minutesFiles = glob.sync(path.join(folderPath, "*.md"));
      if (minutesFiles.length === 0) {
        console.log(`  SKIPPING: No minutes file found in ${folderName}`);
        skippedCount++;
        continue;
      }
      if (minutesFiles.length > 1) {
        console.log(`  Multiple minutes files found in ${folderName}, using the first one...`);
      }

      // Read the transcript and minutes content
      const transcriptContent = fs.readFileSync(transcriptFiles[0], "utf8");
      let minutesContent = fs.readFileSync(minutesFiles[0], "utf8");

      // Clean up unnecessarily escaped characters in Markdown
      minutesContent = cleanMarkdownEscapes(minutesContent);

      // Check content sizes - ensure they're within reasonable limits
      const MAX_CONTENT_SIZE = options.maxContentSize || 100000;
      let userContent = `${PROMPT}\n\n${transcriptContent}`;

      // Skip entries that would need to be truncated
      if (!options.allowTruncation && userContent.length > MAX_CONTENT_SIZE) {
        console.log(
          `  SKIPPING: User content for ${folderName} is too large (${userContent.length} chars) - omitting from output`
        );
        skippedCount++;
        continue;
      } else if (options.allowTruncation && userContent.length > MAX_CONTENT_SIZE) {
        console.log(`  TRUNCATING: User content for ${folderName} (${userContent.length} chars)`);
        userContent = userContent.substring(0, MAX_CONTENT_SIZE);
      }

      // Skip if minutes content is too large
      if (!options.allowTruncation && minutesContent.length > MAX_CONTENT_SIZE) {
        console.log(
          `  SKIPPING: Minutes content for ${folderName} is too large (${minutesContent.length} chars) - omitting from output`
        );
        skippedCount++;
        continue;
      } else if (options.allowTruncation && minutesContent.length > MAX_CONTENT_SIZE) {
        console.log(
          `  TRUNCATING: Minutes content for ${folderName} (${minutesContent.length} chars)`
        );
        minutesContent = minutesContent.substring(0, MAX_CONTENT_SIZE);
      }

      // Create JSONL entry with validated content
      const entry = {
        messages: [
          {
            role: "user",
            content: userContent,
          },
          {
            role: "assistant",
            content: minutesContent,
          },
        ],
        tools: [], // Empty array, not null or undefined
      };

      // Convert to string and validate JSON before writing
      try {
        const entryString = JSON.stringify(entry);
        // Attempt to parse it back as a final validation
        JSON.parse(entryString);
        // Write to output file
        outputStream.write(entryString + "\n");
        processedCount++;
      } catch (err) {
        console.error(`  ERROR: Failed to create valid JSON for ${folderName}`);
        console.error(`  Error details: ${err instanceof Error ? err.message : String(err)}`);
        skippedCount++;
        continue; // Skip this entry
      }

      console.log(`  Processed ${folderName}`);
    }

    // Close the output stream
    outputStream.end();

    console.log(`\n====== PROCESSING SUMMARY ======`);
    console.log(`Total folders: ${transcriptFolders.length}`);
    console.log(`Successfully processed: ${processedCount}`);
    console.log(`Skipped: ${skippedCount}`);
    console.log(`Successfully created ${outputFile}`);
  } catch (error) {
    console.error(
      "Error processing transcript folders:",
      error instanceof Error ? error.message : String(error)
    );
    throw error;
  }
}

// Process options interface
interface ProcessOptions {
  allowTruncation?: boolean;
  maxContentSize?: number;
}

// Parse command line arguments
const args = process.argv.slice(2);

// Set default options
const options: ProcessOptions = {
  allowTruncation: false,
  maxContentSize: 100000,
};

// Handle different command variants
if (args[0] === "status") {
  // Run status check
  const rootDir = args[1] || ".";
  checkTranscriptStatus(rootDir)
    .then(() => console.log("\nStatus check complete!"))
    .catch((err) => {
      console.error("Status check failed:", err);
      process.exit(1);
    });
} else if (args[0] === "--help" || args[0] === "-h") {
  console.log(`
Usage: npm run training:prepare -- [options] <input-directory> <output-file>

Options:
  --truncate         Allow truncation of content instead of skipping
  --max-size <size>  Maximum content size in characters (default: 100000)
  status             Check status of transcript folders
  --help, -h         Show this help message

Examples:
  npm run training:prepare -- ./transcripts output.jsonl
  npm run training:prepare -- --truncate ./transcripts output.jsonl
  npm run training:prepare -- --max-size 150000 ./transcripts output.jsonl
  npm run training:prepare -- status ./transcripts
  `);
} else {
  // Process run with possible options
  let inputDir = ".";
  let outputFile = "output.jsonl";

  // Parse options
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--truncate") {
      options.allowTruncation = true;
      continue;
    }

    if (args[i] === "--max-size" && i + 1 < args.length) {
      options.maxContentSize = parseInt(args[i + 1], 10);
      i++; // Skip the next argument (the size value)
      continue;
    }

    // If not an option flag, treat as positional argument
    if (!args[i].startsWith("--")) {
      if (inputDir === ".") {
        inputDir = args[i];
      } else if (outputFile === "output.jsonl") {
        outputFile = args[i];
      }
    }
  }

  // Run processing
  processTranscriptFolders(inputDir, outputFile, options)
    .then(() => console.log("Processing complete!"))
    .catch((err) => {
      console.error("Processing failed:", err);
      process.exit(1);
    });
}
