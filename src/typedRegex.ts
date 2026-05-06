import type {
  BaseIssue,
  BaseValidation,
  ErrorMessage,
} from "valibot";
import { _addIssue } from "valibot";
import type { InferRegexOutput, ValidateRegex } from "./type-engine/index.ts";

export interface TypedRegexIssue<TInput extends string> extends BaseIssue<TInput> {
  readonly kind: "validation";
  readonly type: "typed_regex";
  readonly expected: string;
  readonly received: string;
  readonly requirement: RegExp;
}

export interface TypedRegexAction<
  TInput extends string,
  TOutput extends string,
  TMessage extends ErrorMessage<TypedRegexIssue<TInput>> | undefined,
> extends BaseValidation<TInput, TOutput, TypedRegexIssue<TInput>> {
  readonly type: "typed_regex";
  readonly reference: typeof typedRegex;
  readonly expects: string;
  readonly requirement: RegExp;
  readonly message: TMessage;
}

export function typedRegex<
  TPattern extends string,
  TInput extends string = string,
>(
  pattern: ValidateRegex<TPattern>,
): TypedRegexAction<TInput, InferRegexOutput<TPattern>, undefined>;

export function typedRegex<
  TPattern extends string,
  TInput extends string = string,
  const TMessage extends ErrorMessage<TypedRegexIssue<TInput>> | undefined = undefined,
>(
  pattern: ValidateRegex<TPattern>,
  message: TMessage,
): TypedRegexAction<TInput, InferRegexOutput<TPattern>, TMessage>;

// @__NO_SIDE_EFFECTS__
export function typedRegex(
  pattern: string,
  message?: ErrorMessage<TypedRegexIssue<string>>,
): TypedRegexAction<string, string, ErrorMessage<TypedRegexIssue<string>> | undefined> {
  let requirement: RegExp;
  try {
    requirement = new RegExp(pattern);
  } catch (cause) {
    throw new SyntaxError(
      `typedRegex: invalid pattern ${JSON.stringify(pattern)}`,
      { cause },
    );
  }
  return {
    kind: "validation",
    type: "typed_regex",
    reference: typedRegex,
    async: false,
    expects: String(requirement),
    requirement,
    message,
    "~run"(dataset, config) {
      if (dataset.typed && !this.requirement.test(dataset.value)) {
        _addIssue(this, "format", dataset, config);
      }
      return dataset;
    },
  };
}
