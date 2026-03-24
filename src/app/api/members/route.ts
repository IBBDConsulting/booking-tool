import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const members = await prisma.orgMember.findMany({
      include: { user: true },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      success: true,
      members: members.map((m) => ({
        id: m.id,
        name: m.user.name || m.user.email,
        email: m.user.email,
        googleCalendarConnected: !!m.googleAccessToken,
      })),
    });
  } catch (error) {
    console.error("Error fetching members:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
