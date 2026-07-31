import { FormEvent, useMemo, useState } from "react";
import { Turnstile } from "@marsidev/react-turnstile";
import { api, ApiError } from "../api";
import { CATEGORIES, type BookingStartInput, type Category } from "../types";
import { fromStoreLocalInput, toLocalInput } from "../date";

interface Props {
  initialStart?: string;
  initialEnd?: string;
  onClose: () => void;
  onConfirmed: () => void;
}

interface StartResponse {
  challengeId: string;
  bookingId: string;
  expiresAt: string;
  devCode?: string;
}

interface VerifyResponse {
  status: "confirmed";
  manageUrl: string;
}

export default function BookingForm({ initialStart, initialEnd, onClose, onConfirmed }: Props) {
  const defaults = useMemo(() => ({
    start: initialStart ? toLocalInput(initialStart) : "",
    end: initialEnd ? toLocalInput(initialEnd) : "",
  }), [initialStart, initialEnd]);
  const [form, setForm] = useState<BookingStartInput>({
    groupName: "",
    category: "Community Event",
    contactName: "",
    email: "",
    phone: "",
    privateNotes: "",
    start: defaults.start,
    end: defaults.end,
  });
  const [challenge, setChallenge] = useState<StartResponse | null>(null);
  const [code, setCode] = useState("");
  const [confirmed, setConfirmed] = useState<VerifyResponse | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

  const update = (key: keyof BookingStartInput, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api<StartResponse>("/api/bookings/start", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          start: fromStoreLocalInput(form.start),
          end: fromStoreLocalInput(form.end),
        }),
      });
      setChallenge(result);
      if (result.devCode) setCode(result.devCode);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "We could not hold that time.");
    } finally {
      setBusy(false);
    }
  };

  const verify = async (event: FormEvent) => {
    event.preventDefault();
    if (!challenge) return;
    setBusy(true);
    setError("");
    try {
      const result = await api<VerifyResponse>("/api/bookings/verify", {
        method: "POST",
        body: JSON.stringify({ challengeId: challenge.challengeId, code }),
      });
      setConfirmed(result);
      onConfirmed();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "That code could not be verified.");
    } finally {
      setBusy(false);
    }
  };

  if (confirmed) {
    return (
      <div className="dialog-card confirmation" role="dialog" aria-modal="true" aria-labelledby="confirmed-title">
        <button className="dialog-close" onClick={onClose} aria-label="Close">×</button>
        <span className="success-mark" aria-hidden="true">✓</span>
        <h2 id="confirmed-title">You’re booked!</h2>
        <p>We sent the details to your email. Keep your private link if you need to cancel or choose another time.</p>
        <a className="button primary" href={confirmed.manageUrl}>Manage this reservation</a>
      </div>
    );
  }

  if (challenge) {
    return (
      <div className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="verify-title">
        <button className="dialog-close" onClick={onClose} aria-label="Close">×</button>
        <p className="eyebrow">One quick step</p>
        <h2 id="verify-title">Check your email</h2>
        <p>Enter the six-digit code sent to <strong>{form.email}</strong>. Your time is held for ten minutes.</p>
        <form onSubmit={verify}>
          <label htmlFor="verification-code">Verification code</label>
          <input id="verification-code" className="code-input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} required autoFocus />
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button primary full" disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Confirm reservation"}</button>
        </form>
      </div>
    );
  }

  return (
    <div className="dialog-card booking-dialog" role="dialog" aria-modal="true" aria-labelledby="booking-title">
      <button className="dialog-close" onClick={onClose} aria-label="Close">×</button>
      <p className="eyebrow">Reserve the space</p>
      <h2 id="booking-title">Tell us about your event</h2>
      <p className="privacy-note">Only your group name and event category appear publicly. Your contact details stay private for store staff.</p>
      <form onSubmit={submit} className="booking-form">
        <div className="field-span">
          <label htmlFor="group-name">Group or event name</label>
          <input id="group-name" value={form.groupName} onChange={(e) => update("groupName", e.target.value)} maxLength={100} required autoFocus />
        </div>
        <div className="field-span">
          <label htmlFor="category">Event category</label>
          <select id="category" value={form.category} onChange={(e) => update("category", e.target.value as Category)}>
            {CATEGORIES.map((category) => <option key={category}>{category}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="start">Starts</label>
          <input id="start" type="datetime-local" step="1800" value={form.start} onChange={(e) => update("start", e.target.value)} required />
        </div>
        <div>
          <label htmlFor="end">Ends</label>
          <input id="end" type="datetime-local" step="1800" value={form.end} onChange={(e) => update("end", e.target.value)} required />
        </div>
        <div>
          <label htmlFor="contact-name">Contact name</label>
          <input id="contact-name" autoComplete="name" value={form.contactName} onChange={(e) => update("contactName", e.target.value)} maxLength={100} required />
        </div>
        <div>
          <label htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" value={form.email} onChange={(e) => update("email", e.target.value)} maxLength={254} required />
        </div>
        <div className="field-span">
          <label htmlFor="phone">Phone <span>(optional)</span></label>
          <input id="phone" type="tel" autoComplete="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} maxLength={30} />
        </div>
        <div className="field-span">
          <label htmlFor="notes">Notes for store staff <span>(optional and private)</span></label>
          <textarea id="notes" value={form.privateNotes} onChange={(e) => update("privateNotes", e.target.value)} maxLength={1000} rows={3} />
        </div>
        {siteKey && (
          <div className="field-span turnstile-wrap">
            <Turnstile siteKey={siteKey} onSuccess={(token) => update("turnstileToken", token)} options={{ theme: "light" }} />
          </div>
        )}
        {error && <p className="form-error field-span" role="alert">{error}</p>}
        <div className="dialog-actions field-span">
          <button type="button" className="button ghost" onClick={onClose}>Not yet</button>
          <button className="button primary" disabled={busy}>{busy ? "Holding your time…" : "Email my verification code"}</button>
        </div>
      </form>
    </div>
  );
}
