"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";

type Step = "select" | "qualify" | "calendar" | "confirmed";

interface FormField {
  key: string;
  label: string;
  type: string;
  required: boolean;
}

interface BookingPageType {
  id: string;
  title: string;
  slug: string;
  duration: number;
  description: string | null;
  isActive: boolean;
  formFields: FormField[] | null;
}

const defaultFormFields: FormField[] = [
  { key: "firstName", label: "Vorname", type: "text", required: true },
  { key: "lastName", label: "Nachname", type: "text", required: true },
  { key: "email", label: "E-Mail", type: "email", required: true },
  { key: "company", label: "Firma", type: "text", required: false },
  { key: "role", label: "Rolle / Position", type: "text", required: false },
];

function getAvailableDates(workingDays: number[] = [1,2,3,4,5]): Date[] {
  const dates: Date[] = [];
  const today = new Date();
  // Start from tomorrow (i=1), today is always blocked
  for (let i = 1; i <= 30 && dates.length < 14; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const day = date.getDay();
    if (workingDays.includes(day)) dates.push(date);
  }
  return dates;
}

function getTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = 9; h < 17; h++) {
    slots.push(`${h.toString().padStart(2, "0")}:00`);
    slots.push(`${h.toString().padStart(2, "0")}:30`);
  }
  return slots;
}

function formatDateLong(date: Date): string {
  const days = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
  const months = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
  return `${days[date.getDay()]}, ${date.getDate()}. ${months[date.getMonth()]}`;
}

function getMonthYear(date: Date): string {
  const months = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

function getCalendarDays(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
  const days: (Date | null)[] = [];
  for (let i = 0; i < startDay; i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));
  return days;
}

export default function BookingPage({ params }: { params: { slug: string } }) {
  const searchParams = useSearchParams();
  const agentCode = searchParams.get("agent");
  const [step, setStep] = useState<Step>("select");
  const [bookingPages, setBookingPages] = useState<BookingPageType[]>([]);
  const [selectedPage, setSelectedPage] = useState<BookingPageType | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [workingDays, setWorkingDays] = useState<number[]>([1,2,3,4,5]);

  const availableDates = getAvailableDates(workingDays);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const formFields = selectedPage?.formFields || defaultFormFields;

  useEffect(() => {
    // Load working days from member settings
    fetch("/api/member").then(r => r.json()).then(d => {
      if (d.success && d.member.workingDays) setWorkingDays(d.member.workingDays);
    }).catch(() => {});

    fetch("/api/booking-pages")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          const active = data.bookingPages.filter((p: BookingPageType) => p.isActive);
          setBookingPages(active);
          if (active.length === 1) {
            setSelectedPage(active[0]);
            setStep("calendar");
          }
        }
      })
      .catch(console.error);
  }, []);

  const fetchAvailability = useCallback(async (date: Date) => {
    if (!selectedPage) return;
    setLoadingSlots(true);
    setAvailableSlots([]); // Clear old slots while loading
    try {
      // Use local date parts to avoid UTC date shift
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      const res = await fetch(`/api/availability?slug=${selectedPage.slug}&date=${dateStr}`);
      const data = await res.json();
      setAvailableSlots(data.success ? data.slots : []);
    } catch {
      setAvailableSlots([]); // Show no slots on error, not all slots
    } finally {
      setLoadingSlots(false);
    }
  }, [selectedPage]);

  const handleBooking = async () => {
    if (!selectedDate || !selectedTime || !selectedPage) return;
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: formData.firstName || "",
          lastName: formData.lastName || "",
          email: formData.email || "",
          company: formData.company || "",
          companySize: formData.companySize || "",
          role: formData.role || "",
          date: `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`,
          time: selectedTime,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          utcOffset: -new Date().getTimezoneOffset(),
          slug: selectedPage.slug,
          agentCode: agentCode || undefined,
          internalNotes: formData.internalNotes || "",
        }),
      });
      const data = await response.json();
      if (data.success) {
        setBookingId(data.bookingId);
        setStep("confirmed");
      } else {
        alert("Es gab einen Fehler. Bitte versuche es erneut.");
      }
    } catch {
      alert("Verbindungsfehler. Bitte versuche es erneut.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isDateAvailable = (date: Date): boolean => {
    return availableDates.some((d) => d.toDateString() === date.toDateString());
  };

  const calendarDays = getCalendarDays(currentMonth.getFullYear(), currentMonth.getMonth());
  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));

  const Sidebar = () => (
    <div className="flex flex-col h-full">
      <div className="mb-6">
        <img src="/dealcode-logo.svg" alt="dealcode" className="h-8" />
      </div>
      <p className="text-sm text-gray-500 mb-1">Dennis Fredrich</p>
      <h1 className="text-xl font-bold text-gray-900 mb-3">{selectedPage?.title || "Termin buchen"}</h1>
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>{selectedPage?.duration || 30} min</span>
      </div>
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        <span>Einzelheiten zur Webkonferenz nach Bestätigung.</span>
      </div>
      <div className="mt-auto pt-6 flex gap-4 text-xs text-gray-400">
        <a href="#" className="hover:text-gray-600 transition">Cookie-Einstellungen</a>
        <a href="#" className="hover:text-gray-600 transition">Datenschutzerklärung</a>
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-4xl overflow-hidden">

        {step === "select" && (
          <div className="p-8 max-w-lg mx-auto">
            <div className="mb-6 flex justify-center">
              <img src="/dealcode-logo.svg" alt="dealcode" className="h-8" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-1 text-center">Terminart wählen</h2>
            <p className="text-gray-500 mb-6 text-center">Welche Art von Gespräch möchten Sie buchen?</p>
            <div className="space-y-3">
              {bookingPages.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Laden...</p>
              ) : (
                bookingPages.map((page) => (
                  <button
                    key={page.id}
                    onClick={() => { setSelectedPage(page); setStep("calendar"); }}
                    className="w-full text-left p-5 rounded-xl border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition group"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-gray-900 group-hover:text-blue-700 text-lg">{page.title}</h3>
                      <span className="flex-shrink-0 ml-4 px-4 py-1.5 rounded-full bg-gray-100 text-sm font-semibold text-gray-600 group-hover:bg-blue-100 group-hover:text-blue-700">
                        {page.duration} Min.
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {(step === "calendar" || step === "qualify") && (
          <div className="flex flex-col md:flex-row min-h-[560px]">
            <div className="md:w-72 flex-shrink-0 border-b md:border-b-0 md:border-r border-gray-200 p-6">
              <Sidebar />
            </div>
            <div className="flex-1 p-6">
              {step === "calendar" && (
                <div>
                  <h2 className="text-lg font-bold text-gray-900 mb-4">Datum & Uhrzeit wählen</h2>
                  <div className="flex flex-col lg:flex-row gap-6">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-4">
                        <button onClick={prevMonth} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition">
                          <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                        <span className="font-semibold text-gray-900">{getMonthYear(currentMonth)}</span>
                        <button onClick={nextMonth} className="w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-700 flex items-center justify-center transition">
                          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>
                      <div className="grid grid-cols-7 gap-0 mb-2">
                        {["MO.", "DI.", "MI.", "DO.", "FR.", "SA.", "SO."].map((d) => (
                          <div key={d} className="text-center text-xs font-medium text-gray-400 py-2">{d}</div>
                        ))}
                      </div>
                      <div className="grid grid-cols-7 gap-0">
                        {calendarDays.map((day, i) => {
                          if (!day) return <div key={`empty-${i}`} className="aspect-square" />;
                          const available = isDateAvailable(day);
                          const isSelected = selectedDate?.toDateString() === day.toDateString();
                          const isPast = day <= today; // today is also blocked
                          const isToday = day.toDateString() === today.toDateString();
                          return (
                            <div key={day.toISOString()} className="aspect-square flex items-center justify-center p-0.5">
                              <button
                                disabled={!available || isPast}
                                onClick={() => { setSelectedDate(day); setSelectedTime(null); fetchAvailability(day); }}
                                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition relative ${
                                  isSelected
                                    ? "bg-blue-600 text-white shadow-md"
                                    : available && !isPast
                                    ? "bg-blue-50 text-blue-700 font-bold hover:bg-blue-100 ring-1 ring-blue-200"
                                    : "text-gray-300 cursor-not-allowed"
                                }`}
                              >
                                {day.getDate()}
                                {isToday && !isSelected && (
                                  <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-600" />
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Zeitzone</span>
                      </div>
                      <p className="text-sm text-gray-600 ml-6">Mitteleuropäische Zeit ({new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}) ▾</p>
                    </div>
                    {selectedDate && (
                      <div className="lg:w-40 flex-shrink-0">
                        <p className="text-sm font-semibold text-gray-900 mb-3">{formatDateLong(selectedDate)}</p>
                        <button onClick={() => fetchAvailability(selectedDate)} className="w-full mb-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition">
                          Freie Zeiten anzeigen
                        </button>
                        {loadingSlots ? (
                          <p className="text-sm text-gray-400 py-4 text-center">Laden...</p>
                        ) : availableSlots.length === 0 ? (
                          <p className="text-sm text-gray-400 py-4 text-center">Keine freien Slots.</p>
                        ) : (
                          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                            {availableSlots.map((time) => {
                              const isTimeSelected = selectedTime === time;
                              return isTimeSelected ? (
                                <div key={time} className="flex gap-1.5">
                                  <div className="flex-1 py-2.5 rounded-lg border border-gray-400 bg-gray-600 text-white text-sm font-semibold text-center">{time}</div>
                                  <button onClick={() => setStep("qualify")} className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition">Weiter</button>
                                </div>
                              ) : (
                                <button key={time} onClick={() => setSelectedTime(time)}
                                  className="w-full py-2.5 rounded-lg border text-sm font-semibold transition bg-white text-blue-600 border-blue-200 hover:border-blue-400"
                                >{time}</button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {bookingPages.length > 1 && (
                    <button onClick={() => { setStep("select"); setSelectedPage(null); }} className="mt-4 text-sm text-gray-500 hover:text-gray-700 transition">
                      ← Anderen Termintyp wählen
                    </button>
                  )}
                </div>
              )}

              {step === "qualify" && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <button onClick={() => setStep("calendar")} className="p-1 rounded-full hover:bg-gray-100 transition">
                      <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <h2 className="text-lg font-bold text-gray-900">Details eingeben</h2>
                  </div>
                  {selectedDate && selectedTime && (
                    <div className="bg-blue-50 rounded-lg p-3 mb-5 flex items-center gap-2">
                      <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-sm text-blue-800 font-medium">{formatDateLong(selectedDate)} um {selectedTime} Uhr</p>
                    </div>
                  )}
                  <form onSubmit={(e) => { e.preventDefault(); handleBooking(); }} className="space-y-4">
                    {formFields.some(f => f.key === "firstName") && formFields.some(f => f.key === "lastName") ? (
                      <div className="grid grid-cols-2 gap-3">
                        {["firstName", "lastName"].map((key) => {
                          const field = formFields.find(f => f.key === key)!;
                          return (
                            <div key={key}>
                              <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}{field.required ? " *" : ""}</label>
                              <input type={field.type || "text"} required={field.required} value={formData[key] || ""} onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                    {formFields.filter(f => f.key !== "firstName" && f.key !== "lastName").map((field) => (
                      <div key={field.key}>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}{field.required ? " *" : ""}</label>
                        {field.type === "textarea" ? (
                          <textarea required={field.required} value={formData[field.key] || ""} onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none min-h-[80px] resize-y" rows={3} />
                        ) : (
                          <input type={field.type || "text"} required={field.required} value={formData[field.key] || ""} onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
                        )}
                      </div>
                    ))}
                    {/* Company Size */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Unternehmensgröße</label>
                      <select
                        value={formData.companySize || ""}
                        onChange={(e) => setFormData({ ...formData, companySize: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                      >
                        <option value="">Bitte wählen...</option>
                        <option value="1-10">1-10 Mitarbeiter</option>
                        <option value="11-50">11-50 Mitarbeiter</option>
                        <option value="51-200">51-200 Mitarbeiter</option>
                        <option value="201-1000">201-1.000 Mitarbeiter</option>
                        <option value="1000+">1.000+ Mitarbeiter</option>
                      </select>
                    </div>
                    {/* Internal notes - only visible in dashboard */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Interne Notizen <span className="text-gray-400 font-normal">(nur für uns sichtbar)</span>
                      </label>
                      <textarea
                        value={formData.internalNotes || ""}
                        onChange={(e) => setFormData({ ...formData, internalNotes: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none min-h-[60px] resize-y"
                        placeholder="z.B. Lead kommt über LinkedIn, interessiert an Feature X..."
                      />
                    </div>
                    <button type="submit" disabled={isSubmitting}
                      className={`w-full rounded-lg px-4 py-3 text-white font-semibold transition ${isSubmitting ? "bg-gray-300 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"}`}
                    >{isSubmitting ? "Wird gebucht..." : "Termin bestätigen"}</button>
                  </form>
                </div>
              )}
            </div>
          </div>
        )}

        {step === "confirmed" && (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Termin gebucht!</h2>
            <p className="text-gray-500 mb-1">Dein Termin am <strong>{selectedDate && formatDateLong(selectedDate)} um {selectedTime} Uhr</strong> ist bestätigt.</p>
            <p className="text-gray-400 text-sm mb-6">Eine Kalendereinladung wird an <strong>{formData.email}</strong> gesendet.</p>
            <button onClick={() => { setStep("select"); setSelectedPage(null); setFormData({}); setSelectedDate(null); setSelectedTime(null); }}
              className="rounded-lg border border-gray-300 px-6 py-2.5 text-gray-700 font-medium hover:bg-gray-50 transition">
              Neuen Termin buchen
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
