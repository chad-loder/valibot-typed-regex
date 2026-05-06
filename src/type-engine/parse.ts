import type { Backslash, InternalErrorMessage, Scanner } from "./scanner.ts";
import type { ParseCharset } from "./charset.ts";
import type { ParseEscape } from "./escape.ts";
import type { ParseGroup } from "./group.ts";
import type { ParseBuiltinQuantifier, ParsePossibleRange, QuantifyingChar } from "./quantify.ts";
import type { Anchor, AnchorMarker, s, State, UnionTree } from "./state.ts";
import type { LessThanOrEqual, MAX_CASE_INSENSITIVE_RUN } from "./limits.ts";

export type ParseState<TState extends State> =
  TState["unscanned"] extends InternalErrorMessage ? TState["unscanned"]
    : TState["unscanned"] extends "" ? s.FinalizeState<TState>
      : ParseState<Next<TState>>;

type Next<TState extends State> =
  TState["unscanned"] extends Scanner.Shift<infer TLookahead, infer TUnscanned>
    ? TLookahead extends "." ? s.ShiftQuantifiable<TState, string, TUnscanned>
      : TLookahead extends Backslash ? ParseEscape<TState, TUnscanned>
        : TLookahead extends "|" ? s.FinalizeBranch<TState, TUnscanned>
          : TLookahead extends Anchor ? s.PushAnchor<TState, AnchorMarker<TLookahead>, TUnscanned>
            : TLookahead extends "(" ? ParseGroup<TState, TUnscanned>
              : TLookahead extends ")" ? s.PopGroup<TState, TUnscanned>
                : TLookahead extends QuantifyingChar ? ParseBuiltinQuantifier<TState, TLookahead, TUnscanned>
                  : TLookahead extends "{" ? ParsePossibleRange<TState, TUnscanned>
                    : TLookahead extends "[" ? ParseCharset<TState, TUnscanned>
                      : TState["caseInsensitive"] extends true
                        ? ShiftWithCasing<TState, TLookahead, TUnscanned>
                        : s.ShiftQuantifiable<TState, TLookahead, TUnscanned>
    : never;

type ShiftWithCasing<
  TState extends State,
  TChar extends string,
  TUnscanned extends string,
  TNextRun extends 1[] = [...TState["ciRun"], 1],
> =
  Lowercase<TChar> extends Uppercase<TChar>
    ? s.ShiftQuantifiable<TState, TChar, TUnscanned>
    : LessThanOrEqual<
      TNextRun["length"],
      MAX_CASE_INSENSITIVE_RUN
    > extends true
      ? s.ShiftQuantifiable<
        TState,
        UnionTree<[Lowercase<TChar>, Uppercase<TChar>]>,
        TUnscanned,
        TNextRun
      >
      : s.WidenSequence<TState, TUnscanned>;
