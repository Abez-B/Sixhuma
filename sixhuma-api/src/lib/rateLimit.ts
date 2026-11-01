/**
 * Simple in-memory sliding window rate limiter for socket and HTTP events.
 */
export interface RateLimitOptions {
  windowMs: number;
  max: number;
}

export class RateLimiter {
  private hits: Map<string, number[]> = new Map();
  private windowMs: number;
  private max: number;

  constructor(options: RateLimitOptions) {
    this.windowMs = options.windowMs;
    this.max = options.max;
  }

  /**
   * Checks if the key is within rate limits.
   * Returns true if allowed, false if limit exceeded.
   */
  allow(key: string): boolean {
    const now = Date.now();
    const timestamps = this.hits.get(key) || [];

    // Filter out timestamps outside the sliding window
    const valid = timestamps.filter((ts) => now - ts < this.windowMs);

    if (valid.length >= this.max) {
      this.hits.set(key, valid);
      return false;
    }

    valid.push(now);
    this.hits.set(key, valid);
    return true;
  }

  /**
   * Resets rate limit for a specific key
   */
  reset(key: string): void {
    this.hits.delete(key);
  }

  /**
   * Cleans up expired rate limit entries to prevent memory leaks
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, timestamps] of this.hits.entries()) {
      const valid = timestamps.filter((ts) => now - ts < this.windowMs);
      if (valid.length === 0) {
        this.hits.delete(key);
      } else {
        this.hits.set(key, valid);
      }
    }
  }
}

// Pre-configured rate limiters
export const chatRateLimiter = new RateLimiter({ windowMs: 5000, max: 10 }); // 10 msgs / 5s
export const dmRateLimiter = new RateLimiter({ windowMs: 5000, max: 10 }); // 10 DMs / 5s
export const reactionRateLimiter = new RateLimiter({ windowMs: 3000, max: 15 }); // 15 reactions / 3s
export const createMeetingRateLimiter = new RateLimiter({ windowMs: 60000, max: 5 }); // 5 meetings / 1min
export const announcementRateLimiter = new RateLimiter({ windowMs: 10000, max: 3 }); // 3 announcements / 10s

// Periodic cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    chatRateLimiter.cleanup();
    dmRateLimiter.cleanup();
    reactionRateLimiter.cleanup();
    createMeetingRateLimiter.cleanup();
    announcementRateLimiter.cleanup();
  }, 5 * 60 * 1000).unref?.();
}
