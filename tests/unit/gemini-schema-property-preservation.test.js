import { describe, expect, it } from "vitest";
import { cleanJSONSchemaForAntigravity } from "../../open-sse/translator/formats/gemini.js";

describe("Antigravity schema preserves caller argument names", () => {
  it.each(["items", "properties", "required"])("keeps a required argument named %s", (name) => {
    const schema = {
      type: "object",
      properties: {
        [name]: { type: "string", description: "Caller-defined argument" },
        normal: { type: "string" },
      },
      required: [name],
    };
    const cleaned = cleanJSONSchemaForAntigravity(structuredClone(schema));
    expect(cleaned.properties[name]).toEqual(schema.properties[name]);
    expect(cleaned.required).toEqual([name]);
  });

  it("preserves nested keyword-named arguments while cleaning their schemas", () => {
    const cleaned = cleanJSONSchemaForAntigravity({
      type: "object",
      properties: {
        options: {
          type: "object",
          properties: {
            items: { type: "array", items: { type: "string", items: { type: "number" } } },
            properties: { type: "string" },
            required: { type: "boolean" },
          },
          required: ["items", "properties", "required"],
        },
      },
    });
    expect(Object.keys(cleaned.properties.options.properties)).toEqual(["items", "properties", "required"]);
    expect(cleaned.properties.options.required).toEqual(["items", "properties", "required"]);
    expect(cleaned.properties.options.properties.items.items).toEqual({ type: "string" });
  });

  it("walks object schemas inside array items without treating the property map as a schema", () => {
    const cleaned = cleanJSONSchemaForAntigravity({
      type: "array",
      items: {
        type: "object",
        properties: {
          items: { type: "string" },
          properties: { type: "array", items: {} },
        },
        required: ["items", "properties"],
      },
    });
    expect(cleaned.items.properties.items).toEqual({ type: "string" });
    expect(cleaned.items.properties.properties).toEqual({ type: "array", items: { type: "string" } });
    expect(cleaned.items.required).toEqual(["items", "properties"]);
  });
});