import { FormEvent, useMemo, useRef, useState } from "react";
import { api, ApiError } from "../api";
import { CATEGORIES, type BookingStartInput, type Category } from "../types";
import { addHoursToStoreInput, bookingInputBounds, fromStoreLocalInput, toLocalInput } from "../date";
import AccessibleDialog from "./AccessibleDialog";
import CaptchaChallenge, { type CaptchaChallengeHandle } from "./CaptchaChallenge";
import { DateHourFields } from "./HourFields";
import FormError from "./FormError";

interface Props {
  initialStart?: string;
  maxDurationHours?: number;
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

export default function BookingForm({ initialStart, maxDurationHours = 4, onClose, onConfirmed }: Props) {
  const defaults = useMemo(() => ({
    start: initialStart ? toLocalInput(initialStart) : "",
    end: "",
  }), [initialStart]);
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
  const [durationHours, setDurationHours] = useState(1);
  const bounds = useMemo(() => bookingInputBounds(), []);
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
  const captchaRef = useRef<CaptchaChallengeHandle | null>(null);

  const update = (key: keyof BookingStartInput, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (siteKey && !form.turnstileToken) {
      setError("Please complete the spam-protection check before continuing.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await api<StartResponse>("/api/bookings/start", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          start: fromStoreLocalInput(form.start),
          end: fromStoreLocalInput(addHoursToStoreInput(form.start, durationHours)),
        }),
      });
      setChallenge(result);
      if (result.devCode) setCode(result.devCode);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "We could not hold that time.");
      if (siteKey) {
        update("turnstileToken", "");
        captchaRef.current?.reset("The request was not accepted. Complete a fresh spam-protection check and try again.");
      }
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
      <AccessibleDialog className="confirmation" labelledBy="confirmed-title" onClose={onClose} initialFocusSelector="a.button">
        <button className="dialog-close" onClick={onClose} aria-label="Close">×</button>
        <span className="success-mark" aria-hidden="true">✓</span>
        <h2 id="confirmed-title">You’re booked!</h2>
        <p>We sent the details to your email. Keep your private link if you need to cancel or choose another time.</p>
        <a className="button primary" href={confirmed.manageUrl}>Manage this reservation</a>
      </AccessibleDialog>
    );
  }

  if (challenge) {
    return (
      <AccessibleDialog labelledBy="verify-title" onClose={onClose} initialFocusSelector="#verification-code">
        <button className="dialog-close" onClick={onClose} aria-label="Close">×</button>
        <p className="eyebrow">One quick step</p>
        <h2 id="verify-title">Check your email</h2>
        <p>Enter the six-digit code sent to <strong>{form.email}</strong>. Your time is held for ten minutes.</p>
        <form onSubmit={verify}>
          <label htmlFor="verification-code">Verification code</label>
          <input id="verification-code" className="code-input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} required />
          {error && <FormError>{error}</FormError>}
          <button className="button primary full" disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Confirm reservation"}</button>
        </form>
      </AccessibleDialog>
    );
  }

  return (
    <AccessibleDialog className="booking-dialog" labelledBy="booking-title" onClose={onClose} initialFocusSelector="#group-name">
      <button className="dialog-close" onClick={onClose} aria-label="Close">×</button>
      <p className="eyebrow">Reserve the space</p>
      <h2 id="booking-title">Tell us about your event</h2>
      <p className="privacy-note">Only your group name and event category appear publicly. Your contact details stay private for store staff.</p>
      <form onSubmit={submit} className="booking-form">
        <div className="field-span">
          <label htmlFor="group-name">Group or event name</label>
          <input id="group-name" value={form.groupName} onChange={(e) => update("groupName", e.target.value)} maxLength={100} required />
        </div>
        <div className="field-span">
          <label htmlFor="category">Event category</label>
          <select id="category" value={form.category} onChange={(e) => update("category", e.target.value as Category)}>
            {CATEGORIES.map((category) => <option key={category}>{category}</option>)}
          </select>
        </div>
        <DateHourFields idPrefix="booking-start" value={form.start} min={bounds.min} max={bounds.max} onChange={(value) => update("start", value)} />
        <div>
          <label htmlFor="duration">Length</label>
          <select id="duration" value={durationHours} onChange={(e) => setDurationHours(Number(e.target.value))}>
            {Array.from({ length: Math.max(1, Math.min(4, maxDurationHours)) }, (_, index) => index + 1).map((hours) => <option key={hours} value={hours}>{hours} hour{hours === 1 ? "" : "s"}</option>)}
          </select>
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
        {siteKey && <div className="field-span"><CaptchaChallenge ref={captchaRef} siteKey={siteKey} onTokenChange={(token) => { update("turnstileToken", token); if (token) setError(""); }} /></div>}
        {error && <FormError className="field-span">{error}</FormError>}
        <div className="dialog-actions field-span">
          <button type="button" className="button ghost" onClick={onClose}>Not yet</button>
          <button className="button primary" disabled={busy || Boolean(siteKey && !form.turnstileToken)}>{busy ? "Holding your time…" : "Email my verification code"}</button>
        </div>
      </form>
    </AccessibleDialog>
  );
}
