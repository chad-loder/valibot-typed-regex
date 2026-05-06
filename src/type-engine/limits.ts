// Expansion limits for the type-level regex parser.
//
// Governing formula: N^K where N = character class size, K = quantifier max.
// Hard ceiling: ~1,000 total combinations per evaluated node.
// See docs/expansion-limits.md for the full rationale.

// Worst case with MAX_QUANTIFIER_FOR_UNIONS = 3: 10^3 = 1,000.
export type MAX_ENUMERABLE_RANGE = 10;

// Singletons use MAX_QUANTIFIER_FOR_SINGLETONS instead (1^K = 1, no explosion).
export type MAX_QUANTIFIER_FOR_UNIONS = 3;

// Bounds recursion depth for singletons like a{5000} that don't explode
// combinatorially but still crash TS via deep template literal recursion.
export type MAX_QUANTIFIER_FOR_SINGLETONS = 20;

// Each case-variant char doubles evaluation paths (2^N, not just union members).
// 2^8 = 256 is comfortable; 2^10 exceeds TS limits with downstream finalization.
// Don't bump after testing in isolation — calibrated with full e2e patterns.
export type MAX_CASE_INSENSITIVE_RUN = 8;

// Union detection via contravariance: UnionToIntersection<"a"|"b"> = never.
export type IsUnion<T extends string> =
  [T] extends [UnionToIntersection<T>] ? false : true;

type UnionToIntersection<U> =
  (U extends unknown ? (x: U) => void : never) extends (x: infer I) => void
    ? I
    : never;

export type StringLength<
  S extends string,
  TAcc extends 1[] = [],
> = S extends `${infer _Char}${infer TRest}`
  ? StringLength<TRest, [...TAcc, 1]>
  : TAcc["length"];

// O(min(N, Max)) recursion — callers must pre-clamp to small values.
export type LessThanOrEqual<
  N extends number,
  TMax extends number,
  TAcc extends 1[] = [],
> =
  TAcc["length"] extends N ? true
    : TAcc["length"] extends TMax ? false
      : LessThanOrEqual<N, TMax, [...TAcc, 1]>;
