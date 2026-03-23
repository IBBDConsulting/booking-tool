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
  notes: string | null;
  lead: Lead;
  agent: Agent | null;
  bookingPage: BookingPage;
  createdAt: string;
}

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
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [conversionMonth, setConversionMonth] = useState<string>("all");
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [notesText, setNotesText] = useState<string>("");
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

  const updateBooking = async (bookingId: string, updates: { status?: BookingStatus; stage?: BookingStage; outcome?: BookingOutcome; notes?: string }) => {
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

  const filteredBookings =
    filter === "ALL" ? bookings : bookings.filter((b) => b.status === filter);

  // KPI counts
  const totalBookings = bookings.length;
  const attended = bookings.filter((b) => b.status === "ATTENDED").length;
  const noShow = bookings.filter((b) => b.status === "NO_SHOW").length;
  const scheduled = bookings.filter((b) => b.status === "SCHEDULED").length;
  const cancelled = bookings.filter((b) => b.status === "CANCELLED").length;

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

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {[
            { label: "Gesamt", value: totalBookings, color: "bg-blue-500" },
            { label: "Geplant", value: scheduled, color: "bg-indigo-500" },
            { label: "Teilgenommen", value: attended, color: "bg-green-500" },
            { label: "Nicht erschienen", value: noShow, color: "bg-gray-500" },
            { label: "Storniert", value: cancelled, color: "bg-red-500" },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-white rounded-xl shadow-sm p-4">
              <div className={`w-2 h-2 rounded-full ${kpi.color} mb-2`} />
              <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
              <p className="text-sm text-gray-500">{kpi.label}</p>
            </div>
          ))}
        </div>

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
                              <td className="py-3 text-center text-gray-700">{a.booked}</td>
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
        </div>

        {/* Bookings List */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-400">Laden...</div>
          ) : filteredBookings.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              {bookings.length === 0
                ? "Noch keine Buchungen vorhanden."
                : "Keine Buchungen mit diesem Filter."}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredBookings.map((booking) => (
                <div key={booking.id} className="p-5 hover:bg-gray-50/50 transition">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    {/* Left: Lead Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold text-gray-900">
                          {booking.lead.firstName} {booking.lead.lastName}
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
                      {booking.agent && (
                        <span className="mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                          Agent: {booking.agent.name}
                        </span>
                      )}

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
                              onClick={() => updateBooking(booking.id, { stage: s })}
                              disabled={updatingId === booking.id}
                              title={stageLabels[s]}
                              className={`px-2.5 py-1 rounded text-xs font-medium transition border ${
                                isActive
                                  ? "bg-blue-600 text-white border-blue-600"
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
          )}
        </div>
      </div>
    </main>
  );
}
