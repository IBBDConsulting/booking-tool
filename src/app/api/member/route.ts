import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: Return current member info (simplified: returns first member)
export async function GET() {
  try {
    const member = await prisma.orgMember.findFirst({
      include: { user: true },
    });

    if (!member) {
      return NextResponse.json(
        { success: false, error: "Kein Mitglied gefunden." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      member: {
        id: member.id,
        name: member.user.name,
        email: member.user.email,
        googleCalendarConnected: !!member.googleAccessToken,
        workingHoursStart: member.workingHoursStart,
        workingHoursEnd: member.workingHoursEnd,
        bufferMinutes: member.bufferMinutes,
        workingDays: member.workingDays,
        breaks: member.breaks,
        additionalCalendars: member.additionalCalendars,
      },
    });
  } catch (error) {
    console.error("Error fetching member:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}

// PATCH: Update member settings
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const member = await prisma.orgMember.findFirst();

    if (!member) {
      return NextResponse.json(
        { success: false, error: "Kein Mitglied gefunden." },
        { status: 404 }
      );
    }

    const updateData: Record<string, any> = {};
    if (body.workingHoursStart) updateData.workingHoursStart = body.workingHoursStart;
    if (body.workingHoursEnd) updateData.workingHoursEnd = body.workingHoursEnd;
    if (body.bufferMinutes !== undefined) updateData.bufferMinutes = Number(body.bufferMinutes);
    if (body.workingDays !== undefined) updateData.workingDays = body.workingDays;
    if (body.breaks !== undefined) updateData.breaks = body.breaks === null ? null : JSON.parse(JSON.stringify(body.breaks));
    if (body.additionalCalendars !== undefined) updateData.additionalCalendars = body.additionalCalendars;

    await prisma.orgMember.update({
      where: { id: member.id },
      data: updateData,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error updating member:", error?.message || error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
