import type { InternalErrorMessage, Scanner, WriteUnclosedGroupMessage } from "./scanner.ts";
import type { State, s } from "./state.ts";

type LookaroundChar = "=" | "!";

export type ModifiableFlag = "i" | "m" | "s";

export type ParseGroup<TState extends State, TUnscanned extends string> =
  TUnscanned extends Scanner.Shift<infer TLookahead, infer TNext>
    ? TLookahead extends "?"
      ? ParseNonCapturingGroup<TState, TNext>
      : s.PushGroup<TState, State.UnnamedCaptureKind.indexed, TUnscanned, undefined>
    : s.Error<WriteUnclosedGroupMessage<")">>;

type ParseNonCapturingGroup<TState extends State, TUnscanned extends string> =
  TUnscanned extends Scanner.Shift<infer TLookahead, infer TNext>
    ? TLookahead extends ":"
      ? s.PushGroup<TState, State.UnnamedCaptureKind.noncapturing, TNext, undefined>
      : TLookahead extends LookaroundChar
        ? s.PushGroup<TState, State.UnnamedCaptureKind.lookaround, TNext, undefined>
        : TLookahead extends "<" ? ParseNamedGroupOrLookbehind<TState, TNext>
          : ShiftModifiers<TUnscanned> extends (
            ShiftedModifiers<infer TFlags, infer TNegated, infer TFollowing>
          )
            ? TFollowing extends InternalErrorMessage<infer TMessage>
              ? s.Error<TMessage>
              : s.PushGroup<
                TState,
                State.UnnamedCaptureKind.noncapturing,
                TFollowing,
                "i" extends TFlags ? true
                  : "i" extends TNegated ? false
                    : undefined
              >
            : never
    : s.Error<WriteUnclosedGroupMessage<")">>;

type ShiftedModifiers<
  TFlags extends ModifiableFlag = ModifiableFlag,
  TNegated extends ModifiableFlag = ModifiableFlag,
  TUnscanned extends string = string,
> = [ParsedModifiers<TFlags, TNegated>, TUnscanned];

type ParsedModifiers<
  TFlags extends ModifiableFlag = ModifiableFlag,
  TNegated extends ModifiableFlag = ModifiableFlag,
> = {
  flags: TFlags;
  negated: TNegated;
};

type ShiftModifiers<TUnscanned extends string> =
  Scanner.ShiftUntil<TUnscanned, ":" | ")"> extends (
    Scanner.ShiftResult<infer TScanned, infer TNext>
  )
    ? TNext extends Scanner.Shift<infer TTerminator, infer TFollowing>
      ? TTerminator extends ":"
        ? _ParseModifiers<TScanned, never, never> extends (
          ParsedModifiers<infer TFlags, infer TNegated>
        )
          ? ShiftedModifiers<TFlags, TNegated, TFollowing>
          : ShiftedModifiers<
            never,
            never,
            InternalErrorMessage<_ParseModifiers<TScanned, never, never> & string>
          >
        : ShiftedModifiers<
          never,
          never,
          InternalErrorMessage<UnescapedLiteralQuestionMarkMessage>
        >
      : ShiftedModifiers<
        never,
        never,
        InternalErrorMessage<WriteUnclosedGroupMessage<")">>
      >
    : never;

type _ParseModifiers<
  TUnscanned extends string,
  TFlags extends ModifiableFlag,
  TNegated extends ModifiableFlag,
> =
  TUnscanned extends Scanner.Shift<infer TLookahead, infer TNext>
    ? TLookahead extends "-"
      ? [TNegated] extends [never]
        ? TNext extends Scanner.Shift<infer TModifier, infer TNextNext>
          ? TModifier extends ModifiableFlag
            ? TModifier extends TFlags | TNegated
              ? WriteDuplicateModifierMessage<TModifier>
              : _ParseModifiers<TNextNext, TFlags, TNegated | TModifier>
            : WriteInvalidModifierMessage<TModifier>
          : MissingNegatedModifierMessage
        : MultipleModifierDashesMessage
      : TLookahead extends ModifiableFlag
        ? TLookahead extends TFlags | TNegated
          ? WriteDuplicateModifierMessage<TLookahead>
          : [TNegated] extends [never]
            ? _ParseModifiers<TNext, TFlags | TLookahead, TNegated>
            : _ParseModifiers<TNext, TFlags, TNegated | TLookahead>
        : WriteInvalidModifierMessage<TLookahead>
    : ParsedModifiers<TFlags, TNegated>;

// Disambiguates (?<name>...) from (?<=...) / (?<!...) by checking if the
// next char is = or !. This works because group names must be valid JS
// identifiers, which cannot start with = or !. If name-validation logic
// is added later, it must preserve this invariant.
type ParseNamedGroupOrLookbehind<TState extends State, TUnscanned extends string> =
  TUnscanned extends Scanner.Shift<LookaroundChar, infer TNext>
    ? s.PushGroup<TState, State.UnnamedCaptureKind.lookaround, TNext, undefined>
    : ShiftNamedGroup<TUnscanned> extends (
      Scanner.ShiftResult<infer TName, infer TFollowing>
    )
      ? s.PushGroup<TState, TName, TFollowing, undefined>
      : s.Error<WriteUnclosedGroupMessage<")">>;

type ShiftNamedGroup<TUnscanned extends string> =
  TUnscanned extends `${infer TName}>${infer TNext}`
    ? TName extends ""
      ? Scanner.ShiftResult<"", InternalErrorMessage<UnnamedCaptureGroupMessage>>
      : Scanner.ShiftResult<TName, TNext>
    : Scanner.ShiftResult<"", InternalErrorMessage<WriteUnclosedGroupMessage<">">>>;

export type WriteDuplicateModifierMessage<TModifier extends ModifiableFlag> =
  `Modifier ${TModifier} cannot appear multiple times in a single group`;

export type MultipleModifierDashesMessage =
  "Modifiers can include at most one '-' to negate subsequent flags";

export type MissingNegatedModifierMessage =
  "- must be followed by the modifier flag to negate ('i', 'm' or 's')";

export type WriteInvalidModifierMessage<TChar extends string> =
  `Modifier flag ${TChar} must be 'i', 'm' or 's'`;

export type UnnamedCaptureGroupMessage = "Capture group <> requires a name";

export type UnescapedLiteralQuestionMarkMessage =
  "literal ? must be escaped at the start of a group";
