import { FormEvent, useEffect, useState } from "react";
import { api, ApiError } from "../api";
import { addHoursToStoreInput, bookingInputBounds, formatDay, formatTime, fromStoreLocalInput, hoursBetween, toLocalInput } from "../date";

interface ManagedBooking {
  groupName: string;
  category: string;
  contactName: string;
  email: string;
  phone?: string | null;
  privateNotes?: string | null;
  status: string;
  start: string;
  end: string;
}

export default function ManagePage({ token }: { token: string }) {
  const [booking, setBooking] = useState<ManagedBooking | null>(null);
  const [start, setStart] = useState("");
  const [durationHours, setDurationHours] = useState(1);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const bounds = bookingInputBounds();

  const load = async () => {
    try {
      const result = await api<ManagedBooking>(`/api/manage/${token}`);
      setBooking(result);
      setStart(toLocalInput(result.start));
      setDurationHours(Math.max(1, Math.min(4, Math.round(hoursBetween(result.start, result.end)))));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "This private link could not be opened.");
    }
  };

  useEffect(() => { void load(); }, [token]);

  const act = async (action: "cancel" | "reschedule", event?: FormEvent) => {
    event?.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api<ManagedBooking>(`/api/manage/${token}`, {
        method: "POST",
        body: JSON.stringify(action === "cancel" ? { action } : { action, start: fromStoreLocalInput(start), end: fromStoreLocalInput(addHoursToStoreInput(start, durationHours)) }),
      });
      setBooking(result);
      if (action === "reschedule") {
        setStart(toLocalInput(result.start));
        setDurationHours(Math.max(1, Math.min(4, Math.round(hoursBetween(result.start, result.end)))));
      }
      setNotice(action === "cancel" ? "Your reservation is cancelled and the time is available again." : "Your reservation has been moved.");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "That change could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="narrow-page">
      <a className="back-link" href="/">← Back to the public schedule</a>
      <p className="eyebrow">Private reservation link</p>
      <h1>Manage your event</h1>
      {!booking && !error && <div className="state-card">Loading your reservation…</div>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {notice && <p className="success-notice" role="status">{notice}</p>}
      {booking && (
        <div className="manage-card">
          <div className={`status-pill ${booking.status}`}>{booking.status.replace("_", " ")}</div>
          <h2>{booking.groupName}</h2>
          <p>{booking.category}</p>
          <dl>
            <div><dt>Date</dt><dd>{formatDay(booking.start)}</dd></div>
            <div><dt>Time</dt><dd>{formatTime(booking.start)}–{formatTime(booking.end)}</dd></div>
            <div><dt>Contact</dt><dd>{booking.contactName}<br />{booking.email}{booking.phone && <><br />{booking.phone}</>}</dd></div>
          </dl>
          {booking.status === "confirmed" && (
            <>
              <form className="reschedule-form" onSubmit={(event) => void act("reschedule", event)}>
                <h3>Choose another time</h3>
                <label htmlFor="manage-start">Starts</label>
                <input id="manage-start" type="datetime-local" step="3600" min={bounds.min} max={bounds.max} value={start} onChange={(e) => setStart(e.target.value)} required />
                <label htmlFor="manage-duration">Length</label>
                <select id="manage-duration" value={durationHours} onChange={(e) => setDurationHours(Number(e.target.value))}>{[1, 2, 3, 4].map((hours) => <option key={hours} value={hours}>{hours} hour{hours === 1 ? "" : "s"}</option>)}</select>
                <button className="button primary" disabled={busy}>{busy ? "Saving…" : "Move reservation"}</button>
              </form>
              <div className="danger-zone">
                <h3>Need to cancel?</h3>
                <p>The time will immediately become available to another neighbor.</p>
                <button className="button danger" disabled={busy} onClick={() => { if (window.confirm("Cancel this reservation?")) void act("cancel"); }}>Cancel reservation</button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
