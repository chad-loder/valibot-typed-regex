import type {
  Contains,
  InternalErrorMessage,
  NoSuggest,
  NumberLiteral,
  SetIndex,
  UnionKeyOf,
  WriteUnclosedGroupMessage,
  WriteUnmatchedGroupCloseMessage,
  ZeroWidthSpace,
} from "./scanner.ts";
import type { WriteUnresolvableBackreferenceMessage } from "./escape.ts";
import type { Quantify, QuantifyingChar } from "./quantify.ts";

// ── Flags & context ──────────────────────────────────────────────────

export type IndexedCaptures = Array<string | undefined>;
export type NamedCaptures = Record<string, string | undefined>;

export type UnicodeFlag = "v" | "u";
export type Flags =
  `${"d" | ""}${"g" | ""}${"i" | ""}${"m" | ""}${"s" | ""}${UnicodeFlag | ""}${"y" | ""}`;

export type RegexContext = {
  flags?: Flags;
  captures?: IndexedCaptures;
  names?: NamedCaptures;
};

// ── AST node types ───────────────────────────────────────────────────

export type RegexAst =
  | string
  | ReferenceNode
  | UnionTree
  | SequenceTree
  | GroupTree
  | QuantifierTree;

export interface ReferenceNode<TTo extends string = string> {
  kind: "reference";
  to: TTo;
}

export interface SequenceTree<TAst extends RegexAst[] = RegexAst[]> {
  kind: "sequence";
  ast: TAst;
}

export interface UnionTree<TAst extends RegexAst[] = RegexAst[]> {
  kind: "union";
  ast: TAst;
}

export type CapturedGroupKind = string | State.UnnamedCaptureKind.indexed;

export type IncompleteCaptureGroup = NoSuggest<"incompleteCaptureGroup">;

export type IndexedCaptureOffset = NoSuggest<"indexedCaptureOffset">;

export type EmptyCaptures = [IndexedCaptureOffset];

export interface GroupTree<
  TAst extends RegexAst = RegexAst,
  TCapture extends CapturedGroupKind = CapturedGroupKind,
> {
  kind: "group";
  capture: TCapture;
  ast: TAst;
}

export interface QuantifierTree<TAst extends RegexAst = RegexAst> {
  kind: "quantifier";
  ast: TAst;
  min: number;
  max: number | null;
}

// ── Anchors ──────────────────────────────────────────────────────────

export type Boundary = Anchor | "(" | ")" | "[" | "]";
export type Anchor = "^" | "$";
export type Control = QuantifyingChar | Boundary | "|" | "." | "{" | "-" | "\\";

export type AnchorMarker<TInner extends Anchor = Anchor> =
  `<${ZeroWidthSpace}${TInner}${ZeroWidthSpace}>`;

export type StartAnchorMarker = AnchorMarker<"^">;
export type EndAnchorMarker = AnchorMarker<"$">;

// ── State interface ──────────────────────────────────────────────────

export interface State extends State.Group {
  unscanned: string;
  groups: State.Group[];
  flags: Flags;
}

export declare namespace State {
  export type From<TState extends State> = TState;

  export type Initialize<TSource extends string, TFlags extends Flags> = From<{
    unscanned: TSource;
    groups: [];
    capture: never;
    branches: [];
    sequence: SequenceTree<[]>;
    root: "";
    caseInsensitive: Contains<TFlags, "i">;
    ciRun: [];
    flags: TFlags;
  }>;

  enum UnnamedCaptureKind {
    indexed,
    lookaround,
    noncapturing,
  }

  export type CaptureKind = string | UnnamedCaptureKind;

  export type Group = {
    capture: CaptureKind;
    branches: RegexAst[];
    sequence: RegexAst;
    root: RegexAst;
    caseInsensitive: boolean;
    ciRun: 1[];
  };

  export namespace Group {
    export type From<TGroup extends Group> = TGroup;

    type Pop<TInit extends Group, TLast extends Group[]> = [...TLast, TInit];

    export type Finalize<TGroup extends Group> =
      TGroup["branches"] extends []
        ? PushQuantifiable<TGroup["sequence"], TGroup["root"]>
        : [...TGroup["branches"], PushQuantifiable<TGroup["sequence"], TGroup["root"]>] extends (
          infer TBranches extends RegexAst[]
        )
          ? FinalizeUnion<TBranches, []>
          : never;

    type FinalizeUnion<
      TRemaining extends RegexAst[],
      TFlattened extends RegexAst[],
    > =
      TRemaining extends [infer THead extends RegexAst, ...infer TTail extends RegexAst[]]
        ? THead extends UnionTree<infer THeadBranches>
          ? FinalizeUnion<TTail, [...TFlattened, ...THeadBranches]>
          : FinalizeUnion<TTail, [...TFlattened, THead]>
        : UnionTree<TFlattened>;
  }
}

// ── State transitions (namespace s) ──────────────────────────────────

export declare namespace s {
  export type Error<TMessage extends string> = State.From<{
    unscanned: InternalErrorMessage<TMessage>;
    groups: [];
    capture: never;
    branches: [];
    sequence: SequenceTree<[]>;
    root: "";
    caseInsensitive: false;
    ciRun: [];
    flags: "";
  }>;

  export type ShiftQuantifiable<
    TState extends State,
    TRoot extends RegexAst,
    TUnscanned extends string,
    TCiRun extends 1[] = [],
  > = State.From<{
    unscanned: TUnscanned;
    groups: TState["groups"];
    capture: TState["capture"];
    branches: TState["branches"];
    sequence: PushQuantifiable<TState["sequence"], TState["root"]>;
    root: TRoot;
    caseInsensitive: TState["caseInsensitive"];
    ciRun: TCiRun;
    flags: TState["flags"];
  }>;

  export type WidenSequence<
    TState extends State,
    TUnscanned extends string,
  > = State.From<{
    unscanned: TUnscanned;
    groups: TState["groups"];
    capture: TState["capture"];
    branches: TState["branches"];
    sequence: SequenceTree<[]>;
    root: string;
    caseInsensitive: TState["caseInsensitive"];
    ciRun: [];
    flags: TState["flags"];
  }>;

  export type PushQuantified<
    TState extends State,
    TQuantified extends RegexAst,
    TUnscanned extends string,
  > = State.From<{
    unscanned: TUnscanned;
    groups: TState["groups"];
    capture: TState["capture"];
    branches: TState["branches"];
    sequence: PushQuantifiable<TState["sequence"], TQuantified>;
    root: "";
    caseInsensitive: TState["caseInsensitive"];
    ciRun: [];
    flags: TState["flags"];
  }>;

  export type PushQuantifier<
    TState extends State,
    TMin extends number,
    TMax extends number | null,
    TUnscanned extends string,
  > = State.From<{
    unscanned: TUnscanned;
    groups: TState["groups"];
    capture: TState["capture"];
    branches: TState["branches"];
    sequence: PushQuantifiable<
      TState["sequence"],
      { kind: "quantifier"; ast: TState["root"]; min: TMin; max: TMax }
    >;
    root: "";
    caseInsensitive: TState["caseInsensitive"];
    ciRun: [];
    flags: TState["flags"];
  }>;

  export type FinalizeBranch<
    TState extends State,
    TUnscanned extends string,
  > = State.From<{
    unscanned: TUnscanned;
    groups: TState["groups"];
    capture: TState["capture"];
    branches: [...TState["branches"], PushQuantifiable<TState["sequence"], TState["root"]>];
    sequence: SequenceTree<[]>;
    root: "";
    caseInsensitive: TState["caseInsensitive"];
    ciRun: [];
    flags: TState["flags"];
  }>;

  export type PushAnchor<
    TState extends State,
    TAnchor extends AnchorMarker,
    TUnscanned extends string,
  > = State.From<{
    unscanned: TUnscanned;
    groups: TState["groups"];
    capture: TState["capture"];
    branches: TState["branches"];
    sequence: PushQuantifiable<TState["sequence"], PushQuantifiable<TState["root"], TAnchor>>;
    root: "";
    caseInsensitive: TState["caseInsensitive"];
    ciRun: [];
    flags: TState["flags"];
  }>;

  export type PushGroup<
    TState extends State,
    TCapture extends string | State.UnnamedCaptureKind,
    TUnscanned extends string,
    TCaseInsensitive extends boolean | undefined,
  > = State.From<{
    unscanned: TUnscanned;
    groups: [...TState["groups"], TState];
    capture: TCapture;
    branches: [];
    sequence: SequenceTree<[]>;
    root: "";
    caseInsensitive: TCaseInsensitive extends boolean ? TCaseInsensitive
      : TState["caseInsensitive"];
    ciRun: [];
    flags: TState["flags"];
  }>;

  export type PopGroup<TState extends State, TUnscanned extends string> =
    TState["groups"] extends State.Group.Pop<infer TLast, infer TInit>
      ? State.From<{
        unscanned: TUnscanned;
        groups: TInit;
        capture: TLast["capture"];
        branches: TLast["branches"];
        sequence: PushQuantifiable<TLast["sequence"], TLast["root"]>;
        root: TState["capture"] extends CapturedGroupKind
          ? GroupTree<State.Group.Finalize<TState>, TState["capture"]>
          : TState["capture"] extends State.UnnamedCaptureKind.lookaround ? ""
            : State.Group.Finalize<TState>;
        caseInsensitive: TLast["caseInsensitive"];
        ciRun: TLast["ciRun"];
        flags: TState["flags"];
      }>
      : s.Error<WriteUnmatchedGroupCloseMessage<")", TUnscanned>>;

  export type FinalizeState<TState extends State> =
    TState["groups"] extends [unknown, ...unknown[]]
      ? InternalErrorMessage<WriteUnclosedGroupMessage<")">>
      : FinalizeRegexOrError<
        FinalizeTree<
          State.Group.Finalize<TState>,
          {
            captures: EmptyCaptures;
            names: {};
            flags: TState["flags"];
            errors: [];
          }
        >
      >;

  type FinalizeRegexOrError<TResult extends FinalizationResult> =
    TResult["ctx"]["errors"] extends []
      ? ApplyAnchors<TResult["pattern"]> extends infer TPattern extends string
        ? Contains<TPattern, StartAnchorMarker> extends false
          ? Contains<TPattern, EndAnchorMarker> extends false
            ? RegexOutput<TPattern, FinalizeContext<TResult["ctx"]>>
            : InternalErrorMessage<WriteMidAnchorError<"$">>
          : InternalErrorMessage<WriteMidAnchorError<"^">>
        : never
      : TResult["ctx"]["errors"][0];

  type FinalizeContext<TCtx extends FinalizationContext> =
    TCtx["captures"] extends EmptyCaptures ? FinalizeContextWithoutCaptures<TCtx>
      : FinalizeContextWithCaptures<{
        captures: TCtx["captures"] extends [IndexedCaptureOffset, ...infer TRest extends IndexedCaptures]
          ? TRest
          : never;
        names: TCtx["names"];
        flags: TCtx["flags"];
        errors: TCtx["errors"];
      }>;

  type FinalizeContextWithoutCaptures<TCtx extends FinalizationContext> =
    TCtx["flags"] extends "" ? {}
      : { flags: TCtx["flags"] };

  type FinalizeContextWithCaptures<TCtx extends FinalizationContext> =
    keyof TCtx["names"] extends never
      ? TCtx["flags"] extends ""
        ? { captures: TCtx["captures"] }
        : { captures: TCtx["captures"]; flags: TCtx["flags"] }
      : TCtx["flags"] extends ""
        ? { captures: TCtx["captures"]; names: TCtx["names"] }
        : { captures: TCtx["captures"]; names: TCtx["names"]; flags: TCtx["flags"] };
}

// ── Regex output ─────────────────────────────────────────────────────

export interface RegexOutput<
  TPattern extends string = string,
  TCtx extends RegexContext = RegexContext,
> {
  pattern: TPattern;
  ctx: TCtx;
}

// ── Finalization ─────────────────────────────────────────────────────

export interface FinalizationContext extends Required<RegexContext> {
  errors: InternalErrorMessage[];
}

export declare namespace FinalizationContext {
  export type From<TCtx extends FinalizationContext> = TCtx;
}

export type FinalizationResult = {
  pattern: string;
  ctx: FinalizationContext;
};

export declare namespace FinalizationResult {
  export type From<TResult extends FinalizationResult> = TResult;

  export type ResultError<
    TCtx extends FinalizationContext,
    TMessage extends string,
  > = From<{
    pattern: string;
    ctx: {
      captures: TCtx["captures"];
      names: TCtx["names"];
      flags: TCtx["flags"];
      errors: [...TCtx["errors"], InternalErrorMessage<TMessage>];
    };
  }>;
}

// ── Tree finalization (dispatch) ─────────────────────────────────────

export type FinalizeTree<TTree, TCtx extends FinalizationContext> =
  TTree extends string
    ? FinalizationResult.From<{ pattern: TTree; ctx: TCtx }>
    : TTree extends SequenceTree ? SequenceTreeFinalize<TTree, TCtx>
      : TTree extends UnionTree ? UnionTreeFinalize<TTree, TCtx>
        : TTree extends GroupTree ? GroupTreeFinalize<TTree, TCtx>
          : TTree extends QuantifierTree ? QuantifierTreeFinalize<TTree, TCtx>
            : TTree extends ReferenceNode ? ReferenceNodeFinalize<TTree, TCtx>
              : never;

// ── Reference node finalization ──────────────────────────────────────

type ReferenceNodeFinalize<
  TSelf extends ReferenceNode,
  TCtx extends FinalizationContext,
  TTo extends string = TSelf["to"],
> =
  TTo extends NumberLiteral & keyof TCtx["captures"]
    ? TCtx["captures"][TTo] extends IncompleteCaptureGroup
      ? FinalizationResult.ResultError<TCtx, WriteIncompleteReferenceError<TTo>>
      : FinalizationResult.From<{
        pattern: InferReference<TCtx["captures"][TTo]>;
        ctx: TCtx;
      }>
    : TTo extends keyof TCtx["names"]
      ? TCtx["names"][TTo] extends IncompleteCaptureGroup
        ? FinalizationResult.ResultError<TCtx, WriteIncompleteReferenceError<TTo>>
        : FinalizationResult.From<{
          pattern: InferReference<TCtx["names"][TTo]>;
          ctx: TCtx;
        }>
      : FinalizationResult.ResultError<TCtx, WriteUnresolvableBackreferenceMessage<TTo>>;

type InferReference<TTo extends string | undefined> =
  TTo extends string ? TTo : "";

export type WriteIncompleteReferenceError<TRef extends string> =
  `Reference to incomplete group '${TRef}' has no effect`;

// ── Sequence tree finalization ───────────────────────────────────────

type SequenceTreeFinalize<
  TSelf extends SequenceTree,
  TCtx extends FinalizationContext,
> = SequenceTreeLoop<TSelf["ast"], "", TCtx>;

type SequenceTreeLoop<
  TTree extends unknown[],
  TPattern extends string,
  TCtx extends FinalizationContext,
> =
  TTree extends [infer THead, ...infer TTail]
    ? FinalizeTree<THead, TCtx> extends infer TResult
      ? TResult extends FinalizationResult
        ? SequenceTreeLoop<TTail, AppendNonRedundant<TPattern, TResult["pattern"]>, TResult["ctx"]>
        : never
      : never
    : FinalizationResult.From<{ pattern: TPattern; ctx: TCtx }>;

// ── Union tree finalization ──────────────────────────────────────────

type FinalizedBranch = {
  pattern: string;
  captures: IndexedCaptures;
  names: NamedCaptures;
};

type UnionTreeFinalize<
  TSelf extends UnionTree,
  TCtx extends FinalizationContext,
> = UnionTreeLoop<TSelf["ast"], [], TCtx>;

type UnionTreeLoop<
  TAstBranches extends unknown[],
  TAcc extends FinalizedBranch[],
  TCtx extends FinalizationContext,
> =
  TAstBranches extends [infer THead, ...infer TTail]
    ? FinalizeTree<THead, TCtx> extends infer TResult
      ? TResult extends FinalizationResult
        ? UnionTreeLoop<TTail, UnionFinalizeBranch<TAcc, TCtx, TResult>, TCtx>
        : never
      : never
    : UnionFinalizeBranches<keyof TAcc, TAcc, TCtx>;

type UnionFinalizeBranch<
  TAcc extends FinalizedBranch[],
  TCtx extends FinalizationContext,
  TResult extends FinalizationResult,
> = [
  ...TAcc,
  {
    pattern: TResult["pattern"];
    captures: UnionFinalizeBranchCaptures<TAcc, TCtx, TResult>;
    names: TResult["ctx"]["names"];
  },
];

type UnionFinalizeBranchCaptures<
  TAcc extends FinalizedBranch[],
  TCtx extends FinalizationContext,
  TResult extends FinalizationResult,
  TBranchCaptures extends IndexedCaptures = ExtractNewCaptures<TCtx["captures"], TResult["ctx"]["captures"]>,
> =
  TAcc extends [] ? TBranchCaptures
    : TAcc[0]["captures"] extends infer TFirstCaptureBranch extends IndexedCaptures
      ? TBranchCaptures extends []
        ? { [TIdx in keyof TFirstCaptureBranch]: undefined }
        : [...{ [TIdx in keyof TFirstCaptureBranch]: undefined }, ...TBranchCaptures]
      : never;

type UnionFinalizeBranches<
  TIdx,
  TAcc extends FinalizedBranch[],
  TCtx extends FinalizationContext,
> =
  TIdx extends keyof TAcc & NumberLiteral
    ? FinalizationResult.From<{
      pattern: TAcc[TIdx]["pattern"];
      ctx: {
        flags: TCtx["flags"];
        captures: [...TCtx["captures"], ...TAcc[TIdx]["captures"]];
        names: {
          [TKey in UnionKeyOf<TAcc[number]["names"]>]: TKey extends keyof TAcc[TIdx]["names"]
            ? TAcc[TIdx]["names"][TKey]
            : undefined;
        };
        errors: TCtx["errors"];
      };
    }>
    : never;

// ── Group tree finalization ──────────────────────────────────────────

type GroupTreeFinalize<
  TSelf extends GroupTree,
  TCtx extends FinalizationContext,
> =
  GroupTreeFinalizeAst<TSelf, TCtx> extends infer TResult
    ? TResult extends FinalizationResult
      ? GroupTreeFinalizeResult<TSelf, TCtx, TResult>
      : never
    : never;

type GroupTreeFinalizeAst<
  TSelf extends GroupTree,
  TCtx extends FinalizationContext,
> = FinalizeTree<
  TSelf["ast"],
  TSelf["capture"] extends string
    ? {
      captures: [...TCtx["captures"], IncompleteCaptureGroup];
      names: TCtx["names"] & { [_ in TSelf["capture"]]: IncompleteCaptureGroup };
      flags: TCtx["flags"];
      errors: TCtx["errors"];
    }
    : TSelf["capture"] extends State.UnnamedCaptureKind.indexed
      ? {
        captures: [...TCtx["captures"], IncompleteCaptureGroup];
        names: TCtx["names"];
        flags: TCtx["flags"];
        errors: TCtx["errors"];
      }
      : TCtx
>;

type GroupTreeFinalizeResult<
  TSelf extends GroupTree,
  TCtx extends FinalizationContext,
  TResult extends FinalizationResult,
> = FinalizationResult.From<{
  pattern: TResult["pattern"];
  ctx: TSelf["capture"] extends string
    ? FinalizeNamedCapture<TSelf["capture"], TCtx["captures"]["length"], TResult["pattern"], TResult["ctx"]>
    : TSelf["capture"] extends State.UnnamedCaptureKind.indexed
      ? FinalizeUnnamedCapture<TCtx["captures"]["length"], TResult["pattern"], TResult["ctx"]>
      : TResult["ctx"];
}>;

type FinalizeNamedCapture<
  TName extends string,
  TIndex extends number,
  TPattern extends string,
  TCtx extends FinalizationContext,
> = FinalizationContext.From<{
  captures: SetIndex<TCtx["captures"], TIndex, AnchorsAway<TPattern>>;
  names: {
    [TKey in keyof TCtx["names"]]: TKey extends TName ? AnchorsAway<TPattern>
      : TCtx["names"][TKey];
  };
  flags: TCtx["flags"];
  errors: TCtx["errors"];
}>;

type FinalizeUnnamedCapture<
  TIndex extends number,
  TPattern extends string,
  TCtx extends FinalizationContext,
> = FinalizationContext.From<{
  captures: SetIndex<TCtx["captures"], TIndex, AnchorsAway<TPattern>>;
  names: TCtx["names"];
  flags: TCtx["flags"];
  errors: TCtx["errors"];
}>;

// ── Quantifier tree finalization ─────────────────────────────────────

type QuantifierTreeFinalize<
  TSelf extends QuantifierTree,
  TCtx extends FinalizationContext,
> =
  FinalizeTree<TSelf["ast"], TCtx> extends infer TResult extends FinalizationResult
    ? QuantifierTreeFinalizeResult<TSelf, TCtx, TResult>
    : never;

type QuantifierTreeFinalizeResult<
  TSelf extends QuantifierTree,
  TCtx extends FinalizationContext,
  TResult extends FinalizationResult,
  TQuantifiedCaptures extends IndexedCaptures = ExtractNewCaptures<TCtx["captures"], TResult["ctx"]["captures"]>,
> =
  TSelf["min"] extends 0
    ? TQuantifiedCaptures extends []
      ? FinalizeNonZeroMinQuantified<TSelf, TResult>
      : FinalizeZeroMinQuantifiedWithCaptures<TSelf, TCtx, TResult, TQuantifiedCaptures>
    : FinalizeNonZeroMinQuantified<TSelf, TResult>;

type FinalizeNonZeroMinQuantified<
  TSelf extends QuantifierTree,
  TResult extends FinalizationResult,
> = FinalizationResult.From<{
  pattern: Quantify<TResult["pattern"], TSelf["min"], TSelf["max"]>;
  ctx: TResult["ctx"];
}>;

type FinalizeZeroMinQuantifiedWithCaptures<
  TSelf extends QuantifierTree,
  TCtx extends FinalizationContext,
  TResult extends FinalizationResult,
  TQuantifiedCaptures extends IndexedCaptures,
> =
  | FinalizeZeroQuantified<TCtx, TResult, TQuantifiedCaptures>
  | FinalizeOnePlusQuantified<TSelf["max"], TResult>;

type FinalizeZeroQuantified<
  TCtx extends FinalizationContext,
  TResult extends FinalizationResult,
  TQuantifiedCaptures extends IndexedCaptures,
> = FinalizationResult.From<{
  pattern: "";
  ctx: {
    captures: [...TCtx["captures"], ...{ [TIdx in keyof TQuantifiedCaptures]: undefined }];
    flags: TResult["ctx"]["flags"];
    names: ZeroQuantifiedNames<TCtx["names"], TResult["ctx"]["names"]>;
    errors: TResult["ctx"]["errors"];
  };
}>;

type ZeroQuantifiedNames<
  TBase extends NamedCaptures,
  TResult extends NamedCaptures,
> = {
  [TKey in keyof TResult]: TKey extends keyof TBase ? TResult[TKey] : undefined;
} & unknown;

type FinalizeOnePlusQuantified<
  TMax extends number | null,
  TResult extends FinalizationResult,
> =
  TMax extends 1 ? TResult
    : FinalizationResult.From<{
      pattern: Quantify<TResult["pattern"], 1, TMax>;
      ctx: TResult["ctx"];
    }>;

// ── Shared helpers ───────────────────────────────────────────────────

export type PushQuantifiable<TSequence extends RegexAst, TRoot extends RegexAst> =
  TRoot extends "" ? TSequence
    : TSequence extends string
      ? TSequence extends "" ? TRoot
        : TRoot extends string ? AppendNonRedundant<TSequence, TRoot>
          : SequenceTree<[TSequence, TRoot]>
      : TSequence extends SequenceTree ? PushToSequence<TSequence, TRoot>
        : SequenceTree<[TSequence, TRoot]>;

type PushToSequence<TSequence extends SequenceTree, TRoot extends RegexAst> =
  TSequence extends SequenceTree<[]> ? TRoot
    : TRoot extends SequenceTree
      ? SequenceTree<[...TSequence["ast"], ...TRoot["ast"]]>
      : SequenceTree<[...TSequence["ast"], TRoot]>;

type ExtractNewCaptures<
  TBase extends IndexedCaptures,
  TResult extends IndexedCaptures,
> =
  TResult extends readonly [...TBase, ...infer TElements extends IndexedCaptures]
    ? TElements
    : [];

type ApplyAnchors<TPattern extends string> =
  TPattern extends `${StartAnchorMarker}${infer TStartStripped}`
    ? TStartStripped extends `${infer TBothStripped}${EndAnchorMarker}`
      ? TBothStripped
      : AppendNonRedundant<TStartStripped, string>
    : TPattern extends `${infer TEndStripped}${EndAnchorMarker}`
      ? PrependNonRedundant<TEndStripped, string>
      : PrependNonRedundant<AppendNonRedundant<TPattern, string>, string>;

type AnchorsAway<TPattern extends string> =
  TPattern extends `${StartAnchorMarker}${infer TStartStripped}`
    ? TStartStripped extends `${infer TBothStripped}${EndAnchorMarker}`
      ? TBothStripped
      : TStartStripped
    : TPattern extends `${infer TEndStripped}${EndAnchorMarker}` ? TEndStripped
      : TPattern;

type AppendNonRedundant<TBase extends string, TSuffix extends string> =
  string extends TBase
    ? string extends TSuffix ? string
      : `${TBase}${TSuffix}`
    : `${number}` extends TBase
      ? `${number}` extends TSuffix ? `${number}`
        : `${TBase}${TSuffix}`
      : `${TBase}${TSuffix}`;

type PrependNonRedundant<TBase extends string, TPrefix extends string> =
  string extends TBase
    ? string extends TPrefix ? string
      : `${TPrefix}${TBase}`
    : `${number}` extends TBase
      ? `${number}` extends TPrefix ? `${number}`
        : `${TPrefix}${TBase}`
      : `${TPrefix}${TBase}`;

export type WriteMidAnchorError<TAnchor extends Anchor> =
  `Anchor ${TAnchor} may not appear mid-pattern`;
