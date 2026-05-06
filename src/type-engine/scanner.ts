// Type-level string scanning and helpers.
// All exports are type-only; this file contributes 0 bytes to the runtime bundle.

export type Backslash = "\\";

export type WhitespaceChar = " " | "\n" | "\t";

export type ZeroWidthSpace = "\u{200B}";

export type InternalErrorMessage<TMessage extends string = string> =
  `${TMessage}${ZeroWidthSpace}`;

export type NoSuggest<TValue extends string = string> = ` ${TValue}`;

export type Contains<TString extends string, TSub extends string> =
  TString extends `${string}${TSub}${string}` ? true : false;

export type NumberLiteral<TNum extends number = number> = `${TNum}`;

export type UnionKeyOf<TValue> =
  TValue extends unknown ? keyof TValue : never;

type ParseInteger<TToken extends string> =
  TToken extends `${bigint}`
    ? TToken extends `${infer TNum extends number}` ? TNum
      : never
    : never;

export type ParseNonNegativeInteger<TToken extends string> =
  TToken extends `-${string}` ? never : ParseInteger<TToken>;

export type SetIndex<
  TArr extends readonly unknown[],
  TIndex extends number,
  TTo extends TArr[number],
> =
  TArr extends TArr[number][] ? _SetIndex<TArr, TIndex, TTo, []>
    : Readonly<_SetIndex<TArr, TIndex, TTo, []>>;

type _SetIndex<
  TArr extends readonly unknown[],
  TIndex extends number,
  TTo extends TArr[number],
  TResult extends TArr[number][],
> =
  TArr extends readonly [infer THead, ...infer TTail]
    ? _SetIndex<TTail, TIndex, TTo, [...TResult, TResult["length"] extends TIndex ? TTo : THead]>
    : TResult;

export type WriteUnclosedGroupMessage<TMissingChar extends string> =
  TMissingChar extends ")" ? "Unterminated group"
    : TMissingChar extends "]" ? "Unterminated character class"
      : TMissingChar extends ">" ? "Unterminated group name"
        : `Missing ${TMissingChar}`;

export type WriteUnmatchedGroupCloseMessage<
  TChar extends string,
  TUnscanned extends string,
> = `Unmatched '${TChar}'${TUnscanned extends "" ? "" : ` before ${TUnscanned}`}`;

export declare namespace Scanner {
  export type Shift<
    TLookahead extends string,
    TUnscanned extends string,
  > = `${TLookahead}${TUnscanned}`;

  export type ShiftResult<
    TScanned extends string,
    TUnscanned extends string,
  > = [TScanned, TUnscanned];

  export type ShiftUntil<
    TUnscanned extends string,
    TTerminator extends string,
    TAppendTo extends string = "",
  > =
    TUnscanned extends Shift<infer TLookahead, infer TNext>
      ? TLookahead extends TTerminator
        ? [TAppendTo, TUnscanned]
        : ShiftUntil<TNext, TTerminator, `${TAppendTo}${TLookahead}`>
      : [TAppendTo, ""];

  export type ShiftUntilEscapable<
    TUnscanned extends string,
    TTerminator extends string,
    TEscapeEscape extends Backslash | "",
    TAppendTo extends string = "",
  > =
    TUnscanned extends Shift<infer TLookahead, infer TNext>
      ? TLookahead extends TTerminator ? [TAppendTo, TUnscanned]
        : TLookahead extends Backslash
          ? TNext extends Shift<infer TNextLookahead, infer TPostEscaped>
            ? ShiftUntilEscapable<
              TPostEscaped,
              TTerminator,
              TEscapeEscape,
              `${TAppendTo}${TNextLookahead extends TTerminator ? ""
                : TNextLookahead extends Backslash ? TEscapeEscape
                  : Backslash}${TNextLookahead}`
            >
            : [`${TAppendTo}${Backslash}`, ""]
          : ShiftUntilEscapable<
            TNext,
            TTerminator,
            TEscapeEscape,
            `${TAppendTo}${TLookahead}`
          >
      : [TAppendTo, ""];

  export type ShiftUntilNot<
    TUnscanned extends string,
    TNonTerminator extends string,
    TAppendTo extends string = "",
  > =
    TUnscanned extends Shift<infer TLookahead, infer TNext>
      ? TLookahead extends TNonTerminator
        ? ShiftUntilNot<TNext, TNonTerminator, `${TAppendTo}${TLookahead}`>
        : [TAppendTo, TUnscanned]
      : [TAppendTo, ""];
}
