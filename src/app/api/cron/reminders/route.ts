import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendBookingReminder } from "@/lib/email";
import { google } from "googleapis";

// Check if Google Calendar event still exists and is not cancelled
async function isEventStillActive(member: any, googleEventId: string): Promise<boolean> {
  if (!member.googleAccessToken || !member.googleRefreshToken || !googleEventId) {
    return true; // Can't check, assume active
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    oauth2Client.setCredentials({
      access_token: member.googleAccessToken,
      refresh_token: member.googleRefreshToken,
    });

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });
    const calendarId = member.googleCalendarId || "primary";

    const event = await calendar.events.get({
      calendarId,
      eventId: googleEventId,
    });

    // Check if event is cancelled
    return event.data.status !== "cancelled";
  } catch (error: any) {
    // 404 = event deleted, 410 = event gone
    if (error?.code === 404 || error?.code === 410) {
      return false;
    }
    console.error("Calendar check error:", error?.message);
    return true; // Can't check, assume active
  }
}

// GET /api/cron/reminders — Send 30-min reminder emails for upcoming bookings
// Called every 5 minutes via Vercel Cron
export async function GET(request: Request) {
  try {
    const now = new Date();
    const in35min = new Date(now.getTime() + 35 * 60 * 1000);
    const in25min = new Date(now.getTime() + 25 * 60 * 1000);

    // Find bookings starting in 25-35 minutes where reminder hasn't been sent
    const upcomingBookings = await prisma.booking.findMany({
      where: {
        status: "SCHEDULED",
        startTime: {
          gte: in25min,
          lte: in35min,
        },
        reminder1hSentAt: null,
      },
      include: {
        lead: true,
        member: true,
      },
    });

    let sent = 0;
    let skipped = 0;

    for (const booking of upcomingBookings) {
      // Check if event still exists in Google Calendar
      if (booking.googleEventId && booking.member) {
        const stillActive = await isEventStillActive(booking.member, booking.googleEventId);
        if (!stillActive) {
          console.log(`[Reminder] Skipping ${booking.id} - Calendar event cancelled/deleted`);
          // Mark as cancelled in our DB too
          await prisma.booking.update({
            where: { id: booking.id },
            data: { status: "CANCELLED", reminder1hSentAt: new Date() },
          });
          skipped++;
          continue;
        }
      }

      const emailSent = await sendBookingReminder(
        booking,
        booking.lead,
        booking.meetLink
      );

      if (emailSent) {
        await prisma.booking.update({
          where: { id: booking.id },
          data: { reminder1hSentAt: new Date() },
        });
        sent++;
        console.log(`[Reminder] Sent to ${booking.lead.email} for booking ${booking.id}`);
      }
    }

    return NextResponse.json({
      success: true,
      checked: upcomingBookings.length,
      sent,
      skipped,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("Reminder cron error:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
