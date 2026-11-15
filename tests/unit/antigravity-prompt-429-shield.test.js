import { describe, expect, it } from "vitest";

import { ANTIGRAVITY_SYSTEM_ANCHOR } from "../../open-sse/config/appConstants.js";
import {
  AntigravityExecutor,
  ANTIGRAVITY_PROMPT_REJECTED_MESSAGE,
  isAntigravityPromptRejection,
} from "../../open-sse/executors/antigravity.js";
import { checkFallbackError } from "../../open-sse/services/accountFallback.js";
import { claudeToOpenAIRequest } from "../../open-sse/translator/request/claude-to-openai.js";
import { openaiResponsesToOpenAIRequest } from "../../open-sse/translator/request/openai-responses.js";
import { openaiToAntigravityRequest } from "../../open-sse/translator/request/openai-to-gemini.js";

function transformOpenAISystem(model, systemContent, userContent = "hello") {
  const body = openaiToAntigravityRequest(
    model,
    {
      messages: [
        { role: "system", content: systemContent },
        { role: "user", content: userContent },
      ],
    },
    true
  );
  const finalBody = new AntigravityExecutor().transformRequest(model, body, true, {});
  const rawSystemField = finalBody.request.systemInstruction?.parts?.map((p) => p.text).join("\n") ?? "";
  const firstParts = finalBody.request.contents?.[0]?.parts ?? [];
  return {
    finalBody,
    rawSystemField,
    systemText: firstParts[0]?.text ?? "",
    userText: firstParts.slice(1).map((p) => p.text).join("\n") ?? "",
  };
}

function transformClaudeMessagesSystem(model, systemBlocks, userContent = "hello") {
  const oai = claudeToOpenAIRequest(
    model,
    {
      model,
      max_tokens: 4096,
      system: systemBlocks,
      messages: [{ role: "user", content: userContent }],
    },
    true
  );
  const agBody = openaiToAntigravityRequest(model, oai, true);
  const finalBody = new AntigravityExecutor().transformRequest(model, agBody, true, {});
  expect(finalBody.request.systemInstruction?.parts?.map((p) => p.text).join("\n")).toBe(ANTIGRAVITY_SYSTEM_ANCHOR);
  return finalBody.request.contents?.[0]?.parts?.[0]?.text ?? "";
}

describe("Antigravity prompt-triggered 429 shield", () => {
  const models = ["gemini-4-hydrogen-high", "gemini-3.8-flash-high", "claude-sonnet-5-5-high"];

  describe("Pi (pi-coding-agent) system prompt", () => {
    for (const model of models) {
      it(`relocates and rewrites Pi preamble on ${model} while keeping rules, docs paths, and user text intact`, () => {
        const piPrompt = [
          "You are a coding assistant running inside pi, a coding agent harness. Help users inspect files, run commands, and modify code.",
          "<tools>\n- read: Read file contents\n</tools>",
          "<docs>\nPi documentation (read only when the user asks about the harness itself, its SDK, extensions, themes, skills, or TUI):\n- Main documentation: /opt/node_modules/@earendil-works/pi-coding-agent/README.md\n</docs>",
          "## Memory\n- Fixed Pi (`pi-coding-agent`) and OpenCode V2 (`tools.opencode.`) notes in MEMORY.md",
        ].join("\n\n");
        const { rawSystemField, systemText, userText } = transformOpenAISystem(model, piPrompt, "fix bug in pi");
        expect(rawSystemField).toBe(ANTIGRAVITY_SYSTEM_ANCHOR);
        expect(rawSystemField).not.toContain("pi-coding-agent");
        expect(systemText).toMatch(/^<system_instructions>\n[\s\S]+\n<\/system_instructions>\n\n$/);
        expect(systemText).not.toContain("running inside pi, a coding agent harness");
        expect(systemText).not.toContain("Pi documentation (read only when the user asks about the harness");
        expect(systemText).toContain("You are a helpful coding assistant. Help users inspect files, run commands, and modify code.");
        expect(systemText).toContain("/opt/node_modules/@earendil-works/pi-coding-agent/README.md");
        expect(systemText).toContain("- read: Read file contents");
        expect(userText).toBe("fix bug in pi");
      });
    }
  });

  describe("Claude Code CLI system prompt on Antigravity Gemini & Claude routes", () => {
    for (const model of models) {
      it(`neutralizes Claude Code identity and skill mentions via /v1/messages on ${model}`, () => {
        const systemBlocks = [
          { type: "text", text: "x-anthropic-billing-header: cc_version=2.1.325; cc_entrypoint=cli;" },
          { type: "text", text: "You are Claude Code, Anthropic's official CLI for Claude." },
          { type: "text", text: "Run `/compact` in Claude Code when context grows large." },
        ];
        const systemText = transformClaudeMessagesSystem(model, systemBlocks);
        expect(systemText).not.toContain("x-anthropic-billing-header");
        expect(systemText).not.toContain("Claude Code");
        expect(systemText).toContain("Run `/compact` in Claude CLI when context grows large.");
      });
    }
  });

  describe("OpenCode V2 Code Mode & branding", () => {
    it("neutralizes tools.opencode.session_move with valid JS bracket access while rewriting prose OpenCode", () => {
      const prompt = [
        "You are OpenCode, an interactive CLI coding agent.",
        "Code Mode catalog:",
        " - tools.opencode.session_move({ directory: string })",
        " - tools.opencode.worktree_list({})",
      ].join("\n");
      const { finalBody, systemText } = transformOpenAISystem("gemini-4-argon-high", prompt);
      expect(systemText).toContain("You are Antigravity, an interactive CLI coding agent.");
      expect(systemText).not.toContain("tools.opencode.");
      expect(systemText).not.toContain("tools.antigravity.");
      expect(systemText).toContain('tools["opencode"].session_move({ directory: string })');
      expect(systemText).toContain('tools["opencode"].worktree_list({})');

      const serialized = JSON.stringify(finalBody);
      expect(() => JSON.parse(serialized)).not.toThrow();
    });
  });

  describe("Codex CLI, generic coding-task, Hermes, OpenClaw, omp, ZCode, and DeepSeek Harness", () => {
    it.each([
      [
        "Codex 0.169+ banner",
        "You are Codex, a coding agent based on GPT-5.4.",
        "You are Codex",
        "You are an AI coding assistant.",
      ],
      [
        "Codex legacy banner",
        "You are Codex, an agent based on GPT-5.",
        "You are Codex",
        "You are an AI coding assistant.",
      ],
      [
        "Generic coding-task pair-programming trigger (#5701)",
        "You are pair programming with a user to solve coding tasks. Be concise, practical, and tool-aware.",
        "solve coding tasks. Be concise, practical, and tool-aware.",
        "work on their coding tasks. Keep responses concise and practical, and use the available tools when they help.",
      ],
      [
        "OpenClaw opening identity (#5696)",
        "You are a personal assistant running inside OpenClaw.",
        "running inside OpenClaw.",
        "You are a personal assistant that runs inside OpenClaw.",
      ],
      [
        "Hermes runtime & Google directives (#5703)",
        [
          "You are Hermes Agent, built by Nous Research.",
          "Be direct: match the length of your reply to the weight of the ask.",
          "For help with Hermes Agent itself, documentation at https://hermes-agent.nousresearch.com/docs is your authoritative reference.",
          "Mid-turn, the user can steer you: Hermes delivers their message as a standalone user message.",
          "# Hermes runtime environment",
          "<!-- End Hermes runtime environment -->",
          "# Google model operational directives",
        ].join("\n"),
        "# Google model operational directives",
        "# Operational directives",
      ],
      [
        "oh-my-pi (omp) conventions & xd:// tool hint",
        [
          "You are omp, a high-performance coding agent.",
          "<system-conventions>",
          "RFC 2119: MUST, REQUIRED, SHOULD, RECOMMENDED, MAY, OPTIONAL.",
          "Read xd://<tool> for full docs + JSON schema before first use.",
          "</system-conventions>",
        ].join("\n"),
        "<system-conventions>",
        "<workspace_conventions>",
      ],
      [
        "ZCode & DeepSeek Harness",
        "You are ZCode 3.17.\nPowered by DeepSeek Harness.",
        "DeepSeek Harness",
        "Assistant Framework",
      ],
    ])("rewrites %s", (_label, input, forbidden, expected) => {
      const { systemText } = transformOpenAISystem("gemini-3.8-flash-high", input);
      expect(systemText).not.toContain(forbidden);
      expect(systemText).toContain(expected);
    });

    it("does not mutate the caller's original systemInstruction parts in place and stays idempotent on retry", () => {
      const originalPart = { text: "You are a coding assistant running inside pi, a coding agent harness." };
      const body = {
        model: "gemini-3.8-flash-high",
        request: {
          contents: [{ role: "user", parts: [{ text: "hi" }] }],
          systemInstruction: { role: "user", parts: [originalPart] },
        },
      };
      const executor = new AntigravityExecutor();
      const out1 = executor.transformRequest("gemini-3.8-flash-high", body, true, {});
      expect(originalPart.text).toBe("You are a coding assistant running inside pi, a coding agent harness.");
      expect(out1.request.systemInstruction.parts).toEqual([{ text: ANTIGRAVITY_SYSTEM_ANCHOR }]);
      expect(out1.request.contents[0].parts[0].text).toBe(
        "<system_instructions>\nYou are a helpful coding assistant.\n</system_instructions>\n\n"
      );
      expect(out1.request.contents[0].parts[1].text).toBe("hi");

      // Simulate BaseExecutor retry passing the already-transformed body again.
      const out2 = executor.transformRequest("gemini-3.8-flash-high", out1, true, {});
      expect(out2.request.systemInstruction.parts).toEqual([{ text: ANTIGRAVITY_SYSTEM_ANCHOR }]);
      expect(out2.request.contents[0].parts).toHaveLength(2);
      expect(out2.request.contents[0].parts[0].text).toBe(
        "<system_instructions>\nYou are a helpful coding assistant.\n</system_instructions>\n\n"
      );
    });

    it("drops systemInstruction cleanly when empty or stripped down to empty", () => {
      const executor = new AntigravityExecutor();
      const noSys = executor.transformRequest(
        "gemini-4-argon-medium",
        { request: { contents: [{ role: "user", parts: [{ text: "hi" }] }] } },
        true,
        {}
      );
      expect(noSys.request.systemInstruction).toBeUndefined();
      expect(noSys.request.contents[0].parts).toEqual([{ text: "hi" }]);

      const billingOnly = executor.transformRequest(
        "gemini-4-argon-medium",
        {
          request: {
            systemInstruction: { role: "user", parts: [{ text: "x-anthropic-billing-header: cc_version=2.1.325;" }] },
            contents: [{ role: "user", parts: [{ text: "hi" }] }],
          },
        },
        true,
        {}
      );
      expect(billingOnly.request.systemInstruction).toBeUndefined();
      expect(billingOnly.request.contents[0].parts).toEqual([{ text: "hi" }]);
    });

    it("preserves and relocates both top-level instructions and developer role items via /v1/responses", () => {
      for (const model of ["gemini-4-hydrogen-xhigh", "claude-opus-5-5-high"]) {
        const responsesBody = {
          model,
          instructions: "You are Codex, a coding agent based on GPT-5.4.",
          input: [
            {
              type: "message",
              role: "developer",
              content: [{ type: "input_text", text: "You are a coding assistant running inside pi, a coding agent harness. Follow project rules." }],
            },
            {
              type: "message",
              role: "user",
              content: [{ type: "input_text", text: "Reply OK" }],
            },
          ],
        };
        const oai = openaiResponsesToOpenAIRequest(model, responsesBody, true, {});
        const ag = openaiToAntigravityRequest(model, oai, true, {});
        const finalBody = new AntigravityExecutor().transformRequest(model, ag, true, {});
        const rawSystemField = finalBody.request.systemInstruction.parts.map((p) => p.text).join("\n");
        const relocatedText = finalBody.request.contents[0].parts[0].text;

        expect(rawSystemField).toBe(ANTIGRAVITY_SYSTEM_ANCHOR);
        expect(relocatedText).not.toContain("You are Codex");
        expect(relocatedText).not.toContain("running inside pi");
        expect(relocatedText).toContain("You are an AI coding assistant.");
        expect(relocatedText).toContain("You are a helpful coding assistant. Follow project rules.");
        expect(finalBody.request.contents).toHaveLength(1);
        expect(finalBody.request.contents[0].role).toBe("user");
        expect(finalBody.request.contents[0].parts[1].text).toBe("Reply OK");
      }
    });
  });

  describe("Bare 429 RESOURCE_EXHAUSTED classification (account-lock protection)", () => {
    const bareBody = JSON.stringify({
      error: {
        code: 429,
        message: "Resource has been exhausted (e.g. check quota).",
        status: "RESOURCE_EXHAUSTED",
      },
    });

    const realQuotaBody = JSON.stringify({
      error: {
        code: 429,
        message: "Individual quota reached. Resets in 1h56m.",
        status: "RESOURCE_EXHAUSTED",
        details: [
          {
            "@type": "type.googleapis.com/google.rpc.ErrorInfo",
            reason: "QUOTA_EXHAUSTED",
            metadata: { quotaResetTimeStamp: "2099-01-01T00:00:00Z" },
          },
        ],
      },
    });

    const bareMessageWithDetailsBody = JSON.stringify({
      error: {
        code: 429,
        message: "Resource has been exhausted (e.g. check quota).",
        status: "RESOURCE_EXHAUSTED",
        details: [{ retryDelay: "45s" }],
      },
    });

    it("identifies only detail-free bare RESOURCE_EXHAUSTED 429s as prompt rejections", () => {
      expect(isAntigravityPromptRejection(429, bareBody)).toBe(true);
      expect(isAntigravityPromptRejection(429, realQuotaBody)).toBe(false);
      expect(isAntigravityPromptRejection(429, bareMessageWithDetailsBody)).toBe(false);
      expect(isAntigravityPromptRejection(500, bareBody)).toBe(false);
      expect(isAntigravityPromptRejection(429, "not json")).toBe(false);
    });

    it("maps bare prompt-rejection 429 to request-scoped 400 without locking the account", () => {
      const ag = new AntigravityExecutor();
      const parsed = ag.parseError({ status: 429, headers: { get: () => null } }, bareBody);
      expect(parsed).toEqual({
        status: 400,
        message: ANTIGRAVITY_PROMPT_REJECTED_MESSAGE,
      });

      const fallbackDecision = checkFallbackError(parsed.status, parsed.message, 0, "antigravity");
      expect(fallbackDecision).toEqual({
        shouldFallback: false,
        cooldownMs: 0,
        requestScoped: true,
      });
    });

    it("keeps Retry-After 429s and detailed quota 429s on the rate-limit / quota path", async () => {
      const ag = new AntigravityExecutor();

      // Detailed quota 429 still extracts resetsAtMs
      const detailedParsed = ag.parseError({ status: 429, headers: { get: () => null } }, realQuotaBody);
      expect(detailedParsed.status).toBe(429);
      expect(detailedParsed.resetsAtMs).toBe(Date.parse("2099-01-01T00:00:00Z"));

      // Bare 429 with no Retry-After header vetoes retry immediately
      const bareRes = {
        status: 429,
        headers: { get: () => null },
        clone: () => ({ text: async () => bareBody }),
      };
      expect(await ag.computeRetryDelay(bareRes, 1)).toBe(false);

      // Bare 429 WITH an explicit Retry-After header is treated as a real rate limit
      const headerRateLimitParsed = ag.parseError(
        { status: 429, headers: { get: (k) => (k === "retry-after" ? "4" : null) } },
        bareBody
      );
      expect(headerRateLimitParsed.status).toBe(429);

      const headerRateLimitRes = {
        status: 429,
        headers: { get: (k) => (k === "retry-after" ? "4" : null) },
        clone: () => ({ text: async () => bareBody }),
      };
      expect(await ag.computeRetryDelay(headerRateLimitRes, 1)).toBe(4000);
    });
  });
});