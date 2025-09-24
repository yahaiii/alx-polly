// Simple in-memory rate limiter
// In production, use Redis or a proper rate limiting service

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class SimpleRateLimiter {
  private storage = new Map<string, RateLimitEntry>();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number = 5, windowMs: number = 60000) { // 5 requests per minute
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  check(identifier: string): { allowed: boolean; resetTime?: number } {
    const now = Date.now();
    const entry = this.storage.get(identifier);

    if (!entry || now > entry.resetTime) {
      // First request or window expired
      this.storage.set(identifier, {
        count: 1,
        resetTime: now + this.windowMs
      });
      return { allowed: true };
    }

    if (entry.count >= this.maxRequests) {
      return { allowed: false, resetTime: entry.resetTime };
    }

    entry.count++;
    return { allowed: true };
  }

  // Clean up expired entries periodically
  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.storage.entries()) {
      if (now > entry.resetTime) {
        this.storage.delete(key);
      }
    }
  }
}

export const votingRateLimiter = new SimpleRateLimiter(5, 60000); // 5 votes per minute
export const createPollRateLimiter = new SimpleRateLimiter(10, 300000); // 10 polls per 5 minutes

// Clean up expired entries every 5 minutes
setInterval(() => {
  votingRateLimiter.cleanup();
  createPollRateLimiter.cleanup();
}, 300000);

export function getClientIdentifier(userAgent: string, ip?: string): string {
  // Use a combination of IP and User-Agent for anonymous users
  // In production, consider using more sophisticated fingerprinting
  const identifier = `${ip || 'unknown'}_${userAgent || 'unknown'}`;
  return Buffer.from(identifier).toString('base64').substring(0, 32);
}