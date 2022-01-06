import { EmitHint, createPrinter, createSourceFile, SourceFile, Node } from "typescript";
import {
  SourceDocument,
  SingleSelectionResult,
  ArraySelectionResult,
  RootArraySelectionResult,
  RootSingleSelectionResult,
  BaseSelectionCallbackContext,
  EditCallbackContext,
  MutationPayload,
} from "./types";
import { tsquery } from "@phenomnomnominal/tsquery";
import { template as taltTemplate } from "talt";

const { sourceFile, ...rest } = taltTemplate;
export const template = {
  ...rest,
} as const;

type TextChange = {
  readonly pos: number;
  readonly end: number;
  readonly newText: string;
};

export class SourceFileDocument implements SourceDocument {
  private _sourceFile!: SourceFile;

  private _uncommittedChanges: TextChange[];

  static createFromSourceFile(sourceFile: SourceFile) {
    return new SourceFileDocument({ sourceFile });
  }

  private constructor({ sourceFile }: { sourceFile: SourceFile }) {
    this._sourceFile = sourceFile;
    this._uncommittedChanges = [];
  }

  query<TNode extends Node = Node>(queryStr: string): RootArraySelectionResult<TNode> {
    const result = tsquery.query(this._sourceFile, queryStr);
    return new DefaultRootArraySelectionResult(result as TNode[], this);
  }

  get text() {
    return this._sourceFile.text;
  }

  commit() {
    const sorted = this._uncommittedChanges.slice().sort((a, b) => {
      const endDiff = b.end - a.end;
      if (endDiff !== 0) return endDiff;
      const startDiff = b.pos - a.pos;
      return startDiff;
    });
    let lastChange: TextChange | undefined = undefined;
    for (const change of sorted) {
      if (lastChange && change.pos >= lastChange.pos) {
        continue;
      }
      const head = this._sourceFile.text.slice(0, change.pos);
      const tail = this._sourceFile.text.slice(change.end);
      const newText = head + change.newText + tail;
      this._sourceFile = this._sourceFile.update(newText, {
        span: {
          start: change.pos,
          length: change.end - change.pos,
        },
        newLength: change.newText.length,
      });
      lastChange = change;
    }
    this._uncommittedChanges = [];
    return this;
  }

  pushChange(change: TextChange) {
    this._uncommittedChanges.push(change);
  }

  printNode(node: Node) {
    const printer = createPrinter({
      omitTrailingSemicolon: false,
      removeComments: false,
    });
    return printer.printNode(EmitHint.Unspecified, node, this._sourceFile);
  }
}

class DefaultArraySelectionResult<TNode extends Node> implements ArraySelectionResult<TNode> {
  public readonly _holder: SourceFileDocument;
  protected readonly _raw: TNode[];

  constructor(raw: TNode[], holder: SourceFileDocument) {
    this._raw = raw;
    this._holder = holder;
  }

  get node() {
    return this._raw;
  }

  get length() {
    return this._raw.length;
  }

  end() {
    return this._holder;
  }

  get first(): SingleSelectionResult<TNode> {
    if (this._raw.length === 0) {
      // TODO Specify error
      throw new Error("");
    }
    return new DefaultSingleSelectionResult(this._raw[0], this._holder);
  }

  get last(): SingleSelectionResult<TNode> {
    if (this._raw.length === 0) {
      // TODO Specify error
      throw new Error("");
    }
    return new DefaultRootSingleSelectionResult(this._raw[this._raw.length - 1], this._holder);
  }

  get unique(): SingleSelectionResult<TNode> {
    if (this._raw.length !== 1) {
      // TODO Specify error
      throw new Error("");
    }
    return new DefaultRootSingleSelectionResult(this._raw[0], this._holder);
  }

  filter(cb: (context: BaseSelectionCallbackContext<TNode>) => boolean): ArraySelectionResult<TNode> {
    return new DefaultArraySelectionResult(
      this._createContexts()
        .filter(cb)
        .map(({ node }) => node),
      this._holder,
    );
  }

  map<TResult>(cb: (context: BaseSelectionCallbackContext<TNode>) => TResult): TResult[] {
    return this._createContexts().map(cb);
  }

  parent<SNode extends Node = Node>(): ArraySelectionResult<SNode> {
    return new DefaultArraySelectionResult<SNode>(
      this._raw.map(node => node.parent as SNode),
      this._holder,
    );
  }

  get rawResults() {
    return this._raw;
  }

  forEach(cb: (context: BaseSelectionCallbackContext<TNode>) => void) {
    this._createContexts().forEach(cb);
    return this;
  }

  replace(cb: (context: EditCallbackContext<TNode>) => MutationPayload) {
    this._createContexts().forEach(ctx => {
      const replacementResult = cb(ctx);
      if (replacementResult == null) {
        return;
      }
      const newText =
        typeof replacementResult === "string" ? replacementResult : this._holder.printNode(replacementResult);
      this._holder.pushChange({
        pos: ctx.node.pos,
        end: ctx.node.end,
        newText,
      });
    });
    return this;
  }

  protected _createContexts(): BaseSelectionCallbackContext<TNode>[] {
    return this._raw.map(node => {
      const text = this._holder.printNode(node);
      return {
        node,
        text,
        query: <SNode extends Node = Node>(queryString: string) => {
          const raw = tsquery.query(node, queryString) as SNode[];
          return new DefaultArraySelectionResult(raw, this._holder);
        },
      };
    });
  }
}

class DefaultRootArraySelectionResult<TNode extends Node>
  extends DefaultArraySelectionResult<TNode>
  implements RootArraySelectionResult<TNode>
{
  static promoteFrom<TNode extends Node = Node>(x: DefaultArraySelectionResult<TNode>) {
    return new DefaultRootArraySelectionResult(x.rawResults, x._holder);
  }

  constructor(raw: TNode[], holder: SourceFileDocument) {
    super(raw, holder);
  }

  end() {
    return this._holder;
  }

  get first(): RootSingleSelectionResult<TNode> {
    return DefaultRootSingleSelectionResult.promoteFrom(super.first as DefaultSingleSelectionResult<TNode>);
  }

  get last(): RootSingleSelectionResult<TNode> {
    return DefaultRootSingleSelectionResult.promoteFrom(super.last as DefaultSingleSelectionResult<TNode>);
  }

  get unique(): RootSingleSelectionResult<TNode> {
    return DefaultRootSingleSelectionResult.promoteFrom(super.unique as DefaultSingleSelectionResult<TNode>);
  }

  filter(cb: (context: BaseSelectionCallbackContext<TNode>) => boolean): DefaultRootArraySelectionResult<TNode> {
    return DefaultRootArraySelectionResult.promoteFrom(super.filter(cb) as DefaultArraySelectionResult<TNode>);
  }

  parent<SNode extends Node = Node>(): RootArraySelectionResult<SNode> {
    return DefaultRootArraySelectionResult.promoteFrom(super.parent() as DefaultArraySelectionResult<SNode>);
  }

  remove() {
    this._createContexts().forEach(mutationKindOf("remove", this));
    return this;
  }

  prepend(cb: (context: EditCallbackContext<TNode>) => MutationPayload) {
    this._createContexts().forEach(mutationKindOf("prepend", this, cb));
    return this;
  }

  append(cb: (context: EditCallbackContext<TNode>) => MutationPayload) {
    this._createContexts().forEach(mutationKindOf("append", this, cb));
    return this;
  }

  replace(cb: (context: EditCallbackContext<TNode>) => MutationPayload) {
    this._createContexts().forEach(mutationKindOf("replace", this, cb));
    return this;
  }
}

class DefaultSingleSelectionResult<TNode extends Node> implements SingleSelectionResult<TNode> {
  public readonly _holder: SourceFileDocument;
  protected readonly _raw: TNode;

  constructor(raw: TNode, holder: SourceFileDocument) {
    this._raw = raw;
    this._holder = holder;
  }

  get node() {
    return this._raw;
  }

  get length() {
    return 1;
  }

  get first(): this {
    return this;
  }

  get last(): this {
    return this;
  }

  get unique(): this {
    return this;
  }

  filter(cb: (context: BaseSelectionCallbackContext<TNode>) => boolean): this {
    const ctx = this._createContext();
    const result = cb(ctx);
    if (!result) {
      // TODO Specify error
      throw new Error("");
    }
    return this;
  }

  map<TResult>(cb: (context: BaseSelectionCallbackContext<TNode>) => TResult): TResult {
    const ctx = this._createContext();
    return cb(ctx);
  }

  parent<SNode extends Node = Node>(): SingleSelectionResult<SNode> {
    return new DefaultRootSingleSelectionResult<SNode>(this._raw.parent as SNode, this._holder);
  }

  get rawResults() {
    return this._raw;
  }

  forEach(cb: (context: BaseSelectionCallbackContext<TNode>) => void) {
    const ctx = this._createContext();
    cb(ctx);
    return this;
  }

  protected _createContext(): BaseSelectionCallbackContext<TNode> {
    const node = this._raw;
    const text = this._holder.printNode(node);
    return {
      node,
      text,
      query: <SNode extends Node = Node>(queryString: string) => {
        const raw = tsquery.query(node, queryString) as SNode[];
        return new DefaultArraySelectionResult(raw, this._holder);
      },
    };
  }
}

class DefaultRootSingleSelectionResult<TNode extends Node>
  extends DefaultSingleSelectionResult<TNode>
  implements RootSingleSelectionResult<TNode>
{
  static promoteFrom<TNode extends Node = Node>(x: DefaultSingleSelectionResult<TNode>) {
    return new DefaultRootSingleSelectionResult(x.rawResults, x._holder);
  }

  constructor(raw: TNode, holder: SourceFileDocument) {
    super(raw, holder);
  }

  end() {
    return this._holder;
  }

  parent<SNode extends Node = Node>(): RootSingleSelectionResult<SNode> {
    return DefaultRootSingleSelectionResult.promoteFrom(super.parent() as DefaultSingleSelectionResult<SNode>);
  }

  remove() {
    mutationKindOf("remove", this)(this._createContext());
    return this;
  }

  prepend(cb: (context: EditCallbackContext<TNode>) => string) {
    mutationKindOf("prepend", this, cb)(this._createContext());
    return this;
  }

  append(cb: (context: EditCallbackContext<TNode>) => string) {
    mutationKindOf("append", this, cb)(this._createContext());
    return this;
  }

  replace(cb: (context: EditCallbackContext<TNode>) => string) {
    mutationKindOf("replace", this, cb)(this._createContext());
    return this;
  }
}

function mutationKindOf<TNode extends Node = Node>(
  type: "remove" | "prepend" | "append" | "replace",
  { _holder }: { _holder: SourceFileDocument },
  cb?: (context: EditCallbackContext<TNode>) => MutationPayload,
) {
  return (ctx: EditCallbackContext<TNode>) => {
    const payload = cb?.(ctx);
    if (type !== "remove" && payload == null) return;
    const newText = payload == null ? "" : typeof payload === "string" ? payload : _holder.printNode(payload);
    switch (type) {
      case "remove":
        _holder.pushChange({
          pos: ctx.node.pos,
          end: ctx.node.end,
          newText: "",
        });
        return;
      case "prepend":
        _holder.pushChange({
          pos: ctx.node.pos,
          end: ctx.node.pos,
          newText,
        });
        return;
      case "append":
        _holder.pushChange({
          pos: ctx.node.end,
          end: ctx.node.end,
          newText,
        });
        return;
      case "replace":
        _holder.pushChange({
          pos: ctx.node.pos,
          end: ctx.node.end,
          newText,
        });
        return;
    }
  };
}
