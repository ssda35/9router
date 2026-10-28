/**
 * Regression for #5125: an image_url part inside a role:"tool" message must be
 * converted to a Claude image block, not forwarded as an OpenAI part.
 */
import { describe, it, expect } from "vitest";
import { openaiToClaudeRequest } from "../../open-sse/translator/request/openai-to-claude.js";

const PNG = "data:image/png;base64,iVBORw0KGgo=";

function toolResultContent(body) {
  const toolMsg = body.messages.find(m => Array.isArray(m.content) && m.content.some(b => b.type === "tool_result"));
  return toolMsg.content.find(b => b.type === "tool_result").content;
}

describe("tool message with image_url part (#5125)", () => {
  it("converts image_url inside a tool result to a Claude image block", () => {
    const body = {
      model: "claude-haiku-4-5",
      messages: [
        { role: "user", content: "look at image" },
        { role: "assistant", content: null, tool_calls: [{ id: "t1", type: "function", function: { name: "v", arguments: "{}" } }] },
        { role: "tool", tool_call_id: "t1", content: [
          { type: "text", text: "shot" },
          { type: "image_url", image_url: { url: PNG } },
        ] },
      ],
    };

    const out = openaiToClaudeRequest("claude-haiku-4-5", body, false);
    const content = toolResultContent(out);

    expect(content.some(p => p.type === "image_url")).toBe(false);
    const img = content.find(p => p.type === "image");
    expect(img).toEqual({ type: "image", source: { type: "base64", media_type: "image/png", data: "iVBORw0KGgo=" } });
    expect(content.find(p => p.type === "text").text).toBe("shot");
  });

  it.each([
    ["text and PDF", [{ type: "text", text: "Attached PDF" }]],
    ["screenshot and PDF", [{ type: "image_url", image_url: { url: PNG } }]],
  ])("preserves the document in a mixed %s result", (_name, prefix) => {
    const document = {
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: "JVBERi0xLjc=" },
      title: "report.pdf",
      citations: { enabled: true },
      cache_control: { type: "ephemeral" },
    };
    const input = [...prefix, document];
    const original = structuredClone(input);
    const out = openaiToClaudeRequest("claude-sonnet-5-5", {
      messages: [
        { role: "user", content: "Review the attachment" },
        { role: "assistant", content: null, tool_calls: [
          { id: "pdf1", type: "function", function: { name: "read", arguments: "{}" } },
        ] },
        { role: "tool", tool_call_id: "pdf1", content: input },
      ],
    }, false);
    const content = toolResultContent(out);

    expect(content).toHaveLength(2);
    expect(content[1]).toEqual(document);
    expect(content[0].type).toBe(prefix[0].type === "image_url" ? "image" : "text");
    expect(input).toEqual(original);
  });

  it("retains native text/image metadata and other existing result blocks", () => {
    const content = [
      { type: "text", text: "", cache_control: { type: "ephemeral" } },
      { type: "text", text: "Evidence", citations: [{ type: "page_location", start_page_number: 1, end_page_number: 1, document_index: 0 }] },
      { type: "image", source: { type: "base64", media_type: "image/png", data: "iVBORw0KGgo=" }, cache_control: { type: "ephemeral" } },
      { type: "document", source: { type: "url", url: "https://example.test/report.pdf" } },
      { type: "file", file: { filename: "report.pdf", file_data: "data:application/pdf;base64,JVBERi0xLjc=" } },
    ];
    const out = openaiToClaudeRequest("claude-sonnet-5-5", {
      messages: [
        { role: "assistant", content: null, tool_calls: [
          { id: "meta1", type: "function", function: { name: "read", arguments: "{}" } },
        ] },
        { role: "tool", tool_call_id: "meta1", content: structuredClone(content) },
      ],
    }, false);
    expect(toolResultContent(out)).toEqual(content);
  });

  it("keeps a plain string tool result unchanged", () => {
    const body = {
      model: "claude-haiku-4-5",
      messages: [
        { role: "user", content: "hi" },
        { role: "assistant", content: null, tool_calls: [{ id: "t2", type: "function", function: { name: "v", arguments: "{}" } }] },
        { role: "tool", tool_call_id: "t2", content: "plain result" },
      ],
    };
    const out = openaiToClaudeRequest("claude-haiku-4-5", body, false);
    expect(toolResultContent(out)).toBe("plain result");
  });
});
