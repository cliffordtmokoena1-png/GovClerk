import ical, {
  ICalAttendeeRole,
  ICalAttendeeStatus,
  ICalAttendeeType,
  ICalCalendarMethod,
  ICalEventStatus,
} from "ical-generator";

export type IcsParams = {
  calendarName: string;
  eventTitle: string;
  eventDescription: string;
  location: string;
  senderEmail: string;
  senderName: string;
  receiverEmail: string;
  receiverName: string;
  eventTime: string;
  url: string;
};
export function getIcsString({
  calendarName,
  eventTitle,
  eventDescription,
  location,
  senderEmail,
  senderName,
  receiverEmail,
  receiverName,
  eventTime,
  url,
}: IcsParams): string {
  const cal = ical({
    method: ICalCalendarMethod.REQUEST,
  });

  const start = new Date(eventTime);
  cal.createEvent({
    start,
    end: new Date(start.getTime() + 30 * 60 * 1000), // 30 minutes later
    summary: eventTitle,
    description: eventDescription,
    location,
    url,
    organizer: {
      name: senderName,
      email: senderEmail,
    },
    status: ICalEventStatus.CONFIRMED,
    id: makeIcsUid(receiverEmail, eventTime, "mgfreetraining"),
    attendees: [
      {
        name: receiverName,
        email: receiverEmail,
        rsvp: true,
        role: ICalAttendeeRole.REQ,
        status: ICalAttendeeStatus.NEEDSACTION,
        type: ICalAttendeeType.INDIVIDUAL,
        x: {
          "X-NUM-GUESTS": "0",
        },
      },
    ],
  });

  return btoa(unescape(encodeURIComponent(cal.toString())));
}

// Make and id based of the recepient, the time, and the event.
function makeIcsUid(email: string, eventTime: string, eventType: string): string {
  return `${eventType}x${eventTime}x${email}`;
}
