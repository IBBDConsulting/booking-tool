import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createCalendarEvent } from "@/lib/google-calendar";
import { sendBookingConfirmation } from "@/lib/email";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { firstName, lastName, email, company, role, date, time, timezone, slug, agentCode } = body;

    // Validate required fields
    if (!firstName || !lastName || !email || !date || !time || !slug) {
      return NextResponse.json(
        { success: false, error: "Pflichtfelder fehlen." },
        { status: 400 }
      );
    }

    // Find the booking page by slug
    const bookingPage = await prisma.bookingPage.findUnique({
      where: { slug },
      include: { member: true },
    });

    if (!bookingPage) {
      return NextResponse.json(
        { success: false, error: "Buchungsseite nicht gefunden." },
        { status: 404 }
      );
    }

    // Find agent by referral code (if provided)
    let agentId: string | null = null;
    if (agentCode) {
      const agent = await prisma.agent.findUnique({
        where: { referralCode: agentCode },
      });
      if (agent && agent.isActive) {
        agentId = agent.id;
      }
    }

    // Create or find the lead
    let lead = await prisma.lead.findFirst({
      where: { email },
    });

    if (!lead) {
      lead = await prisma.lead.create({
        data: {
          firstName,
          lastName,
          email,
          company: company || null,
          role: role || null,
          agentId,
          referralCode: agentCode || null,
        },
      });
    } else if (agentId && !lead.agentId) {
      // Update existing lead with agent if not already assigned
      lead = await prisma.lead.update({
        where: { id: lead.id },
        data: { agentId, referralCode: agentCode || null },
      });
    }

    // Parse date and time into start/end timestamps with timezone
    // The client sends date (YYYY-MM-DD) and time (HH:MM) in the user's timezone
    // We need to create the correct UTC timestamp
    const tz = timezone || "Europe/Berlin";
    const dateTimeStr = `${date}T${time}:00`;

    // Create date using timezone offset
    // Use Intl to find the UTC offset for the given timezone and date
    const tempDate = new Date(dateTimeStr + "Z"); // temp as UTC
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false,
    });

    // Calculate offset: format the UTC date in the target timezone and compare
    const utcDate = new Date(`${date}T${time}:00Z`);
    const parts = formatter.formatToParts(utcDate);
    const tzParts: Record<string, string> = {};
    parts.forEach(p => { if (p.type !== "literal") tzParts[p.type] = p.value; });
    const tzDateStr = `${tzParts.year}-${tzParts.month}-${tzParts.day}T${tzParts.hour}:${tzParts.minute}:${tzParts.second}Z`;
    const tzAsUtc = new Date(tzDateStr);
    const offsetMs = tzAsUtc.getTime() - utcDate.getTime();

    // startTime = the user's local time converted to UTC
    const startTime = new Date(utcDate.getTime() - offsetMs);
    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + bookingPage.duration);

    // Check for double bookings on the same member at the same time
    const existingBooking = await prisma.booking.findFirst({
      where: {
        memberId: bookingPage.memberId,
        status: "SCHEDULED",
        startTime: { lte: endTime },
        endTime: { gte: startTime },
      },
    });

    if (existingBooking) {
      return NextResponse.json(
        { success: false, error: "Dieser Zeitslot ist leider nicht mehr verfügbar." },
        { status: 409 }
      );
    }

    // Create the booking
    let booking = await prisma.booking.create({
      data: {
        leadId: lead.id,
        memberId: bookingPage.memberId,
        bookingPageId: bookingPage.id,
        startTime,
        endTime,
        timezone: timezone || "Europe/Berlin",
        duration: bookingPage.duration,
        status: "SCHEDULED",
        agentId: agentId || null,
        referralCode: agentCode || null,
      },
    });

    // Google Calendar: create event if member has connected calendar
    let meetLink: string | null = null;
    try {
      const calendarResult = await createCalendarEvent(
        bookingPage.member,
        booking,
        lead,
        bookingPage.calendarSubject,
        bookingPage.description
      );
      if (calendarResult) {
        meetLink = calendarResult.meetLink;
        booking = await prisma.booking.update({
          where: { id: booking.id },
          data: {
            googleEventId: calendarResult.googleEventId,
            meetLink: calendarResult.meetLink,
          },
        });
      }
    } catch (error) {
      console.error("Google Calendar Fehler:", error);
    }

    // Send confirmation email
    try {
      const emailSent = await sendBookingConfirmation(booking, lead, meetLink, bookingPage.emailSubject);
      if (emailSent) {
        await prisma.booking.update({
          where: { id: booking.id },
          data: { confirmationSentAt: new Date() },
        });
      }
    } catch (error) {
      console.error("E-Mail Fehler:", error);
    }

    return NextResponse.json({
      success: true,
      bookingId: booking.id,
    });
  } catch (error) {
    console.error("Booking error:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}

// GET: List all bookings (for dashboard)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const where: any = {};
    if (status) {
      where.status = status;
    }

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        lead: true,
        agent: true,
        member: true,
        bookingPage: true,
      },
      orderBy: { startTime: "desc" },
    });

    return NextResponse.json({ success: true, bookings });
  } catch (error) {
    console.error("Error fetching bookings:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}

// PATCH: Update booking status, stage, notes
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { bookingId, status, outcome, stage, notes } = body;

    if (!bookingId) {
      return NextResponse.json(
        { success: false, error: "bookingId ist erforderlich." },
        { status: 400 }
      );
    }

    const updateData: any = {};

    if (status) {
      const validStatuses = ["SCHEDULED", "RESCHEDULED", "CANCELLED", "ATTENDED", "NO_SHOW"];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { success: false, error: "Ungültiger Status." },
          { status: 400 }
        );
      }
      updateData.status = status;
    }

    if (outcome) {
      updateData.outcome = outcome;
    }

    if (stage) {
      const validStages = ["BOOKED", "FIRST_CALL", "DEMO", "DEAL", "POSTPONED", "NOT_QUALIFIED"];
      if (!validStages.includes(stage)) {
        return NextResponse.json(
          { success: false, error: "Ungültige Stage." },
          { status: 400 }
        );
      }
      updateData.stage = stage;
    }

    if (notes !== undefined) {
      updateData.notes = notes;
    }

    const booking = await prisma.booking.update({
      where: { id: bookingId },
      data: updateData,
      include: {
        lead: true,
        agent: true,
        bookingPage: true,
      },
    });

    return NextResponse.json({ success: true, booking });
  } catch (error) {
    console.error("Error updating booking:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}

// DELETE /api/bookings — Delete a booking
export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { bookingId } = body;

    if (!bookingId) {
      return NextResponse.json(
        { success: false, error: "bookingId ist erforderlich." },
        { status: 400 }
      );
    }

    await prisma.booking.delete({
      where: { id: bookingId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting booking:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
