import fs from "fs/promises";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import chalk from "chalk";

interface Segment {
  speaker: string;
  start: string;
  stop: string;
}

interface ParsedSegment {
  speaker: string;
  start: number;
  stop: number;
}

// Matrix where matrix[a][b] = overlapped seconds between speaker a (json1) and speaker b (json2)
type OverlapMatrix = Record<string, Record<string, number>>;

interface MappingResult {
  mappedTo: string;
  overlapSeconds: number;
  share: number;
}

type SpeakerMapping = Record<string, MappingResult>;

interface ComparisonMetrics {
  totalSegments1: number;
  totalSegments2: number;
  unassignedSegments1: number;
  json2SegmentsOverlappingUnassigned: number;
  unassignedSegmentsCovered: number;
  json1SegmentsSplitAcrossJson2: number;
  sameSpeakerCount: number;
  sameSpeakerCountReverse: number;
}

function timestampToSeconds(timestamp: string): number {
  if (timestamp.includes(":")) {
    const parts = timestamp.split(":").map(parseFloat);
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }
  }
  return parseFloat(timestamp);
}

function computeOverlap(a: ParsedSegment, b: ParsedSegment): number {
  const start = Math.max(a.start, b.start);
  const stop = Math.min(a.stop, b.stop);
  return Math.max(0, stop - start);
}

function addToMatrix(matrix: OverlapMatrix, spk1: string, spk2: string, sec: number) {
  if (!matrix[spk1]) matrix[spk1] = {};
  matrix[spk1][spk2] = (matrix[spk1][spk2] || 0) + sec;
}

async function readAndParseSegments(filePath: string): Promise<ParsedSegment[]> {
  const rawContent = await fs.readFile(filePath, "utf8");
  const json = JSON.parse(rawContent);

  if (!json.segments || !Array.isArray(json.segments)) {
    throw new Error(`Invalid JSON format in ${filePath} – expected 'segments' array.`);
  }

  return json.segments.map((s: Segment) => ({
    speaker: s.speaker,
    start: timestampToSeconds(s.start),
    stop: timestampToSeconds(s.stop),
  }));
}

function buildOverlapMatrices(
  segs1: ParsedSegment[],
  segs2: ParsedSegment[]
): { matrix: OverlapMatrix; matrixRev: OverlapMatrix } {
  const matrix: OverlapMatrix = {};
  const matrixRev: OverlapMatrix = {}; // json2 -> json1

  segs1.forEach((s1) => {
    segs2.forEach((s2) => {
      const ov = computeOverlap(s1, s2);
      if (ov > 0) {
        addToMatrix(matrix, s1.speaker, s2.speaker, ov);
        addToMatrix(matrixRev, s2.speaker, s1.speaker, ov);
      }
    });
  });

  return { matrix, matrixRev };
}

function generateSpeakerMapping(matrix: OverlapMatrix): SpeakerMapping {
  const mapping: SpeakerMapping = {};
  Object.entries(matrix).forEach(([spk, targets]) => {
    let bestMatch: { target: string; sec: number } | null = null;
    const totalOverlap = Object.values(targets).reduce((a, b) => a + b, 0);

    for (const [target, sec] of Object.entries(targets)) {
      if (!bestMatch || sec > bestMatch.sec) {
        bestMatch = { target, sec };
      }
    }

    if (bestMatch) {
      mapping[spk] = {
        mappedTo: bestMatch.target,
        overlapSeconds: bestMatch.sec,
        share: totalOverlap > 0 ? bestMatch.sec / totalOverlap : 0,
      };
    }
  });
  return mapping;
}

function calculateMetrics(
  segs1: ParsedSegment[],
  segs2: ParsedSegment[],
  mapping: SpeakerMapping,
  mappingRev: SpeakerMapping
): ComparisonMetrics {
  const unassigned1 = segs1.filter((s) => s.speaker.startsWith("UNASSIGNED"));

  const json2SegmentsOverlappingUnassigned = segs2.filter((s2) =>
    unassigned1.some((u1) => computeOverlap(u1, s2) > 0)
  ).length;

  const unassignedSegmentsCovered = unassigned1.filter((u1) =>
    segs2.some((s2) => computeOverlap(u1, s2) > 0)
  ).length;

  const json1SegmentsSplitAcrossJson2 = segs1.filter((s1) => {
    const overlappingSpeakers = new Set(
      segs2.filter((s2) => computeOverlap(s1, s2) > 0).map((s2) => s2.speaker)
    );
    return overlappingSpeakers.size > 1;
  }).length;

  const sameSpeakerCount = Object.values(mapping).filter((m) => m.share >= 0.5).length;
  const sameSpeakerCountReverse = Object.values(mappingRev).filter((m) => m.share >= 0.5).length;

  return {
    totalSegments1: segs1.length,
    totalSegments2: segs2.length,
    unassignedSegments1: unassigned1.length,
    json2SegmentsOverlappingUnassigned,
    unassignedSegmentsCovered,
    json1SegmentsSplitAcrossJson2,
    sameSpeakerCount,
    sameSpeakerCountReverse,
  };
}

function printResults({
  metrics,
  mapping,
  mappingRev,
  matrix,
}: {
  metrics: ComparisonMetrics;
  mapping: SpeakerMapping;
  mappingRev: SpeakerMapping;
  matrix: OverlapMatrix;
}) {
  console.log(chalk.bold("\n★★ SUMMARY ★★"));

  const pct = (val: number, total: number) =>
    total > 0 ? ((val / total) * 100).toFixed(1) : "0.0";

  console.log(
    `${chalk.cyan("• Json1 segments")}: ${metrics.totalSegments1}\n` +
      `${chalk.cyan("• Json2 segments")}: ${metrics.totalSegments2}`
  );

  const pctUnassigned = pct(metrics.json2SegmentsOverlappingUnassigned, metrics.totalSegments2);
  console.log(
    `${chalk.cyan("• % of Json2 that overlaps UNASSIGNED in Json1")}: ${pctUnassigned}% ` +
      `(${metrics.json2SegmentsOverlappingUnassigned}/${metrics.totalSegments2})`
  );

  const pctUnassignedCovered = pct(metrics.unassignedSegmentsCovered, metrics.unassignedSegments1);
  console.log(
    `${chalk.cyan("• UNASSIGNED segments covered by Json2")}: ${metrics.unassignedSegmentsCovered}/${metrics.unassignedSegments1} ` +
      `(${pctUnassignedCovered}%)`
  );

  console.log(
    `${chalk.cyan("• Json1 segments that get split across multiple Json2 speakers")}: ${metrics.json1SegmentsSplitAcrossJson2}/${metrics.totalSegments1}`
  );

  const pctSame = pct(metrics.sameSpeakerCount, Object.keys(mapping).length);
  console.log(
    `${chalk.cyan("• Json1 speakers with clear match in Json2")}: ${metrics.sameSpeakerCount} ` +
      `(${pctSame}% of Json1 speakers)`
  );

  const pctSameRev = pct(metrics.sameSpeakerCountReverse, Object.keys(mappingRev).length);
  console.log(
    `${chalk.cyan("• Json2 speakers with clear match back in Json1")}: ${metrics.sameSpeakerCountReverse} ` +
      `(${pctSameRev}% of Json2 speakers)`
  );

  const formatMappingTable = (m: SpeakerMapping, key1: string, key2: string) =>
    Object.entries(m)
      .sort()
      .map(([spk, data]) => ({
        [key1]: spk,
        [key2]: data.mappedTo,
        overlapSec: data.overlapSeconds.toFixed(2),
        share: (data.share * 100).toFixed(1) + "%",
      }));

  console.log(chalk.bold("\n=== SPEAKER MAPPING (json1 ➜ json2) ==="));
  console.table(formatMappingTable(mapping, "json1", "json2"));

  console.log(chalk.bold("\n=== SPEAKER MAPPING (json2 ➜ json1) ==="));
  console.table(formatMappingTable(mappingRev, "json2", "json1"));

  if (process.env.VERBOSE === "true") {
    console.log(chalk.bold("\n=== FULL OVERLAP MATRIX (seconds) ==="));
    console.dir(matrix, { depth: null });
  }
}

async function main({ file1, file2 }: { file1: string; file2: string }) {
  const [segs1, segs2] = await Promise.all([
    readAndParseSegments(file1),
    readAndParseSegments(file2),
  ]);

  const { matrix, matrixRev } = buildOverlapMatrices(segs1, segs2);

  const mapping = generateSpeakerMapping(matrix);
  const mappingRev = generateSpeakerMapping(matrixRev);

  const metrics = calculateMetrics(segs1, segs2, mapping, mappingRev);

  printResults({ metrics, mapping, mappingRev, matrix });
}

yargs(hideBin(process.argv))
  .command(
    "$0 <originalJSON> <pyannoteJSON>",
    "Compare two diarization JSON files and output metrics.",
    (y) =>
      y
        .positional("originalJSON", {
          describe: "Path to first JSON (original diarization)",
          type: "string",
          demandOption: true,
        })
        .positional("pyannoteJSON", {
          describe: "Path to second JSON (pyannote diarization)",
          type: "string",
          demandOption: true,
        }),
    async (argv) => {
      try {
        await main({ file1: argv.originalJSON as string, file2: argv.pyannoteJSON as string });
      } catch (err) {
        console.error(chalk.red("Error:"), err instanceof Error ? err.message : err);
        process.exit(1);
      }
    }
  )
  .help()
  .strict().argv;
