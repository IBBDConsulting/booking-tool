import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFreeBusySlots, type BusySlot } from "@/lib/google-calendar";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug");
    const date = searchParams.get("date"); // Format: YYYY-MM-DD

    if (!slug || !date) {
      return NextResponse.json(
        { success: false, error: "slug und date sind erforderlich." },
        { status: 400 }
      );
    }

    // Find booking page
    const bookingPage = await prisma.bookingPage.findUnique({
      where: { slug },
      include: {
        member: true,
      },
    });

    if (!bookingPage) {
      return NextResponse.json(
        { success: false, error: "Buchungsseite nicht gefunden." },
        { status: 404 }
      );
    }

    const member = bookingPage.member;

    // Check if this day is a working day
    const requestedDate = new Date(`${date}T12:00:00`);
    const dayOfWeek = requestedDate.getDay(); // 0=Sun, 1=Mon, etc.
    if (!member.workingDays.includes(dayOfWeek)) {
      return NextResponse.json({ success: true, slots: [], duration: bookingPage.duration });
    }

    // Get working hours from member settings
    const workStart = member.workingHoursStart;
    const workEnd = member.workingHoursEnd;
    const duration = bookingPage.duration;
    const buffer = member.bufferMinutes;

    // Parse breaks
    const breaks: { startMin: number; endMin: number }[] = [];
    if (member.breaks && Array.isArray(member.breaks)) {
      for (const b of member.breaks as any[]) {
        if (b.start && b.end) {
          const [bsH, bsM] = b.start.split(":").map(Number);
          const [beH, beM] = b.end.split(":").map(Number);
          breaks.push({ startMin: bsH * 60 + bsM, endMin: beH * 60 + beM });
        }
      }
    }

    // Generate all possible slots for the day
    const [startH, startM] = workStart.split(":").map(Number);
    const [endH, endM] = workEnd.split(":").map(Number);

    const slots: string[] = [];
    let currentMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    while (currentMinutes + duration <= endMinutes) {
      const slotEnd = currentMinutes + duration;

      // Check if slot overlaps with any break
      const inBreak = breaks.some((br) => currentMinutes < br.endMin && slotEnd > br.startMin);

      if (!inBreak) {
        const h = Math.floor(currentMinutes / 60);
        const m = currentMinutes % 60;
        slots.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
      }
      currentMinutes += 30;
    }

    // Use Europe/Berlin timezone for correct UTC conversion
    // Determine if date is in CET (UTC+1) or CEST (UTC+2)
    // CEST starts last Sunday of March at 02:00 CET, ends last Sunday of October at 03:00 CEST
    function isCESTDate(dateStr: string): boolean {
      const d = new Date(`${dateStr}T12:00:00Z`);
      const year = d.getUTCFullYear();
      const month = d.getUTCMonth(); // 0-11

      if (month < 2 || month > 9) return false; // Nov-Feb = CET
      if (month > 2 && month < 9) return true;  // Apr-Sep = CEST

      // March: find last Sunday
      if (month === 2) {
        const lastDay = new Date(Date.UTC(year, 3, 0)); // March 31 or 30
        const lastSun = lastDay.getUTCDate() - lastDay.getUTCDay();
        return d.getUTCDate() >= lastSun;
      }
      // October: find last Sunday
      const lastDay = new Date(Date.UTC(year, 10, 0)); // Oct 31 or 30
      const lastSun = lastDay.getUTCDate() - lastDay.getUTCDay();
      return d.getUTCDate() < lastSun;
    }

    const tzOffsetHours = isCESTDate(date) ? 2 : 1;
    const tzOffsetStr = `+0${tzOffsetHours}:00`;

    // Day boundaries in correct timezone
    const dayStart = new Date(`${date}T00:00:00${tzOffsetStr}`);
    const dayEnd = new Date(`${date}T23:59:59${tzOffsetStr}`);

    console.log(`[Availability] Date: ${date}, TZ offset: ${tzOffsetStr}, dayStart UTC: ${dayStart.toISOString()}, dayEnd UTC: ${dayEnd.toISOString()}`);

    const existingBookings = await prisma.booking.findMany({
      where: {
        memberId: member.id,
        status: { in: ["SCHEDULED", "RESCHEDULED"] },
        startTime: { gte: dayStart },
        endTime: { lte: dayEnd },
      },
    });

    // Fetch Google Calendar busy times (if connected)
    let googleBusySlots: BusySlot[] = [];
    try {
      googleBusySlots = await getFreeBusySlots(member, dayStart, dayEnd);
      console.log(`[Availability] Google busy slots: ${googleBusySlots.length}`, googleBusySlots.map(b => `${b.start.toISOString()} - ${b.end.toISOString()}`));
    } catch (error) {
      console.error("Google FreeBusy Fehler:", error);
    }

    // Filter out slots that conflict with existing bookings OR Google Calendar events
    const availableSlots = slots.filter((slot) => {
      // Create slot times in the correct timezone
      const slotStart = new Date(`${date}T${slot}:00${tzOffsetStr}`);
      const slotEnd = new Date(slotStart.getTime() + duration * 60 * 1000);

      // Check buffer time too
      const slotStartWithBuffer = new Date(slotStart.getTime() - buffer * 60 * 1000);
      const slotEndWithBuffer = new Date(slotEnd.getTime() + buffer * 60 * 1000);

      // Check against database bookings
      const dbConflict = existingBookings.some((booking) => {
        return slotStartWithBuffer < booking.endTime && slotEndWithBuffer > booking.startTime;
      });

      // Check against Google Calendar busy periods
      const gcalConflict = googleBusySlots.some((busy) => {
        return slotStart < busy.end && slotEnd > busy.start;
      });

      return !dbConflict && !gcalConflict;
    });

    return NextResponse.json({
      success: true,
      slots: availableSlots,
      duration: bookingPage.duration,
    });
  } catch (error) {
    console.error("Availability error:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
