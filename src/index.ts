import { EmitHint, createPrinter, SourceFile, Node } from "typescript";
import {
  SingleQueryResultWrapper,
  ArrayQueryResultWrapper,
  SourceDocument,
  QueryReplacementContext,
  QueryForEachContext,
} from "./types";
import { tsquery } from "@phenomnomnominal/tsquery";

export class SourceFileDocument implements SourceDocument {
  private _sourceFile!: SourceFile;

  static createFromSourceFile(sourceFile: SourceFile) {
    return new SourceFileDocument({ sourceFile });
  }

  private constructor({ sourceFile }: { sourceFile: SourceFile }) {
    this._sourceFile = sourceFile;
  }

  query<TNode extends Node = Node>(queryStr: string): ArrayQueryResultWrapper<TNode> {
    const result = tsquery.query(this._sourceFile, queryStr);
    return new TsArrayQueryResultWrapper(result as TNode[], this);
  }

  printNode(node: Node) {
    const printer = createPrinter({
      omitTrailingSemicolon: false,
      removeComments: false,
    });
    return printer.printNode(EmitHint.Unspecified, node, this._sourceFile);
  }
}

class TsArrayQueryResultWrapper<TNode extends Node> implements ArrayQueryResultWrapper<TNode> {
  private readonly _holder: SourceFileDocument;
  private readonly _raw: TNode[];

  constructor(raw: TNode[], holder: SourceFileDocument) {
    this._raw = raw;
    this._holder = holder;
  }

  get length() {
    return this._raw.length;
  }

  get first(): SingleQueryResultWrapper<TNode> {
    if (this._raw.length === 0) {
      // TODO Specify error
      throw new Error("");
    }
    return new TsSingleQueryResultWrapper(this._raw[0], this._holder);
  }

  get last(): SingleQueryResultWrapper<TNode> {
    if (this._raw.length === 0) {
      // TODO Specify error
      throw new Error("");
    }
    return new TsSingleQueryResultWrapper(this._raw[this._raw.length - 1], this._holder);
  }

  get unique(): SingleQueryResultWrapper<TNode> {
    if (this._raw.length !== 1) {
      // TODO Specify error
      throw new Error("");
    }
    return new TsSingleQueryResultWrapper(this._raw[0], this._holder);
  }

  filter(cb: (context: QueryForEachContext<TNode>) => boolean): TsArrayQueryResultWrapper<TNode> {
    return new TsArrayQueryResultWrapper(
      this._raw.filter(node => {
        const text = this._holder.printNode(node);
        return cb({ node, text });
      }),
      this._holder,
    );
  }

  map<TResult>(cb: (context: QueryForEachContext<TNode>) => TResult): TResult[] {
    return this._raw.map(node => {
      const text = this._holder.printNode(node);
      return cb({ node, text });
    });
  }

  parent<SNode extends Node = Node>(): ArrayQueryResultWrapper<SNode> {
    return new TsArrayQueryResultWrapper<SNode>(
      this._raw.map(node => node.parent as SNode),
      this._holder,
    );
  }

  get rawResults() {
    return this._raw;
  }

  forEach(cb: (context: QueryForEachContext<TNode>) => void) {
    this._raw.forEach(node => {
      const text = this._holder.printNode(node);
      cb({ node, text });
    });
    return this;
  }

  replace(cb: (context: QueryReplacementContext<TNode>) => string) {
    return this._holder;
  }
}

class TsSingleQueryResultWrapper<TNode extends Node> implements SingleQueryResultWrapper<TNode> {
  private readonly _holder: SourceFileDocument;
  private readonly _raw: TNode;

  constructor(raw: TNode, holder: SourceFileDocument) {
    this._raw = raw;
    this._holder = holder;
  }
  get length() {
    return 1;
  }

  get first(): SingleQueryResultWrapper<TNode> {
    return this;
  }

  get last(): SingleQueryResultWrapper<TNode> {
    return this;
  }

  get unique(): SingleQueryResultWrapper<TNode> {
    return this;
  }

  filter(cb: (context: QueryForEachContext<TNode>) => boolean): this {
    const node = this._raw;
    const text = this._holder.printNode(node);
    const result = cb({ node, text });
    if (!result) {
      // TODO Specify error
      throw new Error("");
    }
    return this;
  }

  map<TResult>(cb: (context: QueryForEachContext<TNode>) => TResult): TResult {
    const node = this._raw;
    const text = this._holder.printNode(node);
    return cb({ node, text });
  }

  parent<SNode extends Node = Node>(): SingleQueryResultWrapper<SNode> {
    return new TsSingleQueryResultWrapper<SNode>(this._raw.parent as SNode, this._holder);
  }

  get rawResults() {
    return this._raw;
  }

  forEach(cb: (context: QueryForEachContext<TNode>) => void) {
    const node = this._raw;
    const text = this._holder.printNode(node);
    cb({ node, text });
    return this;
  }

  replace(cb: (context: QueryReplacementContext<TNode>) => string) {
    return this._holder;
  }
}
