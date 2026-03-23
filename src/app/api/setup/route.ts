import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/setup — Erstellt die nötigen Grunddaten (Organization, User, OrgMember, BookingPage)
// Rufe diese URL einmal im Browser auf: http://localhost:3000/api/setup
export async function GET() {
  try {
    // Check if already set up
    const existingOrg = await prisma.organization.findFirst();
    if (existingOrg) {
      const bookingPage = await prisma.bookingPage.findFirst();
      return NextResponse.json({
        success: true,
        message: "Setup wurde bereits durchgeführt.",
        bookingUrl: bookingPage ? `/book/${bookingPage.slug}` : null,
        dashboardUrl: "/dashboard",
      });
    }

    // 1. Create Organization
    const org = await prisma.organization.create({
      data: {
        name: "Meine Firma",
        slug: "meine-firma",
        timezone: "Europe/Berlin",
      },
    });

    // 2. Create User
    const user = await prisma.user.create({
      data: {
        email: "hello@berlors.com",
        name: "Dennis",
      },
    });

    // 3. Create OrgMember
    const member = await prisma.orgMember.create({
      data: {
        orgId: org.id,
        userId: user.id,
        role: "OWNER",
        workingHoursStart: "09:00",
        workingHoursEnd: "17:00",
        workingDays: [1, 2, 3, 4, 5],
        bufferMinutes: 15,
        defaultDuration: 30,
      },
    });

    // 4. Create BookingPages
    const bookingPage = await prisma.bookingPage.create({
      data: {
        orgId: org.id,
        memberId: member.id,
        title: "45 Min Demo",
        slug: "demo",
        duration: 45,
        isActive: true,
        description: "Produktdemo mit Screen-Sharing",
      },
    });

    await prisma.bookingPage.create({
      data: {
        orgId: org.id,
        memberId: member.id,
        title: "15 Min Erstgespräch",
        slug: "erstgespraech",
        duration: 15,
        isActive: true,
        description: "Kurzes Kennenlernen und Bedarfsanalyse",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Setup erfolgreich! Deine Buchungsseite ist bereit.",
      bookingUrl: `/book/${bookingPage.slug}`,
      dashboardUrl: "/dashboard",
      data: {
        organization: org.name,
        user: user.name,
        bookingPageSlug: bookingPage.slug,
      },
    });
  } catch (error) {
    console.error("Setup error:", error);
    return NextResponse.json(
      { success: false, error: "Fehler beim Setup: " + String(error) },
      { status: 500 }
    );
  }
}
