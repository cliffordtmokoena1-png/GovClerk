import withErrorReporting from "@/error/withErrorReporting";
import { getAuth } from "@clerk/nextjs/server";
import type { NextApiRequest, NextApiResponse } from "next";
import { resolveRequestContext } from "@/utils/resolveRequestContext";
import { getPortalDbConnection } from "@/utils/portalDb";
import { transcribeSegments } from "@/pages/api/resume-transcribe";
import {
  uploadTranscriptToS3,
  fetchBroadcastSegments,
  formatSegmentsAsTranscript,
  findLatestBroadcastForMeeting,
  createMinutesTranscript,
  linkMinutesToMeeting,
  clearMinutesFromMeeting,
  findCompletedRecordingForBroadcast,
  createAudioMinutesTranscript,
  copyRecordingToUploadKey,
  triggerAudioDiarization,
} from "@/utils/minutesGeneration";

export const config = {
  runtime: "nodejs",
};

async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const meetingId = req.query.id as string;

  if (!meetingId) {
    res.status(400).json({ error: "Meeting ID is required" });
    return;
  }

  const body = req.body || {};
  const { orgId, userId } = await resolveRequestContext(auth.userId, body.orgId, req.headers);

  if (!orgId) {
    res.status(400).json({ error: "Organization context required" });
    return;
  }

  const conn = getPortalDbConnection();

  try {
    const meetingCheck = await conn.execute(
      "SELECT id, title, minutes_transcript_id FROM gc_meetings WHERE id = ? AND org_id = ?",
      [meetingId, orgId]
    );

    if (meetingCheck.rows.length === 0) {
      res.status(404).json({ error: "Meeting not found" });
      return;
    }

    const meeting = meetingCheck.rows[0] as {
      id: number;
      title: string;
      minutes_transcript_id: number | null;
    };

    await clearMinutesFromMeeting(conn, meetingId, orgId);

    const broadcastId = await findLatestBroadcastForMeeting(conn, meetingId, orgId);

    if (!broadcastId) {
      res.status(404).json({ error: "No broadcast found for this meeting" });
      return;
    }

    // Check for completed recording - use audio diarization pipeline if available
    const recording = await findCompletedRecordingForBroadcast(conn, broadcastId);
    if (recording) {
      const title = `${meeting.title} - Minutes`;
      const transcriptId = await createAudioMinutesTranscript(conn, userId, orgId, title);
      await copyRecordingToUploadKey(recording.s3Key, transcriptId);
      await linkMinutesToMeeting(conn, meetingId, orgId, transcriptId);
      try {
        await triggerAudioDiarization(transcriptId);
      } catch (pipelineError) {
        console.error("[retry-minutes] Audio pipeline start failed:", pipelineError);
      }
      res.status(200).json({ transcriptId, meetingId: String(meetingId) });
      return;
    }

    const segments = await fetchBroadcastSegments(conn, broadcastId);

    if (segments.length === 0) {
      res.status(404).json({ error: "No transcript segments found for broadcast" });
      return;
    }

    const transcriptText = formatSegmentsAsTranscript(segments);
    const title = `${meeting.title} - Minutes`;

    const transcriptId = await createMinutesTranscript(conn, userId, orgId, title, transcriptText);

    await uploadTranscriptToS3(transcriptId, transcriptText);
    await linkMinutesToMeeting(conn, meetingId, orgId, transcriptId);

    try {
      await transcribeSegments(transcriptId);
    } catch (pipelineError) {
      console.error("[retry-minutes] Pipeline start failed:", pipelineError);
    }

    res.status(200).json({
      transcriptId,
      meetingId: String(meetingId),
    });
  } catch (error) {
    console.error("[retry-minutes] Error:", error);
    res.status(500).json({ error: "Failed to retry minutes generation" });
  }
}

export default withErrorReporting(handler);
