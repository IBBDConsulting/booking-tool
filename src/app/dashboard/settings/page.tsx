"use client";

import { useState, useEffect } from "react";

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
  calendarSubject: string | null;
  emailSubject: string | null;
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

interface BreakSlot {
  start: string;
  end: string;
}

interface MemberSettings {
  id: string;
  workingHoursStart: string;
  workingHoursEnd: string;
  bufferMinutes: number;
  workingDays: number[];
  breaks: BreakSlot[] | null;
  additionalCalendars: string[];
}

const dayLabels: Record<number, string> = { 0: "So", 1: "Mo", 2: "Di", 3: "Mi", 4: "Do", 5: "Fr", 6: "Sa" };
const allDays = [1, 2, 3, 4, 5, 6, 0]; // Mo-Sa, So

const ADMIN_PASSWORD = "Salesbros2024!";

export default function SettingsPage() {
  const [bookingPages, setBookingPages] = useState<BookingPageType[]>([]);
  const [member, setMember] = useState<MemberSettings | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<BookingPageType>>({});
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({ title: "", slug: "", duration: "30", description: "", calendarSubject: "", emailSubject: "" });
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [memberForm, setMemberForm] = useState({ workingHoursStart: "09:00", workingHoursEnd: "17:00", bufferMinutes: "15", workingDays: [1,2,3,4,5] as number[], breaks: [] as BreakSlot[], additionalCalendars: "" });
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("dashboard_auth");
    if (saved === ADMIN_PASSWORD) {
      setAuthenticated(true);
    } else {
      window.location.href = "/dashboard";
    }
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    fetch("/api/booking-pages").then(r => r.json()).then(d => { if (d.success) setBookingPages(d.bookingPages || []); }).catch(e => console.error("[Settings] fetch error:", e));
    fetch("/api/member").then(r => r.json()).then(d => {
      if (d.success) {
        setMember(d.member);
        setMemberForm({
          workingHoursStart: d.member.workingHoursStart || "09:00",
          workingHoursEnd: d.member.workingHoursEnd || "17:00",
          bufferMinutes: String(d.member.bufferMinutes ?? 15),
          workingDays: d.member.workingDays || [1,2,3,4,5],
          breaks: d.member.breaks || [],
          additionalCalendars: (d.member.additionalCalendars || []).join(", "),
        });
      }
    });
  }, [authenticated]);

  const startEdit = (page: BookingPageType) => {
    setEditingId(page.id);
    setEditForm({ ...page, formFields: page.formFields || [...defaultFormFields] });
  };

  const saveEdit = async () => {
    setSaving(true);
    const res = await fetch("/api/booking-pages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    const data = await res.json();
    if (data.success) {
      setBookingPages(prev => prev.map(p => p.id === data.bookingPage.id ? data.bookingPage : p));
      setEditingId(null);
    }
    setSaving(false);
  };

  const createNew = async () => {
    setSaving(true);
    const res = await fetch("/api/booking-pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newForm),
    });
    const data = await res.json();
    if (data.success) {
      setBookingPages(prev => [...prev, data.bookingPage]);
      setShowNew(false);
      setNewForm({ title: "", slug: "", duration: "30", description: "", calendarSubject: "", emailSubject: "" });
    } else {
      alert(data.error || "Fehler beim Erstellen.");
    }
    setSaving(false);
  };

  const saveMemberSettings = async () => {
    setSaving(true);
    const res = await fetch("/api/member", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workingHoursStart: memberForm.workingHoursStart,
        workingHoursEnd: memberForm.workingHoursEnd,
        bufferMinutes: Number(memberForm.bufferMinutes),
        workingDays: memberForm.workingDays,
        breaks: memberForm.breaks,
        additionalCalendars: memberForm.additionalCalendars
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean),
      }),
    });
    const data = await res.json();
    if (data.success) {
      setSaveMessage("Einstellungen gespeichert!");
      setTimeout(() => setSaveMessage(null), 3000);
    }
    setSaving(false);
  };

  const inputClass = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none";

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Einstellungen</h1>
            <p className="text-gray-500 mt-1">Termintypen und Arbeitszeiten verwalten</p>
          </div>
          <a href="/dashboard" className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
            Zurück zum Dashboard
          </a>
        </div>

        {/* Termintypen */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Termintypen</h2>
            <button
              onClick={() => setShowNew(true)}
              className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition"
            >
              + Neuer Typ
            </button>
          </div>

          <div className="space-y-3">
            {bookingPages.map((page) => (
              <div key={page.id} className="border border-gray-200 rounded-lg p-4">
                {editingId === page.id ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Titel</label>
                        <input className={inputClass} value={editForm.title || ""} onChange={e => setEditForm({ ...editForm, title: e.target.value })} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Dauer (Min.)</label>
                        <input className={inputClass} type="number" value={editForm.duration || ""} onChange={e => setEditForm({ ...editForm, duration: Number(e.target.value) })} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Beschreibung (nur in Kalender-/E-Mail-Einladung)</label>
                      <textarea className={`${inputClass} min-h-[100px] resize-y`} value={editForm.description || ""} onChange={e => setEditForm({ ...editForm, description: e.target.value })} placeholder="Wird in der Kalendereinladung und E-Mail angezeigt. Absätze mit Enter möglich." rows={4} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Google Calendar Betreff</label>
                      <input className={inputClass} value={editForm.calendarSubject || ""} onChange={e => setEditForm({ ...editForm, calendarSubject: e.target.value })} placeholder="z.B. Demo mit {name} von {company}" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">E-Mail Betreff</label>
                      <input className={inputClass} value={editForm.emailSubject || ""} onChange={e => setEditForm({ ...editForm, emailSubject: e.target.value })} placeholder="z.B. Deine Demo am {date}" />
                    </div>

                    {/* Form Fields Editor */}
                    <div className="border-t border-gray-200 pt-3 mt-2">
                      <label className="block text-xs font-medium text-gray-500 mb-2">Formularfelder</label>
                      <div className="space-y-2">
                        {(Array.isArray(editForm.formFields) ? editForm.formFields as FormField[] : defaultFormFields).map((field, idx) => (
                          <div key={`${field.key}-${idx}`} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                            <input
                              className="flex-1 rounded border border-gray-200 px-2 py-1 text-sm"
                              value={field.label}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditForm(prev => {
                                  const fields = (Array.isArray(prev.formFields) ? prev.formFields as FormField[] : defaultFormFields).map((f, i) => i === idx ? { ...f, label: val } : f);
                                  return { ...prev, formFields: fields };
                                });
                              }}
                            />
                            <select
                              className="rounded border border-gray-200 px-2 py-1 text-xs"
                              value={field.type}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditForm(prev => {
                                  const fields = (Array.isArray(prev.formFields) ? prev.formFields as FormField[] : defaultFormFields).map((f, i) => i === idx ? { ...f, type: val } : f);
                                  return { ...prev, formFields: fields };
                                });
                              }}
                            >
                              <option value="text">Text</option>
                              <option value="email">E-Mail</option>
                              <option value="tel">Telefon</option>
                              <option value="url">URL</option>
                              <option value="textarea">Textfeld</option>
                            </select>
                            <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                              <input
                                type="checkbox"
                                checked={field.required}
                                onChange={(e) => {
                                  const val = e.target.checked;
                                  setEditForm(prev => {
                                    const fields = (Array.isArray(prev.formFields) ? prev.formFields as FormField[] : defaultFormFields).map((f, i) => i === idx ? { ...f, required: val } : f);
                                    return { ...prev, formFields: fields };
                                  });
                                }}
                              />
                              Pflicht
                            </label>
                            <button
                              onClick={() => {
                                setEditForm(prev => {
                                  const fields = (Array.isArray(prev.formFields) ? prev.formFields as FormField[] : defaultFormFields).filter((_, i) => i !== idx);
                                  return { ...prev, formFields: fields };
                                });
                              }}
                              className="text-red-400 hover:text-red-600 text-sm px-1"
                              title="Feld entfernen"
                            >✕</button>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => {
                          setEditForm(prev => {
                            const fields = Array.isArray(prev.formFields) ? prev.formFields as FormField[] : defaultFormFields;
                            return { ...prev, formFields: [...fields, { key: `field_${Date.now()}`, label: "Neues Feld", type: "text", required: false }] };
                          });
                        }}
                        className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
                      >
                        + Feld hinzufügen
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={editForm.isActive ?? true} onChange={e => setEditForm({ ...editForm, isActive: e.target.checked })} />
                        Aktiv
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={saveEdit} disabled={saving} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50">
                        {saving ? "Speichern..." : "Speichern"}
                      </button>
                      <button onClick={() => setEditingId(null)} className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
                        Abbrechen
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900">{page.title}</h3>
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">{page.duration} Min.</span>
                        {!page.isActive && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600">Inaktiv</span>}
                      </div>
                      {page.description && <p className="text-sm text-gray-500 mt-0.5">{page.description}</p>}
                      <p className="text-xs text-gray-400 mt-1">Slug: {page.slug}</p>
                    </div>
                    <button onClick={() => startEdit(page)} className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
                      Bearbeiten
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* New booking page form */}
          {showNew && (
            <div className="border border-blue-200 rounded-lg p-4 mt-3 bg-blue-50">
              <h3 className="font-medium text-gray-900 mb-3">Neuen Termintyp anlegen</h3>
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Titel *</label>
                    <input className={inputClass} value={newForm.title} onChange={e => setNewForm({ ...newForm, title: e.target.value })} placeholder="z.B. Erstgespräch" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Slug *</label>
                    <input className={inputClass} value={newForm.slug} onChange={e => setNewForm({ ...newForm, slug: e.target.value })} placeholder="z.B. erstgespraech" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Dauer (Min.) *</label>
                    <input className={inputClass} type="number" value={newForm.duration} onChange={e => setNewForm({ ...newForm, duration: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Beschreibung</label>
                  <textarea className={`${inputClass} min-h-[80px] resize-y`} value={newForm.description} onChange={e => setNewForm({ ...newForm, description: e.target.value })} placeholder="Absätze mit Enter möglich." rows={3} />
                </div>
                <div className="flex gap-2">
                  <button onClick={createNew} disabled={saving || !newForm.title || !newForm.slug} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50">
                    Anlegen
                  </button>
                  <button onClick={() => setShowNew(false)} className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
                    Abbrechen
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Arbeitszeiten */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Arbeitszeiten</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Start</label>
              <input className={inputClass} type="time" value={memberForm.workingHoursStart} onChange={e => setMemberForm({ ...memberForm, workingHoursStart: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Ende</label>
              <input className={inputClass} type="time" value={memberForm.workingHoursEnd} onChange={e => setMemberForm({ ...memberForm, workingHoursEnd: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Buffer (Min.)</label>
              <input className={inputClass} type="number" value={memberForm.bufferMinutes} onChange={e => setMemberForm({ ...memberForm, bufferMinutes: e.target.value })} />
            </div>
          </div>

          {/* Arbeitstage */}
          <div className="mt-4">
            <label className="block text-xs font-medium text-gray-500 mb-2">Arbeitstage</label>
            <div className="flex gap-2">
              {allDays.map((day) => {
                const active = memberForm.workingDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => {
                      setMemberForm(prev => ({
                        ...prev,
                        workingDays: active
                          ? prev.workingDays.filter(d => d !== day)
                          : [...prev.workingDays, day].sort()
                      }));
                    }}
                    className={`w-10 h-10 rounded-full text-sm font-medium transition ${
                      active
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                    }`}
                  >
                    {dayLabels[day]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Pausen */}
          <div className="mt-4">
            <label className="block text-xs font-medium text-gray-500 mb-2">Pausen</label>
            <div className="space-y-2">
              {memberForm.breaks.map((b, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    className={inputClass + " !w-28"}
                    type="time"
                    value={b.start}
                    onChange={(e) => {
                      const breaks = [...memberForm.breaks];
                      breaks[idx] = { ...breaks[idx], start: e.target.value };
                      setMemberForm({ ...memberForm, breaks });
                    }}
                  />
                  <span className="text-gray-400 text-sm">bis</span>
                  <input
                    className={inputClass + " !w-28"}
                    type="time"
                    value={b.end}
                    onChange={(e) => {
                      const breaks = [...memberForm.breaks];
                      breaks[idx] = { ...breaks[idx], end: e.target.value };
                      setMemberForm({ ...memberForm, breaks });
                    }}
                  />
                  <button
                    onClick={() => {
                      setMemberForm({ ...memberForm, breaks: memberForm.breaks.filter((_, i) => i !== idx) });
                    }}
                    className="text-red-400 hover:text-red-600 text-sm px-1"
                  >✕</button>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                setMemberForm({ ...memberForm, breaks: [...memberForm.breaks, { start: "12:00", end: "13:00" }] });
              }}
              className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              + Pause hinzufügen
            </button>
          </div>

          <div className="mt-4">
            <label className="block text-xs font-medium text-gray-500 mb-1">Zusätzliche Kalender für Verfügbarkeit</label>
            <input className={inputClass} value={memberForm.additionalCalendars} onChange={e => setMemberForm({ ...memberForm, additionalCalendars: e.target.value })} placeholder="z.B. deine.private@gmail.com, team@firma.de (kommagetrennt)" />
            <p className="text-xs text-gray-400 mt-1">Diese Kalender werden bei der Verfügbarkeitsprüfung mitgeprüft. Termine dort blockieren Slots.</p>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button onClick={saveMemberSettings} disabled={saving} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50">
              {saving ? "Speichern..." : "Einstellungen speichern"}
            </button>
            {saveMessage && (
              <span className="text-sm text-green-600 font-medium animate-pulse">✓ {saveMessage}</span>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
