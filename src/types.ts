import type { Node, SourceFile } from "typescript";

export interface SourceDocument {
  query<TNode extends Node = Node>(queryStr: string): ArrayQueryResultWrapper<TNode>;
}

// type ArrayResultHolder<TNode extends Node = Node> = {
//   type: "list";
//   payload: TNode[];
// };
//
// type SingleResultHolder<TNode extends Node = Node> = {
//   type: "single";
//   payload: TNode;
// };
//
// type ResultHolder<TNode extends Node = Node> = ArrayResultHolder<TNode> | SingleResultHolder<TNode>;

export interface BaseQueryResultWrapper<TNode extends Node = Node> {
  forEach(cb: (context: QueryForEachContext<TNode>) => void): this;
  replace(cb: (context: QueryReplacementContext<TNode>) => string): SourceDocument;
  readonly length: number;
}

export interface ArrayQueryResultWrapper<TNode extends Node = Node> extends BaseQueryResultWrapper<TNode> {
  parent<SNode extends Node = Node>(): ArrayQueryResultWrapper<SNode>;
  map<TResult>(cb: (context: QueryForEachContext<TNode>) => TResult): TResult[];
  filter(cb: (context: QueryForEachContext<TNode>) => boolean): ArrayQueryResultWrapper<TNode>;
  readonly unique: SingleQueryResultWrapper<TNode>;
  readonly first: SingleQueryResultWrapper<TNode>;
  readonly last: SingleQueryResultWrapper<TNode>;
}

export interface SingleQueryResultWrapper<TNode extends Node = Node> extends BaseQueryResultWrapper<TNode> {
  parent<SNode extends Node = Node>(): SingleQueryResultWrapper<SNode>;
  map<TResult>(cb: (context: QueryForEachContext<TNode>) => TResult): TResult;
  filter(cb: (context: QueryForEachContext<TNode>) => boolean): SingleQueryResultWrapper<TNode>;
  readonly unique: SingleQueryResultWrapper<TNode>;
  readonly first: SingleQueryResultWrapper<TNode>;
  readonly last: SingleQueryResultWrapper<TNode>;
}

export interface QueryForEachContext<TNode extends Node = Node> {
  readonly node: TNode;
  readonly text: string;
}

export interface QueryReplacementContext<TNode extends Node = Node> extends QueryForEachContext<TNode> {}
