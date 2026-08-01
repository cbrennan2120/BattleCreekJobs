import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "../api";
import type { AdminBooking } from "../types";
import { addHoursToStoreInput, formatDay, formatTime, fromStoreLocalInput } from "../date";
import ManualEntryWizard, { draftFromBooking, draftFromHold, type InitialEntry } from "../components/ManualEntryWizard";
import AccessibleDialog from "../components/AccessibleDialog";
import AccessibleTabs from "../components/AccessibleTabs";
import CaptchaChallenge, { type CaptchaChallengeHandle } from "../components/CaptchaChallenge";
import { DateHourFields, HourSelect } from "../components/HourFields";
import FormError from "../components/FormError";

interface HoursRow { id: string; dayOfWeek: number; opensAt: string; closesAt: string; isClosed: boolean }
interface Blackout { id: string; startsAt: string; endsAt: string; reason: string; seriesId?: string | null; occurrenceKey?: string | null; isException?: boolean }
interface AuditRow { id: string; action: string; entityType: string; actorLabel?: string | null; metadata?: unknown; createdAt: string }
interface Dashboard { bookings: AdminBooking[]; hours: HoursRow[]; blackouts: Blackout[]; audit: AuditRow[] }
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
type RemoveScope = "occurrence" | "following" | "series";

export default function AdminPage() {
  const [passcode, setPasscode] = useState("");
  const [csrf, setCsrf] = useState(() => sessionStorage.getItem("psp-admin-csrf") ?? "");
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"bookings" | "hours" | "blackouts" | "audit">("bookings");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [blackout, setBlackout] = useState({ startsAt: "", durationHours: 1, reason: "" });
  const [wizard, setWizard] = useState<{ initial?: InitialEntry } | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{ id: string; label: string; hasSeries: boolean } | null>(null);
  const [removeScope, setRemoveScope] = useState<RemoveScope>("occurrence");
  const [cancelTarget, setCancelTarget] = useState<{ id: string; label: string } | null>(null);
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
  const captchaRef = useRef<CaptchaChallengeHandle | null>(null);

  const authedApi = useCallback(<T,>(path: string, init?: RequestInit) => api<T>(path, {
    ...init,
    headers: { ...init?.headers, ...(csrf ? { "X-CSRF-Token": csrf } : {}) },
  }), [csrf]);

  const load = useCallback(async () => {
    if (!csrf) return;
    try {
      const [bookingsResponse, hoursResponse, blackoutsResponse, auditResponse] = await Promise.all([
        authedApi<{ bookings: AdminBooking[] }>("/api/admin/bookings"),
        authedApi<{ hours: HoursRow[] }>("/api/admin/hours"),
        authedApi<{ blackouts: Blackout[] }>("/api/admin/blackouts"),
        authedApi<{ audit: AuditRow[] }>("/api/admin/audit"),
      ]);
      setData({ bookings: bookingsResponse.bookings, hours: hoursResponse.hours, blackouts: blackoutsResponse.blackouts, audit: auditResponse.audit });
      setError("");
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        sessionStorage.removeItem("psp-admin-csrf"); setCsrf("");
      } else setError(caught instanceof ApiError ? caught.message : "The dashboard could not be loaded.");
    }
  }, [authedApi, csrf]);

  useEffect(() => { void load(); }, [load]);

  const login = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const result = await api<{ csrfToken: string }>("/api/admin/session", { method: "POST", body: JSON.stringify({ passcode, turnstileToken }) });
      sessionStorage.setItem("psp-admin-csrf", result.csrfToken); setCsrf(result.csrfToken); setPasscode("");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Sign-in failed.");
      if (siteKey) captchaRef.current?.reset("Sign-in was not accepted. Complete a fresh spam-protection check and try again.");
    }
    finally { setBusy(false); }
  };

  const logout = async () => {
    await authedApi("/api/admin/session", { method: "DELETE" }).catch(() => undefined);
    sessionStorage.removeItem("psp-admin-csrf"); setCsrf(""); setData(null);
  };

  const cancelBooking = async (id: string) => {
    await authedApi(`/api/admin/bookings/${id}`, { method: "PATCH", body: JSON.stringify({ action: "cancel" }) });
    setCancelTarget(null);
    await load();
  };

  const saveHours = async () => {
    if (!data) return;
    await authedApi("/api/admin/hours", { method: "PUT", body: JSON.stringify({ hours: data.hours }) }); await load();
  };

  const addBlackout = async (event: FormEvent) => {
    event.preventDefault();
    await authedApi("/api/admin/blackouts", { method: "POST", body: JSON.stringify({ startsAt: fromStoreLocalInput(blackout.startsAt), endsAt: fromStoreLocalInput(addHoursToStoreInput(blackout.startsAt, blackout.durationHours)), reason: blackout.reason }) });
    setBlackout({ startsAt: "", durationHours: 1, reason: "" }); await load();
  };

  const removeManualEntry = async () => {
    if (!removeTarget) return;
    setBusy(true); setError("");
    try {
      await authedApi(`/api/admin/entries/${removeTarget.id}?scope=${removeScope}`, { method: "DELETE" });
      setRemoveTarget(null); await load();
    } catch (caught) { setError(caught instanceof ApiError ? caught.message : "The entry could not be removed."); }
    finally { setBusy(false); }
  };

  const askRemove = (id: string, label: string, hasSeries: boolean) => {
    setRemoveScope("occurrence"); setRemoveTarget({ id, label, hasSeries });
  };

  if (!csrf) return (
    <section className="admin-login narrow-page">
      <p className="eyebrow">Store staff only</p><h1>Community scheduling dashboard</h1><p>Contact details and private event notes are protected here.</p>
      <form className="login-card" onSubmit={login}><label htmlFor="admin-passcode">Shared staff passcode</label><input id="admin-passcode" type="password" autoComplete="current-password" value={passcode} onChange={(e) => setPasscode(e.target.value)} required autoFocus />{siteKey && <CaptchaChallenge ref={captchaRef} siteKey={siteKey} onTokenChange={setTurnstileToken} />}{error && <FormError>{error}</FormError>}<button className="button primary full" disabled={busy || Boolean(siteKey && !turnstileToken)}>{busy ? "Signing in…" : "Open dashboard"}</button></form>
    </section>
  );

  return (
    <section className="admin-page">
      <div className="admin-heading"><div><p className="eyebrow">Private staff view</p><h1>Community scheduling dashboard</h1></div><div className="admin-actions"><button className="button primary" onClick={() => setWizard({})}>Add event or hold</button><button className="button ghost" onClick={() => void logout()}>Sign out</button></div></div>
      {error && <FormError>{error}</FormError>}
      {!data ? <div className="state-card">Loading private booking details…</div> : <>
        <AccessibleTabs idPrefix="admin" className="admin-tabs" label="Staff dashboard sections" selected={tab} onSelect={setTab} items={(["bookings", "hours", "blackouts", "audit"] as const).map((item) => ({ id: item, label: item }))} />
        {tab === "bookings" && <div className="admin-list" id="admin-panel-bookings" role="tabpanel" aria-labelledby="admin-tab-bookings">{data.bookings.map((booking) => <article className="admin-booking" key={booking.id}>
          <div><span className={`status-pill ${booking.status}`}>{booking.status.replace("_", " ")}</span>{booking.source === "admin_manual" && <span className="status-pill manual">Staff added</span>}{booking.seriesId && <span className="status-pill series">Series</span>}<h2>{booking.groupName}</h2><p>{booking.category}</p></div>
          <dl><div><dt>When</dt><dd>{formatDay(booking.start)}<br />{formatTime(booking.start)}–{formatTime(booking.end)}</dd></div><div><dt>Contact</dt><dd>{booking.contactName || "None provided"}{booking.email && <><br /><a href={`mailto:${booking.email}`}>{booking.email}</a></>}{booking.phone && <><br /><a href={`tel:${booking.phone}`}>{booking.phone}</a></>}</dd></div><div><dt>Private notes</dt><dd>{booking.privateNotes || "None"}</dd></div></dl>
          {booking.status === "confirmed" && booking.source === "admin_manual" ? <div className="card-actions"><button className="button ghost small" onClick={() => setWizard({ initial: draftFromBooking(booking) })}>Edit</button><button className="button danger small" onClick={() => askRemove(booking.id, booking.groupName, Boolean(booking.seriesId))}>Remove</button></div> : booking.status === "confirmed" && <button className="button danger small" onClick={() => setCancelTarget({ id: booking.id, label: booking.groupName })}>Cancel booking</button>}
        </article>)}</div>}
        {tab === "hours" && <div className="settings-card" id="admin-panel-hours" role="tabpanel" aria-labelledby="admin-tab-hours"><h2>Weekly hours</h2>{[...data.hours].sort((a, b) => a.dayOfWeek - b.dayOfWeek).map((row) => <div className="hours-row" key={row.id}><strong>{DAYS[row.dayOfWeek - 1]}</strong><label><span>Open</span><HourSelect value={row.opensAt} disabled={row.isClosed} ariaLabel={`${DAYS[row.dayOfWeek - 1]} opening time`} onChange={(value) => setData({ ...data, hours: data.hours.map((item) => item.id === row.id ? { ...item, opensAt: value } : item) })} /></label><label><span>Close</span><HourSelect value={row.closesAt} disabled={row.isClosed} ariaLabel={`${DAYS[row.dayOfWeek - 1]} closing time`} onChange={(value) => setData({ ...data, hours: data.hours.map((item) => item.id === row.id ? { ...item, closesAt: value } : item) })} /></label><label className="checkbox"><input type="checkbox" checked={row.isClosed} onChange={(e) => setData({ ...data, hours: data.hours.map((item) => item.id === row.id ? { ...item, isClosed: e.target.checked } : item) })} /> Closed</label></div>)}<button className="button primary" onClick={() => void saveHours()}>Save weekly hours</button></div>}
        {tab === "blackouts" && <div className="settings-grid" id="admin-panel-blackouts" role="tabpanel" aria-labelledby="admin-tab-blackouts"><form className="settings-card" onSubmit={addBlackout}><h2>Add one-time unavailable time</h2><p>For a repeating hold, use “Add event or hold” above.</p><DateHourFields idPrefix="blackout-start" value={blackout.startsAt} onChange={(value) => setBlackout({ ...blackout, startsAt: value })} /><label>Length<select value={blackout.durationHours} onChange={(e) => setBlackout({ ...blackout, durationHours: Number(e.target.value) })}>{Array.from({ length: 24 }, (_, index) => index + 1).map((hours) => <option key={hours} value={hours}>{hours} hour{hours === 1 ? "" : "s"}</option>)}</select></label><label>Reason<input value={blackout.reason} maxLength={200} onChange={(e) => setBlackout({ ...blackout, reason: e.target.value })} required /></label><button className="button primary">Block this time</button></form><div className="settings-card"><h2>Upcoming holds</h2>{data.blackouts.map((item) => <div className="blackout-row" key={item.id}><div><strong>{item.reason} {item.seriesId && <span className="status-pill series">Series</span>}</strong><span>{formatDay(item.startsAt)}, {formatTime(item.startsAt)}–{formatTime(item.endsAt)}</span></div><div className="card-actions"><button className="button ghost small" onClick={() => setWizard({ initial: draftFromHold(item) })}>Edit</button><button className="button danger small" onClick={() => askRemove(item.id, item.reason, Boolean(item.seriesId))}>Remove</button></div></div>)}</div></div>}
        {tab === "audit" && <div className="settings-card" id="admin-panel-audit" role="tabpanel" aria-labelledby="admin-tab-audit"><h2>Recent staff and booking activity</h2><table><thead><tr><th>When</th><th>Action</th><th>Type</th><th>Actor</th></tr></thead><tbody>{data.audit.map((row) => <tr key={row.id}><td>{new Date(row.createdAt).toLocaleString()}</td><td>{row.action}</td><td>{row.entityType}</td><td>{row.actorLabel || "System"}</td></tr>)}</tbody></table></div>}
      </>}
      {wizard && <ManualEntryWizard request={authedApi} initial={wizard.initial} onClose={() => setWizard(null)} onSaved={load} />}
      {removeTarget && <AccessibleDialog className="scope-dialog" labelledBy="remove-title" onClose={() => setRemoveTarget(null)} initialFocusSelector=".dialog-actions .ghost"><button className="dialog-close" onClick={() => setRemoveTarget(null)} aria-label="Close">×</button><p className="eyebrow">Staff scheduling</p><h2 id="remove-title">Remove {removeTarget.label}?</h2>{removeTarget.hasSeries ? <label>Apply to<select value={removeScope} onChange={(e) => setRemoveScope(e.target.value as RemoveScope)}><option value="occurrence">This occurrence</option><option value="following">This and future occurrences</option><option value="series">All future occurrences</option></select></label> : <p>This releases the reserved time. Booking history is retained where applicable.</p>}<div className="dialog-actions"><button className="button ghost" onClick={() => setRemoveTarget(null)}>Keep it</button><button className="button danger" onClick={() => void removeManualEntry()} disabled={busy}>{busy ? "Removing…" : "Remove"}</button></div></AccessibleDialog>}
      {cancelTarget && <AccessibleDialog className="scope-dialog" labelledBy="cancel-booking-title" onClose={() => setCancelTarget(null)} initialFocusSelector=".dialog-actions .ghost"><button className="dialog-close" onClick={() => setCancelTarget(null)} aria-label="Close">×</button><p className="eyebrow">Staff scheduling</p><h2 id="cancel-booking-title">Cancel {cancelTarget.label}?</h2><p>This releases the reserved time immediately.</p><div className="dialog-actions"><button className="button ghost" onClick={() => setCancelTarget(null)}>Keep booking</button><button className="button danger" onClick={() => void cancelBooking(cancelTarget.id)} disabled={busy}>Cancel booking</button></div></AccessibleDialog>}
    </section>
  );
}
