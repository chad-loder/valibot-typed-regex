/**
 * Compile-time regex syntax validation.
 *
 * Every `@ts-expect-error` below marks a pattern that would silently compile
 * with plain valibot `regex()` but is caught at build time by `typedRegex()`.
 * Remove any `@ts-expect-error` line and the build breaks — proving the
 * type engine is doing its job.
 */

import { describe, test } from "vitest";
import { typedRegex } from "../typedRegex.ts";

describe("syntax errors caught at compile time", () => {
  // ── Unbalanced groups ────────────────────────────────────────────

  describe("unbalanced groups", () => {
    test("unclosed parenthesis", () => {
      // @ts-expect-error — Missing )
      typedRegex("(abc");
    });

    test("unmatched closing parenthesis", () => {
      // @ts-expect-error — Unmatched )
      typedRegex("abc)");
    });

    test("deeply nested unclosed group", () => {
      // @ts-expect-error — Missing )
      typedRegex("(a(b(c)d)");
    });

    test("unclosed character class", () => {
      // @ts-expect-error — Missing ]
      typedRegex("[abc");
    });

    test("unclosed named group", () => {
      // @ts-expect-error — Missing >
      typedRegex("(?<fooabc)");
    });
  });

  // ── Misplaced anchors ────────────────────────────────────────────

  describe("misplaced anchors", () => {
    test("consecutive start anchor", () => {
      // @ts-expect-error — Anchor ^ may not appear mid-pattern
      typedRegex("^^");
    });

    test("consecutive end anchor", () => {
      // @ts-expect-error — Anchor $ may not appear mid-pattern
      typedRegex("$$");
    });

    test("start anchor after content", () => {
      // @ts-expect-error — Anchor ^ may not appear mid-pattern
      typedRegex("a^");
    });

    test("end anchor before content", () => {
      // @ts-expect-error — Anchor $ may not appear mid-pattern
      typedRegex("$a");
    });
  });

  // ── Dangling quantifiers ─────────────────────────────────────────

  describe("dangling quantifiers", () => {
    test("leading ?", () => {
      // @ts-expect-error — Quantifier ? requires a preceding token
      typedRegex("?");
    });

    test("leading +", () => {
      // @ts-expect-error — Quantifier + requires a preceding token
      typedRegex("+");
    });

    test("leading *", () => {
      // @ts-expect-error — Quantifier * requires a preceding token
      typedRegex("*");
    });

    test("leading range quantifier", () => {
      // @ts-expect-error — Quantifier {2,3} requires a preceding token
      typedRegex("{2,3}");
    });

    test("double question mark at start", () => {
      // @ts-expect-error — Quantifier ? requires a preceding token
      typedRegex("??");
    });
  });

  // ── Invalid quantifier ranges ────────────────────────────────────

  describe("invalid quantifier ranges", () => {
    test("leading zeroes in count", () => {
      // @ts-expect-error — Quantifier {002} must use natural numbers
      typedRegex("^a{002}$");
    });

    test("negative number in count", () => {
      // @ts-expect-error — Quantifier {-1} must use natural numbers
      typedRegex("^a{-1}$");
    });

    test("decimal number in count", () => {
      // @ts-expect-error — Quantifier {1.5} must use natural numbers
      typedRegex("^a{1.5}$");
    });

    test("space in count", () => {
      // @ts-expect-error — Quantifier { 1} must use non-negative integers
      typedRegex("^a{ 1}$");
    });

    test("reversed range {3,1}", () => {
      // @ts-expect-error — Numbers out of order in {3,1} quantifier
      typedRegex("^a{3,1}$");
    });

    test("reversed range {10,2}", () => {
      // @ts-expect-error — Numbers out of order in {10,2} quantifier
      typedRegex("^a{10,2}$");
    });
  });

  // ── Invalid escapes ──────────────────────────────────────────────

  describe("invalid escapes", () => {
    test("trailing backslash", () => {
      // @ts-expect-error — A regex cannot end with \
      typedRegex("abc\\");
    });

    test("unnecessary escape", () => {
      // @ts-expect-error — Escape preceding a is unnecessary
      typedRegex("\\a");
    });

    test("caret notation", () => {
      // @ts-expect-error — \cX notation is not supported
      typedRegex("\\cA");
    });

    test("string-escapable character in regex", () => {
      // @ts-expect-error — \n is a JavaScript string escape
      typedRegex("\\n");
    });

    test("unsupported regex escapes", () => {
      // @ts-expect-error — \x is valid regex but not supported by type engine
      typedRegex("\\x41");
      // @ts-expect-error — \u is valid regex but not supported by type engine
      typedRegex("\\u0041");
      // @ts-expect-error — \0 is valid regex but not supported by type engine
      typedRegex("\\0");
    });
  });

  // ── Invalid backreferences ───────────────────────────────────────

  describe("invalid backreferences", () => {
    test("reference to nonexistent indexed group", () => {
      // @ts-expect-error — Group 2 does not exist
      typedRegex("(a)b\\2");
    });

    test("reference to nonexistent named group", () => {
      // @ts-expect-error — Group bar does not exist
      typedRegex("(?<foo>a)b\\k<bar>");
    });

    test("missing backreference name", () => {
      // @ts-expect-error — \k must be followed by a named reference
      typedRegex("^(?<foo>a)b\\k$");
    });

    test("empty named capture group", () => {
      // @ts-expect-error — Capture group <> requires a name
      typedRegex("(?<>foo)");
    });

    test("incomplete reference (self-referencing group)", () => {
      // @ts-expect-error — Reference to incomplete group '1' has no effect
      typedRegex("^(a\\1b)c\\1$");
    });
  });

  // ── Empty character set ──────────────────────────────────────────

  describe("character sets", () => {
    test("empty character set", () => {
      // @ts-expect-error — Empty character set [] is unsatisfiable
      typedRegex("[]");
    });
  });

  // ── Modifier errors ──────────────────────────────────────────────

  describe("modifier errors", () => {
    test("unescaped literal question mark in group", () => {
      // @ts-expect-error — literal ? must be escaped
      typedRegex("(?ab)");
    });

    test("invalid modifier flag", () => {
      // @ts-expect-error — Modifier flag x must be 'i', 'm' or 's'
      typedRegex("(?x:abc)");
    });

    test("duplicate modifier", () => {
      // @ts-expect-error — Modifier m cannot appear multiple times
      typedRegex("(?mm:.*)");
    });
  });

  // ── Sanity: valid patterns should NOT error ──────────────────────

  describe("valid patterns compile cleanly", () => {
    test("simple literal", () => {
      typedRegex("^hello$");
    });

    test("anchored alternation", () => {
      typedRegex("^(foo|bar)$");
    });

    test("character class", () => {
      typedRegex("^[a-z]+$");
    });

    test("named group", () => {
      typedRegex("^(?<year>\\d{4})-(?<month>\\d{2})-(?<day>\\d{2})$");
    });

    test("complex pattern", () => {
      typedRegex("^https?://[^/]+/.*$");
    });

    test("quantifier range", () => {
      typedRegex("^\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}$");
    });

    test("backreference", () => {
      typedRegex("^(a|b)\\1$");
    });

    test("non-capturing group", () => {
      typedRegex("^(?:foo|bar)+$");
    });

    test("lookahead", () => {
      typedRegex("^a(?=b)b$");
    });

    test("escape sequences", () => {
      typedRegex("^\\d\\w\\s$");
    });
  });
});
