import { afterEach, describe, expect, it, vi } from "vitest";
import { AntigravityExecutor } from "../../open-sse/executors/antigravity.js";

describe("Antigravity quota error details (local PR #4600 regression guards)", () => {
  afterEach(() => vi.useRealTimers());

  const now = new Date("2026-10-07T00:00:00Z");
  const parse = (status, details) => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    return new AntigravityExecutor().parseError({ status }, JSON.stringify({
      error: { message: "Quota exhausted", details },
    }));
  };

  it.each([409, 429])("extracts a future reset timestamp for HTTP %s", (status) => {
    const reset = "2026-10-07T05:00:00Z";
    expect(parse(status, [{ metadata: { quotaResetTimeStamp: reset } }])).toEqual({
      status, message: "Quota exhausted", resetsAtMs: Date.parse(reset),
    });
  });

  it("extracts fractional protobuf RetryInfo duration", () => {
    expect(parse(429, [{ retryDelay: "2.5s" }]).resetsAtMs).toBe(now.getTime() + 2500);
  });

  it("falls back to RetryInfo after invalid or past timestamps", () => {
    expect(parse(429, [
      { metadata: { quotaResetTimeStamp: "invalid" } },
      { metadata: { quotaResetTimeStamp: "2026-10-06T00:00:00Z" } },
      { retryDelay: "10s" },
    ]).resetsAtMs).toBe(now.getTime() + 10000);
  });

  it.each(["0s", "-1s", "invalid"])("does not synthesize resetAt for %s", (retryDelay) => {
    expect(parse(429, [{ retryDelay }])).not.toHaveProperty("resetsAtMs");
  });

  it("leaves non-quota errors on the default error path", () => {
    expect(parse(401, [{ retryDelay: "5s" }])).not.toHaveProperty("resetsAtMs");
  });

  it("fails open on malformed upstream JSON", () => {
    expect(new AntigravityExecutor().parseError({ status: 429 }, "not JSON")).toEqual({
      status: 429, message: "not JSON",
    });
  });
});