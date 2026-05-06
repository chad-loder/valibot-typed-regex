import { describe, expect, it } from "vitest";
import { typedRegex } from "./typedRegex.ts";

describe("typedRegex", () => {
  describe("action object", () => {
    const action = typedRegex("^\\d{3}$");

    it("should have correct kind", () => {
      expect(action.kind).toBe("validation");
    });

    it("should have correct type", () => {
      expect(action.type).toBe("typed_regex");
    });

    it("should compile pattern to RegExp", () => {
      expect(action.requirement).toBeInstanceOf(RegExp);
      expect(action.requirement.source).toBe("^\\d{3}$");
    });

    it("should not be async", () => {
      expect(action.async).toBe(false);
    });
  });

  describe("validation", () => {
    const action = typedRegex("^foo|bar$");

    it("should pass matching values", () => {
      const dataset = { typed: true as const, value: "foo" };
      const result = action["~run"](dataset, {});
      expect(result.issues).toBeUndefined();
    });

    it("should fail non-matching values", () => {
      const dataset = { typed: true as const, value: "baz" };
      const result = action["~run"](dataset, {});
      expect(result.issues).toBeDefined();
      expect(result.issues?.[0]?.type).toBe("typed_regex");
    });

    it("should skip untyped datasets", () => {
      const dataset = {
        typed: false as const,
        value: "anything" as unknown,
        issues: [{
          kind: "schema" as const, type: "string", input: 42,
          expected: "string", received: "42", message: "Invalid type",
        }],
      };
      const result = action["~run"](dataset as Parameters<typeof action["~run"]>[0], {});
      expect(result.value).toBe("anything");
    });
  });
});
