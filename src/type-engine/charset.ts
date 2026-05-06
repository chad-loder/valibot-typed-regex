import type { Backslash, NoSuggest, Scanner, WriteUnclosedGroupMessage } from "./scanner.ts";
import type { ParseEscapedChar, StringDigit } from "./escape.ts";
import type { s, State } from "./state.ts";
import type { LessThanOrEqual, MAX_ENUMERABLE_RANGE } from "./limits.ts";

export type ParseCharset<TState extends State, TUnscanned extends string> =
  Scanner.ShiftUntilEscapable<TUnscanned, "]", Backslash> extends (
    Scanner.ShiftResult<infer TScanned, infer TNext>
  )
    ? TNext extends `]${infer TRemaining}`
      ? TScanned extends Scanner.Shift<"^", string>
        ? s.ShiftQuantifiable<TState, string, TRemaining>
        : ParseNonNegatedCharset<TScanned, never, null> extends (
          infer TResult extends string
        )
          ? TResult extends InternalErrorMessage ? s.Error<TResult>
            : [TResult] extends [never]
              ? s.Error<EmptyCharacterSetMessage>
              : s.ShiftQuantifiable<
                TState,
                ApplyCasing<TState["caseInsensitive"], TResult>,
                TRemaining
              >
          : never
      : s.Error<WriteUnclosedGroupMessage<"]">>
    : never;

type ApplyCasing<TCaseInsensitive extends boolean, TChars extends string> =
  TCaseInsensitive extends true
    ? TChars | Uppercase<TChars> | Lowercase<TChars>
    : TChars;

type ParseNonNegatedCharset<
  TChars extends string,
  TSet extends string,
  TLastChar extends string | null,
> =
  ParseChar<TChars> extends Scanner.ShiftResult<infer TResult, infer TRemainder>
    ? TResult extends UnescapedDashMarker ? ParseDash<TRemainder, TSet, TLastChar>
      : TResult extends InternalErrorMessage ? TResult
        : ParseNonNegatedCharset<TRemainder, TSet | TResult, TResult>
    : TSet;

type ParseDash<
  TUnscanned extends string,
  TSet extends string,
  TLastChar extends string | null,
> =
  TLastChar extends string
    ? ParseChar<TUnscanned> extends Scanner.ShiftResult<infer TRangeEnd, infer TNext>
      ? ParseNonNegatedCharset<TNext, TSet | InferRange<TLastChar, TRangeEnd>, null>
      : TSet | "-"
    : ParseNonNegatedCharset<TUnscanned, TSet | "-", "-">;

type LowercaseAlphabet = "abcdefghijklmnopqrstuvwxyz";
type UppercaseAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

type StringToUnion<S extends string> = S extends `${infer C}${infer R}`
  ? C | StringToUnion<R>
  : never;

type ExtractRange<
  TStart extends string,
  TEnd extends string,
  TSequence extends string,
> = TSequence extends `${string}${TStart}${infer Middle}${TEnd}${string}`
  ? RangeWithinBudget<Middle> extends true
    ? StringToUnion<`${TStart}${Middle}${TEnd}`>
    : string
  : TStart extends TEnd
    ? TStart
    : never;

// Total range width = middle + 2 endpoints. Must be ≤ MAX_ENUMERABLE_RANGE.
// Starts the accumulator at 2 to account for the start/end chars, so the
// result is directly comparable to MAX_ENUMERABLE_RANGE with no derived constant.
type RangeWithinBudget<TMiddle extends string> =
  LessThanOrEqual<MiddleLengthPlus2<TMiddle>, MAX_ENUMERABLE_RANGE> extends true
    ? true
    : false;

type MiddleLengthPlus2<S extends string, TAcc extends 1[] = [1, 1]> =
  S extends `${infer _Char}${infer TRest}`
    ? MiddleLengthPlus2<TRest, [...TAcc, 1]>
    : TAcc["length"];

type InferRange<TStart extends string, TEnd extends string> =
  TStart | TEnd extends StringDigit
    ? `${number}`
    : TStart extends TEnd
      ? LowercaseAlphabet extends `${string}${TStart}${string}` ? TStart
        : UppercaseAlphabet extends `${string}${TStart}${string}` ? TStart
          : string
      : LowercaseAlphabet extends `${string}${TStart}${string}${TEnd}${string}`
        ? ExtractRange<TStart, TEnd, LowercaseAlphabet>
        : UppercaseAlphabet extends `${string}${TStart}${string}${TEnd}${string}`
          ? ExtractRange<TStart, TEnd, UppercaseAlphabet>
          : string;

type UnescapedDashMarker = NoSuggest<"dash">;

type InternalErrorMessage = import("./scanner.ts").InternalErrorMessage;

type ParseChar<TUnscanned extends string> =
  TUnscanned extends Scanner.Shift<infer TLookahead, infer TNext>
    ? TLookahead extends Backslash
      ? TNext extends Scanner.Shift<infer TEscaped, infer TPostEscaped>
        ? Scanner.ShiftResult<ParseEscapedChar<TEscaped>, TPostEscaped>
        : never
      : Scanner.ShiftResult<
        TLookahead extends "-" ? UnescapedDashMarker : TLookahead,
        TNext
      >
    : null;

export type EmptyCharacterSetMessage =
  "Empty character set [] is unsatisfiable";
