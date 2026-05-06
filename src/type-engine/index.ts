import type { InternalErrorMessage } from "./scanner.ts";
import type { ParseState } from "./parse.ts";
import type { RegexOutput, State } from "./state.ts";

export type ParseRegex<TPattern extends string> =
  ParseState<State.Initialize<TPattern, "">>;

export type ValidateRegex<TPattern extends string> =
  ParseRegex<TPattern> extends infer TError extends InternalErrorMessage
    ? TError
    : TPattern;

export type InferRegexOutput<TPattern extends string> =
  ParseRegex<TPattern> extends RegexOutput<infer TInferred>
    ? TInferred
    : string;

export type InferRegexGroups<TPattern extends string> =
  ParseRegex<TPattern> extends RegexOutput<string, infer TCtx>
    ? TCtx extends { names: infer TNames }
      ? TNames
      : Record<string, never>
    : Record<string, never>;
