import { describe, expect, it } from "vitest";
import { isValidTimeZone, todayFor } from "./time";

describe("todayFor", () => {
  it("uses the player's timezone for the day boundary", () => {
    const instant = new Date("2026-10-08T23:30:00Z");
    expect(todayFor("UTC", instant)).toBe("2026-10-08");
    expect(todayFor("Asia/Tokyo", instant)).toBe("2026-10-09");
    expect(todayFor("America/Los_Angeles", instant)).toBe("2026-10-08");
  });
});

describe("isValidTimeZone", () => {
  it("accepts IANA names and rejects junk", () => {
    expect(isValidTimeZone("Asia/Tokyo")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("Not/AZone")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
  });
});
