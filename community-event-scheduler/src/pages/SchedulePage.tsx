import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../api";
import BookingForm from "../components/BookingForm";
import AccessibleTabs from "../components/AccessibleTabs";
import { CATEGORIES, type AvailabilityResponse, type Category, type PublicSlot } from "../types";
import { dateKey, formatDay, formatTime, moveWeek, startOfWeek } from "../date";
import { useMediaQuery } from "../hooks/useMediaQuery";

const categoryClass: Record<Category, string> = {
  "Rescue Organization": "rescue",
  "Community Event": "community",
  "Birthday / Private Party": "party",
  "VIP Vaccine Clinic": "clinic",
  "Dog Trainer": "trainer",
};

function Slot({ slot, onReserve }: { slot: PublicSlot; onReserve: (slot: PublicSlot) => void }) {
  if (slot.state === "available") {
    return (
      <button className="slot available" onClick={(event) => { event.currentTarget.focus(); onReserve(slot); }}>
        <span>{formatTime(slot.start)}</span>
        <strong>Available</strong>
      </button>
    );
  }
  if (slot.state === "booked") {
    return (
      <div className={`slot booked ${slot.category ? categoryClass[slot.category] : ""}`}>
        <span>{formatTime(slot.start)}–{formatTime(slot.end)}</span>
        <strong>{slot.groupName}</strong>
        <small>{slot.category}</small>
      </div>
    );
  }
  return (
    <div className={`slot ${slot.state}`}>
      <span>{formatTime(slot.start)}–{formatTime(slot.end)}</span>
      <strong>{slot.state === "pending" ? "Temporarily held" : "Unavailable"}</strong>
    </div>
  );
}

export function collapseOccupiedSlots(slots: PublicSlot[]): PublicSlot[] {
  const result: PublicSlot[] = [];
  for (const slot of slots) {
    const previous = result[result.length - 1];
    const sameOccupiedEntry = previous
      && slot.state !== "available"
      && previous.state === slot.state
      && previous.end === slot.start
      && previous.groupName === slot.groupName
      && previous.category === slot.category;
    if (sameOccupiedEntry) previous.end = slot.end;
    else result.push({ ...slot });
  }
  return result;
}

export function consecutiveAvailableHours(selected: PublicSlot, slots: PublicSlot[]): number {
  let end = selected.start;
  let hours = 0;
  while (hours < 4) {
    const next = slots.find((slot) => slot.start === end && slot.state === "available");
    if (!next) break;
    hours += 1;
    end = next.end;
  }
  return Math.max(1, hours);
}

export default function SchedulePage() {
  const [week, setWeek] = useState(startOfWeek());
  const [data, setData] = useState<AvailabilityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<"week" | "list">("week");
  const [category, setCategory] = useState<Category | "all">("all");
  const [bookingSlot, setBookingSlot] = useState<"open" | { slot: PublicSlot; maxDurationHours: number } | null>(null);
  const [selectedDay, setSelectedDay] = useState("");
  const currentWeek = useMemo(() => startOfWeek(), []);
  const lastWeek = useMemo(() => startOfWeek(new Date(Date.now() + 90 * 86_400_000)), []);
  const isMobile = useMediaQuery("(max-width: 680px)");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await api<AvailabilityResponse>(`/api/availability?weekStart=${week}`));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The schedule could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [week]);

  useEffect(() => { void load(); }, [load]);
  const days = useMemo(() => {
    const grouped = new Map<string, PublicSlot[]>();
    for (const slot of data?.slots ?? []) {
      if (category !== "all" && slot.state === "booked" && slot.category !== category) continue;
      const key = dateKey(slot.start);
      grouped.set(key, [...(grouped.get(key) ?? []), slot]);
    }
    return [...grouped.entries()];
  }, [data, category]);

  useEffect(() => {
    const keys = days.map(([day]) => day);
    if (selectedDay && keys.includes(selectedDay)) return;
    const today = dateKey(data?.generatedAt ?? new Date().toISOString());
    setSelectedDay(keys.includes(today) ? today : keys.find((day) => day > today) ?? keys[0] ?? "");
  }, [data, days, selectedDay]);

  const selectSlot = (slot: PublicSlot) => setBookingSlot({ slot, maxDurationHours: consecutiveAvailableHours(slot, data?.slots ?? []) });

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Your neighborhood event space</p>
          <h1>Bring pets and people together.</h1>
          <p>Find an open time, tell us about your group, and confirm by email. No account or password needed.</p>
          <button className="button primary hero-cta" onClick={(event) => { event.currentTarget.focus(); setBookingSlot("open"); }}>Reserve the space</button>
        </div>
        <aside className="how-card" aria-label="How reservations work">
          <h2>Simple from start to finish</h2>
          <ol>
            <li><span>1</span><div><strong>Pick a time</strong><small>Choose up to four hours.</small></div></li>
            <li><span>2</span><div><strong>Tell us about your event</strong><small>Your contact information stays private.</small></div></li>
            <li><span>3</span><div><strong>Confirm by email</strong><small>Enter the six-digit code we send you.</small></div></li>
            <li><span>4</span><div><strong>Keep your confirmation email</strong><small>Use its “Manage reservation” button to make changes or cancel.</small></div></li>
          </ol>
        </aside>
      </section>

      <section className="schedule-section" aria-labelledby="schedule-title" aria-busy={loading}>
        <div className="section-heading">
          <div>
            <p className="eyebrow">One shared space · hourly reservations</p>
            <h2 id="schedule-title">Community schedule</h2>
            <p>Everyone can see who is joining us. Personal contact information is visible only to store staff.</p>
          </div>
          <div className="view-toggle" aria-label="Schedule display">
            <button className={view === "week" ? "active" : ""} onClick={() => setView("week")} aria-pressed={view === "week"}>Week</button>
            <button className={view === "list" ? "active" : ""} onClick={() => setView("list")} aria-pressed={view === "list"}>List</button>
          </div>
        </div>

        <div className="schedule-controls">
          <div className="week-nav">
            <button onClick={() => setWeek(moveWeek(week, -1))} aria-label="Previous week" disabled={week <= currentWeek}>←</button>
            <button className="today-button" onClick={() => setWeek(startOfWeek())}>This week</button>
            <button onClick={() => setWeek(moveWeek(week, 1))} aria-label="Next week" disabled={week >= lastWeek}>→</button>
          </div>
          <label className="filter-label">
            <span>Show category</span>
            <select value={category} onChange={(event) => setCategory(event.target.value as Category | "all")}>
              <option value="all">All events</option>
              {CATEGORIES.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
        </div>

        <div className="legend" aria-label="Schedule legend">
          <span><i className="available-dot" /> Available</span>
          <span><i className="booked-dot" /> Booked</span>
          <span><i className="held-dot" /> Temporarily held</span>
        </div>

        {loading && <div className="state-card" role="status" aria-live="polite">Loading the neighborhood schedule…</div>}
        {error && <div className="state-card error-state" role="alert"><strong>We couldn’t load the schedule.</strong><span>{error}</span><button className="button ghost" onClick={() => void load()}>Try again</button></div>}
        {!loading && !error && (
          <>
            {isMobile && days.length > 0 && <AccessibleTabs idPrefix="schedule-day" className="mobile-day-picker" label="Choose a day" selected={selectedDay} onSelect={setSelectedDay} items={days.map(([day, slots]) => ({ id: day, label: <><strong>{formatDay(slots[0].start)}</strong><span>{slots.filter((slot) => slot.state === "available").length} open</span></> }))} />}
            {isMobile && selectedDay && <p className="sr-only" aria-live="polite">Showing {formatDay(days.find(([day]) => day === selectedDay)?.[1][0]?.start ?? `${selectedDay}T12:00:00Z`)}</p>}
            {days.length === 0 ? <div className="state-card">No reservable times are available this week.</div> : <div className={view === "week" ? "week-grid" : "list-view"}>
              {days.map(([day, slots]) => (
                <section
                  className={`day-card ${selectedDay === day ? "mobile-selected" : ""}`}
                  key={day}
                  id={isMobile ? `schedule-day-panel-${day}` : undefined}
                  role={isMobile ? "tabpanel" : undefined}
                  aria-labelledby={isMobile ? `schedule-day-tab-${day}` : undefined}
                  hidden={isMobile && selectedDay !== day}
                >
                  <header>
                    <h3>{slots[0] ? formatDay(slots[0].start) : day}</h3>
                    <span>{slots.filter((slot) => slot.state === "available").length} open</span>
                  </header>
                  <div className="day-slots">
                    {collapseOccupiedSlots(slots).map((slot) => <Slot key={slot.start} slot={slot} onReserve={selectSlot} />)}
                  </div>
                </section>
              ))}
            </div>}
          </>
        )}
      </section>

      <section className="category-band" aria-labelledby="welcome-title">
        <p className="eyebrow">Who can reserve?</p>
        <h2 id="welcome-title">Neighbors of every kind are welcome.</h2>
        <div className="category-grid">
          {CATEGORIES.map((item) => <div className={`category-card ${categoryClass[item]}`} key={item}><span aria-hidden="true">{item === "Rescue Organization" ? "♥" : item === "Community Event" ? "●" : item === "Birthday / Private Party" ? "★" : item === "VIP Vaccine Clinic" ? "+" : "✓"}</span><strong>{item}</strong></div>)}
        </div>
      </section>

      {bookingSlot && (
          <BookingForm
            initialStart={bookingSlot === "open" ? undefined : bookingSlot.slot.start}
            maxDurationHours={bookingSlot === "open" ? 4 : bookingSlot.maxDurationHours}
            onClose={() => setBookingSlot(null)}
            onConfirmed={() => void load()}
          />
      )}
    </>
  );
}
