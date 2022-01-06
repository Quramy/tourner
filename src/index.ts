import { EmitHint, createPrinter, createSourceFile, SourceFile, Node } from "typescript";
import {
  SingleSelectionResult,
  ArraySelectionResult,
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

  select<TNode extends Node = Node>(queryStr: string): ArraySelectionResult<TNode> {
    const result = tsquery.query(this._sourceFile, queryStr);
    return new TsArrayQueryResultWrapper(result as TNode[], this);
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
  private readonly _holder: SourceFileDocument;
  private readonly _raw: TNode[];

  constructor(raw: TNode[], holder: SourceFileDocument) {
    this._raw = raw;
    this._holder = holder;
  }

  end() {
    return this._holder;
  }

  get length() {
    return this._raw.length;
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
    return new TsSingleQueryResultWrapper(this._raw[this._raw.length - 1], this._holder);
  }

  get unique(): SingleSelectionResult<TNode> {
    if (this._raw.length !== 1) {
      // TODO Specify error
      throw new Error("");
    }
    return new TsSingleQueryResultWrapper(this._raw[0], this._holder);
  }

  filter(cb: (context: BaseSelectionCallbackContext<TNode>) => boolean): TsArrayQueryResultWrapper<TNode> {
    return new TsArrayQueryResultWrapper(
      this._raw.filter(node => {
        const text = this._holder.printNode(node);
        return cb({ node, text });
      }),
      this._holder,
    );
  }

  map<TResult>(cb: (context: BaseSelectionCallbackContext<TNode>) => TResult): TResult[] {
    return this._raw.map(node => {
      const text = this._holder.printNode(node);
      return cb({ node, text });
    });
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
    this._raw.forEach(node => {
      const text = this._holder.printNode(node);
      cb({ node, text });
    });
    return this;
  }

  replace(cb: (context: ReplacementCallbackContext<TNode>) => ReplacementResult) {
    this._raw.forEach(node => {
      const text = this._holder.printNode(node);
      const replacementResult = cb({ node, text });
      if (replacementResult == null) {
        return;
      }
      const newText =
        typeof replacementResult === "string" ? replacementResult : this._holder.printNode(replacementResult);
      this._holder.pushChange({
        pos: node.pos,
        end: node.end,
        newText,
      });
    });
    return this;
  }
}

class TsSingleQueryResultWrapper<TNode extends Node> implements SingleSelectionResult<TNode> {
  private readonly _holder: SourceFileDocument;
  private readonly _raw: TNode;

  constructor(raw: TNode, holder: SourceFileDocument) {
    this._raw = raw;
    this._holder = holder;
  }

  end() {
    return this._holder;
  }

  get length() {
    return 1;
  }

  get first(): SingleSelectionResult<TNode> {
    return this;
  }

  get last(): SingleSelectionResult<TNode> {
    return this;
  }

  get unique(): SingleSelectionResult<TNode> {
    return this;
  }

  filter(cb: (context: BaseSelectionCallbackContext<TNode>) => boolean): this {
    const node = this._raw;
    const text = this._holder.printNode(node);
    const result = cb({ node, text });
    if (!result) {
      // TODO Specify error
      throw new Error("");
    }
    return this;
  }

  map<TResult>(cb: (context: BaseSelectionCallbackContext<TNode>) => TResult): TResult {
    const node = this._raw;
    const text = this._holder.printNode(node);
    return cb({ node, text });
  }

  parent<SNode extends Node = Node>(): SingleSelectionResult<SNode> {
    return new TsSingleQueryResultWrapper<SNode>(this._raw.parent as SNode, this._holder);
  }

  get rawResults() {
    return this._raw;
  }

  forEach(cb: (context: BaseSelectionCallbackContext<TNode>) => void) {
    const node = this._raw;
    const text = this._holder.printNode(node);
    cb({ node, text });
    return this;
  }

  replace(cb: (context: ReplacementCallbackContext<TNode>) => string) {
    const node = this._raw;
    const text = this._holder.printNode(node);
    const replacementResult = cb({ node, text });
    if (replacementResult == null) {
      return this;
    }
    const newText =
      typeof replacementResult === "string" ? replacementResult : this._holder.printNode(replacementResult);
    this._holder.pushChange({
      pos: node.pos,
      end: node.end,
      newText,
    });
    return this;
  }
}
