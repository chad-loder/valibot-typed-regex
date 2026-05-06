import { describe, expectTypeOf, test } from "vitest";
import * as v from "valibot";
import { typedRegex } from "./typedRegex.ts";
import type { TypedRegexAction, TypedRegexIssue } from "./typedRegex.ts";
import type { InferRegexOutput } from "./type-engine/index.ts";

describe("typedRegex", () => {
  describe("should return action object", () => {
    test("with undefined message", () => {
      type Action = TypedRegexAction<string, InferRegexOutput<"^test$">, undefined>;
      expectTypeOf(typedRegex("^test$")).toEqualTypeOf<Action>();
      expectTypeOf(typedRegex("^test$", undefined)).toEqualTypeOf<Action>();
    });

    test("with string message", () => {
      expectTypeOf(typedRegex("^test$", "message")).toEqualTypeOf<
        TypedRegexAction<string, InferRegexOutput<"^test$">, "message">
      >();
    });

    test("with function message", () => {
      expectTypeOf(typedRegex("^test$", () => "message")).toEqualTypeOf<
        TypedRegexAction<string, InferRegexOutput<"^test$">, () => string>
      >();
    });
  });

  describe("should infer correct types", () => {
    type Action = TypedRegexAction<string, InferRegexOutput<"^test$">, undefined>;

    test("of input", () => {
      expectTypeOf<v.InferInput<Action>>().toEqualTypeOf<string>();
    });

    test("of output", () => {
      expectTypeOf<v.InferOutput<Action>>().toEqualTypeOf<"test">();
    });

    test("of issue", () => {
      expectTypeOf<v.InferIssue<Action>>().toEqualTypeOf<TypedRegexIssue<string>>();
    });
  });

  describe("should narrow output types", () => {
    test("literal pattern", () => {
      type Output = InferRegexOutput<"^hello$">;
      expectTypeOf<Output>().toEqualTypeOf<"hello">();
    });

    test("unanchored alternation narrows each branch", () => {
      type Output = InferRegexOutput<"^foo|bar$">;
      expectTypeOf<Output>().toEqualTypeOf<`foo${string}` | `${string}bar`>();
    });

    test("anchored alternation", () => {
      type Output = InferRegexOutput<"^(foo|bar)$">;
      expectTypeOf<Output>().toEqualTypeOf<"foo" | "bar">();
    });

    test("digit shorthand", () => {
      type Output = InferRegexOutput<"^\\d$">;
      expectTypeOf<Output>().toEqualTypeOf<`${number}`>();
    });

    test("wildcard falls back to string", () => {
      type Output = InferRegexOutput<"^.*$">;
      expectTypeOf<Output>().toEqualTypeOf<string>();
    });

    test("optional character", () => {
      type Output = InferRegexOutput<"^ab?c$">;
      expectTypeOf<Output>().toEqualTypeOf<"ac" | "abc">();
    });

    test("bounded quantifier", () => {
      type Output = InferRegexOutput<"^a{2,3}$">;
      expectTypeOf<Output>().toEqualTypeOf<"aa" | "aaa">();
    });

    test("unbounded quantifier falls back", () => {
      type Output = InferRegexOutput<"^a+$">;
      expectTypeOf<Output>().toEqualTypeOf<`a${string}`>();
    });
  });

  describe("should compose in pipe", () => {
    test("with v.string()", () => {
      const schema = v.pipe(v.string(), typedRegex("^\\d+$"));
      type Output = v.InferOutput<typeof schema>;
      expectTypeOf<Output>().toEqualTypeOf<`${number}`>();
    });
  });
});
