import type { ParseNonNegativeInteger, Scanner } from "./scanner.ts";
import type { s, State } from "./state.ts";
import type { IsUnion, LessThanOrEqual, MAX_QUANTIFIER_FOR_SINGLETONS, MAX_QUANTIFIER_FOR_UNIONS } from "./limits.ts";

export type ParseBuiltinQuantifier<
  TState extends State,
  TQuantifier extends QuantifyingChar,
  TUnscanned extends string,
> =
  TState["root"] extends ""
    ? s.Error<WriteUnmatchedQuantifierError<TQuantifier>>
    : QuantifyBuiltin<
      TState,
      TQuantifier,
      TUnscanned extends Scanner.Shift<"?", infer TLazy> ? TLazy : TUnscanned
    >;

type QuantifyBuiltin<
  TState extends State,
  TQuantifier extends QuantifyingChar,
  TUnscanned extends string,
> =
  TQuantifier extends "?" ? s.PushQuantifier<TState, 0, 1, TUnscanned>
    : TQuantifier extends "+" ? s.PushQuantifier<TState, 1, null, TUnscanned>
      : TQuantifier extends "*" ? s.PushQuantifier<TState, 0, null, TUnscanned>
        : never;

type ParsedRange = {
  min: number;
  max: number | null;
  unscanned: string;
};

type SkipPossibleQuestionMark<TUnscanned extends string> =
  TUnscanned extends `?${infer TNext}` ? TNext : TUnscanned;

type ParsePossibleRangeString<TUnscanned extends string> =
  TUnscanned extends (
    `${infer TLeft extends `${number}`},${infer TRight extends `${number}`}}${infer TNext}`
  )
    ? {
      min: ParseNonNegativeInteger<TLeft>;
      max: ParseNonNegativeInteger<TRight>;
      unscanned: SkipPossibleQuestionMark<TNext>;
    }
    : TUnscanned extends `${infer TLeft extends `${number}`},}${infer TNext}`
      ? {
        min: ParseNonNegativeInteger<TLeft>;
        max: null;
        unscanned: SkipPossibleQuestionMark<TNext>;
      }
      : TUnscanned extends `${infer TLeft extends `${number}`}}${infer TNext}`
        ? {
          min: ParseNonNegativeInteger<TLeft>;
          max: ParseNonNegativeInteger<TLeft>;
          unscanned: SkipPossibleQuestionMark<TNext>;
        }
        : null;

type ParseQuantifier<TUnscanned extends string, TParsed extends ParsedRange> =
  TUnscanned extends `${infer TRange}${TParsed["unscanned"]}` ? `{${TRange}` : never;

export type ParsePossibleRange<
  TState extends State,
  TUnscanned extends string,
  TParsed extends ParsedRange | null = ParsePossibleRangeString<TUnscanned>,
> =
  TParsed extends ParsedRange
    ? TState["root"] extends ""
      ? s.Error<WriteUnmatchedQuantifierError<ParseQuantifier<TUnscanned, TParsed>>>
      : [TParsed["min"], TParsed["max"]] extends ([never, unknown] | [unknown, never])
        ? s.Error<WriteUnnaturalNumberQuantifierError<ParseQuantifier<TUnscanned, TParsed>>>
        : s.PushQuantifier<
          TState,
          TParsed["min"],
          TParsed["max"],
          TParsed["unscanned"] extends Scanner.Shift<"?", infer TLazy> ? TLazy
            : TParsed["unscanned"]
        >
    : s.ShiftQuantifiable<TState, "{", TUnscanned>;

export type Quantify<
  TPattern extends string,
  TMin extends number,
  TMax extends number | null,
> = TryFastPath<TPattern, TMin, TMax>;

type TryFastPath<
  TPattern extends string,
  TMin extends number,
  TMax extends number | null,
> =
  TMax extends 0 ? ""
    : string extends TPattern ? string
      // Any `${number}` base collapses to `${number}` regardless of bounds.
      // This intentionally short-circuits before the budget check — `${number}`
      // repeated is still `${number}`, so precision is lossless.
      : [TPattern] extends [`${number}`] ? `${number}`
        : ExceedsBudget<TPattern, TMin, TMax> extends true
          ? IsUnion<TPattern> extends true ? string
            : LoopUntilMin<TPattern, CapAt<TMin, MAX_QUANTIFIER_FOR_SINGLETONS>, null, "", []>
          : TMin extends 0
            ? TMax extends 1 ? "" | TPattern
              : TMax extends number ? LoopFromZero<TPattern, TMax, "", []>
                : "" | `${TPattern}${string}`
            : LoopUntilMin<TPattern, TMin, TMax, "", []>;

// Bail out before expansion would crash the compiler.
// For {N,M} the expansion loop runs M times, so check TMax.
// For {N,} the loop builds an N-length prefix then appends `${string}`,
// so check TMin — otherwise a{5000,} recurses 5,000 levels deep.
type ExceedsBudget<TPattern extends string, TMin extends number, TMax extends number | null> =
  TMax extends number
    ? ExceedsLimit<TPattern, TMax>
    : ExceedsLimit<TPattern, TMin>;

type ExceedsLimit<TPattern extends string, TLimit extends number> =
  IsUnion<TPattern> extends true
    ? LessThanOrEqual<TLimit, MAX_QUANTIFIER_FOR_UNIONS> extends true ? false : true
    : LessThanOrEqual<TLimit, MAX_QUANTIFIER_FOR_SINGLETONS> extends true ? false : true;

// Clamp N to at most Max.
type CapAt<N extends number, TMax extends number> =
  LessThanOrEqual<N, TMax> extends true ? N : TMax;

type LoopFromZero<
  TBase extends string,
  TMax extends number,
  TAcc extends string,
  TReps extends 1[],
> =
  TReps["length"] extends TMax ? TAcc
    : LoopFromZero<TBase, TMax, TAcc | `${TAcc}${TBase}`, [...TReps, 1]>;

type LoopUntilMin<
  TBase extends string,
  TMin extends number,
  TMax extends number | null,
  TAcc extends string,
  TReps extends 1[],
> =
  TReps["length"] extends TMin
    ? TMax extends number ? LoopUntilMax<TBase, TMin, TMax, TAcc, TReps>
      // TMin=0 branch: only reachable from the budget-exceeded path
      // (e.g. a{0,5000}), since TryFastPath pre-handles TMin extends 0
      // before reaching LoopUntilMin on the normal path.
      : TReps["length"] extends 0 ? TAcc | `${TAcc}${TBase}${string}`
        : `${TAcc}${string}`
    : LoopUntilMin<TBase, TMin, TMax, `${TAcc}${TBase}`, [...TReps, 1]>;

type LoopUntilMax<
  TBase extends string,
  _TMin extends number,
  TMax extends number,
  TAcc extends string,
  TReps extends 1[],
> =
  TReps["length"] extends TMax ? TAcc
    : LoopUntilMax<TBase, _TMin, TMax, TAcc | `${TAcc}${TBase}`, [...TReps, 1]>;

export type QuantifyingChar = "*" | "+" | "?";

export type WriteUnmatchedQuantifierError<TQuantifier extends string> =
  `Quantifier ${TQuantifier} requires a preceding token`;

export type WriteUnnaturalNumberQuantifierError<TQuantifier extends string> =
  `Quantifier ${TQuantifier} must use natural numbers`;
