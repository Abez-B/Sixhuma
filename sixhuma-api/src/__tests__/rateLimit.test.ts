import { describe, it, expect } from "vitest";
import { RateLimiter } from "../lib/rateLimit";

describe("RateLimiter", () => {
  it("allows requests up to max limit and blocks exceeding requests", () => {
    const limiter = new RateLimiter({ windowMs: 1000, max: 3 });
    const key = "user-123";

    expect(limiter.allow(key)).toBe(true); // 1
    expect(limiter.allow(key)).toBe(true); // 2
    expect(limiter.allow(key)).toBe(true); // 3
    expect(limiter.allow(key)).toBe(false); // 4 - blocked
    expect(limiter.allow(key)).toBe(false); // 5 - blocked

    // Different key should still be allowed
    expect(limiter.allow("user-456")).toBe(true);
  });

  it("resets rate limit for key when requested", () => {
    const limiter = new RateLimiter({ windowMs: 1000, max: 2 });
    const key = "user-reset";

    expect(limiter.allow(key)).toBe(true);
    expect(limiter.allow(key)).toBe(true);
    expect(limiter.allow(key)).toBe(false);

    limiter.reset(key);
    expect(limiter.allow(key)).toBe(true);
  });

  it("cleans up expired entries", async () => {
    const limiter = new RateLimiter({ windowMs: 50, max: 2 });
    limiter.allow("temp-user");

    await new Promise((resolve) => setTimeout(resolve, 60));
    limiter.cleanup();

    // After cleanup and window expiry, new requests should be allowed
    expect(limiter.allow("temp-user")).toBe(true);
  });
});
