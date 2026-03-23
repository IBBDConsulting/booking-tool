import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const BOOKERS = [
  { name: "Nico Koßler", email: "nico@dealcode.ai", slug: "nico", referralCode: "nico" },
  { name: "Nells Koßler", email: "nells@dealcode.ai", slug: "nells", referralCode: "nells" },
  { name: "Alexander Stahl", email: "alexander@dealcode.ai", slug: "alexander", referralCode: "alexander" },
  { name: "Michael Kurz", email: "michael@dealcode.ai", slug: "michael", referralCode: "michael" },
  { name: "Dennis Fredrich", email: "dennis@dealcode.ai", slug: "dennis", referralCode: "dennis" },
  { name: "Florian Böttcher", email: "florian@dealcode.ai", slug: "florian", referralCode: "florian" },
];

export async function GET() {
  try {
    // Get the first org and member (admin)
    const org = await prisma.organization.findFirst();
    const member = await prisma.orgMember.findFirst();

    if (!org || !member) {
      return NextResponse.json({ success: false, error: "Keine Organisation gefunden." }, { status: 400 });
    }

    const results = [];

    for (const booker of BOOKERS) {
      // Create or find agent
      let agent = await prisma.agent.findUnique({ where: { referralCode: booker.referralCode } });
      if (!agent) {
        agent = await prisma.agent.create({
          data: {
            name: booker.name,
            email: booker.email,
            referralCode: booker.referralCode,
            isActive: true,
          },
        });
      }

      // Create booking pages for each booker (15 min + 45 min)
      const pages = [
        {
          slug: `${booker.slug}-erstgespraech`,
          title: `15 Min Erstgespräch - ${booker.name}`,
          duration: 15,
          calendarSubject: "Kurzes Kennenlernen - dealcode.ai / {company}",
          emailSubject: "Kurzes Kennenlernen - dealcode.ai / {company}",
          description: "Guten Tag,\nin diesem Gespräch lernen wir uns persönlich kennen, analysieren kurz Ihre aktuelle Vertriebssituation und schauen uns an, wie die KI-basierte Sales Automatisierung von Dealcode.ai Ihrem Salesteam helfen kann effizienter und schneller Leads zu generieren.\n\nIch freue mich auf unser Gespräch!",
        },
        {
          slug: `${booker.slug}-demo`,
          title: `45 Min Demo - ${booker.name}`,
          duration: 45,
          calendarSubject: "Kurze Demo - dealcode.ai / {company}",
          emailSubject: "Kurze Demo - dealcode.ai / {company}",
          description: "Produktdemo mit Screen-Sharing",
        },
      ];

      for (const page of pages) {
        const existing = await prisma.bookingPage.findUnique({ where: { slug: page.slug } });
        if (!existing) {
          await prisma.bookingPage.create({
            data: {
              orgId: org.id,
              memberId: member.id,
              title: page.title,
              slug: page.slug,
              duration: page.duration,
              calendarSubject: page.calendarSubject,
              emailSubject: page.emailSubject,
              description: page.description,
              formFields: [
                { key: "firstName", type: "text", label: "Vorname", required: true },
                { key: "lastName", type: "text", label: "Nachname", required: true },
                { key: "email", type: "email", label: "E-Mail", required: true },
                { key: "company", type: "text", label: "Firma", required: true },
                { key: "role", type: "text", label: "Rolle / Position", required: false },
              ],
            },
          });
        }
      }

      results.push({
        agent: booker.name,
        referralCode: booker.referralCode,
        links: [
          `/book/${booker.slug}-erstgespraech?agent=${booker.referralCode}`,
          `/book/${booker.slug}-demo?agent=${booker.referralCode}`,
        ],
      });
    }

    return NextResponse.json({ success: true, bookers: results });
  } catch (error) {
    console.error("Setup bookers error:", error);
    return NextResponse.json({ success: false, error: "Interner Serverfehler." }, { status: 500 });
  }
}
