import ts from "typescript";
import { ScriptFunction, template } from "../src";

const fn: ScriptFunction = ({ sourceDocument }) => {
  sourceDocument.query("ExpressionStatement:has(Identifier.expression[name='console'])").replace(ctx =>
    template.statement`return (options: string) => EXPRESSION`({
      EXPRESSION: ctx.query("CallExpression").first.node,
    }),
  );
};

export default fn;
