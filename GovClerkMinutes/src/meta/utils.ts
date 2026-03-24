import { connect } from "@planetscale/database";
import { NextApiRequest } from "next";
import { NextRequest } from "next/server";

export type ConversionEventDataFromRequest = {
  fbc?: string;
  fbp?: string;
  clientIpAddress?: string;
  clientUserAgent?: string;
  eventSourceUrl?: string;
};

export function getConversionEventDataFromServerlessRequest(
  req: NextApiRequest
): ConversionEventDataFromRequest {
  const fbc = req.cookies._fbc || undefined;
  const fbp = req.cookies._fbp || undefined;

  const clientUserAgent = req.headers["user-agent"];
  const clientIpAddress =
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0].trim() ||
    req.socket.remoteAddress;
  const eventSourceUrl = req.headers.referer;

  return {
    fbc,
    fbp,
    clientIpAddress,
    clientUserAgent,
    eventSourceUrl,
  };
}

export function getConversionEventDataFromEdgeRequest(
  req: NextRequest
): ConversionEventDataFromRequest {
  const fbc = req.cookies.get("_fbc")?.value;
  const fbp = req.cookies.get("_fbp")?.value;

  const clientUserAgent = req.headers.get("user-agent") ?? undefined;

  const xff = req.headers.get("x-forwarded-for");
  const clientIpAddress = xff?.split(",")[0].trim() || (req as any).ip || undefined;

  const eventSourceUrl = req.headers.get("referer") ?? undefined;

  return {
    fbc,
    fbp,
    clientIpAddress,
    clientUserAgent,
    eventSourceUrl,
  };
}

export type UtmParams = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
};

export type MetaConversionData = {
  userId: string;
  email?: string;
  sentCompleteRegistration?: number;
  fbc?: string;
  fbp?: string;
  clientIpAddress?: string;
  clientUserAgent?: string;
  adId?: string;
  utmParams?: UtmParams;
  discountCode?: string;
  firstName?: string;
  frequency?: string;
  dueDate?: string;
};

export async function readMetaConversionData(userId: string): Promise<MetaConversionData | null> {
  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  const res = await conn.execute(
    "SELECT fbc, fbp, ip, user_agent, email, sent_complete_registration FROM gc_meta_conversions WHERE user_id = ?",
    [userId]
  );

  if (res.size === 0) {
    return null;
  }

  const first = res.rows[0];

  return {
    userId,
    email: first["email"],
    fbc: first["fbc"],
    fbp: first["fbp"],
    clientIpAddress: first["ip"],
    clientUserAgent: first["user_agent"],
    sentCompleteRegistration: first["sent_complete_registration"],
  };
}

export async function writeMetaConversionData(
  metaConversionData: MetaConversionData
): Promise<void> {
  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  const {
    userId,
    email,
    fbc,
    fbp,
    clientIpAddress,
    clientUserAgent,
    adId,
    discountCode,
    firstName,
    frequency,
    dueDate,
  } = metaConversionData;

  await conn.execute(
    "INSERT INTO gc_meta_conversions (user_id, fbc, fbp, ip, user_agent, email, ad_id, utm_params, discount_code, first_name, minutes_freq, due_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);",
    [
      userId,
      fbc,
      fbp,
      clientIpAddress,
      clientUserAgent,
      email,
      adId,
      JSON.stringify(metaConversionData.utmParams ?? {}),
      discountCode,
      firstName,
      frequency,
      dueDate,
    ]
  );
}

export async function updateMetaConversionData(
  metaConversionData: MetaConversionData
): Promise<void> {
  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  const {
    userId,
    email,
    sentCompleteRegistration,
    fbc,
    fbp,
    clientIpAddress,
    clientUserAgent,
    adId,
    utmParams,
    discountCode,
    firstName,
    frequency,
    dueDate,
  } = metaConversionData;

  const setList: string[] = [];
  const values: unknown[] = [];

  if (email != null) {
    setList.push("email = ?");
    values.push(email);
  }
  if (sentCompleteRegistration != null) {
    setList.push("sent_complete_registration = ?");
    values.push(sentCompleteRegistration);
  }
  if (fbc != null) {
    setList.push("fbc = ?");
    values.push(fbc);
  }
  if (fbp != null) {
    setList.push("fbp = ?");
    values.push(fbp);
  }
  if (clientIpAddress != null) {
    setList.push("ip = ?");
    values.push(clientIpAddress);
  }
  if (clientUserAgent != null) {
    setList.push("user_agent = ?");
    values.push(clientUserAgent);
  }
  if (adId != null) {
    setList.push("ad_id = ?");
    values.push(adId);
  }
  if (utmParams != null) {
    setList.push("utm_params = ?");
    values.push(JSON.stringify(utmParams));
  }
  if (discountCode != null) {
    setList.push("discount_code = ?");
    values.push(discountCode);
  }
  if (firstName != null) {
    setList.push("first_name = ?");
    values.push(firstName);
  }
  if (frequency != null) {
    setList.push("minutes_freq = ?");
    values.push(frequency);
  }
  if (dueDate != null) {
    setList.push("due_date = ?");
    values.push(dueDate);
  }

  if (setList.length === 0) {
    return;
  }

  // add the WHERE clause param
  values.push(userId);

  const sql = `
    UPDATE gc_meta_conversions
    SET ${setList.join(", ")}
    WHERE user_id = ?;
  `;

  await conn.execute(sql, values);
}
