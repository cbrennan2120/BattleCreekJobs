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

export interface AdminBooking extends BookingStartInput {
  id: string;
  status: "pending_verification" | "confirmed" | "cancelled" | "expired";
  createdAt: string;
  confirmedAt?: string | null;
  expiresAt?: string | null;
}
