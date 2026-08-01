// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef, useState } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@marsidev/react-turnstile", async () => {
  const React = await import("react");
  return {
    Turnstile: React.forwardRef(function FakeTurnstile(props: { onSuccess: (token: string) => void; onExpire: () => void; onError: () => void }, ref) {
      React.useImperativeHandle(ref, () => ({ reset: vi.fn() }));
      return <div><button onClick={() => props.onSuccess("fresh-token")}>captcha-success</button><button onClick={props.onExpire}>captcha-expire</button><button onClick={props.onError}>captcha-error</button></div>;
    }),
  };
});

import AccessibleDialog from "../src/components/AccessibleDialog";
import AccessibleTabs from "../src/components/AccessibleTabs";
import CaptchaChallenge, { type CaptchaChallengeHandle } from "../src/components/CaptchaChallenge";
import { DateHourFields, HourSelect } from "../src/components/HourFields";
import { combineStoreLocalInput, formatHourValue, splitStoreLocalInput } from "../src/date";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  globalThis.requestAnimationFrame = (callback) => { callback(0); return 0; };
});
afterEach(cleanup);

describe("whole-hour controls", () => {
  it("splits, combines, and labels store-local hours", () => {
    expect(splitStoreLocalInput("2026-08-08T14:00")).toEqual({ date: "2026-08-08", hour: "14:00" });
    expect(combineStoreLocalInput("2026-08-08", "14:00")).toBe("2026-08-08T14:00");
    expect(formatHourValue("00:00")).toBe("12:00 AM");
    expect(formatHourValue("14:00")).toBe("2:00 PM");
  });

  it("offers 24 hours and disables boundary hours", () => {
    render(<HourSelect ariaLabel="Start time" value="14:00" minValue="13:00" maxValue="16:00" onChange={() => undefined} />);
    expect(screen.getAllByRole("option")).toHaveLength(24);
    expect(screen.getByRole("option", { name: "12:00 PM" })).toBeDisabled();
    expect(screen.getByRole("option", { name: "4:00 PM" })).not.toBeDisabled();
    expect(screen.getByRole("option", { name: "5:00 PM" })).toBeDisabled();
  });

  it("clamps the selected hour when a boundary date is chosen", () => {
    const change = vi.fn();
    render(<DateHourFields idPrefix="test" value="" min="2026-08-08T14:00" max="2026-08-10T18:00" onChange={change} />);
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-08-08" } });
    expect(change).toHaveBeenLastCalledWith("2026-08-08T14:00");
  });
});

it("implements linked tabs with arrow, Home, and End navigation", () => {
  const select = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
  const { rerender } = render(<AccessibleTabs idPrefix="days" className="tabs" label="Days" selected="mon" onSelect={select} items={[{ id: "mon", label: "Monday" }, { id: "tue", label: "Tuesday" }, { id: "wed", label: "Wednesday" }]} />);
  const monday = screen.getByRole("tab", { name: "Monday" });
  expect(monday).toHaveAttribute("aria-controls", "days-panel-mon");
  fireEvent.keyDown(monday, { key: "ArrowRight" });
  expect(select).toHaveBeenCalledWith("tue");
  rerender(<AccessibleTabs idPrefix="days" className="tabs" label="Days" selected="tue" onSelect={select} items={[{ id: "mon", label: "Monday" }, { id: "tue", label: "Tuesday" }, { id: "wed", label: "Wednesday" }]} />);
  fireEvent.keyDown(screen.getByRole("tab", { name: "Tuesday" }), { key: "End" });
  expect(select).toHaveBeenLastCalledWith("wed");
});

it("opens a modal dialog, closes on Escape, and restores focus", async () => {
  function Harness() {
    const [open, setOpen] = useState(false);
    return <><button onClick={(event) => { event.currentTarget.focus(); setOpen(true); }}>Open</button>{open && <AccessibleDialog labelledBy="title" onClose={() => setOpen(false)} initialFocusSelector="#first"><h2 id="title">Dialog</h2><button id="first">First</button></AccessibleDialog>}</>;
  }
  render(<Harness />);
  const opener = screen.getByRole("button", { name: "Open" });
  fireEvent.click(opener);
  fireEvent(screen.getByRole("dialog"), new Event("cancel", { bubbles: false, cancelable: true }));
  await waitFor(() => expect(opener).toHaveFocus());
});

it("clears CAPTCHA tokens on expiration, error, and an imperative rejected-request reset", () => {
  const change = vi.fn();
  const ref = createRef<CaptchaChallengeHandle>();
  render(<CaptchaChallenge ref={ref} siteKey="test" onTokenChange={change} />);
  fireEvent.click(screen.getByText("captcha-success"));
  expect(change).toHaveBeenLastCalledWith("fresh-token");
  fireEvent.click(screen.getByText("captcha-expire"));
  expect(change).toHaveBeenLastCalledWith("");
  fireEvent.click(screen.getByText("captcha-error"));
  expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  expect(change).toHaveBeenLastCalledWith("");
  fireEvent.click(screen.getByRole("button", { name: /retry/i }));
  expect(screen.getByText(/refreshed/i)).toBeInTheDocument();
  ref.current?.reset("Rejected request");
  expect(change).toHaveBeenLastCalledWith("");
});
