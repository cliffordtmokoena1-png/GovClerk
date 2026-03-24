import { withGsspErrorHandling } from "@/error/withErrorReporting";
import { capture, TRAINING_REMINDER_ANONYMOUS_ID } from "@/utils/posthog";
import { getNextWebinarDetails } from "@/utils/webinar";
import { waitUntil } from "@vercel/functions";

export const getServerSideProps = withGsspErrorHandling(async (context) => {
  const webinarDetails = await getNextWebinarDetails();

  if (webinarDetails == null) {
    waitUntil(
      capture(
        "training_reminder",
        {
          fbclid: context.query.fbclid,
        },
        TRAINING_REMINDER_ANONYMOUS_ID
      )
    );

    return {
      redirect: {
        destination: "/",
        permanent: false,
      },
    };
  }

  const { url, eventTime } = webinarDetails;

  waitUntil(
    capture(
      "training_reminder",
      {
        fbclid: context.query.fbclid,
        event_time: eventTime,
      },
      TRAINING_REMINDER_ANONYMOUS_ID
    )
  );

  return {
    redirect: {
      destination: url,
      permanent: false,
    },
  };
});

export default function WeeklyEventRedirect() {
  // This won't render anything because it always redirects
  return null;
}
