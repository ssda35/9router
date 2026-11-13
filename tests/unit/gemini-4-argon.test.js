import { describe, expect, it } from "vitest";

import { getModelUpstreamId } from "../../open-sse/config/providerModels.js";
import { AntigravityExecutor } from "../../open-sse/executors/antigravity.js";
import { getCapabilitiesForModel } from "../../open-sse/providers/capabilities.js";
import { getThinkingLevels } from "../../open-sse/providers/thinkingLevels.js";
import { applyThinking, stripThinkingSuffix } from "../../open-sse/translator/concerns/thinkingUnified.js";
import { claudeToOpenAIRequest } from "../../open-sse/translator/request/claude-to-openai.js";

describe("Gemini 4 Argon capabilities", () => {
  it.each(["gemini", "vertex", "antigravity"])("declares level-based always-on reasoning on %s", (provider) => {
    const model = provider === "antigravity" ? "gemini-4-argon-high" : "gemini-4-argon";
    const caps = getCapabilitiesForModel(provider, model);
    expect(caps.reasoning).toBe(true);
    expect(caps.thinkingFormat).toBe("gemini-level");
    expect(caps.thinkingCanDisable).toBe(false);
    expect(caps.contextWindow).toBe(1048576);
    expect(caps.maxOutput).toBe(65536);
    expect(getThinkingLevels(provider, model)).toEqual(["low", "medium", "high"]);
  });
});

describe("Gemini 4 Argon thinking clamp", () => {
  // Argon rejects thinkingLevel "minimal" (and thinkingBudget) with HTTP 400 —
  // every path that would emit "minimal" must clamp to the lowest supported level.
  it("clamps an explicit reasoning_effort none to low", () => {
    const body = { reasoning_effort: "none" };
    applyThinking("gemini", "gemini-4-argon", body, "vertex");
    expect(body.generationConfig.thinkingConfig).toEqual({ thinkingLevel: "low", includeThoughts: true });
  });

  it("clamps a small thinking budget (minimal after conversion) to low", () => {
    const body = { thinking: { type: "enabled", budget_tokens: 512 } };
    applyThinking("gemini", "gemini-4-argon", body, "vertex");
    expect(body.generationConfig.thinkingConfig).toEqual({ thinkingLevel: "low", includeThoughts: true });
  });

  it("passes supported levels through untouched", () => {
    const body = { reasoning_effort: "high" };
    applyThinking("gemini", "gemini-4-argon", body, "vertex");
    expect(body.generationConfig.thinkingConfig.thinkingLevel).toBe("high");
  });

  it("keeps minimal for Gemini 3 models (regression guard)", () => {
    const body = { reasoning_effort: "none" };
    applyThinking("gemini", "gemini-3.8-flash", body, "gemini");
    expect(body.generationConfig.thinkingConfig).toEqual({ thinkingLevel: "minimal", includeThoughts: false });
  });
});

describe("Gemini 4 Argon Antigravity tier", () => {
  it.each([
    ["gemini-4-argon-high", "high"],
    ["gemini-4-argon-medium", "medium"],
    ["gemini-4-argon-low", "low"],
  ])("maps %s to the wire model with a %s thinking level", (modelId, expectedLevel) => {
    const upstreamModel = getModelUpstreamId("ag", modelId);
    expect(upstreamModel).toBe(`${modelId}(${expectedLevel})`);

    const body = {
      model: stripThinkingSuffix(upstreamModel),
      request: {
        contents: [{ role: "user", parts: [{ text: "hello" }] }],
        generationConfig: {},
      },
    };

    applyThinking("antigravity", upstreamModel, body, "antigravity");
    const finalBody = new AntigravityExecutor().transformRequest(
      modelId,
      body,
      true,
      { projectId: "project", connectionId: "connection" }
    );

    expect(finalBody.model).toBe(modelId);
    expect(finalBody.request.generationConfig.thinkingConfig).toEqual({ thinkingLevel: expectedLevel, includeThoughts: true });
  });
});

describe("Gemini 4 Hydrogen & Orchestrator on Antigravity", () => {
  it.each([
    "gemini-4-hydrogen-xhigh",
    "gemini-4-hydrogen-high",
    "gemini-4-hydrogen-medium",
    "gemini-4-hydrogen-low",
    "gemini-4-hydrogen",
  ])("declares 262144 maxOutput and xhigh thinking support for %s", (model) => {
    const caps = getCapabilitiesForModel("antigravity", model);
    expect(caps.reasoning).toBe(true);
    expect(caps.thinkingFormat).toBe("gemini-level");
    expect(caps.thinkingCanDisable).toBe(false);
    expect(caps.contextWindow).toBe(1048576);
    expect(caps.maxOutput).toBe(262144);
    expect(getThinkingLevels("antigravity", model)).toEqual(["low", "medium", "high", "xhigh"]);
  });

  it("declares Argon-aligned capabilities for gemini-pro-orchestrator-g1-pro", () => {
    const caps = getCapabilitiesForModel("antigravity", "gemini-pro-orchestrator-g1-pro");
    expect(caps.reasoning).toBe(true);
    expect(caps.thinkingFormat).toBe("gemini-level");
    expect(caps.thinkingCanDisable).toBe(false);
    expect(caps.contextWindow).toBe(1048576);
    expect(caps.maxOutput).toBe(65536);
    expect(getThinkingLevels("antigravity", "gemini-pro-orchestrator-g1-pro")).toEqual(["low", "medium", "high"]);
  });

  it.each([
    ["gemini-4-hydrogen-xhigh", "gemini-4-hydrogen-xhigh", "xhigh"],
    ["gemini-4-hydrogen-high", "gemini-4-hydrogen-high", "high"],
    ["gemini-4-hydrogen-medium", "gemini-4-hydrogen-medium", "medium"],
    ["gemini-4-hydrogen-low", "gemini-4-hydrogen-low", "low"],
    ["gemini-4-hydrogen", "gemini-4-hydrogen-high", "high"],
    ["gemini-pro-orchestrator-g1-pro", "gemini-pro-orchestrator-g1-pro", "high"],
  ])("maps %s to wire model %s with %s thinkingLevel", (modelId, expectedWireModel, expectedLevel) => {
    const upstreamModel = getModelUpstreamId("ag", modelId);
    expect(upstreamModel).toBe(`${expectedWireModel}(${expectedLevel})`);

    const body = {
      model: stripThinkingSuffix(upstreamModel),
      request: {
        contents: [{ role: "user", parts: [{ text: "hello" }] }],
        generationConfig: {},
      },
    };

    applyThinking("antigravity", upstreamModel, body, "antigravity");
    const finalBody = new AntigravityExecutor().transformRequest(
      expectedWireModel,
      body,
      true,
      { projectId: "project", connectionId: "connection" }
    );

    expect(finalBody.model).toBe(expectedWireModel);
    expect(finalBody.request.generationConfig.thinkingConfig).toEqual({ thinkingLevel: expectedLevel, includeThoughts: true });
  });

  it("routes unadorned gemini-4-hydrogen with reasoning_effort xhigh to gemini-4-hydrogen-xhigh(xhigh)", () => {
    expect(getModelUpstreamId("ag", "gemini-4-hydrogen", { reasoning_effort: "xhigh" })).toBe("gemini-4-hydrogen-xhigh(xhigh)");
    expect(getModelUpstreamId("ag", "gemini-4-hydrogen-xhigh", { reasoning_effort: "low" })).toBe("gemini-4-hydrogen-xhigh(xhigh)");
  });

  it("preserves 262144 max_tokens across Claude-to-OpenAI translation for Gemini 4 Hydrogen", () => {
    const res = claudeToOpenAIRequest("gemini-4-hydrogen-xhigh", {
      max_tokens: 262144,
      messages: [{ role: "user", content: "hello" }],
    }, true);
    expect(res.max_tokens).toBe(262144);
  });
});
