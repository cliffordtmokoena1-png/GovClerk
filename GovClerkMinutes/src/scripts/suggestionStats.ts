import dotenv from "dotenv";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { dbQuery } from "../backend/db";
import { SIMILARITY_THRESHOLD } from "@/common/constants";

dotenv.config({ path: ".env" });

type TimePeriod = "24h" | "3d" | "7d" | "14d" | "all";

interface SuggestedIdentity {
  id: number;
  name: string;
  similarity_score: number;
}

interface SuggestedSpeakers {
  suggested_identities: SuggestedIdentity[];
}

interface Stats {
  autofilledCount: number;
  highConfidenceNotAutofilledCount: number;
  lowConfidenceCount: number;
  totalSuggestions: number;
  correctTop1Count: number;
  totalTop1Count: number;
  correctTop23Count: number;
  totalTop23Count: number;
  assignedFromSuggestionsCount: number;
  totalAssignedCount: number;
}

interface TranscriptStats extends Stats {
  transcriptId: number;
}

async function fetchStats(period: TimePeriod): Promise<{
  overall: Stats;
  transcriptAverages: Stats;
  activeTranscriptCount: number;
}> {
  const now = new Date();
  let fromDate: Date;

  switch (period) {
    case "24h":
      fromDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case "3d":
      fromDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      break;
    case "7d":
      fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "14d":
      fromDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      break;
    case "all":
      fromDate = new Date(0); // Beginning of time
      break;
    default:
      throw new Error(`Invalid time period: ${period}`);
  }

  console.log(`Fetching statistics from ${fromDate.toISOString()} to ${now.toISOString()}`);

  const query = `
    SELECT 
      s.name,
      s.suggested_speakers,
      s.transcriptId
    FROM speakers s
    JOIN transcripts t ON s.transcriptId = t.id
    WHERE t.dateCreated >= ? 
    AND t.dateCreated <= ?
    AND s.suggested_speakers IS NOT NULL
    AND s.fast_mode = 0
  `;

  const rows = await dbQuery(query, [fromDate, now]);

  const overall: Stats = {
    autofilledCount: 0,
    highConfidenceNotAutofilledCount: 0,
    lowConfidenceCount: 0,
    totalSuggestions: 0,
    correctTop1Count: 0,
    totalTop1Count: 0,
    correctTop23Count: 0,
    totalTop23Count: 0,
    assignedFromSuggestionsCount: 0,
    totalAssignedCount: 0,
  };

  const transcriptStatsMap = new Map<number, TranscriptStats>();

  for (const row of rows as any[]) {
    try {
      const suggestedSpeakers = row.suggested_speakers as SuggestedSpeakers;
      const assignedName = row.name;
      const transcriptId = row.transcriptId;
      const suggestions = suggestedSpeakers.suggested_identities;

      if (!transcriptStatsMap.has(transcriptId)) {
        transcriptStatsMap.set(transcriptId, {
          transcriptId,
          autofilledCount: 0,
          highConfidenceNotAutofilledCount: 0,
          lowConfidenceCount: 0,
          totalSuggestions: 0,
          correctTop1Count: 0,
          totalTop1Count: 0,
          correctTop23Count: 0,
          totalTop23Count: 0,
          assignedFromSuggestionsCount: 0,
          totalAssignedCount: 0,
        });
      }

      const transcriptStats = transcriptStatsMap.get(transcriptId)!;

      // Skip default "Speaker N" names when counting assignments because its default
      if (!assignedName.match(/^Speaker \d+$/)) {
        overall.totalAssignedCount++;
        transcriptStats.totalAssignedCount++;

        if (suggestions.some((s) => s.name === assignedName)) {
          overall.assignedFromSuggestionsCount++;
          transcriptStats.assignedFromSuggestionsCount++;
        }
      }

      if (suggestions.length > 0) {
        overall.totalSuggestions++;
        transcriptStats.totalSuggestions++;

        const sortedSuggestions = [...suggestions].sort(
          (a, b) => b.similarity_score - a.similarity_score
        );

        if (sortedSuggestions[0].similarity_score >= SIMILARITY_THRESHOLD) {
          overall.totalTop1Count++;
          transcriptStats.totalTop1Count++;

          if (sortedSuggestions[0].name === assignedName) {
            overall.correctTop1Count++;
            transcriptStats.correctTop1Count++;
          }

          overall.autofilledCount++;
          transcriptStats.autofilledCount++;
        }

        const top23 = sortedSuggestions.slice(1, 3);
        const highConfTop23 = top23.filter((s) => s.similarity_score >= SIMILARITY_THRESHOLD);

        if (highConfTop23.length > 0) {
          overall.totalTop23Count++;
          transcriptStats.totalTop23Count++;

          if (highConfTop23.some((s) => s.name === assignedName)) {
            overall.correctTop23Count++;
            transcriptStats.correctTop23Count++;
          }

          overall.highConfidenceNotAutofilledCount++;
          transcriptStats.highConfidenceNotAutofilledCount++;
        } else if (sortedSuggestions[0].similarity_score < SIMILARITY_THRESHOLD) {
          // Only count as low confidence if top 1 was also low confidence
          overall.lowConfidenceCount++;
          transcriptStats.lowConfidenceCount++;
        }
      }
    } catch (error) {
      console.error("Error processing row:", error);
      console.error("Row data:", {
        name: row.name,
        transcriptId: row.transcriptId,
        suggestedSpeakers: row.suggested_speakers,
      });
    }
  }

  const activeTranscripts = Array.from(transcriptStatsMap.values()).filter(
    (t) => t.totalSuggestions > 0
  );
  const activeTranscriptCount = activeTranscripts.length;

  const transcriptAverages: Stats = {
    autofilledCount:
      activeTranscripts.reduce((sum, t) => sum + t.autofilledCount, 0) / activeTranscriptCount,
    highConfidenceNotAutofilledCount:
      activeTranscripts.reduce((sum, t) => sum + t.highConfidenceNotAutofilledCount, 0) /
      activeTranscriptCount,
    lowConfidenceCount:
      activeTranscripts.reduce((sum, t) => sum + t.lowConfidenceCount, 0) / activeTranscriptCount,
    totalSuggestions:
      activeTranscripts.reduce((sum, t) => sum + t.totalSuggestions, 0) / activeTranscriptCount,
    correctTop1Count:
      activeTranscripts.reduce((sum, t) => sum + t.correctTop1Count, 0) / activeTranscriptCount,
    totalTop1Count:
      activeTranscripts.reduce((sum, t) => sum + t.totalTop1Count, 0) / activeTranscriptCount,
    correctTop23Count:
      activeTranscripts.reduce((sum, t) => sum + t.correctTop23Count, 0) / activeTranscriptCount,
    totalTop23Count:
      activeTranscripts.reduce((sum, t) => sum + t.totalTop23Count, 0) / activeTranscriptCount,
    assignedFromSuggestionsCount:
      activeTranscripts.reduce((sum, t) => sum + t.assignedFromSuggestionsCount, 0) /
      activeTranscriptCount,
    totalAssignedCount:
      activeTranscripts.reduce((sum, t) => sum + t.totalAssignedCount, 0) / activeTranscriptCount,
  };

  return {
    overall,
    transcriptAverages,
    activeTranscriptCount,
  };
}

function printStats(title: string, stats: Stats) {
  console.log(`\n${title}:`);
  console.log("----------------------------------------");
  console.log(`Total Suggestions: ${stats.totalSuggestions.toFixed(1)}`);
  if (stats.totalSuggestions > 0) {
    console.log(
      `Autofilled (Top 1, ≥0.92): ${stats.autofilledCount.toFixed(1)} (${((stats.autofilledCount / stats.totalSuggestions) * 100).toFixed(2)}%)`
    );
    if (stats.totalTop1Count > 0) {
      console.log(
        `Top 1 Accuracy: ${stats.correctTop1Count.toFixed(1)}/${stats.totalTop1Count.toFixed(1)} (${((stats.correctTop1Count / stats.totalTop1Count) * 100).toFixed(2)}%)`
      );
    }

    console.log(
      `High Confidence Not Autofilled (Top 2-3, ≥0.92): ${stats.highConfidenceNotAutofilledCount.toFixed(1)} (${((stats.highConfidenceNotAutofilledCount / stats.totalSuggestions) * 100).toFixed(2)}%)`
    );
    if (stats.totalTop23Count > 0) {
      console.log(
        `Top 2-3 Accuracy: ${stats.correctTop23Count.toFixed(1)}/${stats.totalTop23Count.toFixed(1)} (${((stats.correctTop23Count / stats.totalTop23Count) * 100).toFixed(2)}%)`
      );
    }

    console.log(
      `Low Confidence (<0.92): ${stats.lowConfidenceCount.toFixed(1)} (${((stats.lowConfidenceCount / stats.totalSuggestions) * 100).toFixed(2)}%)`
    );
  }

  if (stats.totalAssignedCount > 0) {
    console.log(`\nAssigned Names: ${stats.totalAssignedCount.toFixed(1)}`);
    console.log(
      `Names from Suggestions: ${stats.assignedFromSuggestionsCount.toFixed(1)} (${((stats.assignedFromSuggestionsCount / stats.totalAssignedCount) * 100).toFixed(2)}%)`
    );
    console.log(
      `Custom Names: ${(stats.totalAssignedCount - stats.assignedFromSuggestionsCount).toFixed(1)} (${(((stats.totalAssignedCount - stats.assignedFromSuggestionsCount) / stats.totalAssignedCount) * 100).toFixed(2)}%)`
    );
  }
}

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .command("$0 [period]", "Show speaker suggestion statistics", (yargs) => {
      return yargs.positional("period", {
        describe: "Time period to analyze",
        type: "string",
        choices: ["24h", "3d", "7d", "14d", "all"],
        default: "24h",
      });
    })
    .help()
    .alias("help", "h")
    .strict()
    .parse();

  const period = argv.period as TimePeriod;
  console.log(`\nFetching speaker suggestion statistics for the last ${period}...`);

  const { overall, transcriptAverages, activeTranscriptCount } = await fetchStats(period);

  printStats("Overall Statistics", overall);
  console.log(`\nPer-Transcript Averages (${activeTranscriptCount} transcripts)`);
  printStats("Average per Transcript", transcriptAverages);

  process.exit(0);
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
