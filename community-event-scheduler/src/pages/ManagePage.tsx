import { FormEvent, useEffect, useState } from "react";
import { api, ApiError } from "../api";
import { addHoursToStoreInput, bookingInputBounds, formatDay, formatTime, fromStoreLocalInput, hoursBetween, toLocalInput } from "../date";
import AccessibleDialog from "../components/AccessibleDialog";
import { DateHourFields } from "../components/HourFields";
import FormError from "../components/FormError";
import { CATEGORIES, type Category } from "../types";

interface ManagedBooking {
  groupName: string;
  category: Category;
  contactName: string;
  email: string;
  phone?: string | null;
  privateNotes?: string | null;
  status: string;
  start: string;
  end: string;
}

interface EditableDetails {
  groupName: string;
  category: Category;
  contactName: string;
  phone: string;
  privateNotes: string;
}

const emptyDetails: EditableDetails = {
  groupName: "",
  category: "Community Event",
  contactName: "",
  phone: "",
  privateNotes: "",
};

export default function ManagePage({ token }: { token: string }) {
  const [booking, setBooking] = useState<ManagedBooking | null>(null);
  const [details, setDetails] = useState<EditableDetails>(emptyDetails);
  const [start, setStart] = useState("");
  const [durationHours, setDurationHours] = useState(1);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const bounds = bookingInputBounds();

  const load = async () => {
    try {
      const result = await api<ManagedBooking>(`/api/manage/${token}`);
      setBooking(result);
      setDetails({
        groupName: result.groupName,
        category: result.category,
        contactName: result.contactName,
        phone: result.phone ?? "",
        privateNotes: result.privateNotes ?? "",
      });
      setStart(toLocalInput(result.start));
      setDurationHours(Math.max(1, Math.min(4, Math.round(hoursBetween(result.start, result.end)))));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "This private link could not be opened.");
    }
  };

  useEffect(() => { void load(); }, [token]);

  const updateDetail = (key: keyof EditableDetails, value: string) => {
    setDetails((current) => ({ ...current, [key]: value }));
  };

  const saveDetails = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api<ManagedBooking>(`/api/manage/${token}`, {
        method: "POST",
        body: JSON.stringify({
          action: "update_details",
          groupName: details.groupName,
          category: details.category,
          contactName: details.contactName,
          phone: details.phone || undefined,
          privateNotes: details.privateNotes || undefined,
        }),
      });
      setBooking(result);
      setDetails({
        groupName: result.groupName,
        category: result.category,
        contactName: result.contactName,
        phone: result.phone ?? "",
        privateNotes: result.privateNotes ?? "",
      });
      setNotice("Your reservation details have been updated.");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Those reservation details could not be saved.");
    } finally {
      setBusy(false);
    }
  };

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
      {!booking && !error && <div className="state-card" role="status" aria-live="polite">Loading your reservation…</div>}
      {error && <FormError>{error}</FormError>}
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
              <form className="booking-form manage-details-form" onSubmit={saveDetails}>
                <div className="field-span">
                  <h3>Edit reservation details</h3>
                  <p className="form-intro">Update the public event information or the private contact details store staff use.</p>
                </div>
                <div className="field-span">
                  <label htmlFor="manage-group-name">Group or event name</label>
                  <input id="manage-group-name" value={details.groupName} onChange={(event) => updateDetail("groupName", event.target.value)} minLength={2} maxLength={100} required />
                </div>
                <div className="field-span">
                  <label htmlFor="manage-category">Event category</label>
                  <select id="manage-category" value={details.category} onChange={(event) => updateDetail("category", event.target.value as Category)}>
                    {CATEGORIES.map((category) => <option key={category}>{category}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="manage-contact-name">Contact name</label>
                  <input id="manage-contact-name" autoComplete="name" value={details.contactName} onChange={(event) => updateDetail("contactName", event.target.value)} minLength={2} maxLength={100} required />
                </div>
                <div>
                  <label htmlFor="manage-email">Verified email</label>
                  <input id="manage-email" type="email" value={booking.email} readOnly aria-describedby="manage-email-help" />
                  <span id="manage-email-help" className="field-help">To change this address, contact the store.</span>
                </div>
                <div className="field-span">
                  <label htmlFor="manage-phone">Phone <span>(optional)</span></label>
                  <input id="manage-phone" type="tel" autoComplete="tel" value={details.phone} onChange={(event) => updateDetail("phone", event.target.value)} maxLength={30} />
                </div>
                <div className="field-span">
                  <label htmlFor="manage-notes">Notes for store staff <span>(optional and private)</span></label>
                  <textarea id="manage-notes" value={details.privateNotes} onChange={(event) => updateDetail("privateNotes", event.target.value)} maxLength={1000} rows={3} />
                </div>
                <div className="dialog-actions field-span">
                  <button className="button primary" disabled={busy}>{busy ? "Saving…" : "Save reservation details"}</button>
                </div>
              </form>
              <form className="reschedule-form" onSubmit={(event) => void act("reschedule", event)}>
                <h3>Choose another time</h3>
                <DateHourFields idPrefix="manage-start" value={start} min={bounds.min} max={bounds.max} onChange={setStart} />
                <label htmlFor="manage-duration">Length</label>
                <select id="manage-duration" value={durationHours} onChange={(e) => setDurationHours(Number(e.target.value))}>{[1, 2, 3, 4].map((hours) => <option key={hours} value={hours}>{hours} hour{hours === 1 ? "" : "s"}</option>)}</select>
                <button className="button primary" disabled={busy}>{busy ? "Saving…" : "Move reservation"}</button>
              </form>
              <div className="danger-zone">
                <h3>Need to cancel?</h3>
                <p>The time will immediately become available to another neighbor.</p>
                <button className="button danger" disabled={busy} onClick={() => setConfirmCancel(true)}>Cancel reservation</button>
              </div>
            </>
          )}
        </div>
      )}
      {confirmCancel && <AccessibleDialog className="scope-dialog" labelledBy="cancel-title" onClose={() => setConfirmCancel(false)} initialFocusSelector=".dialog-actions .ghost">
        <button className="dialog-close" onClick={() => setConfirmCancel(false)} aria-label="Close">×</button>
        <p className="eyebrow">Reservation change</p>
        <h2 id="cancel-title">Cancel this reservation?</h2>
        <p>The reserved time will immediately become available to another neighbor.</p>
        <div className="dialog-actions"><button className="button ghost" onClick={() => setConfirmCancel(false)}>Keep reservation</button><button className="button danger" disabled={busy} onClick={() => { setConfirmCancel(false); void act("cancel"); }}>Cancel reservation</button></div>
      </AccessibleDialog>}
    </section>
  );
}
