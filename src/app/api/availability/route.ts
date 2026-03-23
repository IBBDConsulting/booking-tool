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

    // Get existing bookings for this member on this date
    const dayStart = new Date(`${date}T00:00:00`);
    const dayEnd = new Date(`${date}T23:59:59`);

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
    } catch (error) {
      console.error("Google FreeBusy Fehler:", error);
    }

    // Filter out slots that conflict with existing bookings OR Google Calendar events
    const availableSlots = slots.filter((slot) => {
      const [h, m] = slot.split(":").map(Number);
      const slotStart = new Date(`${date}T${slot}:00`);
      const slotEnd = new Date(slotStart);
      slotEnd.setMinutes(slotEnd.getMinutes() + duration);

      // Check buffer time too
      const slotStartWithBuffer = new Date(slotStart);
      slotStartWithBuffer.setMinutes(slotStartWithBuffer.getMinutes() - buffer);
      const slotEndWithBuffer = new Date(slotEnd);
      slotEndWithBuffer.setMinutes(slotEndWithBuffer.getMinutes() + buffer);

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
