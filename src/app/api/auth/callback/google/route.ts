import { NextResponse } from "next/server";
import { google } from "googleapis";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const memberId = searchParams.get("state");

  if (!code || !memberId) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?error=missing_params`
    );
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    console.log("[Google OAuth] Exchanging code for tokens, memberId:", memberId);
    const { tokens } = await oauth2Client.getToken(code);
    console.log("[Google OAuth] Got tokens, has access_token:", !!tokens.access_token, "has refresh_token:", !!tokens.refresh_token);
    oauth2Client.setCredentials(tokens);

    // Try to get the primary calendar ID, fall back to "primary"
    let calendarId = "primary";
    try {
      const calendar = google.calendar({ version: "v3", auth: oauth2Client });
      const calendarList = await calendar.calendarList.list();
      const primaryCalendar = calendarList.data.items?.find(
        (cal) => cal.primary
      );
      if (primaryCalendar?.id) {
        calendarId = primaryCalendar.id;
      }
      console.log("[Google OAuth] Primary calendar:", calendarId);
    } catch (calError) {
      console.log("[Google OAuth] Could not fetch calendar list, using 'primary'");
    }

    // Save tokens and calendar ID to the member
    const updated = await prisma.orgMember.update({
      where: { id: memberId },
      data: {
        googleAccessToken: tokens.access_token || null,
        googleRefreshToken: tokens.refresh_token || null,
        googleCalendarId: calendarId,
      },
    });
    console.log("[Google OAuth] Saved tokens for member:", updated.id);

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?calendar=connected`
    );
  } catch (error) {
    console.error("[Google OAuth] ERROR:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?error=oauth_failed`
    );
  }
}
