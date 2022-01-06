import type { Node } from "typescript";

export interface SourceDocument {
  query<TNode extends Node = Node>(queryStr: string): RootArraySelectionResult<TNode>;
  commit(): this;
  readonly touched: boolean;
  readonly dirty: boolean;
  readonly text: string;
}

export type MutationPayload = null | undefined | string | Node;

export interface NodeEditor<TNode extends Node = Node> {
  end(): SourceDocument;
  remove(): this;
  prepend(cb: (context: EditCallbackContext<TNode>) => MutationPayload): this;
  append(cb: (context: EditCallbackContext<TNode>) => MutationPayload): this;
  replace(cb: (context: EditCallbackContext<TNode>) => MutationPayload): this;
}

export interface BaseSelectionResult<TNode extends Node = Node> {
  forEach(cb: (context: BaseSelectionCallbackContext<TNode>) => void): this;
  readonly length: number;
}

export interface ArraySelectionResult<TNode extends Node = Node> extends BaseSelectionResult<TNode> {
  readonly node: TNode[];
  map<TResult>(cb: (context: BaseSelectionCallbackContext<TNode>) => TResult): TResult[];
  parent<SNode extends Node = Node>(): ArraySelectionResult<SNode>;
  filter(cb: (context: BaseSelectionCallbackContext<TNode>) => boolean): ArraySelectionResult<TNode>;
  readonly unique: SingleSelectionResult<TNode>;
  readonly first: SingleSelectionResult<TNode>;
  readonly last: SingleSelectionResult<TNode>;
}

export interface RootArraySelectionResult<TNode extends Node = Node>
  extends ArraySelectionResult<TNode>,
    NodeEditor<TNode> {
  parent<SNode extends Node = Node>(): ArraySelectionResult<SNode>;
  filter(cb: (context: BaseSelectionCallbackContext<TNode>) => boolean): RootArraySelectionResult<TNode>;
  readonly unique: RootSingleSelectionResult<TNode>;
  readonly first: RootSingleSelectionResult<TNode>;
  readonly last: RootSingleSelectionResult<TNode>;
}

export interface SingleSelectionResult<TNode extends Node = Node> extends BaseSelectionResult<TNode> {
  readonly node: TNode;
  map<TResult>(cb: (context: BaseSelectionCallbackContext<TNode>) => TResult): TResult;
  parent<SNode extends Node = Node>(): SingleSelectionResult<SNode>;
  filter(cb: (context: BaseSelectionCallbackContext<TNode>) => boolean): SingleSelectionResult<TNode>;
  readonly unique: SingleSelectionResult<TNode>;
  readonly first: SingleSelectionResult<TNode>;
  readonly last: SingleSelectionResult<TNode>;
}

export interface RootSingleSelectionResult<TNode extends Node = Node>
  extends SingleSelectionResult<TNode>,
    NodeEditor<TNode> {
  parent<SNode extends Node = Node>(): RootSingleSelectionResult<SNode>;
  filter(cb: (context: BaseSelectionCallbackContext<TNode>) => boolean): RootSingleSelectionResult<TNode>;
  readonly unique: RootSingleSelectionResult<TNode>;
  readonly first: RootSingleSelectionResult<TNode>;
  readonly last: RootSingleSelectionResult<TNode>;
}

export interface BaseSelectionCallbackContext<TNode extends Node = Node> {
  readonly node: TNode;
  readonly text: string;
  query<SNode extends Node = Node>(queryStr: string): ArraySelectionResult<SNode>;
}

export interface EditCallbackContext<TNode extends Node = Node> extends BaseSelectionCallbackContext<TNode> {}
