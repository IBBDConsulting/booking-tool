"use client";

import { useState, useEffect } from "react";

type BookingStatus = "SCHEDULED" | "RESCHEDULED" | "CANCELLED" | "ATTENDED" | "NO_SHOW";
type BookingStage = "BOOKED" | "FIRST_CALL" | "DEMO" | "DEAL" | "POSTPONED" | "NOT_QUALIFIED";
type BookingOutcome = "DEMO_SCHEDULED" | "FOLLOW_UP" | "NOT_QUALIFIED" | "CLOSED_WON" | "CLOSED_LOST";

interface Agent {
  id: string;
  name: string;
  referralCode: string;
}

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  company: string | null;
  role: string | null;
  agent: Agent | null;
}

interface BookingPage {
  id: string;
  title: string;
  slug: string;
  duration: number;
}

interface Booking {
  id: string;
  startTime: string;
  endTime: string;
  duration: number;
  status: BookingStatus;
  stage: BookingStage;
  outcome: BookingOutcome | null;
  lossReason: string | null;
  notes: string | null;
  memberId: string;
  member: { id: string; googleCalendarId: string | null } | null;
  lead: Lead;
  agent: Agent | null;
  bookingPage: BookingPage;
  createdAt: string;
}

const LOSS_REASONS = ["Zu teuer", "Falscher Zeitpunkt", "Nicht interessant", "No Show", "Sonstiges"];

const statusLabels: Record<BookingStatus, string> = {
  SCHEDULED: "Geplant",
  RESCHEDULED: "Verschoben",
  CANCELLED: "Storniert",
  ATTENDED: "Teilgenommen",
  NO_SHOW: "Nicht erschienen",
};

const statusColors: Record<BookingStatus, string> = {
  SCHEDULED: "bg-blue-100 text-blue-800",
  RESCHEDULED: "bg-yellow-100 text-yellow-800",
  CANCELLED: "bg-red-100 text-red-800",
  ATTENDED: "bg-green-100 text-green-800",
  NO_SHOW: "bg-gray-100 text-gray-800",
};

const stageLabels: Record<BookingStage, string> = {
  BOOKED: "Gebucht",
  FIRST_CALL: "1st Call",
  DEMO: "Demo",
  DEAL: "Deal",
  POSTPONED: "Verschoben",
  NOT_QUALIFIED: "Nicht qualifiziert",
};

const stageColors: Record<BookingStage, string> = {
  BOOKED: "bg-blue-100 text-blue-700",
  FIRST_CALL: "bg-indigo-100 text-indigo-700",
  DEMO: "bg-purple-100 text-purple-700",
  DEAL: "bg-green-100 text-green-700",
  POSTPONED: "bg-yellow-100 text-yellow-700",
  NOT_QUALIFIED: "bg-gray-100 text-gray-700",
};

const stageOrder: BookingStage[] = ["BOOKED", "FIRST_CALL", "DEMO", "DEAL", "POSTPONED", "NOT_QUALIFIED"];

function formatDateTime(startIso: string, duration: number): string {
  const start = new Date(startIso);
  const end = new Date(start.getTime() + duration * 60 * 1000);
  const hS = start.getHours().toString().padStart(2, "0");
  const mS = start.getMinutes().toString().padStart(2, "0");
  const hE = end.getHours().toString().padStart(2, "0");
  const mE = end.getMinutes().toString().padStart(2, "0");
  const days = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
  const months = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
  return `${hS}:${mS} - ${hE}:${mE}, ${days[start.getDay()]}, ${start.getDate()}. ${months[start.getMonth()]} ${start.getFullYear()}`;
}

interface Member {
  id: string;
  name: string | null;
  email: string;
  googleCalendarConnected: boolean;
}

const ADMIN_PASSWORD = "Salesbros2024!";

export default function DashboardPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<BookingStatus | "ALL">("ALL");
  const [agentFilter, setAgentFilter] = useState<string>("ALL");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [conversionMonth, setConversionMonth] = useState<string>("all");
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [notesText, setNotesText] = useState<string>("");
  const [timePeriod, setTimePeriod] = useState<"week" | "month" | "quarter" | "year" | "all">("all");
  const [editingLossId, setEditingLossId] = useState<string | null>(null);
  const [memberFilter, setMemberFilter] = useState<string>("ALL");
  const [authenticated, setAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("dashboard_auth");
    if (saved === ADMIN_PASSWORD) {
      setAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    if (authenticated) {
      fetchBookings();
      fetchMember();
    }
  }, [authenticated]);

  const handleLogin = () => {
    if (passwordInput === ADMIN_PASSWORD) {
      localStorage.setItem("dashboard_auth", passwordInput);
      setAuthenticated(true);
      setPasswordError(false);
    } else {
      setPasswordError(true);
    }
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-sm">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Dashboard Login</h1>
          <p className="text-sm text-gray-500 mb-6">Bitte Passwort eingeben</p>
          <input
            type="password"
            value={passwordInput}
            onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(false); }}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            placeholder="Passwort"
            className={`w-full px-3 py-2 border rounded-lg text-sm mb-3 ${passwordError ? "border-red-400" : "border-gray-300"}`}
            autoFocus
          />
          {passwordError && <p className="text-red-500 text-xs mb-3">Falsches Passwort</p>}
          <button onClick={handleLogin} className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            Anmelden
          </button>
        </div>
      </div>
    );
  }

  const fetchMember = async () => {
    try {
      const res = await fetch("/api/member");
      const data = await res.json();
      if (data.success) setMember(data.member);
    } catch (error) {
      console.error("Fehler beim Laden des Mitglieds:", error);
    }
  };

  const fetchBookings = async () => {
    try {
      const res = await fetch("/api/bookings");
      const data = await res.json();
      if (data.success) {
        setBookings(data.bookings);
      }
    } catch (error) {
      console.error("Fehler beim Laden:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateBooking = async (bookingId: string, updates: { status?: BookingStatus; stage?: BookingStage; outcome?: BookingOutcome; notes?: string; lossReason?: string }) => {
    setUpdatingId(bookingId);
    try {
      const res = await fetch("/api/bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, ...updates }),
      });
      const data = await res.json();
      if (data.success) {
        setBookings((prev) =>
          prev.map((b) => (b.id === bookingId ? { ...b, ...data.booking } : b))
        );
      }
    } catch (error) {
      console.error("Fehler beim Aktualisieren:", error);
    } finally {
      setUpdatingId(null);
    }
  };

  const deleteBooking = async (bookingId: string) => {
    if (!confirm("Meeting wirklich löschen?")) return;
    setUpdatingId(bookingId);
    try {
      const res = await fetch("/api/bookings", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId }),
      });
      const data = await res.json();
      if (data.success) {
        setBookings((prev) => prev.filter((b) => b.id !== bookingId));
      }
    } catch (error) {
      console.error("Fehler beim Löschen:", error);
    } finally {
      setUpdatingId(null);
    }
  };

  const saveNotes = async (bookingId: string) => {
    await updateBooking(bookingId, { notes: notesText });
    setEditingNotesId(null);
  };

  // Get unique members for filter
  const memberNames = Array.from(new Set(bookings.map((b) => b.member?.googleCalendarId).filter(Boolean))) as string[];
  const memberNameMap: Record<string, string> = {};
  bookings.forEach((b) => {
    if (b.member?.googleCalendarId) {
      const email = b.member.googleCalendarId;
      if (email === "df@dealcode.ai") memberNameMap[email] = "Dennis Fredrich";
      else if (email === "nk@dealcode.ai") memberNameMap[email] = "Nico Koßler";
      else memberNameMap[email] = email;
    }
  });

  const filteredBookings = bookings.filter((b) => {
    if (filter !== "ALL" && b.status !== filter) return false;
    if (agentFilter !== "ALL" && b.agent?.name !== agentFilter) return false;
    if (memberFilter !== "ALL" && b.member?.googleCalendarId !== memberFilter) return false;
    return true;
  });

  // Filter bookings by time period
  const getTimePeriodStart = (): Date | null => {
    const now = new Date();
    switch (timePeriod) {
      case "week": { const d = new Date(now); d.setDate(d.getDate() - 7); return d; }
      case "month": { const d = new Date(now); d.setMonth(d.getMonth() - 1); return d; }
      case "quarter": { const d = new Date(now); d.setMonth(d.getMonth() - 3); return d; }
      case "year": { const d = new Date(now); d.setFullYear(d.getFullYear() - 1); return d; }
      default: return null;
    }
  };
  const periodStart = getTimePeriodStart();
  const filteredByPeriod = periodStart
    ? bookings.filter((b) => new Date(b.createdAt) >= periodStart)
    : bookings;

  // KPI counts (based on time period)
  const totalBookings = filteredByPeriod.length;
  const attended = filteredByPeriod.filter((b) => b.status === "ATTENDED").length;
  const noShow = filteredByPeriod.filter((b) => b.status === "NO_SHOW").length;
  const scheduled = filteredByPeriod.filter((b) => b.status === "SCHEDULED").length;
  const cancelled = filteredByPeriod.filter((b) => b.status === "CANCELLED").length;

  // Conversion funnel
  const getFunnelData = (bookingList: Booking[]) => {
    const booked = bookingList.length;
    const firstCall = bookingList.filter((b) => ["FIRST_CALL", "DEMO", "DEAL"].includes(b.stage)).length;
    const demo = bookingList.filter((b) => ["DEMO", "DEAL"].includes(b.stage)).length;
    const deal = bookingList.filter((b) => b.stage === "DEAL").length;
    const notQualified = bookingList.filter((b) => b.stage === "NOT_QUALIFIED").length;
    const postponed = bookingList.filter((b) => b.stage === "POSTPONED").length;
    return { booked, firstCall, demo, deal, notQualified, postponed };
  };

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-500 mt-1">Übersicht aller Buchungen und Termine</p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/dashboard/settings"
              className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              Einstellungen
            </a>
          {member && (
            <div>
              {member.googleCalendarConnected ? (
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-50 text-green-700 text-sm font-medium border border-green-200">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  Google Calendar verbunden
                </span>
              ) : (
                <a
                  href={`/api/auth/google?memberId=${member.id}`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-gray-700 text-sm font-medium border border-gray-300 hover:bg-gray-50 transition shadow-sm"
                >
                  Google Calendar verbinden
                </a>
              )}
            </div>
          )}
          </div>
        </div>

        {/* Time Period Filter */}
        <div className="flex gap-2 mb-4">
          {([["week", "Woche"], ["month", "Monat"], ["quarter", "Quartal"], ["year", "Jahr"], ["all", "Gesamt"]] as const).map(([key, label]) => (
            <button key={key} onClick={() => setTimePeriod(key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${timePeriod === key ? "bg-blue-600 text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"}`}
            >{label}</button>
          ))}
        </div>

        {/* KPI Cards */}
        {(() => {
          const showUpRate = (attended + noShow) > 0 ? Math.round((attended / (attended + noShow)) * 100) : 0;
          const noShowRate = (attended + noShow) > 0 ? Math.round((noShow / (attended + noShow)) * 100) : 0;
          return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          {[
            { label: "Calls gebucht", value: totalBookings, color: "bg-blue-500" },
            { label: "Geplant", value: scheduled, color: "bg-indigo-500" },
            { label: "Teilgenommen", value: attended, color: "bg-green-500" },
            { label: "Storniert", value: cancelled, color: "bg-red-500" },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-white rounded-xl shadow-sm p-4">
              <div className={`w-2 h-2 rounded-full ${kpi.color} mb-2`} />
              <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
              <p className="text-sm text-gray-500">{kpi.label}</p>
            </div>
          ))}
        </div>
          );
        })()}

        {/* Show-Up & No-Show Stats */}
        {(() => {
          const decidedBookings = filteredByPeriod.filter((b) => b.status === "ATTENDED" || b.status === "NO_SHOW");
          const showUpRate = decidedBookings.length > 0 ? Math.round((attended / decidedBookings.length) * 100) : 0;
          const noShowRate = decidedBookings.length > 0 ? Math.round((noShow / decidedBookings.length) * 100) : 0;

          // No-Show by agent
          const noShowByAgent: Record<string, { total: number; noShow: number }> = {};
          filteredByPeriod.forEach((b) => {
            if (b.status !== "ATTENDED" && b.status !== "NO_SHOW") return;
            const name = b.agent?.name || "Kein Agent";
            if (!noShowByAgent[name]) noShowByAgent[name] = { total: 0, noShow: 0 };
            noShowByAgent[name].total++;
            if (b.status === "NO_SHOW") noShowByAgent[name].noShow++;
          });

          // Loss reasons breakdown
          const lossReasons: Record<string, number> = {};
          filteredByPeriod.forEach((b) => {
            if (b.lossReason) {
              lossReasons[b.lossReason] = (lossReasons[b.lossReason] || 0) + 1;
            }
          });
          const totalLoss = Object.values(lossReasons).reduce((a, b) => a + b, 0);

          return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* Show-Up Rate */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-500 mb-3">Show-Up Rate</h3>
            <div className="flex items-end gap-3">
              <span className={`text-3xl font-bold ${showUpRate >= 80 ? "text-green-600" : showUpRate >= 60 ? "text-yellow-600" : "text-red-600"}`}>{showUpRate}%</span>
              <span className="text-sm text-gray-400 mb-1">{attended} von {decidedBookings.length}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
              <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${showUpRate}%` }} />
            </div>
            {/* Show-Up by agent */}
            {Object.keys(noShowByAgent).length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                <p className="text-xs font-semibold text-gray-500">Pro Agent:</p>
                {Object.entries(noShowByAgent).sort((a, b) => ((b[1].total - b[1].noShow) / b[1].total) - ((a[1].total - a[1].noShow) / a[1].total)).map(([name, data]) => {
                  const showUp = data.total - data.noShow;
                  const rate = Math.round((showUp / data.total) * 100);
                  return (
                    <div key={name}>
                      <div className="flex items-center justify-between text-xs mb-0.5">
                        <span className="text-gray-600">{name}</span>
                        <span className={`font-semibold ${rate >= 80 ? "text-green-600" : rate >= 60 ? "text-yellow-600" : "text-red-600"}`}>
                          {showUp}/{data.total} ({rate}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1">
                        <div className="bg-green-400 h-1 rounded-full" style={{ width: `${rate}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* No-Show Rate */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-500 mb-3">No-Show Rate</h3>
            <div className="flex items-end gap-3">
              <span className={`text-3xl font-bold ${noShowRate <= 10 ? "text-green-600" : noShowRate <= 25 ? "text-yellow-600" : "text-red-600"}`}>{noShowRate}%</span>
              <span className="text-sm text-gray-400 mb-1">{noShow} von {decidedBookings.length}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
              <div className="bg-red-500 h-2 rounded-full transition-all" style={{ width: `${noShowRate}%` }} />
            </div>
            {/* No-Show by agent */}
            {Object.keys(noShowByAgent).length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                <p className="text-xs font-semibold text-gray-500">Pro Agent:</p>
                {Object.entries(noShowByAgent).sort((a, b) => (b[1].noShow / b[1].total) - (a[1].noShow / a[1].total)).map(([name, data]) => {
                  const rate = Math.round((data.noShow / data.total) * 100);
                  return (
                    <div key={name}>
                      <div className="flex items-center justify-between text-xs mb-0.5">
                        <span className="text-gray-600">{name}</span>
                        <span className={`font-semibold ${rate <= 10 ? "text-green-600" : rate <= 25 ? "text-yellow-600" : "text-red-600"}`}>
                          {data.noShow}/{data.total} ({rate}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1">
                        <div className="bg-red-400 h-1 rounded-full" style={{ width: `${rate}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Loss Reasons */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-500 mb-3">Ablehnungsgründe</h3>
            {totalLoss === 0 ? (
              <p className="text-sm text-gray-400">Keine Daten</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(lossReasons).sort((a, b) => b[1] - a[1]).map(([reason, count]) => {
                  const pct = Math.round((count / totalLoss) * 100);
                  return (
                    <div key={reason}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-gray-700 font-medium">{reason}</span>
                        <span className="text-gray-500">{count} ({pct}%)</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className="bg-red-400 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
          );
        })()}

        {/* Conversion Funnel */}
        {(() => {
          const months = Array.from(new Set(bookings.map((b) => {
            const d = new Date(b.createdAt);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          }))).sort().reverse();

          const monthNames: Record<string, string> = {};
          months.forEach((m) => {
            const [y, mo] = m.split("-");
            const names = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
            monthNames[m] = `${names[parseInt(mo) - 1]} ${y}`;
          });

          const filteredForConversion = conversionMonth === "all"
            ? bookings
            : bookings.filter((b) => {
                const d = new Date(b.createdAt);
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` === conversionMonth;
              });

          const funnel = getFunnelData(filteredForConversion);

          // Agent conversion table
          const agentMap = new Map<string, { name: string; booked: number; firstCall: number; demo: number; deal: number }>();
          filteredForConversion.forEach((b) => {
            const key = b.agent?.name || "__none__";
            const label = b.agent?.name || "Kein Agent";
            if (!agentMap.has(key)) agentMap.set(key, { name: label, booked: 0, firstCall: 0, demo: 0, deal: 0 });
            const entry = agentMap.get(key)!;
            entry.booked++;
            if (["FIRST_CALL", "DEMO", "DEAL"].includes(b.stage)) entry.firstCall++;
            if (["DEMO", "DEAL"].includes(b.stage)) entry.demo++;
            if (b.stage === "DEAL") entry.deal++;
          });
          const agents = Array.from(agentMap.values()).sort((a, b) => b.booked - a.booked);

          return (
            <div className="bg-white rounded-xl shadow-sm p-5 mb-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Conversion Funnel</h2>
                <select
                  value={conversionMonth}
                  onChange={(e) => setConversionMonth(e.target.value)}
                  className="px-3 py-1.5 rounded-lg text-sm border border-gray-200 bg-white text-gray-700"
                >
                  <option value="all">Alle Monate</option>
                  {months.map((m) => (
                    <option key={m} value={m}>{monthNames[m]}</option>
                  ))}
                </select>
              </div>

              {/* Funnel visualization */}
              <div className="grid grid-cols-5 gap-3 mb-8">
                {[
                  { label: "Gebucht", value: funnel.booked, color: "bg-blue-500", pct: 100 },
                  { label: "1st Call", value: funnel.firstCall, color: "bg-indigo-500", pct: funnel.booked > 0 ? Math.round((funnel.firstCall / funnel.booked) * 100) : 0 },
                  { label: "Demo", value: funnel.demo, color: "bg-purple-500", pct: funnel.booked > 0 ? Math.round((funnel.demo / funnel.booked) * 100) : 0 },
                  { label: "Verschoben", value: funnel.postponed, color: "bg-yellow-500", pct: funnel.booked > 0 ? Math.round((funnel.postponed / funnel.booked) * 100) : 0 },
                  { label: "Nicht qual.", value: funnel.notQualified, color: "bg-gray-400", pct: funnel.booked > 0 ? Math.round((funnel.notQualified / funnel.booked) * 100) : 0 },
                ].map((step, i) => (
                  <div key={step.label} className="text-center">
                    <div className="relative h-24 flex items-end justify-center mb-2">
                      <div
                        className={`w-full rounded-t-lg ${step.color} transition-all`}
                        style={{ height: `${Math.max(step.pct, 8)}%` }}
                      />
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{step.value}</p>
                    <p className="text-xs text-gray-500">{step.label}</p>
                    {i > 0 && i < 3 && (
                      <p className="text-xs font-semibold text-gray-400 mt-1">{step.pct}%</p>
                    )}
                  </div>
                ))}
              </div>

              {/* Wochentag-Analyse */}
              {filteredByPeriod.length > 0 && (() => {
                const dayNames = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
                const dayStats: { [key: number]: { booked: number; firstCall: number; demo: number; deal: number } } = {};
                for (let i = 0; i < 7; i++) dayStats[i] = { booked: 0, firstCall: 0, demo: 0, deal: 0 };

                filteredByPeriod.forEach((b) => {
                  const day = new Date(b.createdAt).getDay();
                  dayStats[day].booked++;
                  if (b.stage === "FIRST_CALL" || b.stage === "DEMO" || b.stage === "DEAL") dayStats[day].firstCall++;
                  if (b.stage === "DEMO" || b.stage === "DEAL") dayStats[day].demo++;
                  if (b.stage === "DEAL") dayStats[day].deal++;
                });

                const maxBooked = Math.max(...Object.values(dayStats).map(d => d.booked), 1);
                // Only show work days (Mon-Fri)
                const workDays = [1, 2, 3, 4, 5];

                return (
                  <>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Beste Tage für Cold Calling</h3>
                    <div className="grid grid-cols-5 gap-2 mb-6">
                      {workDays.map((d) => {
                        const stats = dayStats[d];
                        const pct = maxBooked > 0 ? Math.round((stats.booked / maxBooked) * 100) : 0;
                        const convRate = stats.booked > 0 ? Math.round((stats.firstCall / stats.booked) * 100) : 0;
                        const isBest = stats.booked === maxBooked && stats.booked > 0;
                        return (
                          <div key={d} className={`rounded-lg p-3 text-center ${isBest ? "bg-green-50 ring-2 ring-green-500" : "bg-gray-50"}`}>
                            <div className={`text-xs font-semibold mb-1 ${isBest ? "text-green-700" : "text-gray-500"}`}>
                              {dayNames[d].slice(0, 2)}
                              {isBest && " 🏆"}
                            </div>
                            <div className="text-lg font-bold text-gray-900">{stats.booked}</div>
                            <div className="text-[10px] text-gray-400 mb-2">Buchungen</div>
                            <div className="w-full bg-gray-200 rounded-full h-1.5 mb-1">
                              <div className={`h-1.5 rounded-full ${isBest ? "bg-green-500" : "bg-blue-400"}`} style={{ width: `${pct}%` }} />
                            </div>
                            <div className="text-[10px] text-gray-500">
                              Conv: <span className={`font-semibold ${convRate >= 70 ? "text-green-600" : convRate >= 40 ? "text-yellow-600" : "text-red-600"}`}>{convRate}%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}

              {/* Agent conversion table */}
              {agents.length > 0 && (
                <>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Conversion pro Agent</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 text-left text-gray-500">
                          <th className="pb-3 font-medium">Agent</th>
                          <th className="pb-3 font-medium text-center">Gebucht</th>
                          <th className="pb-3 font-medium text-center">1st Call</th>
                          <th className="pb-3 font-medium text-center">Demo</th>
                          <th className="pb-3 font-medium text-center">Deal</th>
                          <th className="pb-3 font-medium text-center">Gebucht → 1st Call</th>
                          <th className="pb-3 font-medium text-center">1st Call → Demo</th>
                          <th className="pb-3 font-medium text-center">Demo → Deal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {agents.map((a) => {
                          const pctFirstCall = a.booked > 0 ? Math.round((a.firstCall / a.booked) * 100) : 0;
                          const pctDemo = a.firstCall > 0 ? Math.round((a.demo / a.firstCall) * 100) : 0;
                          const pctDeal = a.demo > 0 ? Math.round((a.deal / a.demo) * 100) : 0;
                          return (
                            <tr key={a.name} className="border-b border-gray-50">
                              <td className="py-3 font-medium text-gray-900">{a.name}</td>
                              <td className="py-3 text-center">
                                <button onClick={() => setAgentFilter(a.name)} className="text-blue-600 hover:underline font-medium">{a.booked}</button>
                              </td>
                              <td className="py-3 text-center text-gray-700">{a.firstCall}</td>
                              <td className="py-3 text-center text-gray-700">{a.demo}</td>
                              <td className="py-3 text-center text-gray-700">{a.deal}</td>
                              <td className="py-3 text-center">
                                <span className={`font-semibold ${pctFirstCall >= 70 ? "text-green-600" : pctFirstCall >= 40 ? "text-yellow-600" : "text-red-600"}`}>
                                  {pctFirstCall}%
                                </span>
                              </td>
                              <td className="py-3 text-center">
                                <span className={`font-semibold ${pctDemo >= 70 ? "text-green-600" : pctDemo >= 40 ? "text-yellow-600" : "text-red-600"}`}>
                                  {pctDemo}%
                                </span>
                              </td>
                              <td className="py-3 text-center">
                                <span className={`font-semibold ${pctDeal >= 70 ? "text-green-600" : pctDeal >= 40 ? "text-yellow-600" : "text-red-600"}`}>
                                  {pctDeal}%
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          );
        })()}

        {/* Filter */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilter("ALL")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                filter === "ALL"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Alle ({totalBookings})
            </button>
            {(Object.keys(statusLabels) as BookingStatus[]).map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  filter === s
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {statusLabels[s]} ({bookings.filter((b) => b.status === s).length})
              </button>
            ))}
          </div>
          {/* Member Filter */}
          {memberNames.length > 1 && (
            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
              <span className="text-xs text-gray-400 self-center mr-1">Kalender:</span>
              <button
                onClick={() => setMemberFilter("ALL")}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  memberFilter === "ALL" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                Alle
              </button>
              {memberNames.map((email) => (
                <button
                  key={email}
                  onClick={() => setMemberFilter(email)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    memberFilter === email ? "bg-purple-600 text-white" : "bg-purple-50 text-purple-700 hover:bg-purple-100"
                  }`}
                >
                  {memberNameMap[email] || email} ({bookings.filter((b) => b.member?.googleCalendarId === email).length})
                </button>
              ))}
            </div>
          )}
          {/* Agent Filter */}
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
            <span className="text-xs text-gray-400 self-center mr-1">Agent:</span>
            <button
              onClick={() => setAgentFilter("ALL")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                agentFilter === "ALL" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Alle
            </button>
            {Array.from(new Set(bookings.map((b) => b.agent?.name).filter(Boolean))).map((name) => (
              <button
                key={name}
                onClick={() => setAgentFilter(name!)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  agentFilter === name ? "bg-orange-500 text-white" : "bg-orange-50 text-orange-700 hover:bg-orange-100"
                }`}
              >
                {name} ({bookings.filter((b) => b.agent?.name === name).length})
              </button>
            ))}
          </div>
        </div>

        {/* Bookings List - grouped by date */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-400">Laden...</div>
          ) : filteredBookings.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              {bookings.length === 0
                ? "Noch keine Buchungen vorhanden."
                : "Keine Buchungen mit diesem Filter."}
            </div>
          ) : (() => {
            // Group by date
            const grouped: Record<string, typeof filteredBookings> = {};
            filteredBookings.forEach((b) => {
              const d = new Date(b.startTime);
              const key = d.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
              if (!grouped[key]) grouped[key] = [];
              grouped[key].push(b);
            });
            return (
            <div>
              {Object.entries(grouped).map(([dateLabel, dateBookings]) => (
                <div key={dateLabel}>
                  <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
                    <h3 className="text-sm font-bold text-gray-700">{dateLabel}</h3>
                  </div>
                  <div className="divide-y divide-gray-100">
              {dateBookings.map((booking) => (
                <div key={booking.id} className="p-5 hover:bg-gray-50/50 transition">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    {/* Left: Lead Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold text-gray-900">
                          {booking.lead.firstName} {booking.lead.lastName}
                          {booking.lead.company && (
                            <span className="text-blue-600 ml-1">– {booking.lead.company}</span>
                          )}
                        </h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[booking.status]}`}>
                          {statusLabels[booking.status]}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${stageColors[booking.stage || "BOOKED"]}`}>
                          {stageLabels[booking.stage || "BOOKED"]}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">
                        {booking.lead.email}
                        {booking.lead.company && ` · ${booking.lead.company}`}
                        {booking.lead.role && ` · ${booking.lead.role}`}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        {formatDateTime(booking.startTime, booking.duration)}
                        <span className="text-gray-400 ml-2">· {booking.bookingPage?.title || `${booking.duration} Min`}</span>
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Gebucht am {new Date(booking.createdAt).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })} Uhr
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {booking.agent && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                            Agent: {booking.agent.name}
                          </span>
                        )}
                        {booking.member?.googleCalendarId && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            Kalender: {memberNameMap[booking.member.googleCalendarId] || booking.member.googleCalendarId}
                          </span>
                        )}
                      </div>

                      {/* Notes */}
                      <div className="mt-2">
                        {editingNotesId === booking.id ? (
                          <div className="flex gap-2 items-start">
                            <textarea
                              value={notesText}
                              onChange={(e) => setNotesText(e.target.value)}
                              className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 min-h-[60px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Notiz hinzufügen..."
                            />
                            <div className="flex flex-col gap-1">
                              <button
                                onClick={() => saveNotes(booking.id)}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700"
                              >
                                Speichern
                              </button>
                              <button
                                onClick={() => setEditingNotesId(null)}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200"
                              >
                                Abbrechen
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingNotesId(booking.id);
                              setNotesText(booking.notes || "");
                            }}
                            className="text-xs text-gray-400 hover:text-gray-600 transition"
                          >
                            {booking.notes ? (
                              <span className="text-gray-600">📝 {booking.notes}</span>
                            ) : (
                              <span>+ Notiz hinzufügen</span>
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Right: Stage Pipeline + Actions */}
                    <div className="flex flex-col gap-3 items-end">
                      {/* Stage Pipeline */}
                      <div className="flex items-center gap-1">
                        {stageOrder.map((s, i) => {
                          const currentIndex = stageOrder.indexOf(booking.stage || "BOOKED");
                          const isActive = s === (booking.stage || "BOOKED");
                          const isPassed = i <= currentIndex && s !== "POSTPONED" && s !== "NOT_QUALIFIED" && (booking.stage !== "POSTPONED" && booking.stage !== "NOT_QUALIFIED");
                          return (
                            <button
                              key={s}
                              onClick={() => {
                                if (s === "NOT_QUALIFIED") {
                                  setEditingLossId(editingLossId === booking.id ? null : booking.id);
                                }
                                updateBooking(booking.id, { stage: s });
                              }}
                              disabled={updatingId === booking.id}
                              title={stageLabels[s]}
                              className={`px-2.5 py-1 rounded text-xs font-medium transition border ${
                                isActive
                                  ? s === "NOT_QUALIFIED" ? "bg-red-600 text-white border-red-600"
                                  : s === "POSTPONED" ? "bg-yellow-500 text-white border-yellow-500"
                                  : "bg-blue-600 text-white border-blue-600"
                                  : isPassed
                                  ? "bg-blue-100 text-blue-700 border-blue-200"
                                  : "bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100"
                              } disabled:opacity-50`}
                            >
                              {stageLabels[s]}
                            </button>
                          );
                        })}
                      </div>
                      {/* Loss Reason Dropdown */}
                      {(booking.stage === "NOT_QUALIFIED" || booking.status === "NO_SHOW") && (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500">Grund:</span>
                          <select
                            value={booking.lossReason || ""}
                            onChange={(e) => updateBooking(booking.id, { lossReason: e.target.value })}
                            className="text-xs border border-gray-200 rounded px-2 py-1 bg-white"
                          >
                            <option value="">Grund wählen...</option>
                            {LOSS_REASONS.map((r) => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                          {booking.lossReason && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">{booking.lossReason}</span>
                          )}
                        </div>
                      )}

                      {/* Status Actions */}
                      <div className="flex flex-wrap gap-2">
                        {booking.status === "SCHEDULED" && (
                          <>
                            <button
                              onClick={() => updateBooking(booking.id, { status: "ATTENDED" })}
                              disabled={updatingId === booking.id}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 transition disabled:opacity-50"
                            >
                              Teilgenommen
                            </button>
                            <button
                              onClick={() => updateBooking(booking.id, { status: "NO_SHOW" })}
                              disabled={updatingId === booking.id}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200 transition disabled:opacity-50"
                            >
                              No Show
                            </button>
                            <button
                              onClick={() => updateBooking(booking.id, { status: "CANCELLED" })}
                              disabled={updatingId === booking.id}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 transition disabled:opacity-50"
                            >
                              Stornieren
                            </button>
                          </>
                        )}
                        {(booking.status === "ATTENDED" || booking.status === "NO_SHOW" || booking.status === "CANCELLED") && (
                          <button
                            onClick={() => updateBooking(booking.id, { status: "SCHEDULED" })}
                            disabled={updatingId === booking.id}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border border-yellow-200 transition disabled:opacity-50"
                          >
                            ↩ Zurücksetzen
                          </button>
                        )}
                        <button
                          onClick={() => deleteBooking(booking.id)}
                          disabled={updatingId === booking.id}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition disabled:opacity-50"
                        >
                          🗑 Löschen
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
                  </div>
                </div>
              ))}
            </div>
            );
          })()}
        </div>
      </div>
    </main>
  );
}
