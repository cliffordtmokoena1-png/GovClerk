import { connect } from "@planetscale/database";

export type MgLead = {
  userId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  organizationName?: string;
  websiteUrl?: string;
  comments?: string;
  minutesFreq?: string;
  minutesDue?: string;
  instantlyId?: string;
};

export async function updateLeadInDb({
  userId,
  email,
  firstName,
  lastName,
  phone,
  organizationName,
  websiteUrl,
  comments,
  minutesFreq,
  minutesDue,
  instantlyId,
}: MgLead): Promise<void> {
  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  const setList = [];
  const values = [];

  if (email != null) {
    setList.push("email = ?");
    values.push(email);
  }
  if (firstName != null) {
    setList.push("first_name = ?");
    values.push(firstName);
  }
  if (lastName != null) {
    setList.push("last_name = ?");
    values.push(lastName);
  }
  if (phone != null) {
    setList.push("phone = ?");
    values.push(phone);
  }
  if (organizationName != null) {
    setList.push("organization_name = ?");
    values.push(organizationName);
  }
  if (websiteUrl != null) {
    setList.push("website_url = ?");
    values.push(websiteUrl);
  }
  if (comments != null) {
    setList.push("comments = ?");
    values.push(comments);
  }
  if (minutesFreq != null) {
    setList.push("minutes_freq = ?");
    values.push(minutesFreq);
  }
  if (minutesDue != null) {
    setList.push("minutes_due = ?");
    values.push(minutesDue);
  }
  if (instantlyId != null) {
    setList.push("instantly_id = ?");
    values.push(instantlyId);
  }

  if (setList.length === 0) {
    return;
  }

  const setListStr = setList.join(", ");

  await conn.execute(`UPDATE gc_leads SET ${setListStr} WHERE user_id = ?;`, [...values, userId]);
}

export async function upsertLeadToDb({
  userId,
  email,
  firstName,
  lastName,
  phone,
  organizationName,
  websiteUrl,
  comments,
  minutesFreq,
  minutesDue,
  instantlyId,
}: MgLead): Promise<void> {
  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  await conn.execute(
    `
    INSERT INTO gc_leads
      (user_id, email, first_name, last_name, phone, organization_name, website_url, comments, minutes_freq, minutes_due, instantly_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      email = COALESCE(VALUES(email), email),
      first_name = COALESCE(VALUES(first_name), first_name),
      last_name = COALESCE(VALUES(last_name), last_name),
      phone = COALESCE(VALUES(phone), phone),
      organization_name = COALESCE(VALUES(organization_name), organization_name),
      website_url = COALESCE(VALUES(website_url), website_url),
      comments = COALESCE(VALUES(comments), comments),
      minutes_freq = COALESCE(VALUES(minutes_freq), minutes_freq),
      minutes_due = COALESCE(VALUES(minutes_due), minutes_due),
      instantly_id = COALESCE(VALUES(instantly_id), instantly_id);
    `,
    [
      userId,
      email ?? null,
      firstName ?? null,
      lastName ?? null,
      phone ?? null,
      organizationName ?? null,
      websiteUrl ?? null,
      comments ?? null,
      minutesFreq ?? null,
      minutesDue ?? null,
      instantlyId ?? null,
    ]
  );
}

export async function getLeadFromDb(userId: string): Promise<MgLead | null> {
  return getLeadsFromDb([userId]).then((leads) => leads[0] || null);
}

export async function getLeadsFromDb(userIds: string[]): Promise<MgLead[]> {
  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  const rows = await conn
    .execute(
      `
      SELECT 
        user_id,
        email,
        first_name,
        last_name,
        phone,
        organization_name,
        website_url,
        comments,
        minutes_freq,
        minutes_due,
        instantly_id
      FROM gc_leads
      WHERE user_id IN (?);
      `,
      [userIds]
    )
    .then((r) => r.rows);

  return rows.map((row) => ({
    userId: row.user_id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    organizationName: row.organization_name,
    websiteUrl: row.website_url,
    comments: row.comments,
    minutesFreq: row.minutes_freq,
    minutesDue: row.minutes_due,
    instantlyId: row.instantly_id,
  }));
}

export async function getLeadByPhoneFromDb(phone: string): Promise<MgLead | null> {
  if (!phone) {
    return null;
  }

  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  const row = await conn
    .execute(
      `
      SELECT 
        user_id,
        email,
        first_name,
        last_name,
        phone,
        organization_name,
        website_url,
        comments,
        minutes_freq,
        minutes_due,
        instantly_id
      FROM gc_leads
      WHERE phone = ?
      LIMIT 1;
      `,
      [phone]
    )
    .then((r) => r.rows[0] as any);

  if (!row) {
    return null;
  }

  return {
    userId: row.user_id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    organizationName: row.organization_name,
    websiteUrl: row.website_url,
    comments: row.comments,
    minutesFreq: row.minutes_freq,
    minutesDue: row.minutes_due,
    instantlyId: row.instantly_id,
  };
}
