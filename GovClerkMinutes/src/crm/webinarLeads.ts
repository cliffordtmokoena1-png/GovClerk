import { asUtcDate, convertDateForMysql } from "@/utils/date";
import { connect } from "@planetscale/database";

export type WebinarLead = {
  email: string;
  userId?: string;
  firstName: string;
  eventUrl: string;
  eventTime: Date;
  isRegistered: boolean;
  isReminded: boolean;
};

export type WebinarLeadRow = {
  email: string;
  user_id: string | null;
  first_name: string;
  event_url: string;
  event_time: string;
  is_registered: boolean;
  is_reminded: boolean;
};

export async function getWebinarLeadFromDb(email: string): Promise<WebinarLead | null> {
  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  const rows: WebinarLead[] = await conn
    .execute<WebinarLeadRow>(
      `
      SELECT 
        email,
        user_id,
        first_name,
        event_url,
        event_time,
        is_registered,
        is_reminded
      FROM gc_webinar_leads
      WHERE email = ?;
      `,
      [email]
    )
    .then((r) =>
      r.rows.map((row) => ({
        email: row.email,
        userId: row.user_id ?? undefined,
        firstName: row.first_name,
        eventUrl: row.event_url,
        eventTime: asUtcDate(row.event_time),
        isRegistered: row.is_registered,
        isReminded: row.is_reminded,
      }))
    );

  if (rows.length !== 1) {
    return null;
  }

  return rows[0];
}

export async function updateWebinarLeadInDb({
  email,
  userId,
  firstName,
  eventUrl,
  eventTime,
  isRegistered,
  isReminded,
}: Partial<WebinarLead> & { email: string }): Promise<void> {
  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  const setList = [];
  const values = [];

  if (userId != null) {
    setList.push("user_id = ?");
    values.push(userId);
  }
  if (firstName != null) {
    setList.push("first_name = ?");
    values.push(firstName);
  }
  if (eventUrl != null) {
    setList.push("event_url = ?");
    values.push(eventUrl);
  }
  if (eventTime != null) {
    setList.push("event_time = ?");
    values.push(convertDateForMysql(eventTime));
  }
  if (isRegistered != null) {
    setList.push("is_registered = ?");
    values.push(isRegistered ? 1 : 0);
  }
  if (isReminded != null) {
    setList.push("is_reminded = ?");
    values.push(isReminded ? 1 : 0);
  }

  if (setList.length === 0) {
    return;
  }

  const setListStr = setList.join(", ");

  await conn.execute(`UPDATE gc_webinar_leads SET ${setListStr} WHERE email = ?;`, [
    ...values,
    email,
  ]);
}

export async function addWebinarLeadToDb({
  email,
  userId,
  firstName,
  eventUrl,
  eventTime,
}: WebinarLead): Promise<void> {
  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  await conn.execute(
    `
    INSERT INTO gc_webinar_leads (email, user_id, first_name, event_url, event_time, is_registered, is_reminded)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      user_id = VALUES(user_id),
      first_name = VALUES(first_name),
      event_url = VALUES(event_url),
      event_time = VALUES(event_time),
      is_registered = VALUES(is_registered),
      is_reminded = VALUES(is_reminded);
    `,
    [
      email,
      userId ?? null,
      firstName ?? null,
      eventUrl ?? null,
      convertDateForMysql(eventTime),
      1, // is_registered
      0, // is_reminded
    ]
  );
}
