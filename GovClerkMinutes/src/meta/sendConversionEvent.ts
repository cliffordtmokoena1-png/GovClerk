import { v4 as uuidv4 } from "uuid";
import { capture } from "@/utils/posthog";
import { isDev } from "@/utils/dev";
import { updateMetaConversionData } from "./utils";

export type FbConversionUserData = {
  eventName:
    | "ViewContent"
    | "SubmitApplication"
    | "CompleteRegistration"
    | "InitiateCheckout"
    | "Purchase";
  userId?: string;
  email?: string;
  fbc?: string;
  fbp?: string;
  clientIpAddress?: string;
  clientUserAgent?: string;
  firstName?: string;
  lastName?: string;
  eventSourceUrl?: string;
  ph?: string;
  st?: string;
  zp?: string;
  country?: string;
  ct?: string;
};

export type FbConversionEventCustomData = {
  currency?: string;
  value?: number;
};

export const META_CONVERSIONS_DATASET = 1419987195621259;

/**
 * Native SHA-256 hashing using the Web Crypto API.
 * This is compatible with Vercel Edge Runtime.
 */
async function hash(s: string | null | undefined): Promise<string | undefined> {
  if (!s) return undefined;

  const msgUint8 = new TextEncoder().encode(s.toLowerCase().trim().replace(/\s/g, ""));
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sendConversionEvent(
  userData: FbConversionUserData,
  customData: FbConversionEventCustomData
) {
  const {
    eventName,
    userId,
    email,
    fbc,
    fbp,
    clientIpAddress,
    clientUserAgent,
    firstName,
    lastName,
    eventSourceUrl,
    ph,
    st,
    zp,
    country,
    ct,
  } = userData;

  if (!isDev()) {
    // We must await the hashes now because crypto.subtle is asynchronous
    const [hashedEmail, hashedFN, hashedLN, hashedPh, hashedSt, hashedZp, hashedCountry, hashedCt] =
      await Promise.all([
        hash(email),
        hash(firstName),
        hash(lastName),
        hash(ph),
        hash(st),
        hash(zp),
        hash(country),
        hash(ct),
      ]);

    await fetch(
      `https://graph.facebook.com/v19.0/${META_CONVERSIONS_DATASET}/events?access_token=${process.env.META_CONVERSIONS_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: [
            {
              event_name: eventName,
              event_time: Math.floor(Date.now() / 1000),
              event_id: uuidv4(),
              action_source: "website",
              event_source_url: eventSourceUrl,
              user_data: {
                client_ip_address: clientIpAddress,
                client_user_agent: clientUserAgent,
                external_id: userId,
                em: hashedEmail,
                fn: hashedFN,
                ln: hashedLN,
                fbc,
                fbp,
                ph: hashedPh,
                st: hashedSt,
                zp: hashedZp,
                country: hashedCountry,
                ct: hashedCt,
              },
              custom_data: customData,
            },
          ],
        }),
      }
    );
  }

  if (eventName === "CompleteRegistration" && userId != null) {
    await updateMetaConversionData({
      userId,
      sentCompleteRegistration: 1,
    });
  }

  if (userId != null) {
    await capture(
      "conversions_api_called",
      {
        ...userData,
        ...customData,
      },
      userId
    );
  }
}
