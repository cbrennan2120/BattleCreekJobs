import { Resend } from "resend";
import { env, isNetlifyRuntime } from "./env";

function escape(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", "\"": "&quot;" })[character]!);
}

async function send(to: string | string[], subject: string, html: string): Promise<void> {
  const key = env("RESEND_API_KEY");
  const from = env("FROM_EMAIL");
  if (!key || !from) {
    if (!isNetlifyRuntime() && env("MAIL_MODE") === "console") {
      console.info("MAIL", { to, subject, html });
      return;
    }
    throw new Error("Email delivery is not configured.");
  }
  const { error } = await new Resend(key).emails.send({ from, to, subject, html });
  if (error) throw new Error(error.message);
}

export async function sendVerification(email: string, code: string, groupName: string): Promise<void> {
  await send(email, "Your PSP event-space verification code", `<div style="font-family:Arial,sans-serif;max-width:600px"><h1 style="color:#00af41">Almost there!</h1><p>Use this code to confirm <strong>${escape(groupName)}</strong>:</p><p style="font-size:36px;font-weight:900;letter-spacing:8px">${code}</p><p>This code and your held time expire in ten minutes.</p><p>Pet Supplies Plus Battle Creek<br>1791 W. Columbia Ave.</p></div>`);
}

export async function sendConfirmation(input: { email: string; groupName: string; category: string; startLabel: string; endLabel: string; manageUrl: string }): Promise<void> {
  await send(input.email, "Your PSP Battle Creek event is confirmed", `<div style="font-family:Arial,sans-serif;max-width:600px"><h1 style="color:#00af41">You’re booked!</h1><p><strong>${escape(input.groupName)}</strong><br>${escape(input.category)}<br>${escape(input.startLabel)}–${escape(input.endLabel)}</p><p><a href="${escape(input.manageUrl)}" style="display:inline-block;background:#00af41;color:#000;border:2px solid #000;border-radius:30px;padding:12px 20px;font-weight:700">Manage reservation</a></p><p>This link is private. Use it to cancel or choose another time.</p></div>`);
  const staff = env("STAFF_NOTIFICATION_EMAIL");
  if (staff) await send(staff, `New community booking: ${input.groupName}`, `<p><strong>${escape(input.groupName)}</strong> has confirmed an event.</p><p>${escape(input.category)}<br>${escape(input.startLabel)}–${escape(input.endLabel)}</p><p>Open the private staff dashboard for contact information.</p>`);
}

export async function sendChanged(email: string, groupName: string, message: string): Promise<void> {
  await send(email, `PSP event update: ${groupName}`, `<div style="font-family:Arial,sans-serif;max-width:600px"><h1 style="color:#00af41">Reservation updated</h1><p>${escape(message)}</p><p>Pet Supplies Plus Battle Creek</p></div>`);
}

export async function sendManualEntrySummary(input: {
  email: string;
  groupName: string;
  action: "created" | "updated" | "cancelled";
  dates: string[];
  skipped?: number;
}): Promise<void> {
  const labels = { created: "scheduled", updated: "updated", cancelled: "cancelled" } as const;
  const dateList = input.dates.length
    ? `<ul>${input.dates.map((date) => `<li>${escape(date)}</li>`).join("")}</ul>`
    : "<p>No remaining dates.</p>";
  const skipped = input.skipped ? `<p>${input.skipped} conflicting date${input.skipped === 1 ? " was" : "s were"} skipped and not changed.</p>` : "";
  await send(input.email, `PSP staff event ${labels[input.action]}: ${input.groupName}`, `<div style="font-family:Arial,sans-serif;max-width:600px"><h1 style="color:#00af41">Event ${labels[input.action]}</h1><p>Store staff ${labels[input.action]} <strong>${escape(input.groupName)}</strong> for:</p>${dateList}${skipped}<p>This entry was created by store staff, so changes are handled by Pet Supplies Plus Battle Creek.</p></div>`);
}
