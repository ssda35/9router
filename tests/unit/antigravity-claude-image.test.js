import { describe, expect, it } from "vitest";
import "../translator/registerAll.js";
import { translateRequest } from "../../open-sse/translator/index.js";
import { FORMATS } from "../../open-sse/translator/formats.js";
import { openaiToAntigravityRequest } from "../../open-sse/translator/request/openai-to-gemini.js";
import { AntigravityExecutor } from "../../open-sse/executors/antigravity.js";

const SAMPLE_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("Antigravity Claude image handling (wrapInCloudCodeEnvelopeForClaude)", () => {
  it("1. preserves base64 image block in user turn on claude -> antigravity", () => {
    const body = {
      model: "claude-opus-5-5-high",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "<tool_response>Read image file [image/jpeg]</tool_response>" },
            {
              type: "image",
              source: { type: "base64", media_type: "image/jpeg", data: SAMPLE_B64 },
            },
          ],
        },
      ],
    };

    const translated = translateRequest(
      FORMATS.CLAUDE,
      FORMATS.ANTIGRAVITY,
      "claude-opus-5-5-high",
      body,
      true,
      { projectId: "p1", connectionId: "c1" },
      "antigravity"
    );
    const finalBody = new AntigravityExecutor().transformRequest(
      "claude-opus-5-5-high",
      translated,
      true,
      { projectId: "p1", connectionId: "c1" }
    );

    const lastTurn = finalBody.request.contents.at(-1);
    expect(lastTurn.role).toBe("user");
    expect(lastTurn.parts).toEqual([
      { text: "<tool_response>Read image file [image/jpeg]</tool_response>" },
      { inlineData: { mimeType: "image/jpeg", data: SAMPLE_B64 } },
    ]);
  });

  it("2. extracts image inside tool_result into inlineData and never stringifies base64 into functionResponse", () => {
    // End-to-end Claude -> Antigravity with image inside tool_result
    const claudeBody = {
      model: "claude-opus-5-5-high",
      max_tokens: 4096,
      messages: [
        { role: "user", content: "Read the screenshot" },
        {
          role: "assistant",
          content: [{ type: "tool_use", id: "toolu_1", name: "read", input: { path: "shot.png" } }],
        },
        {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "toolu_1",
              content: [
                { type: "text", text: "Read image file [image/png]" },
                { type: "image", source: { type: "base64", media_type: "image/png", data: SAMPLE_B64 } },
              ],
            },
          ],
        },
      ],
    };

    const translated = translateRequest(
      FORMATS.CLAUDE,
      FORMATS.ANTIGRAVITY,
      "claude-opus-5-5-high",
      claudeBody,
      true,
      { projectId: "p1", connectionId: "c1" },
      "antigravity"
    );

    const allParts = translated.request.contents.flatMap((c) => c.parts);
    const inlineParts = allParts.filter((p) => p.inlineData);
    const fnResponses = allParts.filter((p) => p.functionResponse);

    expect(inlineParts).toEqual([
      { inlineData: { mimeType: "image/png", data: SAMPLE_B64 } },
    ]);
    expect(fnResponses.length).toBe(1);
    expect(JSON.stringify(fnResponses)).not.toContain(SAMPLE_B64);

    // Hybrid direct call where tool_result still carries an array with an image block
    const directOut = openaiToAntigravityRequest("claude-opus-5-5-high", {
      messages: [
        {
          role: "assistant",
          content: [{ type: "tool_use", id: "toolu_2", name: "read", input: { path: "a.png" } }],
        },
        {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "toolu_2",
              content: [
                { type: "text", text: "ok" },
                { type: "image", source: { type: "base64", media_type: "image/png", data: SAMPLE_B64 } },
              ],
            },
          ],
        },
      ],
    }, true, { projectId: "p1", connectionId: "c1" });

    const directParts = directOut.request.contents.flatMap((c) => c.parts);
    expect(directParts.filter((p) => p.inlineData)).toEqual([
      { inlineData: { mimeType: "image/png", data: SAMPLE_B64 } },
    ]);
    expect(JSON.stringify(directParts.filter((p) => p.functionResponse))).not.toContain(SAMPLE_B64);
  });

  it("3. converts https:// image URL into fileData.fileUri and ignores unsafe schemes", () => {
    const body = {
      model: "claude-sonnet-5-5-high",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Check this image" },
            { type: "image", source: { type: "url", url: "https://example.com/pic.png" } },
            { type: "image", source: { type: "url", url: "file:///etc/passwd" } },
          ],
        },
      ],
    };

    const out = translateRequest(
      FORMATS.CLAUDE,
      FORMATS.ANTIGRAVITY,
      "claude-sonnet-5-5-high",
      body,
      true,
      { projectId: "p1", connectionId: "c1" },
      "antigravity"
    );

    expect(out.request.contents.at(-1).parts).toEqual([
      { text: "Check this image" },
      { fileData: { fileUri: "https://example.com/pic.png", mimeType: "image/*" } },
    ]);
  });

  it("4. converts data: image URL in source.url into inlineData", () => {
    const body = {
      model: "claude-opus-5-5-high",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Data URI image" },
            { type: "image", source: { type: "url", url: `data:image/png;base64,${SAMPLE_B64}` } },
          ],
        },
      ],
    };

    const out = translateRequest(
      FORMATS.CLAUDE,
      FORMATS.ANTIGRAVITY,
      "claude-opus-5-5-high",
      body,
      true,
      { projectId: "p1", connectionId: "c1" },
      "antigravity"
    );

    expect(out.request.contents.at(-1).parts).toEqual([
      { text: "Data URI image" },
      { inlineData: { mimeType: "image/png", data: SAMPLE_B64 } },
    ]);
  });

  it("5. regression: text-only + tool_use + tool_result envelope is unchanged", () => {
    const body = {
      model: "claude-opus-5-5-high",
      max_tokens: 4096,
      messages: [
        { role: "user", content: "Run ls" },
        {
          role: "assistant",
          content: [{ type: "tool_use", id: "toolu_9", name: "bash", input: { cmd: "ls" } }],
        },
        {
          role: "user",
          content: [{ type: "tool_result", tool_use_id: "toolu_9", content: "README.md" }],
        },
      ],
    };

    const out = translateRequest(
      FORMATS.CLAUDE,
      FORMATS.ANTIGRAVITY,
      "claude-opus-5-5-high",
      body,
      true,
      { projectId: "p1", connectionId: "c1" },
      "antigravity"
    );

    expect(out.request.contents).toHaveLength(3);
    expect(out.request.contents[0]).toEqual({ role: "user", parts: [{ text: "Run ls" }] });
    expect(out.request.contents[1].role).toBe("model");
    expect(out.request.contents[1].parts[0].functionCall).toEqual({
      id: "toolu_9",
      name: "bash",
      args: { cmd: "ls" },
    });
    expect(out.request.contents[2]).toEqual({
      role: "user",
      parts: [
        {
          functionResponse: {
            id: "toolu_9",
            name: "bash",
            response: { result: "README.md" },
          },
        },
      ],
    });
  });

  it("6. Gemini model (gemini-4-argon-high) via Antigravity still preserves images", () => {
    const body = {
      model: "gemini-4-argon-high",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "What is this?" },
            { type: "image", source: { type: "base64", media_type: "image/png", data: SAMPLE_B64 } },
          ],
        },
      ],
    };

    const out = translateRequest(
      FORMATS.CLAUDE,
      FORMATS.ANTIGRAVITY,
      "gemini-4-argon-high",
      body,
      true,
      { projectId: "p1", connectionId: "c1" },
      "antigravity"
    );

    expect(out.request.contents.at(-1).parts).toEqual([
      { text: "What is this?" },
      { inlineData: { mime_type: "image/png", data: SAMPLE_B64 } },
    ]);
  });

  it.each([
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
    "image/heic",
    "image/heif",
  ])("7. preserves %s mimeType end-to-end on claude -> antigravity", (mimeType) => {
    const out = translateRequest(
      FORMATS.CLAUDE,
      FORMATS.ANTIGRAVITY,
      "claude-opus-5-5-high",
      {
        model: "claude-opus-5-5-high",
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mimeType, data: SAMPLE_B64 } },
            ],
          },
        ],
      },
      true,
      { projectId: "p1", connectionId: "c1" },
      "antigravity"
    );

    expect(out.request.contents.at(-1).parts).toEqual([
      { inlineData: { mimeType, data: SAMPLE_B64 } },
    ]);
  });

  it("8. preserves application/pdf document block on claude -> antigravity", () => {
    const out = translateRequest(
      FORMATS.CLAUDE,
      FORMATS.ANTIGRAVITY,
      "claude-opus-5-5-high",
      {
        model: "claude-opus-5-5-high",
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Summarize this PDF" },
              { type: "document", source: { type: "base64", media_type: "application/pdf", data: SAMPLE_B64 } },
            ],
          },
        ],
      },
      true,
      { projectId: "p1", connectionId: "c1" },
      "antigravity"
    );

    expect(out.request.contents.at(-1).parts).toEqual([
      { text: "Summarize this PDF" },
      { inlineData: { mimeType: "application/pdf", data: SAMPLE_B64 } },
    ]);
  });
});