import { FormEvent, useCallback, useEffect, useState } from "react";
import { Turnstile } from "@marsidev/react-turnstile";
import { api, ApiError } from "../api";
import type { AdminBooking } from "../types";
import { formatDay, formatTime, fromStoreLocalInput } from "../date";

interface HoursRow { id: string; dayOfWeek: number; opensAt: string; closesAt: string; isClosed: boolean }
interface Blackout { id: string; startsAt: string; endsAt: string; reason: string }
interface AuditRow { id: string; action: string; entityType: string; actorLabel?: string | null; metadata?: unknown; createdAt: string }
interface Dashboard { bookings: AdminBooking[]; hours: HoursRow[]; blackouts: Blackout[]; audit: AuditRow[] }
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function AdminPage() {
  const [passcode, setPasscode] = useState("");
  const [csrf, setCsrf] = useState(() => sessionStorage.getItem("psp-admin-csrf") ?? "");
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"bookings" | "hours" | "blackouts" | "audit">("bookings");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [blackout, setBlackout] = useState({ startsAt: "", endsAt: "", reason: "" });
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

  const authedApi = useCallback(<T,>(path: string, init?: RequestInit) => api<T>(path, {
    ...init,
    headers: { ...init?.headers, ...(csrf ? { "X-CSRF-Token": csrf } : {}) },
  }), [csrf]);

  const load = useCallback(async () => {
    if (!csrf) return;
    try {
      const [bookings, hours, blackouts, audit] = await Promise.all([
        authedApi<{ bookings: AdminBooking[] }>("/api/admin/bookings"),
        authedApi<{ hours: HoursRow[] }>("/api/admin/hours"),
        authedApi<{ blackouts: Blackout[] }>("/api/admin/blackouts"),
        authedApi<{ audit: AuditRow[] }>("/api/admin/audit"),
      ]);
      setData({ bookings: bookings.bookings, hours: hours.hours, blackouts: blackouts.blackouts, audit: audit.audit });
      setError("");
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        sessionStorage.removeItem("psp-admin-csrf");
        setCsrf("");
      } else setError(caught instanceof ApiError ? caught.message : "The dashboard could not be loaded.");
    }
  }, [authedApi, csrf]);

  useEffect(() => { void load(); }, [load]);

  const login = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api<{ csrfToken: string }>("/api/admin/session", { method: "POST", body: JSON.stringify({ passcode, turnstileToken }) });
      sessionStorage.setItem("psp-admin-csrf", result.csrfToken);
      setCsrf(result.csrfToken);
      setPasscode("");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Sign-in failed.");
    } finally { setBusy(false); }
  };

  const logout = async () => {
    await authedApi("/api/admin/session", { method: "DELETE" }).catch(() => undefined);
    sessionStorage.removeItem("psp-admin-csrf");
    setCsrf(""); setData(null);
  };

  const cancelBooking = async (id: string) => {
    if (!window.confirm("Cancel this booking and release its time?")) return;
    await authedApi(`/api/admin/bookings/${id}`, { method: "PATCH", body: JSON.stringify({ action: "cancel" }) });
    await load();
  };

  const saveHours = async () => {
    if (!data) return;
    await authedApi("/api/admin/hours", { method: "PUT", body: JSON.stringify({ hours: data.hours }) });
    await load();
  };

  const addBlackout = async (event: FormEvent) => {
    event.preventDefault();
    await authedApi("/api/admin/blackouts", { method: "POST", body: JSON.stringify({ ...blackout, startsAt: fromStoreLocalInput(blackout.startsAt), endsAt: fromStoreLocalInput(blackout.endsAt) }) });
    setBlackout({ startsAt: "", endsAt: "", reason: "" });
    await load();
  };

  const deleteBlackout = async (id: string) => {
    await authedApi(`/api/admin/blackouts/${id}`, { method: "DELETE" });
    await load();
  };

  if (!csrf) {
    return (
      <section className="admin-login narrow-page">
        <p className="eyebrow">Store staff only</p>
        <h1>Community scheduling dashboard</h1>
        <p>Contact details and private event notes are protected here.</p>
        <form className="login-card" onSubmit={login}>
          <label htmlFor="admin-passcode">Shared staff passcode</label>
          <input id="admin-passcode" type="password" autoComplete="current-password" value={passcode} onChange={(e) => setPasscode(e.target.value)} required autoFocus />
          {siteKey && <Turnstile siteKey={siteKey} onSuccess={setTurnstileToken} />}
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button primary full" disabled={busy}>{busy ? "Signing in…" : "Open dashboard"}</button>
        </form>
      </section>
    );
  }

  return (
    <section className="admin-page">
      <div className="admin-heading">
        <div><p className="eyebrow">Private staff view</p><h1>Community scheduling dashboard</h1></div>
        <button className="button ghost" onClick={() => void logout()}>Sign out</button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {!data ? <div className="state-card">Loading private booking details…</div> : (
        <>
          <div className="admin-tabs" role="tablist">
            {(["bookings", "hours", "blackouts", "audit"] as const).map((item) => <button role="tab" aria-selected={tab === item} className={tab === item ? "active" : ""} key={item} onClick={() => setTab(item)}>{item}</button>)}
          </div>
          {tab === "bookings" && (
            <div className="admin-list">
              {data.bookings.map((booking) => (
                <article className="admin-booking" key={booking.id}>
                  <div><span className={`status-pill ${booking.status}`}>{booking.status.replace("_", " ")}</span><h2>{booking.groupName}</h2><p>{booking.category}</p></div>
                  <dl>
                    <div><dt>When</dt><dd>{formatDay(booking.start)}<br />{formatTime(booking.start)}–{formatTime(booking.end)}</dd></div>
                    <div><dt>Contact</dt><dd>{booking.contactName}<br /><a href={`mailto:${booking.email}`}>{booking.email}</a>{booking.phone && <><br /><a href={`tel:${booking.phone}`}>{booking.phone}</a></>}</dd></div>
                    <div><dt>Private notes</dt><dd>{booking.privateNotes || "None"}</dd></div>
                  </dl>
                  {booking.status === "confirmed" && <button className="button danger small" onClick={() => void cancelBooking(booking.id)}>Cancel booking</button>}
                </article>
              ))}
            </div>
          )}
          {tab === "hours" && (
            <div className="settings-card">
              <h2>Weekly hours</h2>
              {[...data.hours].sort((a, b) => a.dayOfWeek - b.dayOfWeek).map((row) => (
                <div className="hours-row" key={row.id}>
                  <strong>{DAYS[row.dayOfWeek - 1]}</strong>
                  <label><span>Open</span><input type="time" step="1800" value={row.opensAt} disabled={row.isClosed} onChange={(e) => setData({ ...data, hours: data.hours.map((item) => item.id === row.id ? { ...item, opensAt: e.target.value } : item) })} /></label>
                  <label><span>Close</span><input type="time" step="1800" value={row.closesAt} disabled={row.isClosed} onChange={(e) => setData({ ...data, hours: data.hours.map((item) => item.id === row.id ? { ...item, closesAt: e.target.value } : item) })} /></label>
                  <label className="checkbox"><input type="checkbox" checked={row.isClosed} onChange={(e) => setData({ ...data, hours: data.hours.map((item) => item.id === row.id ? { ...item, isClosed: e.target.checked } : item) })} /> Closed</label>
                </div>
              ))}
              <button className="button primary" onClick={() => void saveHours()}>Save weekly hours</button>
            </div>
          )}
          {tab === "blackouts" && (
            <div className="settings-grid">
              <form className="settings-card" onSubmit={addBlackout}>
                <h2>Add unavailable time</h2>
                <label>Starts<input type="datetime-local" step="1800" value={blackout.startsAt} onChange={(e) => setBlackout({ ...blackout, startsAt: e.target.value })} required /></label>
                <label>Ends<input type="datetime-local" step="1800" value={blackout.endsAt} onChange={(e) => setBlackout({ ...blackout, endsAt: e.target.value })} required /></label>
                <label>Reason<input value={blackout.reason} maxLength={200} onChange={(e) => setBlackout({ ...blackout, reason: e.target.value })} required /></label>
                <button className="button primary">Block this time</button>
              </form>
              <div className="settings-card"><h2>Upcoming blackouts</h2>{data.blackouts.map((item) => <div className="blackout-row" key={item.id}><div><strong>{item.reason}</strong><span>{formatDay(item.startsAt)}, {formatTime(item.startsAt)}–{formatTime(item.endsAt)}</span></div><button className="button ghost small" onClick={() => void deleteBlackout(item.id)}>Remove</button></div>)}</div>
            </div>
          )}
          {tab === "audit" && <div className="settings-card"><h2>Recent staff and booking activity</h2><table><thead><tr><th>When</th><th>Action</th><th>Type</th><th>Actor</th></tr></thead><tbody>{data.audit.map((row) => <tr key={row.id}><td>{new Date(row.createdAt).toLocaleString()}</td><td>{row.action}</td><td>{row.entityType}</td><td>{row.actorLabel || "System"}</td></tr>)}</tbody></table></div>}
        </>
      )}
    </section>
  );
}
