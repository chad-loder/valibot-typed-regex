import type { InternalErrorMessage, Scanner, WhitespaceChar } from "./scanner.ts";
import type { Control, ReferenceNode, s, State } from "./state.ts";

export type ParseEscape<TState extends State, TUnscanned extends string> =
  TUnscanned extends Scanner.Shift<infer TChar, infer TNext>
    ? TChar extends NonZeroDigit ? ParseNumericBackreference<TState, TUnscanned>
      : TChar extends "k" ? ParseNamedBackreference<TState, TNext>
        : TChar extends UnicodePropertyChar ? ParseUnicodeProperty<TState, TChar, TNext>
          : ParseSingleEscapedCharacter<TState, TChar, TNext>
    : s.Error<TrailingBackslashMessage>;

type ParseNumericBackreference<
  TState extends State,
  TFullUnscanned extends string,
> =
  Scanner.ShiftUntilNot<TFullUnscanned, StringDigit> extends (
    Scanner.ShiftResult<infer TRef, infer TRemaining>
  )
    ? s.ShiftQuantifiable<TState, ReferenceNode<TRef>, TRemaining>
    : never;

type ParseNamedBackreference<TState extends State, TUnscanned extends string> =
  TUnscanned extends `<${infer TRef}>${infer TFollowing}`
    ? s.ShiftQuantifiable<TState, ReferenceNode<TRef>, TFollowing>
    : s.Error<MissingBackreferenceNameMessage>;

type ParseUnicodeProperty<
  TState extends State,
  TChar extends UnicodePropertyChar,
  TUnscanned extends string,
> =
  TUnscanned extends `{${string}}${infer TFollowing}`
    ? s.ShiftQuantifiable<TState, string, TFollowing>
    : s.Error<WriteInvalidUnicodePropertyMessage<TChar>>;

type ParseSingleEscapedCharacter<
  TState extends State,
  TChar extends string,
  TRemaining extends string,
> =
  ParseEscapedChar<TChar> extends infer TResult extends string
    ? TResult extends InternalErrorMessage
      ? s.Error<TResult>
      : s.ShiftQuantifiable<TState, TResult, TRemaining>
    : never;

export type ParseEscapedChar<TChar extends string> =
  TChar extends RegexClassChar ? string
    : TChar extends "d" ? `${number}`
      : TChar extends "s" ? WhitespaceChar
        : TChar extends BoundaryChar ? ""
          : TChar extends Control ? TChar
            : TChar extends "c" ? InternalErrorMessage<CaretNotationMessage>
              : TChar extends StringLiteralEscape
                ? InternalErrorMessage<WriteStringEscapableMessage<TChar>>
                : TChar extends UnsupportedRegexEscape
                  ? InternalErrorMessage<WriteUnsupportedEscapeMessage<TChar>>
                  : InternalErrorMessage<WriteUnnecessaryEscapeMessage<TChar>>;

export type WriteUnresolvableBackreferenceMessage<TRef extends string | number> =
  `Group ${TRef} does not exist`;

export type TrailingBackslashMessage = "A regex cannot end with \\";

export type MissingBackreferenceNameMessage =
  "\\k must be followed by a named reference like <name>";

export type WriteInvalidUnicodePropertyMessage<TChar extends UnicodePropertyChar> =
  `\\${TChar} must be followed by a property like \\${TChar}{Emoji_Presentation}`;

export type WriteUnnecessaryEscapeMessage<TChar extends string> =
  `Escape preceding ${TChar} is unnecessary and should be removed.`;

export type WriteStringEscapableMessage<TChar extends StringLiteralEscape> =
  `\\${TChar} is a JavaScript string escape. Use a single backslash: regex('\\${TChar}')`;

export type WriteUnsupportedEscapeMessage<TChar extends UnsupportedRegexEscape> =
  `\\${TChar} is valid regex syntax but is not supported by the type engine. The pattern will work at runtime but the output type will be string.`;

export type CaretNotationMessage =
  "\\cX notation is not supported. Use hex (\\x) or unicode (\\u) instead.";

export type StringLiteralEscape = "t" | "n" | "r" | "f" | "v";

export type UnsupportedRegexEscape = "0" | "x" | "u";

export type RegexClassChar = "w" | "W" | "D" | "S";

export type BoundaryChar = "b" | "B";

export type UnicodePropertyChar = "p" | "P";

export type NonZeroDigit = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";

export type StringDigit = "0" | NonZeroDigit;
