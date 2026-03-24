import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: List booking pages (optionally filtered by memberId)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get("memberId");

    const bookingPages = await prisma.bookingPage.findMany({
      where: memberId ? { memberId } : undefined,
      orderBy: { duration: "asc" },
    });

    return NextResponse.json({ success: true, bookingPages });
  } catch (error) {
    console.error("Error fetching booking pages:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}

// POST: Create a new booking page
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, slug, duration, description, calendarSubject, emailSubject, formFields } = body;

    if (!title || !slug || !duration) {
      return NextResponse.json(
        { success: false, error: "Titel, Slug und Dauer sind erforderlich." },
        { status: 400 }
      );
    }

    // Get the first member and org (simplified — no auth yet)
    const member = await prisma.orgMember.findFirst();
    if (!member) {
      return NextResponse.json(
        { success: false, error: "Kein Mitglied gefunden." },
        { status: 404 }
      );
    }

    const bookingPage = await prisma.bookingPage.create({
      data: {
        orgId: member.orgId,
        memberId: member.id,
        title,
        slug,
        duration: Number(duration),
        description: description || null,
        calendarSubject: calendarSubject || null,
        emailSubject: emailSubject || null,
        formFields: formFields || undefined,
      },
    });

    return NextResponse.json({ success: true, bookingPage });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json(
        { success: false, error: "Dieser Slug ist bereits vergeben." },
        { status: 409 }
      );
    }
    console.error("Error creating booking page:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}

// PATCH: Update a booking page
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "ID ist erforderlich." },
        { status: 400 }
      );
    }

    // Only allow known fields to be updated
    const updateData: Record<string, any> = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.slug !== undefined) updateData.slug = body.slug;
    if (body.duration !== undefined) updateData.duration = Number(body.duration);
    if (body.description !== undefined) updateData.description = body.description || null;
    if (body.calendarSubject !== undefined) updateData.calendarSubject = body.calendarSubject || null;
    if (body.emailSubject !== undefined) updateData.emailSubject = body.emailSubject || null;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    if (body.formFields !== undefined) updateData.formFields = body.formFields ?? undefined;

    console.log("[PATCH booking-page] id:", id, "updateData keys:", Object.keys(updateData));

    const bookingPage = await prisma.bookingPage.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, bookingPage });
  } catch (error: any) {
    console.error("Error updating booking page:", error?.message || error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
