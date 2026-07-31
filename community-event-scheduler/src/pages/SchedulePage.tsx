import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../api";
import BookingForm from "../components/BookingForm";
import { CATEGORIES, type AvailabilityResponse, type Category, type PublicSlot } from "../types";
import { dateKey, formatDay, formatTime, moveWeek, startOfWeek } from "../date";

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
      <button className="slot available" onClick={() => onReserve(slot)}>
        <span>{formatTime(slot.start)}</span>
        <strong>Available</strong>
      </button>
    );
  }
  if (slot.state === "booked") {
    return (
      <div className={`slot booked ${slot.category ? categoryClass[slot.category] : ""}`}>
        <span>{formatTime(slot.start)}</span>
        <strong>{slot.groupName}</strong>
        <small>{slot.category}</small>
      </div>
    );
  }
  return (
    <div className={`slot ${slot.state}`}>
      <span>{formatTime(slot.start)}</span>
      <strong>{slot.state === "pending" ? "Temporarily held" : "Unavailable"}</strong>
    </div>
  );
}

export default function SchedulePage() {
  const [week, setWeek] = useState(startOfWeek());
  const [data, setData] = useState<AvailabilityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<"week" | "list">("week");
  const [category, setCategory] = useState<Category | "all">("all");
  const [bookingSlot, setBookingSlot] = useState<PublicSlot | "open" | null>(null);

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
  useEffect(() => {
    if (!bookingSlot) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setBookingSlot(null); };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [bookingSlot]);

  const days = useMemo(() => {
    const grouped = new Map<string, PublicSlot[]>();
    for (const slot of data?.slots ?? []) {
      if (category !== "all" && slot.state === "booked" && slot.category !== category) continue;
      const key = dateKey(slot.start);
      grouped.set(key, [...(grouped.get(key) ?? []), slot]);
    }
    return [...grouped.entries()];
  }, [data, category]);

  const selectSlot = (slot: PublicSlot) => setBookingSlot(slot);

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Your neighborhood event space</p>
          <h1>Bring pets and people together.</h1>
          <p>Find an open time, tell us about your group, and confirm by email. No account or password needed.</p>
          <button className="button primary hero-cta" onClick={() => setBookingSlot("open")}>Reserve the space</button>
        </div>
        <aside className="how-card" aria-label="How reservations work">
          <h2>Simple from start to finish</h2>
          <ol>
            <li><span>1</span><div><strong>Pick a time</strong><small>Choose up to four hours.</small></div></li>
            <li><span>2</span><div><strong>Share the basics</strong><small>Your contact details stay private.</small></div></li>
            <li><span>3</span><div><strong>Check your email</strong><small>One code confirms your reservation.</small></div></li>
          </ol>
        </aside>
      </section>

      <section className="schedule-section" aria-labelledby="schedule-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">One shared space · 30-minute blocks</p>
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
            <button onClick={() => setWeek(moveWeek(week, -1))} aria-label="Previous week">←</button>
            <button className="today-button" onClick={() => setWeek(startOfWeek())}>This week</button>
            <button onClick={() => setWeek(moveWeek(week, 1))} aria-label="Next week">→</button>
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

        {loading && <div className="state-card" role="status">Loading the neighborhood schedule…</div>}
        {error && <div className="state-card error-state" role="alert"><strong>We couldn’t load the schedule.</strong><span>{error}</span><button className="button ghost" onClick={() => void load()}>Try again</button></div>}
        {!loading && !error && (
          <div className={view === "week" ? "week-grid" : "list-view"}>
            {days.map(([day, slots]) => (
              <section className="day-card" key={day}>
                <header>
                  <h3>{slots[0] ? formatDay(slots[0].start) : day}</h3>
                  <span>{slots.filter((slot) => slot.state === "available").length} open</span>
                </header>
                <div className="day-slots">
                  {slots.length ? slots.map((slot) => <Slot key={slot.start} slot={slot} onReserve={selectSlot} />) : <p className="closed-day">No times available</p>}
                </div>
              </section>
            ))}
          </div>
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
        <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setBookingSlot(null); }}>
          <BookingForm
            initialStart={bookingSlot === "open" ? undefined : bookingSlot.start}
            initialEnd={bookingSlot === "open" ? undefined : bookingSlot.end}
            onClose={() => setBookingSlot(null)}
            onConfirmed={() => void load()}
          />
        </div>
      )}
    </>
  );
}
