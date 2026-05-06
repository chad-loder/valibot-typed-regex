# valibot-typed-regex

Type-level regex engine for Valibot. Takes a string literal pattern, **narrows the output type** to match, and **validates regex syntax at compile time**.

```ts
import * as v from "valibot";
import { typedRegex } from "valibot-typed-regex";

const schema = v.pipe(v.string(), typedRegex("^(active|inactive)$"));

type Output = v.InferOutput<typeof schema>;
// Output = "active" | "inactive"
```

Valibot's built-in `regex()` takes a `RegExp` and always returns `string`. `typedRegex()` takes a string literal instead, parses it at the type level, and infers a precise output type.

**Why a string and not `/pattern/`?** TypeScript erases regex literal contents -- `/^foo$/` is just `RegExp` in the type system, so there's nothing to parse. This is a [long-standing limitation](https://github.com/microsoft/TypeScript/issues/18521) with no planned fix. String literals are the only way to get the pattern into the type system.

Inspired by [ArkRegex](https://arktype.io/docs/blog/arkregex), which does the same thing for ArkType. Same core idea -- type-level regex parsing that's "at worst imprecise and never incorrect" -- adapted for Valibot pipelines. ArkRegex wraps `RegExp` and types `.test()`/`.exec()` results; `typedRegex()` is a Valibot action that narrows `v.InferOutput`.

## Install

```sh
npm install valibot-typed-regex
```

Requires `valibot >= 1.3.1` as a peer dependency.

## What it narrows

```ts
// Exact literals
typedRegex("^hello$")           // --> "hello"

// Alternation
typedRegex("^(GET|POST|PUT)$")  // --> "GET" | "POST" | "PUT"

// Numeric patterns
typedRegex("^\\d{3}$")          // --> `${number}`

// Structured templates
typedRegex("^(\\d+)\\.(\\d+)\\.(\\d+)$")
//                                --> `${number}.${number}.${number}`

// Quantifiers
typedRegex("^a{2,4}$")          // --> "aa" | "aaa" | "aaaa"
typedRegex("^a+$")              // --> `a${string}`

// Character classes
typedRegex("^[abc]$")           // --> "a" | "b" | "c"
typedRegex("^[a-f]$")           // --> "a" | "b" | "c" | "d" | "e" | "f"
```

## Compile-time syntax validation

Invalid patterns are caught before your code runs:

```ts
// @ts-expect-error -- Unclosed group: missing )
typedRegex("^(abc$");

// @ts-expect-error -- Quantifier + requires a preceding token
typedRegex("^+foo$");

// @ts-expect-error -- Group 2 does not exist
typedRegex("(a)b\\2");
```

## Fallback

When a pattern is too complex to narrow precisely, the output type falls back to `string` -- never incorrect, never `any`. Syntax validation still applies.

```ts
// Email-like pattern: too complex to enumerate, narrows to string
const email = v.pipe(
  v.string(),
  typedRegex("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"),
);
type E = v.InferOutput<typeof email>; // string
```

Not every type the engine *could* produce is useful. `[a-f]{4}` technically has 1,296 values -- but a 1,296-member union in a hover tooltip helps nobody. The type engine has expansion budgets that draw a line between types worth computing (`"GET" | "POST" | "PUT"`, `` `${number}.${number}.${number}` ``) and types where `string` is the honest, practical answer. In practice, character ranges up to 10 members and quantifier repeats up to 3 (for multi-member bases) are expanded; anything past that widens to `string`.

## Supported syntax

| Feature | Example | Notes |
|---|---|---|
| Literals | `abc` | |
| Anchors | `^`, `$` | |
| Alternation | `a\|b` | |
| Groups | `(...)`, `(?:...)`, `(?<name>...)` | Capturing, non-capturing, named |
| Lookaround | `(?=...)`, `(?!...)`, `(?<=...)`, `(?<!...)` | Zero-width |
| Quantifiers | `?`, `+`, `*`, `{n}`, `{n,m}`, `{n,}` | Lazy `?` suffix accepted |
| Character classes | `[abc]`, `[a-f]`, `[^...]` | Negated classes widen to `string` |
| Escapes | `\d`, `\w`, `\s`, `\b`, `\.` | |
| Case-insensitive | `(?i:...)` | Inline modifier groups |
| Dot | `.` | Matches `string` (not single-char) |

**Not supported** (pattern works at runtime, type widens to `string`):
- `\x41`, `A`, `\0` hex/unicode/null escapes
- `\p{...}` unicode property escapes (widen to `string`)
- Backreference *values* (references are validated but typed as `string`)

## API

```ts
function typedRegex<TPattern extends string>(
  pattern: TPattern,
  message?: ErrorMessage,
): TypedRegexAction;
```

Returns a Valibot validation action. Use it anywhere you'd use `v.regex()`:

```ts
v.pipe(v.string(), typedRegex("^\\d{4}-\\d{2}-\\d{2}$"))
```

## License

MIT
