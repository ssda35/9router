// Codex (ChatGPT backend) speed tiers — `service_tier` on the Responses request.
// Mirrors the Codex desktop app: Standard (none) / Fast ("priority", alias "fast") / Ultrafast.
export const CODEX_SERVICE_TIER = Object.freeze({
  PRIORITY: "priority",
  ULTRAFAST: "ultrafast",
});

// Values the Codex executor forwards upstream; anything else is stripped.
export const CODEX_ALLOWED_SERVICE_TIERS = new Set(Object.values(CODEX_SERVICE_TIER));

// Client header to pick the Codex tier for /v1/messages (Claude-format) requests,
// e.g. Claude Code: ANTHROPIC_CUSTOM_HEADERS="x-codex-service-tier: priority".
export const CODEX_SERVICE_TIER_HEADER = "x-codex-service-tier";

const ALIASES = {
  fast: CODEX_SERVICE_TIER.PRIORITY,
  priority: CODEX_SERVICE_TIER.PRIORITY,
  ultrafast: CODEX_SERVICE_TIER.ULTRAFAST,
};
const STANDARD_VALUES = new Set(["standard", "default", "off", "none"]);

/**
 * Normalize a client-supplied Codex tier.
 * @returns {string|null|undefined} tier string, null = explicit Standard, undefined = not a Codex value (ignore)
 */
export function normalizeCodexServiceTier(value) {
  if (typeof value !== "string") return undefined;
  const v = value.trim().toLowerCase();
  if (ALIASES[v]) return ALIASES[v];
  if (STANDARD_VALUES.has(v)) return null;
  return undefined; // e.g. Anthropic "auto" / "standard_only" — not a Codex tier
}

/**
 * Resolve the Codex tier requested by a Claude-format (/v1/messages) request.
 * Precedence: header > body.service_tier (Codex values only) > body.speed.
 * @returns {string|null|undefined} see normalizeCodexServiceTier
 */
export function resolveClaudeCodexServiceTier(body, rawHeaders) {
  const fromHeader = normalizeCodexServiceTier(rawHeaders?.[CODEX_SERVICE_TIER_HEADER]);
  if (fromHeader !== undefined) return fromHeader;
  const fromBody = normalizeCodexServiceTier(body?.service_tier);
  if (fromBody !== undefined) return fromBody;
  return normalizeCodexServiceTier(body?.speed);
}
