import type { Node, SourceFile } from "typescript";

export interface SourceDocument {
  select<TNode extends Node = Node>(queryStr: string): RootArraySelectionResult<TNode>;
  commit(): SourceDocument;
  readonly text: string;
}

export type ReplacementResult = null | undefined | string | Node;

export interface BaseSelectionResult<TNode extends Node = Node> {
  forEach(cb: (context: BaseSelectionCallbackContext<TNode>) => void): this;
  readonly length: number;
}

export interface ArraySelectionResult<TNode extends Node = Node> extends BaseSelectionResult<TNode> {
  map<TResult>(cb: (context: BaseSelectionCallbackContext<TNode>) => TResult): TResult[];
  parent<SNode extends Node = Node>(): ArraySelectionResult<SNode>;
  filter(cb: (context: BaseSelectionCallbackContext<TNode>) => boolean): ArraySelectionResult<TNode>;
  readonly unique: SingleSelectionResult<TNode>;
  readonly first: SingleSelectionResult<TNode>;
  readonly last: SingleSelectionResult<TNode>;
}

export interface Replacable<TNode extends Node = Node> {
  end(): SourceDocument;
  replace(cb: (context: ReplacementCallbackContext<TNode>) => ReplacementResult): this;
}

export interface RootArraySelectionResult<TNode extends Node = Node>
  extends ArraySelectionResult<TNode>,
    Replacable<TNode> {
  parent<SNode extends Node = Node>(): ArraySelectionResult<SNode>;
  filter(cb: (context: BaseSelectionCallbackContext<TNode>) => boolean): RootArraySelectionResult<TNode>;
  readonly unique: RootSingleSelectionResult<TNode>;
  readonly first: RootSingleSelectionResult<TNode>;
  readonly last: RootSingleSelectionResult<TNode>;
}

export interface SingleSelectionResult<TNode extends Node = Node> extends BaseSelectionResult<TNode> {
  parent<SNode extends Node = Node>(): SingleSelectionResult<SNode>;
  map<TResult>(cb: (context: BaseSelectionCallbackContext<TNode>) => TResult): TResult;
  filter(cb: (context: BaseSelectionCallbackContext<TNode>) => boolean): SingleSelectionResult<TNode>;
  readonly unique: SingleSelectionResult<TNode>;
  readonly first: SingleSelectionResult<TNode>;
  readonly last: SingleSelectionResult<TNode>;
}

export interface RootSingleSelectionResult<TNode extends Node = Node>
  extends SingleSelectionResult<TNode>,
    Replacable<TNode> {
  parent<SNode extends Node = Node>(): RootSingleSelectionResult<SNode>;
  filter(cb: (context: BaseSelectionCallbackContext<TNode>) => boolean): RootSingleSelectionResult<TNode>;
  readonly unique: RootSingleSelectionResult<TNode>;
  readonly first: RootSingleSelectionResult<TNode>;
  readonly last: RootSingleSelectionResult<TNode>;
}

export interface BaseSelectionCallbackContext<TNode extends Node = Node> {
  readonly node: TNode;
  readonly text: string;
}

export interface ReplacementCallbackContext<TNode extends Node = Node> extends BaseSelectionCallbackContext<TNode> {}
