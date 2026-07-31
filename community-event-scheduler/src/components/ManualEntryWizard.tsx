import { FormEvent, useEffect, useMemo, useState } from "react";
import { ApiError } from "../api";
import { formatDay, formatTime, isoDate, toLocalInput } from "../date";
import { CATEGORIES, type Category, type ManualEntryDraft, type ManualOccurrence, type RecurrenceEnd, type RecurrenceRule } from "../types";

type Requester = <T>(path: string, init?: RequestInit) => Promise<T>;
type Scope = "occurrence" | "following" | "series";

export interface InitialEntry {
  id: string;
  hasSeries: boolean;
  draft: ManualEntryDraft;
}

interface Props {
  request: Requester;
  onClose: () => void;
  onSaved: () => Promise<void>;
  initial?: InitialEntry;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function dateAfter(months: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return isoDate(date);
}

function defaultDraft(): ManualEntryDraft {
  return {
    entryType: "event",
    event: { groupName: "", category: CATEGORIES[0] },
    startDate: isoDate(new Date()),
    startTime: "09:00",
    durationMinutes: 30,
    recurrence: { frequency: "none" },
  };
}

function cleanOptional(value: string | undefined) { return value?.trim() || undefined; }

export function draftFromBooking(booking: {
  id: string; groupName: string; category: Category; contactName?: string; email?: string; phone?: string; privateNotes?: string;
  start: string; end: string; seriesId?: string | null;
}): InitialEntry {
  const local = toLocalInput(booking.start);
  return {
    id: booking.id,
    hasSeries: Boolean(booking.seriesId),
    draft: {
      entryType: "event",
      event: { groupName: booking.groupName, category: booking.category, contactName: booking.contactName, email: booking.email, phone: booking.phone, privateNotes: booking.privateNotes },
      startDate: local.slice(0, 10),
      startTime: local.slice(11, 16),
      durationMinutes: (new Date(booking.end).getTime() - new Date(booking.start).getTime()) / 60_000,
      recurrence: { frequency: "none" },
    },
  };
}

export function draftFromHold(hold: { id: string; startsAt: string; endsAt: string; reason: string; seriesId?: string | null }): InitialEntry {
  const local = toLocalInput(hold.startsAt);
  return {
    id: hold.id,
    hasSeries: Boolean(hold.seriesId),
    draft: {
      entryType: "hold",
      hold: { reason: hold.reason },
      startDate: local.slice(0, 10),
      startTime: local.slice(11, 16),
      durationMinutes: (new Date(hold.endsAt).getTime() - new Date(hold.startsAt).getTime()) / 60_000,
      recurrence: { frequency: "none" },
    },
  };
}

export default function ManualEntryWizard({ request, onClose, onSaved, initial }: Props) {
  const seed = initial?.draft ?? defaultDraft();
  const [step, setStep] = useState(1);
  const [entryType, setEntryType] = useState<"event" | "hold">(seed.entryType);
  const seedEvent = seed.entryType === "event" ? seed.event : { groupName: "", category: CATEGORIES[0] as Category };
  const seedHold = seed.entryType === "hold" ? seed.hold : { reason: "" };
  const [event, setEvent] = useState({ groupName: seedEvent.groupName, category: seedEvent.category, contactName: seedEvent.contactName ?? "", email: seedEvent.email ?? "", phone: seedEvent.phone ?? "", privateNotes: seedEvent.privateNotes ?? "" });
  const [reason, setReason] = useState(seedHold.reason);
  const [startDate, setStartDate] = useState(seed.startDate);
  const [startTime, setStartTime] = useState(seed.startTime);
  const [durationMinutes, setDurationMinutes] = useState(seed.durationMinutes);
  const [frequency, setFrequency] = useState<RecurrenceRule["frequency"]>(seed.recurrence.frequency);
  const [interval, setInterval] = useState(seed.recurrence.frequency === "none" ? 1 : seed.recurrence.interval);
  const [weekdays, setWeekdays] = useState<number[]>(seed.recurrence.frequency === "weekly" ? seed.recurrence.weekdays : [1]);
  const [monthlyMode, setMonthlyMode] = useState<"day_of_month" | "ordinal_weekday">(seed.recurrence.frequency === "monthly" ? seed.recurrence.mode : "day_of_month");
  const [dayOfMonth, setDayOfMonth] = useState(seed.recurrence.frequency === "monthly" && seed.recurrence.mode === "day_of_month" ? seed.recurrence.dayOfMonth : 1);
  const [ordinal, setOrdinal] = useState<-1 | 1 | 2 | 3 | 4 | 5>(seed.recurrence.frequency === "monthly" && seed.recurrence.mode === "ordinal_weekday" ? seed.recurrence.ordinal : 1);
  const [monthlyWeekday, setMonthlyWeekday] = useState(seed.recurrence.frequency === "monthly" && seed.recurrence.mode === "ordinal_weekday" ? seed.recurrence.weekday : 1);
  const [endType, setEndType] = useState<RecurrenceEnd["type"]>(seed.recurrence.frequency === "none" ? "count" : seed.recurrence.end.type);
  const [endDate, setEndDate] = useState(seed.recurrence.frequency !== "none" && seed.recurrence.end.type === "until" ? seed.recurrence.end.date : dateAfter(1));
  const [count, setCount] = useState(seed.recurrence.frequency !== "none" && seed.recurrence.end.type === "count" ? seed.recurrence.end.count : 4);
  const [scope, setScope] = useState<Scope>("occurrence");
  const [preview, setPreview] = useState<ManualOccurrence[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ changed: number; skipped: number } | null>(null);

  const draft = useMemo<ManualEntryDraft>(() => {
    let recurrence: RecurrenceRule = { frequency: "none" };
    if (frequency !== "none") {
      const end: RecurrenceEnd = endType === "until" ? { type: "until", date: endDate } : { type: "count", count };
      if (frequency === "daily") recurrence = { frequency, interval, end };
      else if (frequency === "weekly") recurrence = { frequency, interval, weekdays, end };
      else if (monthlyMode === "day_of_month") recurrence = { frequency, interval, mode: monthlyMode, dayOfMonth, end };
      else recurrence = { frequency, interval, mode: monthlyMode, ordinal, weekday: monthlyWeekday, end };
    }
    const schedule = { startDate, startTime, durationMinutes, recurrence };
    return entryType === "event"
      ? { entryType, ...schedule, event: { groupName: event.groupName.trim(), category: event.category, contactName: cleanOptional(event.contactName), email: cleanOptional(event.email), phone: cleanOptional(event.phone), privateNotes: cleanOptional(event.privateNotes) } }
      : { entryType, ...schedule, hold: { reason: reason.trim() } };
  }, [count, dayOfMonth, durationMinutes, endDate, endType, entryType, event, frequency, interval, monthlyMode, monthlyWeekday, ordinal, reason, startDate, startTime, weekdays]);

  useEffect(() => {
    if (frequency === "weekly" && !weekdays.length) setWeekdays([new Date(`${startDate}T12:00:00`).getDay() || 7]);
  }, [frequency, startDate, weekdays.length]);

  useEffect(() => {
    if (initial && scope === "occurrence" && frequency !== "none") setFrequency("none");
  }, [frequency, initial, scope]);

  const next = async (eventObject: FormEvent) => {
    eventObject.preventDefault();
    setError("");
    if (step < 3) { setStep(step + 1); return; }
    setBusy(true);
    try {
      const body = initial ? { draft, editing: { id: initial.id, scope } } : draft;
      const response = await request<{ occurrences: ManualOccurrence[] }>("/api/admin/entries/preview", { method: "POST", body: JSON.stringify(body) });
      setPreview(response.occurrences);
      setStep(4);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The schedule preview could not be generated.");
    } finally { setBusy(false); }
  };

  const save = async () => {
    setBusy(true); setError("");
    try {
      if (initial) {
        const response = await request<{ changed: ManualOccurrence[]; skipped: ManualOccurrence[] }>(`/api/admin/entries/${initial.id}`, { method: "PATCH", body: JSON.stringify({ scope, draft }) });
        setResult({ changed: response.changed.length, skipped: response.skipped.length });
      } else {
        const response = await request<{ created: ManualOccurrence[]; skipped: ManualOccurrence[] }>("/api/admin/entries", { method: "POST", body: JSON.stringify(draft) });
        setResult({ changed: response.created.length, skipped: response.skipped.length });
      }
      await onSaved();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The entry could not be saved.");
    } finally { setBusy(false); }
  };

  const title = initial ? "Edit event or hold" : "Add event or hold";
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(eventObject) => { if (eventObject.target === eventObject.currentTarget) onClose(); }}>
      <section className="dialog-card booking-dialog manual-entry-dialog" role="dialog" aria-modal="true" aria-labelledby="manual-entry-title">
        <button className="dialog-close" onClick={onClose} aria-label="Close">×</button>
        <p className="eyebrow">Staff scheduling</p>
        <h2 id="manual-entry-title">{title}</h2>
        <ol className="wizard-steps" aria-label="Progress">
          {["Type", "Details", "Schedule", "Review"].map((label, index) => <li className={step === index + 1 ? "active" : step > index + 1 ? "done" : ""} key={label}><span>{index + 1}</span>{label}</li>)}
        </ol>

        {result ? (
          <div className="confirmation" role="status"><div className="success-mark">✓</div><h3>Schedule saved</h3><p>{result.changed} date{result.changed === 1 ? "" : "s"} saved.{result.skipped ? ` ${result.skipped} conflict${result.skipped === 1 ? " was" : "s were"} skipped.` : ""}</p><button className="button primary" onClick={onClose}>Done</button></div>
        ) : (
          <form onSubmit={next}>
            {step === 1 && <fieldset className="choice-grid"><legend>What are you adding?</legend><label className={entryType === "event" ? "selected" : ""}><input type="radio" name="entry-type" checked={entryType === "event"} onChange={() => setEntryType("event")} disabled={Boolean(initial)} /><strong>Public event</strong><span>Shows the group name and category.</span></label><label className={entryType === "hold" ? "selected" : ""}><input type="radio" name="entry-type" checked={entryType === "hold"} onChange={() => setEntryType("hold")} disabled={Boolean(initial)} /><strong>Store hold</strong><span>Shows only “Unavailable.”</span></label></fieldset>}

            {step === 2 && entryType === "event" && <div className="booking-form"><div><label htmlFor="manual-group">Group or event name</label><input id="manual-group" value={event.groupName} onChange={(e) => setEvent({ ...event, groupName: e.target.value })} minLength={2} maxLength={100} required /></div><div><label htmlFor="manual-category">Category</label><select id="manual-category" value={event.category} onChange={(e) => setEvent({ ...event, category: e.target.value as Category })}>{CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></div><div><label htmlFor="manual-contact">Contact name <span>(private, optional)</span></label><input id="manual-contact" value={event.contactName} onChange={(e) => setEvent({ ...event, contactName: e.target.value })} /></div><div><label htmlFor="manual-email">Email <span>(private, optional)</span></label><input id="manual-email" type="email" value={event.email} onChange={(e) => setEvent({ ...event, email: e.target.value })} /></div><div><label htmlFor="manual-phone">Phone <span>(private, optional)</span></label><input id="manual-phone" type="tel" value={event.phone} onChange={(e) => setEvent({ ...event, phone: e.target.value })} /></div><div className="field-span"><label htmlFor="manual-notes">Private notes <span>(optional)</span></label><textarea id="manual-notes" rows={3} value={event.privateNotes} onChange={(e) => setEvent({ ...event, privateNotes: e.target.value })} /></div></div>}
            {step === 2 && entryType === "hold" && <div><label htmlFor="hold-reason">Internal reason</label><input id="hold-reason" value={reason} onChange={(e) => setReason(e.target.value)} minLength={2} maxLength={200} required /><p className="privacy-note">This reason is visible only to staff. The public calendar shows “Unavailable.”</p></div>}

            {step === 3 && <div className="schedule-fields"><div className="inline-fields"><label>First date<input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required /></label><label>Start time<input type="time" step="1800" value={startTime} onChange={(e) => setStartTime(e.target.value)} required /></label><label>Length<select value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))}>{Array.from({ length: entryType === "event" ? 8 : 48 }, (_, index) => (index + 1) * 30).map((minutes) => <option key={minutes} value={minutes}>{minutes < 60 ? `${minutes} minutes` : `${minutes / 60} hours`}</option>)}</select></label></div><label>Repeat<select value={frequency} onChange={(e) => setFrequency(e.target.value as RecurrenceRule["frequency"])}><option value="none">Does not repeat</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label>{frequency !== "none" && <div className="recurrence-box"><label>Repeat every <span className="inline-number"><input type="number" min="1" max={frequency === "daily" ? 30 : 12} value={interval} onChange={(e) => setInterval(Number(e.target.value))} /> {frequency === "daily" ? "day(s)" : frequency === "weekly" ? "week(s)" : "month(s)"}</span></label>{frequency === "weekly" && <fieldset className="weekday-picker"><legend>On these days</legend>{WEEKDAYS.map((day, index) => <label key={day}><input type="checkbox" checked={weekdays.includes(index + 1)} onChange={(e) => setWeekdays(e.target.checked ? [...weekdays, index + 1] : weekdays.filter((value) => value !== index + 1))} />{day}</label>)}</fieldset>}{frequency === "monthly" && <><label>Monthly pattern<select value={monthlyMode} onChange={(e) => setMonthlyMode(e.target.value as typeof monthlyMode)}><option value="day_of_month">Day of month</option><option value="ordinal_weekday">Ordinal weekday</option></select></label>{monthlyMode === "day_of_month" ? <label>Day<input type="number" min="1" max="31" value={dayOfMonth} onChange={(e) => setDayOfMonth(Number(e.target.value))} /></label> : <div className="inline-fields"><label>Which<select value={ordinal} onChange={(e) => setOrdinal(Number(e.target.value) as typeof ordinal)}><option value="1">First</option><option value="2">Second</option><option value="3">Third</option><option value="4">Fourth</option><option value="5">Fifth</option><option value="-1">Last</option></select></label><label>Weekday<select value={monthlyWeekday} onChange={(e) => setMonthlyWeekday(Number(e.target.value))}>{WEEKDAYS.map((day, index) => <option value={index + 1} key={day}>{day}</option>)}</select></label></div>}</>}
              <fieldset className="end-picker"><legend>Ends</legend><label><input type="radio" checked={endType === "count"} onChange={() => setEndType("count")} /> After <input aria-label="Occurrence count" type="number" min="1" max="200" value={count} onChange={(e) => setCount(Number(e.target.value))} /> dates</label><label><input type="radio" checked={endType === "until"} onChange={() => setEndType("until")} /> On <input aria-label="Ending date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></label></fieldset></div>}{initial?.hasSeries && <label>Apply change to<select value={scope} onChange={(e) => setScope(e.target.value as Scope)}><option value="occurrence">This occurrence</option><option value="following">This and future occurrences</option><option value="series">All future occurrences</option></select></label>}<p className="helper-text">Times stay at the same Detroit wall time through daylight-saving changes. Conflicts are never replaced.</p></div>}

            {step === 4 && <div><p className="preview-summary"><strong>{preview.filter((item) => item.status === "open").length}</strong> open date(s) and <strong>{preview.filter((item) => item.status !== "open").length}</strong> skipped date(s).</p><div className="occurrence-preview" aria-live="polite">{preview.map((item) => <div className={`occurrence-row ${item.status}`} key={`${item.occurrenceKey}-${item.status}`}><span aria-hidden="true">{item.status === "open" ? "✓" : "!"}</span><div><strong>{item.start ? formatDay(item.start) : item.date} at {item.start ? formatTime(item.start) : item.time}</strong>{item.end && <small> to {formatTime(item.end)}</small>}{item.reason && <p>{item.reason}</p>}</div></div>)}</div></div>}

            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="dialog-actions">{step > 1 && <button type="button" className="button ghost" onClick={() => setStep(step - 1)} disabled={busy}>Back</button>}{step < 4 && <button className="button primary" disabled={busy}>{step === 3 ? busy ? "Checking…" : "Preview dates" : "Continue"}</button>}{step === 4 && <button type="button" className="button primary" onClick={() => void save()} disabled={busy || !preview.some((item) => item.status === "open")}>{busy ? "Saving…" : initial ? "Save changes" : "Create open dates"}</button>}</div>
          </form>
        )}
      </section>
    </div>
  );
}
