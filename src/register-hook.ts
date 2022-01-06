import fs from "fs";
import type { CompilerOptions } from "typescript";

let _processedFileNames: string[] = [];

export function registerTypeScript() {
  let defaultCompileOptions: CompilerOptions;
  require.extensions[".ts"] = (module, fileName) => {
    const ts = require("typescript") as typeof import("typescript");
    if (!defaultCompileOptions) {
      defaultCompileOptions = ts.getDefaultCompilerOptions();
    }
    const content = fs.readFileSync(fileName, "utf8");
    const { outputText } = ts.transpileModule(content, {
      fileName,
      compilerOptions: {
        ...defaultCompileOptions,
        noEmit: true,
        esModuleInterop: true,
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.CommonJS,
      },
      reportDiagnostics: false,
    });
    (module as any)._compile(outputText, fileName);
    _processedFileNames.push(fileName);
  };
}

export function getProcessedFileNames() {
  return _processedFileNames as ReadonlyArray<string>;
}
