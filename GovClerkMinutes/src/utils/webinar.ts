import { connect } from "@planetscale/database";

export type WebinarDetail = {
  url: string;
  eventTime: string; // Ex. "2025-04-03T16:00:00.000Z"
};

export async function getNextWebinarDetails(): Promise<WebinarDetail | undefined> {
  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  const rows = await conn
    .execute(
      `
      SELECT url, event_time
      FROM gc_events
      WHERE event_time > NOW()
      ORDER BY event_time ASC
      LIMIT 1;
      `
    )
    .then((result) => result.rows);

  if (rows.length === 0) {
    return undefined;
  }

  const { url, event_time: eventTime } = rows[0] as {
    url: string;
    event_time: string; // Ex. "2025-04-03 16:00:00"
  };

  return {
    url,
    eventTime: new Date(eventTime + "Z").toISOString(), // Ex. "2025-04-03T16:00:00.000Z"
  };
}

export async function getWebinarDetails(limit: number): Promise<WebinarDetail[] | undefined> {
  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  const rows = await conn
    .execute(
      `
      SELECT url, event_time
      FROM gc_events
      ORDER BY event_time DESC
      LIMIT ?;
      `,
      [limit]
    )
    .then((result) => result.rows);

  if (rows.length === 0) {
    return undefined;
  }

  const details: Array<WebinarDetail> = (
    rows as Array<{
      url: string;
      event_time: string; // Ex. "2025-04-03 16:00:00"
    }>
  ).map((r) => {
    return {
      url: r.url,
      eventTime: new Date(r.event_time + "Z").toISOString(), // Ex. "2025-04-03T16:00:00.000Z"
    };
  });

  return details;
}
