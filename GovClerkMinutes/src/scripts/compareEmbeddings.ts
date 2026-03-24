import { Connection, connect } from "@planetscale/database";
import * as dotenv from "dotenv";

dotenv.config();

const [, , id1, id2] = process.argv;

if (!id1 || !id2) {
  console.error("Usage: npm run compare-embeddings -- <speakerId1> <speakerId2>");
  process.exit(1);
}

const conn = connect({
  host: process.env.PLANETSCALE_DB_HOST!,
  username: process.env.PLANETSCALE_DB_USERNAME!,
  password: process.env.PLANETSCALE_DB_PASSWORD!,
});

type Speaker = {
  id: number;
  name: string;
  fast_mode: number;
  embedding?: number[];
};

async function fetchSpeakerData(conn: Connection, speakerId: number): Promise<Speaker> {
  const result = await conn.execute<Speaker>(
    "SELECT id, name, fast_mode, embedding FROM speakers WHERE id = ?",
    [speakerId]
  );

  if (result.rows.length === 0) {
    throw new Error(`Speaker with id ${speakerId} not found`);
  }
  return result.rows[0];
}

function cosineSimilarity(a: number[] | undefined, b: number[] | undefined): number {
  if (!a || !b || a.length !== b.length) {
    return -99;
  }
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

(async () => {
  try {
    const speakerId1 = parseInt(id1);
    const speakerId2 = parseInt(id2);

    if (isNaN(speakerId1) || isNaN(speakerId2)) {
      throw new Error("Invalid speaker IDs provided");
    }

    const [data1, data2] = await Promise.all([
      fetchSpeakerData(conn, speakerId1),
      fetchSpeakerData(conn, speakerId2),
    ]);

    const similarity = cosineSimilarity(data1.embedding, data2.embedding);

    if (similarity === -99) {
      throw new Error("Unable to compare. Embeddings not found or have different lengths");
    }

    console.log(
      `Cosine similarity between speaker ${speakerId1} and speaker ${speakerId2}: ${(similarity * 100).toFixed(4)}%`
    );

    // hide embedding data
    delete data1.embedding;
    delete data2.embedding;

    console.log("Speaker 1:", data1);
    console.log("Speaker 2:", data2);
  } catch (error: any) {
    console.error("Error:", error.message);
  }
})();
