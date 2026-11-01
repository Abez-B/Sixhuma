import { describe, it, expect } from "vitest";
import { generateMeetingCode, isValidMeetingCode, normalizeMeetingCode } from "../MeetingCodeGen";

describe("MeetingCodeGen", () => {
  it("generates 4-character uppercase alphanumeric code", () => {
    const code = generateMeetingCode();
    expect(code).toHaveLength(4);
    expect(isValidMeetingCode(code)).toBe(true);
  });

  it("validates meeting code format", () => {
    expect(isValidMeetingCode("A3B7")).toBe(true);
    expect(isValidMeetingCode("a3b7")).toBe(true);
    expect(isValidMeetingCode("A3B")).toBe(false);
    expect(isValidMeetingCode("A3B7C")).toBe(false);
    expect(isValidMeetingCode("")).toBe(false);
    expect(isValidMeetingCode("A#B$")).toBe(false);
  });

  it("normalizes meeting codes to uppercase and trimmed", () => {
    expect(normalizeMeetingCode("  a3b7 ")).toBe("A3B7");
    expect(normalizeMeetingCode("Xy9Z")).toBe("XY9Z");
  });
});
