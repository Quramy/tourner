import ts from "typescript";
import { template as taltTemplate } from "talt";

export * from "./types";

const { sourceFile, ...rest } = taltTemplate;
export const template = { ...rest } as const;

export function createProject() {
  const result = ts.getParsedCommandLineOfConfigFile(
    ts.sys.getCurrentDirectory() + "/tsconfig.json",
    {},
    ts.sys as unknown as ts.ParseConfigFileHost,
  );
  if (!result) {
    // TODO
    throw new Error("");
  }
  return result;
}
