/**
 * Shared portal database utilities.
 * Centralizes database connection and row mappers for portal API endpoints.
 */

import { connect } from "@planetscale/database";
import type { PortalMeeting, PortalArtifact, PortalArtifactType } from "@/types/portal";

/**
 * Creates a PlanetScale database connection for portal operations.
 */
export function getPortalDbConnection() {
  return connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });
}

/**
 * Maps a database row to a PortalMeeting object.
 * Handles JSON parsing for tags field.
 */
export function rowToPortalMeeting(row: any): PortalMeeting {
  let tags = row.tags;
  if (typeof tags === "string") {
    try {
      tags = JSON.parse(tags);
    } catch {
      tags = undefined;
    }
  }

  return {
    id: row.id,
    orgId: row.org_id,
    portalSettingsId: row.portal_settings_id,
    mgBoardId: row.board_id || undefined,
    title: row.title,
    description: row.description,
    meetingDate: row.meeting_date,
    location: row.location,
    isPublic: Boolean(row.is_public),
    tags: tags || undefined,
    isCancelled: Boolean(row.is_cancelled),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    minutesTranscriptId: row.minutes_transcript_id ? Number(row.minutes_transcript_id) : undefined,
    minutesVersion: row.minutes_version || undefined,
  };
}

interface LinkedAgendaItem {
  id: number;
  title: string;
}

/**
 * Maps a database row to a PortalArtifact object.
 * Optionally includes linked agenda item information.
 */
export function rowToPortalArtifact(row: any, linkedAgendaItem?: LinkedAgendaItem): PortalArtifact {
  const linked =
    linkedAgendaItem ||
    (row.linked_agenda_item_id
      ? { id: row.linked_agenda_item_id, title: row.linked_agenda_item_title }
      : undefined);

  return {
    id: row.id,
    orgId: row.org_id,
    portalSettingsId: row.portal_settings_id || undefined,
    portalMeetingId: row.meeting_id || undefined,
    artifactType: row.artifact_type as PortalArtifactType,
    fileName: row.file_name,
    fileSize: row.file_size,
    contentType: row.content_type || undefined,
    s3Key: row.s3_key,
    s3Url: row.s3_url,
    isPublic: Boolean(row.is_public),
    sourceTranscriptId: row.source_transcript_id || undefined,
    sourceAgendaId: row.source_agenda_id || undefined,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    linkedAgendaItem: linked,
  };
}
