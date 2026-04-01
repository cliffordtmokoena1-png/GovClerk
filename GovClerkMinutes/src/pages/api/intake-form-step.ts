import withErrorReporting from "@/error/withErrorReporting";
import { DISCOUNT_COOKIE_NAME, getDiscountCodeId } from "@/cookies/discounts";
import { getUserIdFromEmail } from "@/auth/getUserIdFromEmail";
import { createUser } from "@/auth/createUser";
import { createSignInToken } from "@/utils/clerk";
import { sendSignInMagicEmail, sendSignUpMagicEmail } from "@/utils/postmark";
import { updateLeadInDb, upsertLeadToDb } from "@/crm/leads";
import {
  getConversionEventDataFromEdgeRequest,
  updateMetaConversionData,
  writeMetaConversionData,
} from "@/meta/utils";
import { capture } from "@/utils/posthog";
import { updateUser } from "@/auth/updateUser";
import {
  IntakeFormDueDateStepBody,
  IntakeFormEmailStepBody,
  IntakeFormFirstNameStepBody,
  IntakeFormFrequencyStepBody,
  IntakeFormOccupationStepBody,
  IntakeFormOrganizationStepBody,
  IntakeFormPhoneStepBody,
  IntakeFormStep,
  validateBody,
} from "@/IntakeForm/IntakeFormStep";
import hubspot from "@/crm/hubspot";
import { NextRequest } from "next/server";
import { capitalizeName } from "@/utils/name";
import { getSiteFromHeaders } from "@/utils/site";

export const config = {
  runtime: "edge",
};

async function handleEmailStep(body: IntakeFormEmailStepBody, req: NextRequest): Promise<Response> {
  const email = body.email.trim().toLowerCase();
  const utmParams = body.utmParams;
  const site = getSiteFromHeaders(req.headers);

  const existingUserId = await getUserIdFromEmail({ email, site });
  const userId = existingUserId ?? (await createUser({ email, firstName: null, site }));
  const discountCode = getDiscountCodeId(req.cookies.get(DISCOUNT_COOKIE_NAME)?.value);
  const token = await createSignInToken(userId, site);
  if (!token) {
    throw new Error(`[intake-form-step] Failed to create Clerk sign-in token for userId=${userId}`);
  }

  if (existingUserId == null) {
    // New user
    sendSignUpMagicEmail(email, token);

    const userData = getConversionEventDataFromEdgeRequest(req);

    await Promise.all([
      upsertLeadToDb({
        userId,
        email,
      }),
      writeMetaConversionData({
        userId,
        email,
        fbc: userData.fbc,
        fbp: userData.fbp,
        clientIpAddress: userData.clientIpAddress,
        clientUserAgent: userData.clientUserAgent,
        utmParams,
        discountCode,
      }),
      hubspot.createContact({
        userId,
        email,
        lead_source: "gc_landing_page",
      }),
    ]);
  } else {
    // Existing user
    sendSignInMagicEmail(email, token);
  }

  await capture(
    "user_magic_email_sent",
    {
      email,
      userId,
      existingUserId,
    },
    userId
  );

  return new Response(
    JSON.stringify({
      userId,
      existingUserId,
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}

async function handleFirstNameStep(
  body: IntakeFormFirstNameStepBody,
  req: NextRequest
): Promise<Response> {
  const userId = body.userId;
  const firstName = capitalizeName(body.firstName.trim());
  const site = getSiteFromHeaders(req.headers);
  await Promise.all([
    updateUser(userId, firstName, site),
    updateLeadInDb({
      userId,
      firstName,
    }),
    updateMetaConversionData({
      userId,
      firstName,
    }),
    hubspot.updateContact({
      filter: {
        propertyName: "user_id",
        value: userId,
      },
      properties: {
        firstName,
      },
    }),
  ]);

  return new Response(
    JSON.stringify({
      userId,
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}

async function handlePhoneStep(body: IntakeFormPhoneStepBody): Promise<Response> {
  const userId = body.userId;
  const phone = body.phone.trim();
  await Promise.all([
    updateLeadInDb({
      userId,
      phone,
    }),
    hubspot.updateContact({
      filter: {
        propertyName: "user_id",
        value: userId,
      },
      properties: {
        phone,
      },
    }),
  ]);

  return new Response(
    JSON.stringify({
      userId,
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}

async function handleFrequencyStep(body: IntakeFormFrequencyStepBody): Promise<Response> {
  const { userId, frequency } = body;

  await Promise.all([
    updateLeadInDb({
      userId,
      minutesFreq: frequency,
    }),
    hubspot.updateContact({
      filter: {
        propertyName: "user_id",
        value: userId,
      },
      properties: {
        minutesFreq: frequency,
      },
    }),
  ]);

  return new Response(
    JSON.stringify({
      userId,
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}

async function handleDueDateStep(body: IntakeFormDueDateStepBody): Promise<Response> {
  const { userId, dueDate } = body;

  await Promise.all([
    updateLeadInDb({
      userId,
      minutesDue: dueDate,
    }),
    hubspot.updateContact({
      filter: {
        propertyName: "user_id",
        value: userId,
      },
      properties: {
        minutesDue: dueDate,
      },
    }),
  ]);

  return new Response(
    JSON.stringify({
      userId,
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}

async function handleOccupationStep(body: IntakeFormOccupationStepBody): Promise<Response> {
  const { userId, occupation } = body;

  await Promise.all([
    updateLeadInDb({
      userId,
      occupation,
    }),
    hubspot.updateContact({
      filter: {
        propertyName: "user_id",
        value: userId,
      },
      properties: {
        occupation,
      },
    }),
  ]);

  return new Response(
    JSON.stringify({
      userId,
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}

async function handleOrganizationStep(body: IntakeFormOrganizationStepBody): Promise<Response> {
  const { userId, organizationName } = body;

  await Promise.all([
    updateLeadInDb({
      userId,
      organizationName,
    }),
    hubspot.updateContact({
      filter: {
        propertyName: "user_id",
        value: userId,
      },
      properties: {
        organizationName,
      },
    }),
  ]);

  return new Response(
    JSON.stringify({
      userId,
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}

async function handler(req: NextRequest) {
  const body = await validateBody(req);

  const step = body.step;
  switch (step) {
    case IntakeFormStep.ASK_EMAIL: {
      return await handleEmailStep(body, req);
    }
    case IntakeFormStep.ASK_FIRST_NAME: {
      return await handleFirstNameStep(body, req);
    }
    case IntakeFormStep.ASK_PHONE: {
      return await handlePhoneStep(body);
    }
    case IntakeFormStep.ASK_FREQUENCY: {
      return await handleFrequencyStep(body);
    }
    case IntakeFormStep.ASK_DUE_DATE: {
      return await handleDueDateStep(body);
    }
    case IntakeFormStep.ASK_OCCUPATION: {
      return await handleOccupationStep(body);
    }
    case IntakeFormStep.ASK_ORGANIZATION: {
      return await handleOrganizationStep(body);
    }
    default: {
      const _exhaustiveCheck: never = step;
      throw new Error(`Invalid step: ${step}`);
    }
  }
}

export default withErrorReporting(handler);
