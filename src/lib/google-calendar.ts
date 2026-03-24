import { google } from "googleapis";
import { prisma } from "@/lib/prisma";

interface CalendarMember {
  id: string;
  googleAccessToken: string | null;
  googleRefreshToken: string | null;
  googleCalendarId: string | null;
  additionalCalendars?: string[];
}

interface CalendarBooking {
  id: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  timezone: string;
}

interface CalendarLead {
  firstName: string;
  lastName: string;
  email: string;
  company: string | null;
}

function getOAuth2Client(member: CalendarMember) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    access_token: member.googleAccessToken,
    refresh_token: member.googleRefreshToken,
  });

  // Auto-refresh: save new tokens when they change
  oauth2Client.on("tokens", async (tokens) => {
    const updateData: Record<string, string> = {};
    if (tokens.access_token) {
      updateData.googleAccessToken = tokens.access_token;
    }
    if (tokens.refresh_token) {
      updateData.googleRefreshToken = tokens.refresh_token;
    }
    if (Object.keys(updateData).length > 0) {
      await prisma.orgMember.update({
        where: { id: member.id },
        data: updateData,
      });
    }
  });

  return oauth2Client;
}

export interface BusySlot {
  start: Date;
  end: Date;
}

export async function getFreeBusySlots(
  member: CalendarMember,
  timeMin: Date,
  timeMax: Date
): Promise<BusySlot[]> {
  if (!member.googleAccessToken || !member.googleRefreshToken) {
    return [];
  }

  const oauth2Client = getOAuth2Client(member);
  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  // Build list of all calendars to check (primary + additional)
  const primaryId = member.googleCalendarId || "primary";
  const calendarIds = [primaryId, ...(member.additionalCalendars || [])];
  const items = calendarIds.map((id) => ({ id }));

  const res = await calendar.freebusy.query({
    requestBody: {
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      items,
    },
  });

  // Merge busy periods from all calendars
  const allBusy: BusySlot[] = [];
  for (const calId of calendarIds) {
    const busyPeriods = res.data.calendars?.[calId]?.busy || [];
    for (const b of busyPeriods) {
      if (b.start && b.end) {
        allBusy.push({ start: new Date(b.start), end: new Date(b.end) });
      }
    }
  }

  return allBusy;
}

export async function createCalendarEvent(
  member: CalendarMember,
  booking: CalendarBooking,
  lead: CalendarLead,
  calendarSubject?: string | null,
  bookingDescription?: string | null
): Promise<{ googleEventId: string; meetLink: string | null } | null> {
  if (!member.googleAccessToken || !member.googleRefreshToken) {
    return null;
  }

  const oauth2Client = getOAuth2Client(member);
  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  const description = [
    `Kunde: ${lead.firstName} ${lead.lastName}`,
    `E-Mail: ${lead.email}`,
    lead.company ? `Firma: ${lead.company}` : null,
    `Dauer: ${booking.duration} Minuten`,
    bookingDescription ? `\n${bookingDescription}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  // Build summary from template or default
  let summary = `Termin mit ${lead.firstName} ${lead.lastName}`;
  if (calendarSubject) {
    summary = calendarSubject
      .replace(/\{name\}/g, `${lead.firstName} ${lead.lastName}`)
      .replace(/\{company\}/g, lead.company || "");
  }

  const event = await calendar.events.insert({
    calendarId: member.googleCalendarId || "primary",
    conferenceDataVersion: 1,
    requestBody: {
      summary,
      description,
      start: {
        dateTime: booking.startTime.toISOString(),
        timeZone: booking.timezone,
      },
      end: {
        dateTime: booking.endTime.toISOString(),
        timeZone: booking.timezone,
      },
      attendees: [
        { email: lead.email },
      ],
      conferenceData: {
        createRequest: {
          requestId: booking.id,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
    },
  });

  return {
    googleEventId: event.data.id || "",
    meetLink: event.data.hangoutLink || null,
  };
}
