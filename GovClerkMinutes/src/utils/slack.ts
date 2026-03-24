import { isDev } from "./dev";

interface SlackField {
  title: string;
  value: string;
  short: boolean;
}

interface SlackAttachment {
  color: string;
  title: string;
  text?: string;
  fields: SlackField[];
  footer?: string;
}

export async function sendSlackWebhook(attachments: SlackAttachment[]): Promise<void> {
  const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!slackWebhookUrl) {
    console.warn("SLACK_WEBHOOK_URL is not set. Skipping Slack notification.");
    return;
  }

  const response = await fetch(slackWebhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ attachments }),
  });

  if (!response.ok) {
    console.error("Failed to send Slack webhook:", response.status);
  }
}

export async function sendSlackChurnInfo(
  userId: string,
  reason: string,
  feedback: string | undefined,
  sessionId: string | undefined
): Promise<void> {
  if (isDev()) {
    console.warn("Skipping Slack notification in dev mode");
    return;
  }

  const fields: SlackField[] = [
    {
      title: "User ID",
      value: userId,
      short: false,
    },
    {
      title: "Reason",
      value: reason,
      short: false,
    },
  ];

  if (feedback) {
    fields.push({
      title: "Feedback",
      value: feedback,
      short: false,
    });
  }

  let text = "";
  const posthogProjectId = process.env.POSTHOG_PROJECT_ID;
  const eventsTabLink = `https://us.posthog.com/project/${posthogProjectId}/person/${userId}#activeTab=events`;

  if (sessionId) {
    const posthogSessionReplayLink = `https://app.posthog.com/project/${posthogProjectId}/replay/${sessionId}`;
    text = `• <${posthogSessionReplayLink}|Watch session replay>\n• <${eventsTabLink}|View events tab>`;
  } else {
    text = `• Session replay unavailable\n• <${eventsTabLink}|View events tab>`;
  }

  const attachment: SlackAttachment = {
    color: "#ff0000",
    title: "Churn Information",
    text: text,
    fields: fields,
    footer: `Time: ${new Date().toISOString()}`,
  };

  await sendSlackWebhook([attachment]);
}
