import posthog from "posthog-js";

export function safeCapture(eventName: string, properties?: object) {
  try {
    if (properties == null) {
      posthog.capture(eventName);
    } else {
      posthog.capture(eventName, properties);
    }
  } catch (e) {
    console.error(`Failed to capture PostHog event: ${eventName}`, e);
  }
}
