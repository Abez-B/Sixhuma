import { describe, it, expect } from "vitest";
import { parseProfile } from "../types";

describe("parseProfile", () => {
  it("parses valid profile json correctly", () => {
    const raw = JSON.stringify({
      name: "Alice",
      linkedIn: "https://linkedin.com/in/alice",
      github: "https://github.com/alice",
      bio: "Software Architect",
      tags: ["#AI", "#Svelte"],
    });

    const parsed = parseProfile(raw);
    expect(parsed).toEqual({
      name: "Alice",
      linkedIn: "https://linkedin.com/in/alice",
      github: "https://github.com/alice",
      portfolio: undefined,
      bio: "Software Architect",
      photo: undefined,
      tags: ["#AI", "#Svelte"],
    });
  });

  it("handles malformed JSON gracefully", () => {
    expect(parseProfile("invalid-json{")).toBeNull();
    expect(parseProfile("")).toBeNull();
  });

  it("fills defaults for missing fields", () => {
    const parsed = parseProfile("{}");
    expect(parsed).toEqual({
      name: "",
      linkedIn: "",
      portfolio: undefined,
      github: undefined,
      bio: undefined,
      photo: undefined,
      tags: [],
    });
  });
});
