/**
 * Valibot pipe composition tests.
 *
 * Validates that `typedRegex()` integrates seamlessly with valibot's pipe
 * system, preserving narrowed output types through schema composition.
 */

import { describe, expectTypeOf, test } from "vitest";
import * as v from "valibot";
import { typedRegex } from "../typedRegex.ts";

describe("pipe integration", () => {
  // ── Basic pipe ───────────────────────────────────────────────────

  describe("basic pipe composition", () => {
    test("string → typedRegex narrows output", () => {
      const schema = v.pipe(v.string(), typedRegex("^(on|off)$"));
      expectTypeOf<v.InferInput<typeof schema>>().toEqualTypeOf<string>();
      expectTypeOf<v.InferOutput<typeof schema>>().toEqualTypeOf<"on" | "off">();
    });

    test("string → typedRegex with template pattern", () => {
      const schema = v.pipe(v.string(), typedRegex("^\\d{4}$"));
      expectTypeOf<v.InferOutput<typeof schema>>().toEqualTypeOf<`${number}`>();
    });
  });

  // ── Chained validations ──────────────────────────────────────────

  describe("chained with other actions", () => {
    test("string → minLength → typedRegex", () => {
      const schema = v.pipe(
        v.string(),
        v.minLength(1),
        typedRegex("^(yes|no)$"),
      );
      expectTypeOf<v.InferOutput<typeof schema>>().toEqualTypeOf<"yes" | "no">();
    });

    test("string → trim → typedRegex", () => {
      const schema = v.pipe(
        v.string(),
        v.trim(),
        typedRegex("^(GET|POST)$"),
      );
      expectTypeOf<v.InferOutput<typeof schema>>().toEqualTypeOf<"GET" | "POST">();
    });
  });

  // ── Object schemas ───────────────────────────────────────────────

  describe("inside object schemas", () => {
    test("narrowed fields in object", () => {
      const schema = v.object({
        method: v.pipe(v.string(), typedRegex("^(GET|POST|PUT|DELETE)$")),
        version: v.pipe(v.string(), typedRegex("^(\\d+)\\.(\\d+)$")),
        path: v.pipe(v.string(), typedRegex("^/.*$")),
      });

      type Output = v.InferOutput<typeof schema>;
      expectTypeOf<Output>().toEqualTypeOf<{
        method: "GET" | "POST" | "PUT" | "DELETE";
        version: `${number}.${number}`;
        path: `/${string}`;
      }>();
    });

    test("optional narrowed field", () => {
      const schema = v.object({
        status: v.optional(v.pipe(v.string(), typedRegex("^(active|inactive)$"))),
      });

      type Output = v.InferOutput<typeof schema>;
      expectTypeOf<Output>().toEqualTypeOf<{
        status?: "active" | "inactive" | undefined;
      }>();
    });
  });

  // ── Issue types ──────────────────────────────────────────────────

  describe("issue type inference", () => {
    test("InferIssue includes TypedRegexIssue", () => {
      const schema = v.pipe(v.string(), typedRegex("^test$"));
      type Issues = v.InferIssue<typeof schema>;
      expectTypeOf<Issues>().not.toBeNever();
    });
  });

  // ── Array items ──────────────────────────────────────────────────

  describe("array of narrowed values", () => {
    test("array items are narrowed", () => {
      const schema = v.array(
        v.pipe(v.string(), typedRegex("^(a|b|c)$")),
      );

      type Output = v.InferOutput<typeof schema>;
      expectTypeOf<Output>().toEqualTypeOf<("a" | "b" | "c")[]>();
    });
  });
});
