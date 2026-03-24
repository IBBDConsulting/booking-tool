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
    } else {
      // Update existing lead with latest data
      lead = await prisma.lead.update({
        where: { id: lead.id },
        data: {
          firstName: firstName || lead.firstName,
          lastName: lastName || lead.lastName,
          company: company || lead.company,
          role: role || lead.role,
          ...(agentId && !lead.agentId ? { agentId, referralCode: agentCode || null } : {}),
        },
      });
    }

    // Parse date and time into start/end timestamps with timezone
    // Client sends date (YYYY-MM-DD), time (HH:MM), and utcOffset (minutes from UTC)
    // utcOffset from client: positive = east of UTC (e.g. 120 for CEST/UTC+2)
    const utcOffsetMinutes = typeof body.utcOffset === "number" ? body.utcOffset : 60; // default CET

    // Build ISO string with explicit offset: e.g. "2026-03-24T09:00:00+02:00"
    const offsetHours = Math.floor(Math.abs(utcOffsetMinutes) / 60);
    const offsetMins = Math.abs(utcOffsetMinutes) % 60;
    const offsetSign = utcOffsetMinutes >= 0 ? "+" : "-";
    const offsetStr = `${offsetSign}${String(offsetHours).padStart(2, "0")}:${String(offsetMins).padStart(2, "0")}`;
    const isoString = `${date}T${time}:00${offsetStr}`;

    console.log(`[Booking] Local: ${date} ${time}, offset: ${utcOffsetMinutes}min, ISO: ${isoString}`);

    const startTime = new Date(isoString);
    const endTime = new Date(startTime.getTime() + bookingPage.duration * 60 * 1000);

    console.log(`[Booking] UTC start: ${startTime.toISOString()}, UTC end: ${endTime.toISOString()}`);

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
    const calSubject = (bookingPage.calendarSubject || "Termin")
      .replace(/\{company\}/g, lead.company || "")
      .replace(/\{name\}/g, `${lead.firstName} ${lead.lastName}`)
      .replace(/\{email\}/g, lead.email || "");
    const calDescription = (bookingPage.description || "")
      .replace(/\{company\}/g, lead.company || "")
      .replace(/\{name\}/g, `${lead.firstName} ${lead.lastName}`)
      .replace(/\{email\}/g, lead.email || "");
    try {
      const calendarResult = await createCalendarEvent(
        bookingPage.member,
        booking,
        lead,
        calSubject,
        calDescription
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
      const emailSubjectResolved = (bookingPage.emailSubject || "Terminbestätigung")
        .replace(/\{company\}/g, lead.company || "")
        .replace(/\{name\}/g, `${lead.firstName} ${lead.lastName}`)
        .replace(/\{email\}/g, lead.email || "");
      const emailSent = await sendBookingConfirmation(booking, lead, meetLink, emailSubjectResolved);
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
