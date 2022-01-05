import ts from "typescript";
import { SourceFileDocument } from ".";
import { template } from "talt";
import { tsquery } from "@phenomnomnominal/tsquery";

describe(SourceFileDocument, () => {
  describe("examples", () => {
    test("unique query and map", () => {
      const result = SourceFileDocument.createFromSourceFile(
        getSourceFile(`const a = 1; const b = 'x' + 'y'; /* foo! */ const c = 3;`),
      )
        .query<ts.VariableStatement>("VariableStatement:has(Identifier[name='b'])")
        .unique.map(ctx => ctx.text);

      expect(result).toContain("const b = 'x' + 'y'");
    });

    test("filter query results", () => {
      const result = SourceFileDocument.createFromSourceFile(
        getSourceFile(`const a = 1; const b = 'x' + 'y'; /* foo! */ const c = 3;`),
      )
        .query<ts.VariableStatement>("VariableStatement")
        .filter(ctx => ts.isNumericLiteral(ctx.node.declarationList.declarations[0].initializer!)).length;

      expect(result).toBe(2);
    });
  });
});

function getSourceFile(text: string) {
  return ts.createSourceFile("test.ts", text, ts.ScriptTarget.Latest, true);
}
