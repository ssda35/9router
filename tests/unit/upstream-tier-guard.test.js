import { describe, expect, it } from "vitest";
import { getModelUpstreamId } from "../../open-sse/config/providerModels.js";

// Local guard on top of upstream #82aeb90: client effort may pick a tier only for
// unadorned model ids; ids that already name a tier keep it.
describe("getModelUpstreamId tier guard", () => {
  it.each([
    ["gemini-4-argon-high", { reasoning_effort: "low" }, "gemini-4-argon-high(high)"],
    ["gemini-4-argon-high", { thinking: { type: "enabled", budget_tokens: 2000 } }, "gemini-4-argon-high(high)"],
    ["gemini-4-argon-low", { reasoning_effort: "high" }, "gemini-4-argon-low(low)"],
    ["claude-opus-5-5-high", { output_config: { effort: "low" } }, "claude-opus-5-5-high(high)"],
    ["claude-sonnet-5-5-medium", { output_config: { effort: "max" } }, "claude-sonnet-5-5-medium(medium)"],
  ])("keeps the named tier of %s", (model, body, expected) => {
    expect(getModelUpstreamId("ag", model, body)).toBe(expected);
  });

  it("still resolves unadorned ids from client effort", () => {
    expect(getModelUpstreamId("ag", "claude-opus-5-5", { output_config: { effort: "medium" } }))
      .toBe("claude-opus-5-5-medium(medium)");
    expect(getModelUpstreamId("ag", "claude-opus-5-5", null)).toBe("claude-opus-5-5-high(high)");
  });

  it("honors an explicit (level) suffix even on a tiered id", () => {
    expect(getModelUpstreamId("ag", "gemini-4-argon-high(low)", null)).toBe("gemini-4-argon-high(low)");
  });
});
