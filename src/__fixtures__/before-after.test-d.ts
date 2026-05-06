/**
 * Before / After comparison: plain valibot `regex()` vs `typedRegex()`.
 *
 * Each test pair shows what valibot gives you today (always `string` output,
 * no compile-time regex validation) vs what `typedRegex()` provides.
 * This file IS the value proposition.
 */

import { describe, expectTypeOf, test } from "vitest";
import * as v from "valibot";
import { typedRegex } from "../typedRegex.ts";

// ── Scenario 1: Literal enum ────────────────────────────────────────
//
// Business rule: field must be "active" or "inactive".
// With valibot: output is string — downstream code needs manual narrowing.
// With typedRegex: output is "active" | "inactive" — no cast required.

describe("scenario: status enum", () => {
  test("BEFORE — valibot regex() output is always string", () => {
    const schema = v.pipe(v.string(), v.regex(/^(active|inactive)$/));
    type Output = v.InferOutput<typeof schema>;
    expectTypeOf<Output>().toEqualTypeOf<string>();
  });

  test("AFTER — typedRegex() narrows to union", () => {
    const schema = v.pipe(v.string(), typedRegex("^(active|inactive)$"));
    type Output = v.InferOutput<typeof schema>;
    expectTypeOf<Output>().toEqualTypeOf<"active" | "inactive">();
  });
});

// ── Scenario 2: Numeric format ──────────────────────────────────────
//
// Business rule: field must be a 3-digit code like "001", "042", "999".
// With valibot: output is string — arithmetic requires parseInt.
// With typedRegex: output is `${number}` — TypeScript knows it's numeric.

describe("scenario: numeric code", () => {
  test("BEFORE — valibot regex() loses numeric info", () => {
    const schema = v.pipe(v.string(), v.regex(/^\d{3}$/));
    type Output = v.InferOutput<typeof schema>;
    expectTypeOf<Output>().toEqualTypeOf<string>();
  });

  test("AFTER — typedRegex() narrows to template number", () => {
    const schema = v.pipe(v.string(), typedRegex("^\\d{3}$"));
    type Output = v.InferOutput<typeof schema>;
    expectTypeOf<Output>().toEqualTypeOf<`${number}`>();
  });
});

// ── Scenario 3: Semver ──────────────────────────────────────────────
//
// Business rule: field must match semver major.minor.patch.
// With valibot: string. With typedRegex: `${number}.${number}.${number}`.

describe("scenario: semver", () => {
  test("BEFORE — valibot regex() returns string", () => {
    const schema = v.pipe(v.string(), v.regex(/^(\d+)\.(\d+)\.(\d+)$/));
    type Output = v.InferOutput<typeof schema>;
    expectTypeOf<Output>().toEqualTypeOf<string>();
  });

  test("AFTER — typedRegex() narrows to structured template", () => {
    const schema = v.pipe(v.string(), typedRegex("^(\\d+)\\.(\\d+)\\.(\\d+)$"));
    type Output = v.InferOutput<typeof schema>;
    expectTypeOf<Output>().toEqualTypeOf<`${number}.${number}.${number}`>();
  });
});

// ── Scenario 4: Boolean string ──────────────────────────────────────
//
// Business rule: env var must be "true" or "false".

describe("scenario: boolean string", () => {
  test("BEFORE — valibot regex() returns string", () => {
    const schema = v.pipe(v.string(), v.regex(/^(true|false)$/));
    type Output = v.InferOutput<typeof schema>;
    expectTypeOf<Output>().toEqualTypeOf<string>();
  });

  test("AFTER — typedRegex() narrows to literal union", () => {
    const schema = v.pipe(v.string(), typedRegex("^(true|false)$"));
    type Output = v.InferOutput<typeof schema>;
    expectTypeOf<Output>().toEqualTypeOf<"true" | "false">();
  });
});

// ── Scenario 5: Typo in regex ───────────────────────────────────────
//
// Developer typo: unbalanced parenthesis.
// With valibot: compiles fine, fails at runtime.
// With typedRegex: caught at build time.

describe("scenario: developer typo", () => {
  test("BEFORE — valibot regex() accepts any RegExp, no pattern validation", () => {
    // valibot's regex() takes a pre-constructed RegExp — TypeScript has
    // no way to validate the pattern string at compile time.  An invalid
    // regex would only fail when `new RegExp(...)` runs.
    const valid = v.pipe(v.string(), v.regex(/^abc$/));
    expectTypeOf<v.InferOutput<typeof valid>>().toEqualTypeOf<string>();
  });

  test("AFTER — typedRegex() catches unbalanced parens at compile time", () => {
    // @ts-expect-error — Missing )
    typedRegex("^(abc$");
  });
});

// ── Scenario 6: Exact string match ──────────────────────────────────
//
// The simplest case: "this exact string only".

describe("scenario: exact match", () => {
  test("BEFORE — valibot regex() still returns string", () => {
    const schema = v.pipe(v.string(), v.regex(/^hello$/));
    type Output = v.InferOutput<typeof schema>;
    expectTypeOf<Output>().toEqualTypeOf<string>();
  });

  test("AFTER — typedRegex() narrows to exact literal", () => {
    const schema = v.pipe(v.string(), typedRegex("^hello$"));
    type Output = v.InferOutput<typeof schema>;
    expectTypeOf<Output>().toEqualTypeOf<"hello">();
  });
});

// ── Scenario 7: Graceful fallback ───────────────────────────────────
//
// Not all patterns can be narrowed. When the type engine can't produce
// a precise type, it falls back to `string` — never incorrect.

describe("scenario: graceful fallback", () => {
  test("complex pattern with ranges → string (safe fallback)", () => {
    const schema = v.pipe(v.string(), typedRegex("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"));
    type Output = v.InferOutput<typeof schema>;
    expectTypeOf<Output>().toBeString();
  });

  test("fallback is still better: syntax is validated at compile time", () => {
    // Even when narrowing falls back to `string`, syntax errors are caught:
    // @ts-expect-error — Quantifier + requires a preceding token
    typedRegex("^+@example.com$");
  });
});
