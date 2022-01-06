import ts from "typescript";
import { template } from ".";
import { SourceFileDocument } from "./source-document";

describe(SourceFileDocument, () => {
  describe(SourceFileDocument.prototype.commit, () => {
    test("with empty string", () => {
      const doc = SourceFileDocument.createFromSourceFile(getSourceFile(""));
      doc.pushChange({
        pos: 0,
        end: 0,
        newText: "a = 1",
      });
      doc.commit();
      expect(doc.text).toBe("a = 1");
    });

    test("prepend", () => {
      const doc = SourceFileDocument.createFromSourceFile(getSourceFile("b = 1;"));
      doc.pushChange({
        pos: 0,
        end: 0,
        newText: "c = 1;",
      });
      doc.commit();
      expect(doc.text).toBe("c = 1;b = 1;");
    });

    test("append", () => {
      const doc = SourceFileDocument.createFromSourceFile(getSourceFile("b = 1;"));
      doc.pushChange({
        pos: doc.text.length,
        end: doc.text.length,
        newText: "c = 1",
      });
      doc.commit();
      expect(doc.text).toBe("b = 1;c = 1");
    });

    test("insert", () => {
      const doc = SourceFileDocument.createFromSourceFile(getSourceFile("a = 1;b = 1;"));
      doc.pushChange({
        pos: "a = 1;".length,
        end: "a = 1;".length,
        newText: "c = 1;",
      });
      doc.commit();
      expect(doc.text).toBe("a = 1;c = 1;b = 1;");
    });

    test("remove", () => {
      const doc = SourceFileDocument.createFromSourceFile(getSourceFile("a = 1;b = 1;"));
      doc.pushChange({
        pos: 0,
        end: "a = 1;".length,
        newText: "",
      });
      doc.commit();
      expect(doc.text).toBe("b = 1;");
    });

    test("replace", () => {
      const doc = SourceFileDocument.createFromSourceFile(getSourceFile("a = 1;b = 1;"));
      doc.pushChange({
        pos: 0,
        end: "a = 1;".length,
        newText: "c = 1;",
      });
      doc.commit();
      expect(doc.text).toBe("c = 1;b = 1;");
    });

    describe("multiple changes", () => {
      test("normal order", () => {
        const doc = SourceFileDocument.createFromSourceFile(getSourceFile("a = 1;b = 1;"));
        doc.pushChange({
          pos: "a = 1;".length,
          end: "a = 1;".length,
          newText: "c = 1;",
        });
        doc.pushChange({
          pos: doc.text.length,
          end: doc.text.length,
          newText: "d = 1;",
        });
        doc.commit();
        expect(doc.text).toBe("a = 1;c = 1;b = 1;d = 1;");
      });

      test("reverse order", () => {
        const doc = SourceFileDocument.createFromSourceFile(getSourceFile("a = 1;b = 1;"));
        doc.pushChange({
          pos: doc.text.length,
          end: doc.text.length,
          newText: "d = 1;",
        });
        doc.pushChange({
          pos: "a = 1;".length,
          end: "a = 1;".length,
          newText: "c = 1;",
        });
        doc.commit();
        expect(doc.text).toBe("a = 1;c = 1;b = 1;d = 1;");
      });

      test("overwrapping range", () => {
        const doc = SourceFileDocument.createFromSourceFile(getSourceFile("a = 1;b = 1;"));
        doc.pushChange({
          pos: 0,
          end: "a = 1;".length,
          newText: "c = 1;",
        });
        doc.pushChange({
          pos: "a".length,
          end: "a".length,
          newText: "AAA",
        });
        doc.commit();
        expect(doc.text).toBe("c = 1;b = 1;");
      });
    });
  });

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

    test("query and replace", () => {
      const result = SourceFileDocument.createFromSourceFile(
        getSourceFile(`const a = 1; const b = 'x' + 'y'; /* foo! */ const c = 3;`),
      )
        .query<ts.VariableStatement>("VariableStatement:has(Identifier[name='b'])")
        .replace(({ query }) =>
          template.statement`export const b = INITIALIZER;`({
            INITIALIZER: query("*.initializer").first.node,
          }),
        )
        .end()
        .commit().text;

      expect(result).toContain("export const b = 'x' + 'y'");
    });
  });
});

function getSourceFile(text: string) {
  return ts.createSourceFile("test.ts", text, ts.ScriptTarget.Latest, true);
}
