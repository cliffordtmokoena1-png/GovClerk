import withErrorReporting from "@/error/withErrorReporting";
import { NextRequest } from "next/server";
import { ipAddress } from "@vercel/functions";
import {
  makeGcalDeeplink,
  makeIcalDeeplink,
  makeOutlookDeeplinkForSouthAfrica,
} from "@/utils/calendar";
import { getIcsString } from "@/utils/ics";
import { createLead } from "@/instantly/leads";
import { getUserIdFromEmail } from "@/auth/getUserIdFromEmail";
import { sendConversionEvent } from "@/meta/sendConversionEvent";
import { sendEmail } from "@/utils/postmark";
import { upsertLeadToDb } from "@/crm/leads";
import { addWebinarLeadToDb } from "@/crm/webinarLeads";
import { getSiteFromHeaders } from "@/utils/site";
import { asUtcDate, convertIsoTimestampForMysql } from "@/utils/date";

export const config = {
  runtime: "edge",
};

const WEBINAR_DRIP_CAMPAIGN_ID = "83a3797b-bb09-430c-a858-d6894650d2e9";

async function addInstantlyLeadToCampaign(
  email: string,
  firstName: string,
  url: string,
  eventTime: string,
  prettyEventTime: string
): Promise<void> {
  const makeDeeplinkParams = {
    title: "Free Training: Meeting Minutes Fast, Easy, and Detailed",
    description: `Join us for a live training on how to generate high quality meeting minutes.  You'll save hours of time and pain by automating your workflow.\n\nWe will give you a special discount in the session.\n\nJoin the session at: ${url}`,
    location: "Facebook Live",
    start: new Date(eventTime),
    end: new Date(new Date(eventTime).getTime() + 30 * 60 * 1000), // 30 minutes later
  };

  const data = await createLead({
    email,
    campaign: WEBINAR_DRIP_CAMPAIGN_ID,
    firstName,
    ltInterestStatus: 1, // Interested
    customVariables: {
      event_url: url,
      event_time: prettyEventTime,
      gcal_deeplink: makeGcalDeeplink(makeDeeplinkParams),
      outlook_deeplink: makeOutlookDeeplinkForSouthAfrica(makeDeeplinkParams),
      ical_deeplink: makeIcalDeeplink(makeDeeplinkParams),
    },
  });

  // eslint-disable-next-line no-console
  console.log(data);
}

async function handler(req: NextRequest) {
  const body = await req.json();
  const email = body.email as string;
  const firstName = body.firstName as string;
  const url = body.url as string;
  const eventTime = body.eventTime as string;
  const prettyEventTime = body.prettyEventTime as string;

  const site = getSiteFromHeaders(req.headers);
  const userId = (await getUserIdFromEmail({ email, site })) ?? undefined;

  await addWebinarLeadToDb({
    email,
    userId,
    firstName,
    eventUrl: url,
    eventTime: new Date(eventTime),
    isRegistered: true,
    isReminded: false,
  });

  await addInstantlyLeadToCampaign(email, firstName, url, eventTime, prettyEventTime);

  sendEmail({
    From: '"Max from GovClerkMinutes" <max@mail.GovClerkMinutes.com>',
    To: email,
    Subject: `See you Thursday, ${firstName}!`,
    HtmlBody: `${firstName} - after this training, generating quality meeting minutes will be fast and easy.<br /><br />Add this to your calendar!<br /><br />Here's the <a href=${url}>FB event for our free training.</a><br /><br />It will go live at ${prettyEventTime}.<br /><br />See you there!<br />Max Sherman`,
    TextBody: `${firstName} - after this training, generating quality meeting minutes will be fast and easy.\n\nAdd this to your calendar!\n\nHere's the FB event for our free training: ${url}\n\nIt will go live at ${prettyEventTime}.\n\nSee you there!\nMax Sherman`,
    MessageStream: "outbound",
    Attachments: [
      {
        Name: "invite.ics",
        Content: getIcsString({
          calendarName: "GovClerkMinutes Free Training",
          eventTitle: "Free Training: Meeting Minutes Fast, Easy, and Detailed",
          eventDescription: `Join us for a live training on how to generate high quality meeting minutes.  You'll save hours of time and pain by automating your workflow.\n\nWe will give you a special discount in the session.\n\nJoin the session at: ${url}`,
          location: "Facebook Live",
          senderEmail: "max@mail.GovClerkMinutes.com",
          senderName: "Max from GovClerkMinutes",
          receiverEmail: email,
          receiverName: firstName,
          eventTime,
          url,
        }),
        ContentType: "text/calendar; charset=utf-8; method=REQUEST",
        ContentID: "calendar",
        Disposition: "inline",
      },
    ],
  });

  const clientUserAgent = req.headers.get("user-agent") ?? undefined;
  const clientIpAddress = ipAddress(req);
  const fbcRaw = req.cookies.get("_fbc");
  const fbc = fbcRaw == null ? undefined : fbcRaw.value;
  const fbpRaw = req.cookies.get("_fbp");
  const fbp = fbpRaw == null ? undefined : fbpRaw.value;
  const eventSourceUrl = req.headers.get("referer") ?? undefined;

  await sendConversionEvent(
    {
      eventName: "SubmitApplication",
      userId,
      email,
      fbc,
      fbp,
      clientIpAddress,
      clientUserAgent,
      eventSourceUrl,
      firstName: firstName?.toLowerCase().trim(),
    },
    {}
  );

  return new Response(JSON.stringify({}), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

export default withErrorReporting(handler);
