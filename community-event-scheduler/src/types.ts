export const CATEGORIES = [
  "Rescue Organization",
  "Community Event",
  "Birthday / Private Party",
  "VIP Vaccine Clinic",
  "Dog Trainer",
] as const;

export type Category = (typeof CATEGORIES)[number];
export type SlotState = "available" | "pending" | "booked" | "blackout";

export interface PublicSlot {
  start: string;
  end: string;
  state: SlotState;
  groupName?: string;
  category?: Category;
}

export interface AvailabilityResponse {
  timezone: string;
  weekStart: string;
  generatedAt: string;
  slots: PublicSlot[];
}

export interface BookingStartInput {
  groupName: string;
  category: Category;
  contactName: string;
  email: string;
  phone?: string;
  privateNotes?: string;
  start: string;
  end: string;
  turnstileToken?: string;
}

export interface AdminBooking {
  id: string;
  groupName: string;
  category: Category;
  contactName?: string;
  email?: string;
  phone?: string;
  privateNotes?: string;
  start: string;
  end: string;
  status: "pending_verification" | "confirmed" | "cancelled" | "expired";
  createdAt: string;
  confirmedAt?: string | null;
  expiresAt?: string | null;
  source: "public" | "admin_manual";
  seriesId?: string | null;
  occurrenceKey?: string | null;
  isException: boolean;
}

export type RecurrenceEnd = { type: "until"; date: string } | { type: "count"; count: number };
export type RecurrenceRule =
  | { frequency: "none" }
  | { frequency: "daily"; interval: number; end: RecurrenceEnd }
  | { frequency: "weekly"; interval: number; weekdays: number[]; end: RecurrenceEnd }
  | { frequency: "monthly"; interval: number; mode: "day_of_month"; dayOfMonth: number; end: RecurrenceEnd }
  | { frequency: "monthly"; interval: number; mode: "ordinal_weekday"; ordinal: -1 | 1 | 2 | 3 | 4 | 5; weekday: number; end: RecurrenceEnd };

export type ManualEntryDraft = {
  startDate: string;
  startTime: string;
  durationMinutes: number;
  recurrence: RecurrenceRule;
} & (
  | { entryType: "event"; event: { groupName: string; category: Category; contactName?: string; email?: string; phone?: string; privateNotes?: string } }
  | { entryType: "hold"; hold: { reason: string } }
);

export interface ManualOccurrence {
  id?: string;
  occurrenceKey: string;
  date: string;
  time: string;
  start?: string;
  end?: string;
  status?: "open" | "conflict" | "skipped";
  reason?: string;
}
