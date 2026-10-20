import { describe, expect, it } from "vitest";
import { CodexExecutor } from "../../open-sse/executors/codex.js";
import { claudeToOpenAIRequest } from "../../open-sse/translator/request/claude-to-openai.js";
import { openaiToOpenAIResponsesRequest } from "../../open-sse/translator/request/openai-responses.js";
import { resolveClaudeCodexServiceTier } from "../../open-sse/config/codexServiceTier.js";

const MODEL = "gpt-5.6-sol";

// Simulates /v1/messages → claude→openai → openai→responses → Codex executor
function claudeToCodex(claudeBody, headers = {}, credentials = {}) {
  credentials.rawHeaders = headers;
  const openai = claudeToOpenAIRequest(MODEL, claudeBody, true, credentials);
  const responses = openaiToOpenAIResponsesRequest(MODEL, openai, true, credentials);
  return { openai, body: new CodexExecutor().transformRequest(MODEL, responses, true, credentials) };
}

const baseClaude = (extra = {}) => ({
  model: MODEL,
  max_tokens: 1024,
  messages: [{ role: "user", content: "hi" }],
  ...extra,
});

describe("Codex service tier for /v1/messages (Claude source)", () => {
  it("defaults to Standard (no service_tier) when nothing is requested", () => {
    const { body } = claudeToCodex(baseClaude());
    expect(body.service_tier).toBeUndefined();
  });

  it.each([
    ["priority", "priority"],
    ["fast", "priority"],
    ["FAST", "priority"],
    ["ultrafast", "ultrafast"],
  ])("header x-codex-service-tier=%s → %s", (value, expected) => {
    const { body } = claudeToCodex(baseClaude(), { "x-codex-service-tier": value });
    expect(body.service_tier).toBe(expected);
  });

  it("body service_tier with a Codex value is honored", () => {
    const { body } = claudeToCodex(baseClaude({ service_tier: "priority" }));
    expect(body.service_tier).toBe("priority");
  });

  it("Claude Code speed:\"fast\" maps to priority", () => {
    const { body } = claudeToCodex(baseClaude({ speed: "fast" }));
    expect(body.service_tier).toBe("priority");
  });

  it("Anthropic-only service_tier values are ignored (Standard)", () => {
    for (const v of ["auto", "standard_only"]) {
      const { body } = claudeToCodex(baseClaude({ service_tier: v }));
      expect(body.service_tier).toBeUndefined();
    }
  });

  it("header wins over body; header 'standard' forces Standard", () => {
    expect(claudeToCodex(baseClaude({ speed: "fast" }), { "x-codex-service-tier": "ultrafast" }).body.service_tier)
      .toBe("ultrafast");
    expect(claudeToCodex(baseClaude({ speed: "fast" }), { "x-codex-service-tier": "standard" }).body.service_tier)
      .toBeUndefined();
  });

  it("invalid header value falls back to body", () => {
    const { body } = claudeToCodex(baseClaude({ speed: "fast" }), { "x-codex-service-tier": "turbo" });
    expect(body.service_tier).toBe("priority");
  });

  it("never puts service_tier on the OpenAI intermediate (other upstreams unaffected)", () => {
    const { openai } = claudeToCodex(baseClaude({ speed: "fast" }), { "x-codex-service-tier": "priority" });
    expect(openai.service_tier).toBeUndefined();
    expect(openai.speed).toBeUndefined();
  });

  it("does not leak the tier into a later request reusing the credentials object", () => {
    const credentials = {};
    claudeToCodex(baseClaude(), { "x-codex-service-tier": "priority" }, credentials);
    // later non-Claude request on same credentials object: chatCore assigns fresh rawHeaders
    credentials.rawHeaders = {};
    const body = new CodexExecutor().transformRequest(MODEL, { model: MODEL, input: "hi" }, true, credentials);
    expect(body.service_tier).toBeUndefined();
  });
});

describe("Codex executor service tier allowlist (all sources)", () => {
  it.each([
    ["fast", "priority"],
    ["priority", "priority"],
    ["ultrafast", "ultrafast"],
    ["flex", undefined],
    ["default", undefined],
    ["auto", undefined],
  ])("service_tier %s → %s", (value, expected) => {
    const body = new CodexExecutor().transformRequest(MODEL, { model: MODEL, input: "hi", service_tier: value }, true, {});
    expect(body.service_tier).toBe(expected);
  });
});

describe("resolveClaudeCodexServiceTier", () => {
  it("returns undefined when nothing Codex-like is present", () => {
    expect(resolveClaudeCodexServiceTier({}, {})).toBeUndefined();
    expect(resolveClaudeCodexServiceTier({ speed: 2 }, null)).toBeUndefined();
  });
});
