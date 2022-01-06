import { EmitHint, createPrinter, createSourceFile, SourceFile, Node } from "typescript";
import {
  SingleSelectionResult,
  ArraySelectionResult,
  RootArraySelectionResult,
  RootSingleSelectionResult,
  SourceDocument,
  ReplacementCallbackContext,
  BaseSelectionCallbackContext,
  ReplacementResult,
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

  select<TNode extends Node = Node>(queryStr: string): RootArraySelectionResult<TNode> {
    const result = tsquery.query(this._sourceFile, queryStr);
    return new TsRootArrayQueryResultWrapper(result as TNode[], this);
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

class TsArrayQueryResultWrapper<TNode extends Node> implements ArraySelectionResult<TNode> {
  public readonly _holder: SourceFileDocument;
  protected readonly _raw: TNode[];

  constructor(raw: TNode[], holder: SourceFileDocument) {
    this._raw = raw;
    this._holder = holder;
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
    return new TsSingleQueryResultWrapper(this._raw[0], this._holder);
  }

  get last(): SingleSelectionResult<TNode> {
    if (this._raw.length === 0) {
      // TODO Specify error
      throw new Error("");
    }
    return new TsRootSingleQueryResultWrapper(this._raw[this._raw.length - 1], this._holder);
  }

  get unique(): SingleSelectionResult<TNode> {
    if (this._raw.length !== 1) {
      // TODO Specify error
      throw new Error("");
    }
    return new TsRootSingleQueryResultWrapper(this._raw[0], this._holder);
  }

  filter(cb: (context: BaseSelectionCallbackContext<TNode>) => boolean): ArraySelectionResult<TNode> {
    return new TsArrayQueryResultWrapper(
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
    return new TsArrayQueryResultWrapper<SNode>(
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

  replace(cb: (context: ReplacementCallbackContext<TNode>) => ReplacementResult) {
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
      };
    });
  }
}

class TsRootArrayQueryResultWrapper<TNode extends Node>
  extends TsArrayQueryResultWrapper<TNode>
  implements RootArraySelectionResult<TNode>
{
  static promoteFrom<TNode extends Node = Node>(x: TsArrayQueryResultWrapper<TNode>) {
    return new TsRootArrayQueryResultWrapper(x.rawResults, x._holder);
  }

  constructor(raw: TNode[], holder: SourceFileDocument) {
    super(raw, holder);
  }

  end() {
    return this._holder;
  }

  get first(): RootSingleSelectionResult<TNode> {
    return TsRootSingleQueryResultWrapper.promoteFrom(super.first as TsSingleQueryResultWrapper<TNode>);
  }

  get last(): RootSingleSelectionResult<TNode> {
    return TsRootSingleQueryResultWrapper.promoteFrom(super.last as TsSingleQueryResultWrapper<TNode>);
  }

  get unique(): RootSingleSelectionResult<TNode> {
    return TsRootSingleQueryResultWrapper.promoteFrom(super.unique as TsSingleQueryResultWrapper<TNode>);
  }

  filter(cb: (context: BaseSelectionCallbackContext<TNode>) => boolean): TsRootArrayQueryResultWrapper<TNode> {
    return TsRootArrayQueryResultWrapper.promoteFrom(super.filter(cb) as TsArrayQueryResultWrapper<TNode>);
  }

  parent<SNode extends Node = Node>(): RootArraySelectionResult<SNode> {
    return TsRootArrayQueryResultWrapper.promoteFrom(super.parent() as TsArrayQueryResultWrapper<SNode>);
  }

  replace(cb: (context: ReplacementCallbackContext<TNode>) => ReplacementResult) {
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
}

class TsSingleQueryResultWrapper<TNode extends Node> implements SingleSelectionResult<TNode> {
  public readonly _holder: SourceFileDocument;
  protected readonly _raw: TNode;

  constructor(raw: TNode, holder: SourceFileDocument) {
    this._raw = raw;
    this._holder = holder;
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
    return new TsRootSingleQueryResultWrapper<SNode>(this._raw.parent as SNode, this._holder);
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
    };
  }
}

class TsRootSingleQueryResultWrapper<TNode extends Node>
  extends TsSingleQueryResultWrapper<TNode>
  implements RootSingleSelectionResult<TNode>
{
  static promoteFrom<TNode extends Node = Node>(x: TsSingleQueryResultWrapper<TNode>) {
    return new TsRootSingleQueryResultWrapper(x.rawResults, x._holder);
  }

  constructor(raw: TNode, holder: SourceFileDocument) {
    super(raw, holder);
  }

  end() {
    return this._holder;
  }

  parent<SNode extends Node = Node>(): RootSingleSelectionResult<SNode> {
    return TsRootSingleQueryResultWrapper.promoteFrom(super.parent() as TsSingleQueryResultWrapper<SNode>);
  }

  replace(cb: (context: ReplacementCallbackContext<TNode>) => string) {
    const ctx = this._createContext();
    const replacementResult = cb(ctx);
    if (replacementResult == null) {
      return this;
    }
    const newText =
      typeof replacementResult === "string" ? replacementResult : this._holder.printNode(replacementResult);
    this._holder.pushChange({
      pos: ctx.node.pos,
      end: ctx.node.end,
      newText,
    });
    return this;
  }
}
