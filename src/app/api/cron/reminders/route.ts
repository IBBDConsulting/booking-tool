import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendBookingReminder } from "@/lib/email";

// GET /api/cron/reminders — Send 30-min reminder emails for upcoming bookings
// Call this endpoint every 5 minutes (via cron, Vercel Cron, or external service)
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
        reminder1hSentAt: null, // reusing this field for 30-min reminder
      },
      include: {
        lead: true,
      },
    });

    let sent = 0;
    for (const booking of upcomingBookings) {
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
      }
    }

    return NextResponse.json({
      success: true,
      checked: upcomingBookings.length,
      sent,
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
