/**
 * Utilities for extracting structured intake data from AI agent replies.
 *
 * Samantha embeds [INTAKE:field=value] tags in her replies when she captures
 * a piece of intake information. These are stripped before sending to the user.
 */

export interface ExtractedIntakeFields {
  email?: string;
  firstName?: string;
  lastName?: string;
  occupation?: string;
  minutesFreq?: string;
  minutesDue?: string;
}

/**
 * Parse [INTAKE:field=value] tags from an AI reply.
 * Returns the extracted fields and the reply with tags stripped.
 */
export function extractIntakeFields(reply: string): {
  fields: ExtractedIntakeFields;
  cleanReply: string;
} {
  const fields: ExtractedIntakeFields = {};
  const tagRegex = /\[INTAKE:(\w+)=([^\]]+)\]/g;

  let match: RegExpExecArray | null;
  while ((match = tagRegex.exec(reply)) !== null) {
    const key = match[1] as keyof ExtractedIntakeFields;
    const value = match[2].trim();
    if (key && value) {
      fields[key] = value;
    }
  }

  // Strip all intake tags from the reply before sending to user
  const cleanReply = reply.replace(/\[INTAKE:[^\]]+\]/g, "").trim();

  return { fields, cleanReply };
}

/**
 * Check whether all required intake fields have been collected for a user.
 */
export function isIntakeComplete(fields: ExtractedIntakeFields): boolean {
  return Boolean(
    fields.email &&
    fields.firstName &&
    fields.occupation &&
    fields.minutesFreq &&
    fields.minutesDue
  );
}
