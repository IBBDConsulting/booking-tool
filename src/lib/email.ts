import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

interface EmailBooking {
  id: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  timezone: string;
  cancelToken: string;
}

interface EmailLead {
  firstName: string;
  lastName: string;
  email: string;
  company?: string | null;
  role?: string | null;
}

function formatDateTimeDE(date: Date, timezone: string): string {
  return date.toLocaleString("de-DE", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  });
}

export async function sendBookingConfirmation(
  booking: EmailBooking,
  lead: EmailLead,
  meetLink?: string | null,
  emailSubject?: string | null
): Promise<boolean> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const dateFormatted = formatDateTimeDE(booking.startTime, booking.timezone);

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 16px;">
      <div style="background: #f0fdf4; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
        <div style="font-size: 36px; margin-bottom: 8px;">&#10003;</div>
        <h1 style="font-size: 20px; color: #166534; margin: 0;">Termin bestätigt</h1>
      </div>

      <p style="color: #374151; font-size: 15px; line-height: 1.6;">
        Hallo ${lead.firstName},<br><br>
        dein Termin wurde erfolgreich gebucht.
      </p>

      <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Termindetails</p>
        <p style="margin: 0 0 4px; color: #111827; font-size: 15px; font-weight: 600;">${dateFormatted} Uhr</p>
        <p style="margin: 0; color: #6b7280; font-size: 14px;">Dauer: ${booking.duration} Minuten</p>
        ${meetLink ? `<p style="margin: 8px 0 0; font-size: 14px;"><a href="${meetLink}" style="color: #2563eb; text-decoration: none;">Google Meet beitreten</a></p>` : ""}
      </div>

      <p style="color: #9ca3af; font-size: 12px; margin-top: 32px; text-align: center;">
        Du möchtest den Termin absagen? <a href="${appUrl}/cancel/${booking.cancelToken}" style="color: #6b7280;">Hier stornieren</a>
      </p>

      <div style="border-top: 1px solid #e5e7eb; margin-top: 32px; padding-top: 24px;">
        <p style="margin: 0; color: #374151; font-size: 14px;">Schöne Grüße,<br>Dennis Fredrich</p>
        <p style="margin: 8px 0 0; color: #6b7280; font-size: 13px;">+++</p>
        <p style="margin: 8px 0 0; color: #111827; font-size: 13px; font-weight: 600;">Dennis Fredrich <span style="font-weight: 400; color: #6b7280;">| Chief Revenue Officer</span></p>
        <p style="margin: 4px 0 0; font-size: 13px;">
          <a href="mailto:df@dealcode.ai" style="color: #2563eb; text-decoration: none;">df@dealcode.ai</a>
          <span style="color: #9ca3af;"> | </span>
          <a href="tel:+494080813422" style="color: #2563eb; text-decoration: none;">+49 40 80813422</a>
          <span style="color: #9ca3af;"> | </span>
          <a href="tel:+491628744818" style="color: #2563eb; text-decoration: none;">+49 162 8744818</a>
        </p>
        <p style="margin: 8px 0 0; color: #6b7280; font-size: 12px;">
          Dealcode GmbH<br>
          c/o SPACE Hamburg | Am Sandtorkai 27 | 20457 Hamburg | Germany
        </p>
        <p style="margin: 8px 0 0; font-size: 12px;">
          <strong style="color: #111827;">Success in B2B Sales with AI Agents</strong><br>
          <span style="color: #6b7280;">- learn more at </span><a href="https://dealcode.ai" style="color: #2563eb; text-decoration: none;">dealcode.ai</a>
        </p>
        <p style="margin: 8px 0 0; color: #9ca3af; font-size: 11px;">
          Managing Directors: Alexander Weltzsch, Dennis Hilger<br>
          Handelsregister: HRB 168195 | Registergericht: Amtsgericht Hamburg | Deutschland
        </p>
      </div>
    </div>
  `;

  try {
    let subject = `Dein Termin am ${dateFormatted}`;
    if (emailSubject) {
      subject = emailSubject
        .replace(/\{name\}/g, `${lead.firstName} ${lead.lastName}`)
        .replace(/\{date\}/g, dateFormatted)
        .replace(/\{company\}/g, lead.company || "");
    }

    await resend.emails.send({
      from: "Terminbuchung <onboarding@resend.dev>",
      to: lead.email,
      subject,
      html,
    });
    return true;
  } catch (error) {
    console.error("E-Mail senden fehlgeschlagen:", error);
    return false;
  }
}

export async function sendBookingReminder(
  booking: EmailBooking,
  lead: EmailLead,
  meetLink?: string | null
): Promise<boolean> {
  const dateFormatted = formatDateTimeDE(booking.startTime, booking.timezone);

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 16px;">
      <p style="color: #374151; font-size: 15px; line-height: 1.8;">
        Guten Tag,<br><br>
        ich wollte Ihnen nur kurz unseren Termin in 30 Minuten bestätigen. Ich freue mich auf unser Gespräch!
      </p>

      ${meetLink ? `
        <div style="margin: 24px 0;">
          <a href="${meetLink}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600;">Google Meet beitreten</a>
        </div>
      ` : ""}

      <div style="border-top: 1px solid #e5e7eb; margin-top: 32px; padding-top: 24px;">
        <p style="margin: 0; color: #374151; font-size: 14px;">Schöne Grüße,<br>Dennis Fredrich</p>
        <p style="margin: 8px 0 0; color: #6b7280; font-size: 13px;">+++</p>
        <p style="margin: 8px 0 0; color: #111827; font-size: 13px; font-weight: 600;">Dennis Fredrich <span style="font-weight: 400; color: #6b7280;">| Chief Revenue Officer</span></p>
        <p style="margin: 4px 0 0; font-size: 13px;">
          <a href="mailto:df@dealcode.ai" style="color: #2563eb; text-decoration: none;">df@dealcode.ai</a>
          <span style="color: #9ca3af;"> | </span>
          <a href="tel:+494080813422" style="color: #2563eb; text-decoration: none;">+49 40 80813422</a>
        </p>
        <p style="margin: 8px 0 0; color: #6b7280; font-size: 12px;">
          Dealcode GmbH | c/o SPACE Hamburg | Am Sandtorkai 27 | 20457 Hamburg
        </p>
        <p style="margin: 12px 0 0;">
          <strong style="color: #111827;">Success in B2B Sales with AI Agents</strong><br>
          <span style="color: #6b7280;">- learn more at </span><a href="https://dealcode.ai" style="color: #2563eb; text-decoration: none;">dealcode.ai</a>
        </p>
        <p style="margin: 8px 0 0; color: #9ca3af; font-size: 11px;">
          Managing Directors: Alexander Weltzsch, Dennis Hilger<br>
          Handelsregister: HRB 168195 | Registergericht: Amtsgericht Hamburg | Deutschland
        </p>
      </div>
    </div>
  `;

  try {
    await resend.emails.send({
      from: "Terminbuchung <onboarding@resend.dev>",
      to: lead.email,
      subject: `Erinnerung: Dein Termin startet in 30 Minuten`,
      html,
    });
    return true;
  } catch (error) {
    console.error("Reminder-E-Mail fehlgeschlagen:", error);
    return false;
  }
}

export async function sendInternalNotification(
  memberEmail: string,
  memberName: string,
  booking: EmailBooking,
  lead: EmailLead,
  agentName?: string | null,
  meetLink?: string | null,
  internalNotes?: string | null
): Promise<boolean> {
  const dateFormatted = formatDateTimeDE(booking.startTime, booking.timezone);

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 16px;">
      <div style="background: #f0fdf4; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
        <div style="font-size: 36px; margin-bottom: 8px;">🎯</div>
        <h1 style="font-size: 20px; color: #166534; margin: 0;">Neuer Termin gebucht!</h1>
      </div>

      <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <p style="margin: 0 0 8px; font-size: 15px;"><strong>${lead.firstName} ${lead.lastName}</strong></p>
        <p style="margin: 0 0 4px; color: #6b7280; font-size: 14px;">📧 ${lead.email}</p>
        ${lead.company ? `<p style="margin: 0 0 4px; color: #6b7280; font-size: 14px;">🏢 ${lead.company}</p>` : ""}
        ${lead.role ? `<p style="margin: 0 0 4px; color: #6b7280; font-size: 14px;">👤 ${lead.role}</p>` : ""}
      </div>

      <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <p style="margin: 0 0 4px; color: #111827; font-size: 15px; font-weight: 600;">📅 ${dateFormatted} Uhr</p>
        <p style="margin: 0 0 4px; color: #6b7280; font-size: 14px;">Dauer: ${booking.duration} Minuten</p>
        ${agentName ? `<p style="margin: 0 0 4px; color: #6b7280; font-size: 14px;">🔗 Gebucht von: <strong>${agentName}</strong></p>` : ""}
        ${meetLink ? `<p style="margin: 8px 0 0;"><a href="${meetLink}" style="color: #2563eb; text-decoration: none; font-size: 14px;">Google Meet beitreten →</a></p>` : ""}
      </div>

      ${internalNotes ? `
        <div style="background: #fefce8; border-radius: 8px; padding: 16px; margin: 20px 0; border-left: 3px solid #eab308;">
          <p style="margin: 0 0 4px; font-size: 13px; font-weight: 600; color: #854d0e;">📝 Interne Notizen:</p>
          <p style="margin: 0; color: #713f12; font-size: 14px;">${internalNotes}</p>
        </div>
      ` : ""}
    </div>
  `;

  try {
    await resend.emails.send({
      from: "Terminbuchung <onboarding@resend.dev>",
      to: memberEmail,
      subject: `Neuer Termin: ${lead.firstName} ${lead.lastName}${lead.company ? ` (${lead.company})` : ""} – ${dateFormatted}`,
      html,
    });
    return true;
  } catch (error) {
    console.error("Interne Benachrichtigung fehlgeschlagen:", error);
    return false;
  }
}
