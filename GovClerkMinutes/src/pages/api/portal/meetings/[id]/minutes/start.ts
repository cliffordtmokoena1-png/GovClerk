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
  findCompletedRecordingForBroadcast,
  createAudioMinutesTranscript,
  copyRecordingToUploadKey,
  triggerAudioDiarization,
} from "@/utils/minutesGeneration";
import {
  createProgressOperation,
  updateProgress,
  completeOperation,
  failOperation,
} from "@/utils/progressDb";

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
  const language: string | undefined = body.language;
  const expectedSpeakers: string[] | undefined = Array.isArray(body.expectedSpeakers)
    ? body.expectedSpeakers
    : undefined;

  if (!orgId) {
    res.status(400).json({ error: "Organization context required" });
    return;
  }

  const conn = getPortalDbConnection();
  let progressOpId: number | null = null;

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

    if (meeting.minutes_transcript_id) {
      res.status(200).json({
        transcriptId: meeting.minutes_transcript_id,
        meetingId,
        alreadyExists: true,
      });
      return;
    }

    try {
      progressOpId = await createProgressOperation(Number(meetingId), "minutes_generation");
    } catch (progressError) {
      console.error("[start-minutes] Failed to create progress operation:", progressError);
    }

    const broadcastId = await findLatestBroadcastForMeeting(conn, meetingId, orgId);

    if (!broadcastId) {
      if (progressOpId) {
        try {
          await failOperation(progressOpId, "No broadcast found for this meeting");
        } catch (progressError) {
          console.error("[start-minutes] Failed to fail progress operation:", progressError);
        }
      }
      res.status(404).json({ error: "No broadcast found for this meeting" });
      return;
    }

    const title = `${meeting.title} - Minutes`;

    // Check for completed recording - use audio diarization pipeline if available.
    // The recording may still be processing (Sophon finalizes asynchronously after
    // the broadcast ends), so retry a few times before falling back to text.
    let recording: Awaited<ReturnType<typeof findCompletedRecordingForBroadcast>> = null;
    for (let attempt = 0; attempt < 10; attempt++) {
      recording = await findCompletedRecordingForBroadcast(conn, broadcastId);
      if (recording) {
        break;
      }
      console.info(
        `[start-minutes] No completed recording yet (attempt ${attempt + 1}/10), waiting 3s...`
      );
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    if (recording) {
      const transcriptId = await createAudioMinutesTranscript(conn, userId, orgId, title, language);
      await copyRecordingToUploadKey(recording.s3Key, transcriptId);
      await linkMinutesToMeeting(conn, meetingId, orgId, transcriptId);
      try {
        await triggerAudioDiarization(transcriptId, language);
      } catch (pipelineError) {
        console.error("[start-minutes] Audio pipeline start failed:", pipelineError);
      }
      // Complete the progress op — actual generation is tracked separately
      // via SWR polling of minutes status (NOT_STARTED/IN_PROGRESS/COMPLETE)
      if (progressOpId) {
        try {
          await completeOperation(progressOpId);
        } catch (progressError) {
          console.error("[start-minutes] Failed to complete progress operation:", progressError);
        }
      }
      res.status(200).json({ transcriptId, meetingId: String(meetingId) });
      return;
    }

    const segments = await fetchBroadcastSegments(conn, broadcastId);

    if (segments.length === 0) {
      if (progressOpId) {
        try {
          await failOperation(progressOpId, "No transcript segments found for broadcast");
        } catch (progressError) {
          console.error("[start-minutes] Failed to fail progress operation:", progressError);
        }
      }
      res.status(404).json({ error: "No transcript segments found for broadcast" });
      return;
    }

    // Feature 6: Log quality metrics for the broadcast segments
    const segmentsWithSpeaker = segments.filter((s) => s.speakerLabel !== null).length;
    const segmentsWithoutSpeaker = segments.length - segmentsWithSpeaker;
    const avgTextLength =
      segments.reduce((sum, s) => sum + s.text.length, 0) / segments.length;
    const speakerLabelPct = Math.round((segmentsWithSpeaker / segments.length) * 100);
    console.info(
      `[start-minutes] Segment quality: total=${segments.length}, withSpeaker=${segmentsWithSpeaker}, withoutSpeaker=${segmentsWithoutSpeaker}, avgTextLength=${avgTextLength.toFixed(1)}, speakerLabelPct=${speakerLabelPct}%`
    );

    if (progressOpId) {
      try {
        await updateProgress(progressOpId, 25);
      } catch (progressError) {
        console.error("[start-minutes] Failed to update progress at 25%:", progressError);
      }
    }

    const transcriptText = formatSegmentsAsTranscript(segments);

    const transcriptId = await createMinutesTranscript(conn, userId, orgId, title, transcriptText, language);

    // Feature 4: Store expected speakers if provided
    if (expectedSpeakers && expectedSpeakers.length > 0) {
      try {
        await conn.execute(
          `INSERT INTO gc_meeting_expected_speakers (meeting_id, org_id, speakers, created_at, updated_at)
           VALUES (?, ?, ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE speakers = VALUES(speakers), updated_at = NOW()`,
          [meetingId, orgId, JSON.stringify(expectedSpeakers)]
        );
      } catch {
        // Table might not exist — continue gracefully
        console.warn("[start-minutes] Could not store expected speakers (table may not exist)");
      }
    }

    if (progressOpId) {
      try {
        await updateProgress(progressOpId, 50);
      } catch (progressError) {
        console.error("[start-minutes] Failed to update progress at 50%:", progressError);
      }
    }

    await uploadTranscriptToS3(transcriptId, transcriptText);

    if (progressOpId) {
      try {
        await updateProgress(progressOpId, 75);
      } catch (progressError) {
        console.error("[start-minutes] Failed to update progress at 75%:", progressError);
      }
    }

    await linkMinutesToMeeting(conn, meetingId, orgId, transcriptId);

    try {
      await transcribeSegments(transcriptId);
    } catch (pipelineError) {
      console.error("[start-minutes] Pipeline start failed:", pipelineError);
    }

    if (progressOpId) {
      try {
        await completeOperation(progressOpId);
      } catch (progressError) {
        console.error("[start-minutes] Failed to complete progress operation:", progressError);
      }
    }

    res.status(200).json({
      transcriptId,
      meetingId: String(meetingId),
    });
  } catch (error) {
    if (progressOpId) {
      try {
        await failOperation(progressOpId, String(error));
      } catch (progressError) {
        console.error("[start-minutes] Failed to fail progress operation:", progressError);
      }
    }

    console.error("[start-minutes] Error:", error);
    res.status(500).json({ error: "Failed to start minutes generation" });
  }
}

export default withErrorReporting(handler);
