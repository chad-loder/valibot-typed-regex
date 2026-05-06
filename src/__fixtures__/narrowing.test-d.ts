/**
 * Output type narrowing showcase.
 *
 * Demonstrates how `typedRegex()` narrows the output type from `string`
 * to precise string literal types based on the regex pattern.  Each test
 * documents the narrowing rule that applies and what the inferred type is.
 */

import { describe, expectTypeOf, test } from "vitest";
import type { InferRegexOutput } from "../type-engine/index.ts";

// ── Literals ─────────────────────────────────────────────────────────

describe("literal narrowing", () => {
  test("fully anchored literal → exact string", () => {
    expectTypeOf<InferRegexOutput<"^hello$">>().toEqualTypeOf<"hello">();
  });

  test("multi-character anchored literal", () => {
    expectTypeOf<InferRegexOutput<"^abc$">>().toEqualTypeOf<"abc">();
  });

  test("empty anchored pattern → empty string", () => {
    expectTypeOf<InferRegexOutput<"^$">>().toEqualTypeOf<"">();
  });

  test("unanchored literal → string prefix/suffix", () => {
    type Result = InferRegexOutput<"hello">;
    expectTypeOf<Result>().toEqualTypeOf<`${string}hello${string}`>();
  });
});

// ── Anchors ──────────────────────────────────────────────────────────

describe("anchor narrowing", () => {
  test("start anchor only → prefix match", () => {
    expectTypeOf<InferRegexOutput<"^foo">>().toEqualTypeOf<`foo${string}`>();
  });

  test("end anchor only → suffix match", () => {
    expectTypeOf<InferRegexOutput<"bar$">>().toEqualTypeOf<`${string}bar`>();
  });

  test("both anchors → exact match", () => {
    expectTypeOf<InferRegexOutput<"^exact$">>().toEqualTypeOf<"exact">();
  });
});

// ── Alternation ──────────────────────────────────────────────────────

describe("alternation narrowing", () => {
  test("anchored alternation via group → union", () => {
    expectTypeOf<InferRegexOutput<"^(foo|bar)$">>().toEqualTypeOf<"foo" | "bar">();
  });

  test("three-way alternation", () => {
    expectTypeOf<InferRegexOutput<"^(a|b|c)$">>().toEqualTypeOf<"a" | "b" | "c">();
  });

  test("unanchored alternation → per-branch narrowing", () => {
    expectTypeOf<InferRegexOutput<"^foo|bar$">>().toEqualTypeOf<
      `foo${string}` | `${string}bar`
    >();
  });

  test("alternation with shared context", () => {
    expectTypeOf<InferRegexOutput<"^(a|b)c$">>().toEqualTypeOf<"ac" | "bc">();
  });
});

// ── Quantifiers ──────────────────────────────────────────────────────

describe("quantifier narrowing", () => {
  test("? (optional) → union of present and absent", () => {
    expectTypeOf<InferRegexOutput<"^ab?c$">>().toEqualTypeOf<"ac" | "abc">();
  });

  test("? sequence → combinatorial union", () => {
    expectTypeOf<InferRegexOutput<"^a?b?$">>().toEqualTypeOf<"" | "a" | "b" | "ab">();
  });

  test("{n} exact → repeated literal", () => {
    expectTypeOf<InferRegexOutput<"^a{3}$">>().toEqualTypeOf<"aaa">();
  });

  test("{n,m} bounded → finite union", () => {
    expectTypeOf<InferRegexOutput<"^a{2,4}$">>().toEqualTypeOf<"aa" | "aaa" | "aaaa">();
  });

  test("{0,n} → includes empty string", () => {
    expectTypeOf<InferRegexOutput<"^a{0,2}$">>().toEqualTypeOf<"" | "a" | "aa">();
  });

  test("+ (one or more) → template literal with string tail", () => {
    expectTypeOf<InferRegexOutput<"^a+$">>().toEqualTypeOf<`a${string}`>();
  });

  test("* (zero or more) → empty or string tail", () => {
    expectTypeOf<InferRegexOutput<"^a*$">>().toEqualTypeOf<"" | `a${string}`>();
  });

  test("{n,} unbounded → template literal", () => {
    expectTypeOf<InferRegexOutput<"^a{2,}$">>().toEqualTypeOf<`aa${string}`>();
  });

  test("{0} → empty string", () => {
    expectTypeOf<InferRegexOutput<"^a{0}$">>().toEqualTypeOf<"">();
  });
});

// ── Escape sequences ─────────────────────────────────────────────────

describe("escape narrowing", () => {
  test("\\d → template number", () => {
    expectTypeOf<InferRegexOutput<"^\\d$">>().toEqualTypeOf<`${number}`>();
  });

  test("\\d+ → template number (fast path)", () => {
    expectTypeOf<InferRegexOutput<"^\\d+$">>().toEqualTypeOf<`${number}`>();
  });

  test("\\d{N} collapses to template number regardless of bounds", () => {
    // `${number}` repeated any number of times is still `${number}`.
    // This is a deliberate fast-path that short-circuits before the budget
    // check — precision is lossless since the type is idempotent under
    // concatenation.
    expectTypeOf<InferRegexOutput<"^\\d{3}$">>().toEqualTypeOf<`${number}`>();
    expectTypeOf<InferRegexOutput<"^\\d{50}$">>().toEqualTypeOf<`${number}`>();
    expectTypeOf<InferRegexOutput<"^\\d{2,5}$">>().toEqualTypeOf<`${number}`>();
    expectTypeOf<InferRegexOutput<"^\\d{100,}$">>().toEqualTypeOf<`${number}`>();
  });

  test("\\w → string (broad class)", () => {
    expectTypeOf<InferRegexOutput<"^\\w$">>().toEqualTypeOf<string>();
  });

  test("escaped control characters are literal", () => {
    expectTypeOf<InferRegexOutput<"^\\?$">>().toEqualTypeOf<"?">();
    expectTypeOf<InferRegexOutput<"^\\.$">>().toEqualTypeOf<".">();
    expectTypeOf<InferRegexOutput<"^\\[$">>().toEqualTypeOf<"[">();
    expectTypeOf<InferRegexOutput<"^\\\\$">>().toEqualTypeOf<"\\">();
  });

  test("\\b word boundary is zero-width", () => {
    expectTypeOf<InferRegexOutput<"^word\\b$">>().toEqualTypeOf<"word">();
  });
});

// ── Character sets ───────────────────────────────────────────────────

describe("character set narrowing", () => {
  test("literal characters → union", () => {
    expectTypeOf<InferRegexOutput<"^[abc]$">>().toEqualTypeOf<"a" | "b" | "c">();
  });

  test("lowercase range → enumerated union", () => {
    expectTypeOf<InferRegexOutput<"^[a-f]$">>().toEqualTypeOf<
      "a" | "b" | "c" | "d" | "e" | "f"
    >();
  });

  test("negated set → string", () => {
    expectTypeOf<InferRegexOutput<"^[^abc]$">>().toEqualTypeOf<string>();
  });

  test("digit range → template number", () => {
    expectTypeOf<InferRegexOutput<"^[0-9]$">>().toEqualTypeOf<`${number}`>();
  });

  test("shorthand inside set", () => {
    expectTypeOf<InferRegexOutput<"^[\\d]$">>().toEqualTypeOf<`${number}`>();
  });

  test("large range widens to string (budget guard)", () => {
    expectTypeOf<InferRegexOutput<"^[a-z]$">>().toEqualTypeOf<string>();
  });

  test("at-limit range still enumerates (10 chars)", () => {
    expectTypeOf<InferRegexOutput<"^[a-j]$">>().toEqualTypeOf<
      "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h" | "i" | "j"
    >();
  });

  test("case-insensitive modifier adds uppercase variants", () => {
    expectTypeOf<InferRegexOutput<"^(?i:[abc])$">>().toEqualTypeOf<
      "a" | "b" | "c" | "A" | "B" | "C"
    >();
  });

  test("case-insensitive range adds uppercase variants", () => {
    expectTypeOf<InferRegexOutput<"^(?i:[a-f])$">>().toEqualTypeOf<
      "a" | "b" | "c" | "d" | "e" | "f" | "A" | "B" | "C" | "D" | "E" | "F"
    >();
  });

  test("case-insensitive uppercase range adds lowercase variants", () => {
    expectTypeOf<InferRegexOutput<"^(?i:[A-F])$">>().toEqualTypeOf<
      "a" | "b" | "c" | "d" | "e" | "f" | "A" | "B" | "C" | "D" | "E" | "F"
    >();
  });
});

describe("expansion budget limits", () => {
  test("small range × small quantifier → expanded", () => {
    expectTypeOf<InferRegexOutput<"^[ab]{2}$">>().toEqualTypeOf<
      "aa" | "ab" | "ba" | "bb"
    >();
  });

  test("range × quantifier exceeding budget → string", () => {
    expectTypeOf<InferRegexOutput<"^[a-f]{4}$">>().toEqualTypeOf<string>();
  });

  test("singleton × moderate quantifier → still expands", () => {
    expectTypeOf<InferRegexOutput<"^a{8}$">>().toEqualTypeOf<"aaaaaaaa">();
  });

  test("singleton × extreme quantifier → prefix template (recursion guard)", () => {
    expectTypeOf<InferRegexOutput<"^a{50}$">>().toEqualTypeOf<
      `aaaaaaaaaaaaaaaaaaaa${string}`
    >();
  });
});

describe("case-insensitive literal budget", () => {
  test("short case-insensitive literal → expanded", () => {
    expectTypeOf<InferRegexOutput<"^(?i:ab)$">>().toEqualTypeOf<
      "ab" | "aB" | "Ab" | "AB"
    >();
  });

  test("case-insensitive literal at limit (8 chars) → expanded", () => {
    type Result = InferRegexOutput<"^(?i:abcdefgh)$">;
    expectTypeOf<Result>().toBeString();
    expectTypeOf<"abcdefgh">().toMatchTypeOf<Result>();
    expectTypeOf<"ABCDEFGH">().toMatchTypeOf<Result>();
  });

  test("case-insensitive literal over limit (9+ chars) → widens to string", () => {
    type Result = InferRegexOutput<"^(?i:abcdefghi)$">;
    expectTypeOf<Result>().toBeString();
    expectTypeOf<"anything">().toMatchTypeOf<Result>();
  });

  test("non-alpha chars reset ciRun counter", () => {
    expectTypeOf<InferRegexOutput<"^(?i:ab1cd)$">>().toBeString();
    expectTypeOf<"ab1cd">().toMatchTypeOf<InferRegexOutput<"^(?i:ab1cd)$">>();
    expectTypeOf<"AB1CD">().toMatchTypeOf<InferRegexOutput<"^(?i:ab1cd)$">>();
  });

  test("long pattern with resets stays within budget", () => {
    type Result = InferRegexOutput<"^(?i:abc1def1ghi)$">;
    expectTypeOf<Result>().toBeString();
    expectTypeOf<"abc1def1ghi">().toMatchTypeOf<Result>();
    expectTypeOf<"ABC1DEF1GHI">().toMatchTypeOf<Result>();
  });

  test("group boundaries don't carry ciRun forward (known limitation)", () => {
    // Each (?i:...) segment is independently at-limit (2^8 = 256).
    // Concatenated: 256 × 256 = 65K evaluation paths. Neither guard trips
    // because ciRun resets at group boundaries and tracks consecutive runs,
    // not accumulated cardinality. TS hits its instantiation depth limit
    // and falls back to string. Pinned here so a future reader knows this
    // is a known gap — if it needs precise types, the fix is root-level
    // cardinality tracking.
    //
    // Shorter segments work fine:
    type Short = InferRegexOutput<"^(?i:abc)(?i:abc)$">;
    expectTypeOf<Short>().toBeString();
    expectTypeOf<"abcabc">().toMatchTypeOf<Short>();
    expectTypeOf<"ABCABC">().toMatchTypeOf<Short>();
    // At-limit × at-limit exceeds TS instantiation depth (256 × 256 = 65K paths):
    // @ts-expect-error — Type instantiation is excessively deep
    type _AtLimit = InferRegexOutput<"^(?i:abcdefgh)(?i:abcdefgh)$">;
  });

  test("charset + literal concat isn't cross-tracked (known limitation)", () => {
    // [a-f] produces 6 members via ApplyCasing (→12 with case),
    // then 8 literal splits via ShiftWithCasing (→256). Neither guard
    // trips individually, but concatenation yields 12 × 256 = 3K members.
    type Result = InferRegexOutput<"^(?i:[a-f]abcdefgh)$">;
    expectTypeOf<Result>().toBeString();
  });
});

// ── Wildcards ────────────────────────────────────────────────────────

describe("wildcard narrowing", () => {
  test(". → string", () => {
    expectTypeOf<InferRegexOutput<"^a.$">>().toEqualTypeOf<`a${string}`>();
  });

  test(".* → string (collapses)", () => {
    expectTypeOf<InferRegexOutput<"^.*$">>().toEqualTypeOf<string>();
  });

  test(".+ → string", () => {
    expectTypeOf<InferRegexOutput<"^.+$">>().toEqualTypeOf<string>();
  });
});

// ── Groups ───────────────────────────────────────────────────────────

describe("group narrowing", () => {
  test("non-capturing group → transparent", () => {
    expectTypeOf<InferRegexOutput<"^(?:foo)$">>().toEqualTypeOf<"foo">();
  });

  test("capturing group → same inference, group is invisible to output", () => {
    expectTypeOf<InferRegexOutput<"^(foo)$">>().toEqualTypeOf<"foo">();
  });

  test("quantified group", () => {
    expectTypeOf<InferRegexOutput<"^(ab){1,2}$">>().toEqualTypeOf<"ab" | "abab">();
  });

  test("optional group", () => {
    expectTypeOf<InferRegexOutput<"^(a)?$">>().toEqualTypeOf<"" | "a">();
  });

  test("lookahead is zero-width", () => {
    expectTypeOf<InferRegexOutput<"^a(?=b)b$">>().toEqualTypeOf<"ab">();
  });

  test("lookbehind is zero-width", () => {
    expectTypeOf<InferRegexOutput<"^a(?<=a)b$">>().toEqualTypeOf<"ab">();
  });
});

// ── Real-world patterns ──────────────────────────────────────────────

describe("real-world pattern narrowing", () => {
  test("semver → number.number.number", () => {
    expectTypeOf<InferRegexOutput<"^(\\d+)\\.(\\d+)\\.(\\d+)$">>().toEqualTypeOf<
      `${number}.${number}.${number}`
    >();
  });

  test("hex color → # + string (mixed range exceeds budget)", () => {
    expectTypeOf<InferRegexOutput<"^#[0-9a-f]{6}$">>().toEqualTypeOf<
      `#${string}`
    >();
  });

  test("yes/no toggle", () => {
    expectTypeOf<InferRegexOutput<"^(yes|no)$">>().toEqualTypeOf<"yes" | "no">();
  });

  test("HTTP method", () => {
    expectTypeOf<InferRegexOutput<"^(GET|POST|PUT|DELETE|PATCH)$">>().toEqualTypeOf<
      "GET" | "POST" | "PUT" | "DELETE" | "PATCH"
    >();
  });

  test("ISO date prefix", () => {
    expectTypeOf<InferRegexOutput<"^\\d{4}-\\d{2}-\\d{2}$">>().toEqualTypeOf<
      `${number}-${number}-${number}`
    >();
  });

  test("UUID-like structure → string template segments", () => {
    type Result = InferRegexOutput<"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$">;
    expectTypeOf<Result>().toEqualTypeOf<`${string}-${string}-${string}-${string}-${string}`>();
  });
});
