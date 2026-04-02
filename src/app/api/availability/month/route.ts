import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFreeBusySlots, type BusySlot } from "@/lib/google-calendar";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug");
    const month = searchParams.get("month"); // Format: YYYY-MM

    if (!slug || !month) {
      return NextResponse.json({ success: false, error: "slug und month sind erforderlich." }, { status: 400 });
    }

    const bookingPage = await prisma.bookingPage.findUnique({
      where: { slug },
      include: { member: true },
    });

    if (!bookingPage) {
      return NextResponse.json({ success: false, error: "Buchungsseite nicht gefunden." }, { status: 404 });
    }

    const member = bookingPage.member;
    const duration = bookingPage.duration;
    const buffer = member.bufferMinutes;
    const workStart = member.workingHoursStart;
    const workEnd = member.workingHoursEnd;

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

    const [startH, startM] = workStart.split(":").map(Number);
    const [endH, endM] = workEnd.split(":").map(Number);

    // CEST detection
    function isCESTDate(dateStr: string): boolean {
      const d = new Date(`${dateStr}T12:00:00Z`);
      const year = d.getUTCFullYear();
      const m = d.getUTCMonth();
      if (m < 2 || m > 9) return false;
      if (m > 2 && m < 9) return true;
      if (m === 2) {
        const lastDay = new Date(Date.UTC(year, 3, 0));
        const lastSun = lastDay.getUTCDate() - lastDay.getUTCDay();
        return d.getUTCDate() >= lastSun;
      }
      const lastDay = new Date(Date.UTC(year, 10, 0));
      const lastSun = lastDay.getUTCDate() - lastDay.getUTCDay();
      return d.getUTCDate() < lastSun;
    }

    // Get all days in the month
    const [yearStr, monthStr] = month.split("-");
    const year = parseInt(yearStr);
    const monthIdx = parseInt(monthStr) - 1;
    const firstDay = new Date(year, monthIdx, 1);
    const lastDay = new Date(year, monthIdx + 1, 0);

    // Fetch month range from Google Calendar in one call
    const tzOffsetFirst = isCESTDate(`${month}-01`) ? 2 : 1;
    const monthStart = new Date(`${month}-01T00:00:00+0${tzOffsetFirst}:00`);
    const tzOffsetLast = isCESTDate(`${month}-${String(lastDay.getDate()).padStart(2, "0")}`) ? 2 : 1;
    const monthEnd = new Date(`${month}-${String(lastDay.getDate()).padStart(2, "0")}T23:59:59+0${tzOffsetLast}:00`);

    // Fetch all bookings and Google Calendar events for the month at once
    const [existingBookings, googleBusySlots] = await Promise.all([
      prisma.booking.findMany({
        where: {
          memberId: member.id,
          status: { in: ["SCHEDULED", "RESCHEDULED"] },
          startTime: { gte: monthStart },
          endTime: { lte: monthEnd },
        },
      }),
      getFreeBusySlots(member, monthStart, monthEnd).catch(() => [] as BusySlot[]),
    ]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const availableDates: string[] = [];

    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, monthIdx, d);
      if (date < tomorrow) continue; // Skip past days and today

      const dayOfWeek = date.getDay();
      if (!member.workingDays.includes(dayOfWeek)) continue;

      const dateStr = `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const tzOffsetHours = isCESTDate(dateStr) ? 2 : 1;
      const tzOffsetStr = `+0${tzOffsetHours}:00`;

      // Generate slots for this day
      let currentMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;
      let hasSlot = false;

      while (currentMinutes + duration <= endMinutes && !hasSlot) {
        const slotEnd = currentMinutes + duration;
        const inBreak = breaks.some((br) => currentMinutes < br.endMin && slotEnd > br.startMin);

        if (!inBreak) {
          const h = Math.floor(currentMinutes / 60);
          const m = currentMinutes % 60;
          const timeStr = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;

          const slotStart = new Date(`${dateStr}T${timeStr}:00${tzOffsetStr}`);
          const slotEndTime = new Date(slotStart.getTime() + duration * 60 * 1000);
          const slotStartBuf = new Date(slotStart.getTime() - buffer * 60 * 1000);
          const slotEndBuf = new Date(slotEndTime.getTime() + buffer * 60 * 1000);

          const dbConflict = existingBookings.some((booking) =>
            slotStartBuf < booking.endTime && slotEndBuf > booking.startTime
          );
          const gcalConflict = googleBusySlots.some((busy) =>
            slotStart < busy.end && slotEndTime > busy.start
          );

          if (!dbConflict && !gcalConflict) hasSlot = true;
        }
        currentMinutes += 30;
      }

      if (hasSlot) availableDates.push(dateStr);
    }

    return NextResponse.json({ success: true, availableDates });
  } catch (error) {
    console.error("Month availability error:", error);
    return NextResponse.json({ success: false, error: "Interner Serverfehler." }, { status: 500 });
  }
}
