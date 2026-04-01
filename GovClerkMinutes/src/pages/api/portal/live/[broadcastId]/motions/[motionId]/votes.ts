import { NextRequest } from "next/server";
import { errorResponse, jsonResponse } from "@/utils/apiHelpers";
import { getPortalDbConnection } from "@/utils/portalDb";
import { requirePortalAuth } from "@/portal-auth/requirePortalAuth";
import type { PortalSessionPayload } from "@/portal-auth/portalAuth";
import type { VoteValue, VoteTally, CastVoteRequest } from "@/types/liveSession";

export const config = {
  runtime: "edge",
};

function computeTally(votes: { vote: VoteValue }[]): VoteTally {
  const tally: VoteTally = { aye: 0, nay: 0, abstain: 0, absent: 0, total: votes.length, result: "pending" };
  for (const voteRecord of votes) {
    if (voteRecord.vote === "aye") tally.aye++;
    else if (voteRecord.vote === "nay") tally.nay++;
    else if (voteRecord.vote === "abstain") tally.abstain++;
    else if (voteRecord.vote === "absent") tally.absent++;
  }
  if (tally.aye > tally.nay) tally.result = "passed";
  else if (tally.nay > tally.aye) tally.result = "failed";
  else if (tally.aye === tally.nay && tally.aye > 0) tally.result = "tied";
  return tally;
}

async function handler(req: NextRequest, session: PortalSessionPayload): Promise<Response> {
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  const liveIndex = pathParts.indexOf("live");
  const broadcastId = Number(pathParts[liveIndex + 1]);
  const motionId = Number(pathParts[liveIndex + 3]);

  if (!broadcastId || isNaN(broadcastId) || !motionId || isNaN(motionId)) {
    return errorResponse("Invalid broadcast ID or motion ID", 400);
  }

  const { orgId } = session;
  const conn = getPortalDbConnection();

  // Verify motion exists
  const motionResult = await conn.execute(
    "SELECT * FROM gc_portal_motions WHERE id = ? AND broadcast_id = ? AND org_id = ?",
    [motionId, broadcastId, orgId]
  );
  if (motionResult.rows.length === 0) {
    return errorResponse("Motion not found", 404);
  }

  if (req.method === "GET") {
    const votesResult = await conn.execute(
      "SELECT * FROM gc_portal_votes WHERE motion_id = ? AND org_id = ? ORDER BY voted_at",
      [motionId, orgId]
    );
    const votes = votesResult.rows.map((row: any) => ({
      id: Number(row.id),
      orgId: row.org_id,
      motionId: Number(row.motion_id),
      broadcastId: Number(row.broadcast_id),
      memberName: row.member_name,
      memberId: row.member_id ?? null,
      vote: row.vote as VoteValue,
      votedAt: row.voted_at,
    }));
    const tally = computeTally(votes);
    return jsonResponse({ votes, tally });
  }

  if (req.method === "POST") {
    const body = (await req.json()) as CastVoteRequest;
    const { memberName, vote } = body;

    if (!memberName || !vote) {
      return errorResponse("memberName and vote are required", 400);
    }

    const validVotes: VoteValue[] = ["aye", "nay", "abstain", "absent"];
    if (!validVotes.includes(vote)) {
      return errorResponse("Invalid vote value. Must be aye, nay, abstain, or absent", 400);
    }

    // Upsert the vote
    await conn.execute(
      `INSERT INTO gc_portal_votes (org_id, motion_id, broadcast_id, member_name, vote)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE vote = VALUES(vote), voted_at = CURRENT_TIMESTAMP`,
      [orgId, motionId, broadcastId, memberName, vote]
    );

    // Recompute tally and update motion
    const allVotesResult = await conn.execute(
      "SELECT vote FROM gc_portal_votes WHERE motion_id = ? AND org_id = ?",
      [motionId, orgId]
    );
    const allVotes = allVotesResult.rows.map((row: any) => ({ vote: row.vote as VoteValue }));
    const tally = computeTally(allVotes);

    const summaryParts = [
      `${tally.aye} Aye`,
      `${tally.nay} Nay`,
      tally.abstain > 0 ? `${tally.abstain} Abstain` : null,
      tally.absent > 0 ? `${tally.absent} Absent` : null,
    ].filter(Boolean);
    const resultLabel = tally.result === "passed" ? "PASSED" : tally.result === "failed" ? "FAILED" : tally.result === "tied" ? "TIED" : "PENDING";
    const voteResultSummary = `${summaryParts.join(", ")} — ${resultLabel}`;

    const newStatus = tally.result === "passed" ? "passed" : tally.result === "failed" ? "failed" : undefined;
    if (newStatus) {
      await conn.execute(
        "UPDATE gc_portal_motions SET vote_result_summary = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND org_id = ?",
        [voteResultSummary, newStatus, motionId, orgId]
      );
    } else {
      await conn.execute(
        "UPDATE gc_portal_motions SET vote_result_summary = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND org_id = ?",
        [voteResultSummary, motionId, orgId]
      );
    }

    return jsonResponse({ tally, voteResultSummary });
  }

  return errorResponse("Method not allowed", 405);
}

export default requirePortalAuth(handler);
