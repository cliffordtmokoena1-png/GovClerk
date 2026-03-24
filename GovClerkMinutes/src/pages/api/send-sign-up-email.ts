import { capture } from "@/utils/posthog";
import { assertString } from "@/utils/assert";
import { sendSignInMagicEmail, sendSignUpMagicEmail } from "@/utils/postmark";
import { NextApiRequest, NextApiResponse } from "next";
import withErrorReporting from "@/error/withErrorReporting";
import { serverUri } from "@/utils/server";
import { DISCOUNT_COOKIE_NAME, getDiscountCodeId } from "@/cookies/discounts";
import { getUserIdFromEmail } from "@/auth/getUserIdFromEmail";
import { createUser } from "@/auth/createUser";
import {
  getConversionEventDataFromServerlessRequest,
  writeMetaConversionData,
  UtmParams,
} from "@/meta/utils";
import { sendConversionEvent } from "@/meta/sendConversionEvent";
import { upsertLeadToDb } from "@/crm/leads";
import { getSiteFromRequest } from "@/utils/site";

type SendSignUpEmailBody = {
  email: string;
  adId?: string;
  utmParams?: UtmParams;
};

export type ApiSendSignUpEmailResponse = {
  error?: string;
  userId?: string;
};

async function handler(req: NextApiRequest, res: NextApiResponse<ApiSendSignUpEmailResponse>) {
  const body = req.body as SendSignUpEmailBody;
  const email = assertString(body.email).trim().toLowerCase();
  const firstNameForUser = null;
  const adId = body.adId;
  const utmParams = body.utmParams;
  const site = getSiteFromRequest(req.headers);
  const existingUserId = await getUserIdFromEmail({ email, site });
  const userId = existingUserId ?? (await createUser({ email, firstName: firstNameForUser, site }));
  const discountCode = getDiscountCodeId(req.cookies[DISCOUNT_COOKIE_NAME]);
  const uploadSecret = assertString(process.env.UPLOAD_COMPLETE_WEBHOOK_SECRET);

  try {
    const { token: authToken } = await fetch(serverUri("/api/auth/create-auth-token"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${uploadSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: userId,
      }),
    }).then((resp) => resp.json());

    if (existingUserId == null) {
      // New user
      sendSignUpMagicEmail(email, authToken);

      await upsertLeadToDb({ userId, email });
    } else {
      // Existing user
      sendSignInMagicEmail(email, authToken);
    }

    const userData = getConversionEventDataFromServerlessRequest(req);

    await Promise.all([
      writeMetaConversionData({
        userId,
        adId,
        email,
        fbc: userData.fbc,
        fbp: userData.fbp,
        clientIpAddress: userData.clientIpAddress,
        clientUserAgent: userData.clientUserAgent,
        utmParams,
        discountCode,
      }),
      sendConversionEvent(
        {
          eventName: "CompleteRegistration",
          userId,
          email,
          ...userData,
        },
        {}
      ),
    ]);

    await capture(
      "user_magic_email_sent",
      {
        email,
        userId,
        existingUserId,
      },
      userId
    );

    return res.status(200).json({
      userId,
    });
  } catch (err: any) {
    await capture(
      "user_magic_email_failed",
      {
        email,
        userId,
        error: err.stack,
      },
      userId
    );
    throw err;
  }
}

export default withErrorReporting(handler);
