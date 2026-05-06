# Design

`valibot-typed-regex` parses regular expressions entirely inside TypeScript's type system -- no code generation, no compiler plugins, no runtime cost. The entire type engine is erased at compile time. It emits zero bytes of JavaScript. At runtime, `typedRegex()` is just a thin wrapper around `new RegExp()`. All the parsing, AST construction, quantifier expansion, and budget checking happens in the type checker and disappears from the bundle.

Heavily inspired by [ArkRegex](https://arktype.io/docs/blog/arkregex), which pioneered type-level regex parsing in TypeScript and established the design philosophy: types should be "at worst imprecise and never incorrect." This project adapts those ideas for Valibot's pipeline architecture while pushing precision further in a few areas.

### Where this diverges from ArkRegex

ArkRegex's approach is "widen early and often" -- character ranges like `[a-f]` immediately become `string`, and there's no explicit budget system. That's a reasonable tradeoff that keeps compile times fast and avoids surprises. This project tries to be more precise where the cost is bounded:

- **Character range enumeration**: ArkRegex widens all non-digit ranges to `string`. We enumerate small ranges (`[a-f]` becomes `"a" | "b" | "c" | "d" | "e" | "f"`) using a master-string template literal trick that runs in O(1) recursion depth. Ranges wider than 10 characters still widen to `string`.

- **Named expansion budgets**: Instead of relying on TS hitting its own limits, the engine has explicit constants (`MAX_ENUMERABLE_RANGE`, `MAX_QUANTIFIER_FOR_UNIONS`, etc.) that draw a line between types worth computing and types that would just be noise in a hover tooltip. This makes degradation predictable -- the same pattern produces the same type on every TS version, rather than depending on internal compiler thresholds.

- **Case-insensitive modifier groups**: `(?i:hello)` expands to the case-variant union with a budget guard that tracks consecutive split characters and wipes the sequence to `string` when 2^N paths would exceed TS limits.

ArkRegex deserves all the credit for proving this was possible and for the recursive descent + tail-state-threading architecture that makes it practical. The differences above are refinements, not reinventions.

## Architecture

The engine lives in `src/type-engine/` and has zero runtime footprint -- every file exports only types. At runtime, the pattern is just passed to `new RegExp()`. All the interesting stuff happens at compile time.

### Recursive descent via tail-position state threading

The parser is a recursive descent machine encoded as TypeScript conditional types. The central trick is **tail-position state threading**: instead of building up deeply nested return types that blow TS's recursion limit, each step returns a new `State` object that carries everything forward in a flat structure.

```ts
type ParseState<TState extends State> =
  TState["unscanned"] extends InternalErrorMessage ? TState["unscanned"]
    : TState["unscanned"] extends "" ? s.FinalizeState<TState>
      : ParseState<Next<TState>>;
```

This is a loop disguised as recursion. `ParseState` calls `Next` to consume one token, which returns a new `State` with the remaining input in `unscanned`. TypeScript can optimize this tail-recursive form -- each step produces a flat state object, not a deeper nesting level. A 50-character pattern recurses 50 times at constant depth, not 50 levels deep.

The `State` interface carries the full parser context as a single object:

```ts
interface State extends State.Group {
  unscanned: string;     // remaining input to parse
  groups: State.Group[]; // stack of enclosing groups
  flags: Flags;          // global regex flags
}

type Group = {
  capture: CaptureKind;    // named, indexed, or non-capturing
  branches: RegexAst[];    // completed alternation branches
  sequence: RegexAst;      // current sequence being built
  root: RegexAst;          // last node (target for quantifiers)
  caseInsensitive: boolean;
  ciRun: 1[];              // consecutive case-variant char count
};
```

State transitions are namespaced under `s` and each produces a new `State` -- `s.ShiftQuantifiable`, `s.PushGroup`, `s.PopGroup`, `s.FinalizeBranch`, etc. The parser's `Next` type dispatches on the first character:

```ts
type Next<TState extends State> =
  TState["unscanned"] extends Scanner.Shift<infer TLookahead, infer TUnscanned>
    ? TLookahead extends "." ? s.ShiftQuantifiable<TState, string, TUnscanned>
      : TLookahead extends "\\" ? ParseEscape<TState, TUnscanned>
        : TLookahead extends "|" ? s.FinalizeBranch<TState, TUnscanned>
          : TLookahead extends "(" ? ParseGroup<TState, TUnscanned>
            // ... each token type dispatches to its handler
    : never;
```

### Two-phase parse and finalize

Parsing builds an AST from type-level interfaces (`SequenceTree`, `UnionTree`, `GroupTree`, `QuantifierTree`). Finalization walks the AST and produces the actual string template literal types. This separation matters because some information isn't available until the full pattern is parsed -- backreferences need to know what their target group matched, and alternation branches need to unify their capture groups.

The finalization pass (`FinalizeTree`) dispatches on AST node type and recursively evaluates each subtree into a `FinalizationResult` containing a pattern string and a context with captures/names. Unions distribute: finalizing a `SequenceTree` containing `UnionTree` children produces the cartesian product of their branches as a TypeScript union type.

### Character range enumeration via master strings

Character ranges like `[a-f]` are enumerated using a template literal matching trick on constant "master strings":

```ts
type LowercaseAlphabet = "abcdefghijklmnopqrstuvwxyz";

type ExtractRange<TStart, TEnd, TSequence> =
  TSequence extends `${string}${TStart}${infer Middle}${TEnd}${string}`
    ? TStart | StringToUnion<Middle> | TEnd
    : ...;
```

`"abcdefghijklmnopqrstuvwxyz" extends \`${string}a${infer Middle}f${string}\`` matches with `Middle = "bcde"`, then `StringToUnion` splits that into `"b" | "c" | "d" | "e"`. The range check is O(1) -- one template literal match, no recursion. `StringToUnion` recurses only over the extracted middle, which is bounded by the budget.

### Quantifier expansion as tuple-counted loops

Quantifiers like `{2,4}` need to produce `"aa" | "aaa" | "aaaa"`. The type system has no for-loop, but it has tuple length:

```ts
type LoopUntilMin<TBase, TMin, TMax, TAcc, TReps extends 1[]> =
  TReps["length"] extends TMin
    ? TMax extends number ? LoopUntilMax<...>
      : `${TAcc}${string}`
    : LoopUntilMin<TBase, TMin, TMax, `${TAcc}${TBase}`, [...TReps, 1]>;
```

Each recursion step appends `TBase` to the accumulator and pushes a `1` onto the tuple. When the tuple length hits `TMin`, the loop switches to accumulating optional suffixes via union (`TAcc | \`${TAcc}${TBase}\``). For unbounded quantifiers (`+`, `{n,}`), it appends `${string}` once the minimum is reached -- `a{2,}` becomes `` `aa${string}` ``.

A `${number}` fast-path short-circuits before expansion: `\d{50}` collapses to `` `${number}` `` in one step, since `` `${number}${number}` `` is just `` `${number}` ``.

## Expansion budgets

Not every type the engine *could* produce is useful to a developer. `[a-f]{4}` technically has 1,296 distinct values -- but a 1,296-member union in a hover tooltip helps nobody, and generating it stalls the language server. The engine draws a line between types that are worth computing precisely (`"GET" | "POST" | "PUT"`, `` `${number}.${number}.${number}` ``) and types where `string` is the honest, practical answer.

This is separate from the tail-recursion architecture. The parser can handle arbitrarily long patterns at constant stack depth. The budget system limits the *output* -- how many union members a single node is allowed to produce before it widens to `string`. TypeScript also has hard limits (unions above ~100K members crash, deep non-tail recursion triggers "excessively deep" errors), but the budgets are set well below those thresholds so degradation is predictable and controlled, not a TS error message.

### The N^K formula

A character class with N members quantified K times produces N^K union members. The budget targets a ceiling of ~1,000 combinations per node -- past that point, the type is more noise than signal.

| Constant | Value | Controls |
|---|---|---|
| `MAX_ENUMERABLE_RANGE` | 10 | Max chars in a range before widening to `string` |
| `MAX_QUANTIFIER_FOR_UNIONS` | 3 | Max repetitions for multi-member bases |
| `MAX_QUANTIFIER_FOR_SINGLETONS` | 20 | Max repetitions for single-member bases |
| `MAX_CASE_INSENSITIVE_RUN` | 8 | Max consecutive case-split chars (2^N paths) |

### How budgets apply

**Range enumeration**: `[a-j]` (10 chars) is enumerated. `[a-z]` (26 chars) widens to `string`.

**Quantifier expansion**: `[a-f]{3}` (6^3 = 216) is expanded. `[a-f]{4}` (6^4 = 1,296) widens to `string`. Singletons get a separate, more generous limit -- `a{20}` expands but `a{50}` produces a typed prefix (`` `aaaaaaaaaaaaaaaaaaaa${string}` ``) instead of crashing.

**Case-insensitive splitting**: Each case-variant character in `(?i:...)` doubles the evaluation paths (the sequence tree finalizer distributes over each 2-branch union). 2^8 = 256 is comfortable; 2^10 = 1,024 exceeds TS limits when combined with downstream finalization work. When the budget is hit, `WidenSequence` replaces the entire accumulated sequence with `string` rather than partially widening -- partial widening would leave `${string}${"a"|"A"}...` mixes that don't help anyone.

### Union detection

Budget decisions need to know whether a pattern is a union or singleton, because 1^K = 1 regardless of K. `IsUnion` uses the contravariance trick:

```ts
type IsUnion<T extends string> =
  [T] extends [UnionToIntersection<T>] ? false : true;
```

For `"a" | "b"`, `UnionToIntersection` produces `"a" & "b"` = `never`. `["a" | "b"] extends [never]` is false, so `IsUnion` returns `true`. For `"a"` alone, the intersection is `"a"`, and `["a"] extends ["a"]` is true.

The tuple wrap `[T] extends [...]` prevents distribution over the union -- without it, the conditional would evaluate once per union member and always return `false`.

## File map

| File | Role |
|---|---|
| `scanner.ts` | String-scanning primitives (`Shift`, `ShiftUntil`, etc.) |
| `parse.ts` | Main parse loop and character dispatch |
| `state.ts` | State interface, transitions, AST nodes, finalization |
| `group.ts` | Group/modifier/lookaround parsing |
| `escape.ts` | Escape sequences and backreferences |
| `charset.ts` | Character class parsing and range enumeration |
| `quantify.ts` | Quantifier parsing, budget checks, expansion loops |
| `limits.ts` | Budget constants and type-level math utilities |
| `index.ts` | Public API types (`ParseRegex`, `InferRegexOutput`, etc.) |
