// TODO
import ts from "typescript";

import path from "path";
import { isMatch } from "picomatch";
import { createPatch } from "diff";

import { registerTypeScript, getProcessedFileNames } from "./register-hook";
import { ScriptHost } from "./script-host";
import { ScriptFunction } from "./types";
import { SourceFileDocument } from "./source-document";
import { createCliOptionParser } from "./cli-option-parser";
import { ConsoleLogger } from "./logger";
import { color } from "./string-util";

function getTsCliOptions(pwd: string, tsconfigJsonFilePath?: string) {
  const result = ts.getParsedCommandLineOfConfigFile(
    !tsconfigJsonFilePath
      ? path.resolve(pwd, "tsconfig.json")
      : path.isAbsolute(tsconfigJsonFilePath)
      ? tsconfigJsonFilePath
      : path.resolve(pwd, tsconfigJsonFilePath),
    {},
    ts.sys as unknown as ts.ParseConfigFileHost,
  );
  if (!result) {
    // TODO
    throw new Error("");
  }
  return result;
}

export function main() {
  const opt = createCliOptionParser({
    baseUsage: "TBD",
    options: {
      write: {
        type: "boolean",
        alias: "W",
        description: "Edit files in-place.",
      },
      verbose: {
        type: "boolean",
      },
      silent: {
        type: "boolean",
      },
      project: {
        type: "string",
        alias: "p",
        defaultValue: "tsconfig.json",
        description: "TypeScript configuration file path.",
      },
      include: {
        type: "string",
        alias: "i",
        description: "Target files to be proccessed.",
      },
      exclude: {
        alias: "e",
        type: "string",
      },
    } as const,
    logger: new ConsoleLogger(),
  }).parse(process.argv);

  if (opt._.length !== 1) {
    opt.showHelp();
    return process.exit(1);
  }

  registerTypeScript();

  const pwd = ts.sys.getCurrentDirectory();

  const scriptPath = opt._[0];
  const tsCliOptions = getTsCliOptions(pwd, opt.options.project);
  const scriptHost = new ScriptHost(pwd, tsCliOptions.options);
  tsCliOptions.fileNames.forEach(fileName => scriptHost.readFile(fileName));
  const service = ts.createLanguageService(scriptHost);

  const script = require(path.resolve(pwd, scriptPath)) as
    | {
        default?: ScriptFunction;
      }
    | undefined;

  const scriptModuleFileNames = getProcessedFileNames();

  const logger = new ConsoleLogger(opt.options.verbose ? "debug" : opt.options.silent ? "silent" : "info");

  logger.debug(
    `Files in this project: [${tsCliOptions.fileNames.map(fileName => path.relative(pwd, fileName)).join(", ")}]`,
  );

  if (script?.default && typeof script?.default === "function") {
    const userDefinedFn = script.default;
    const processedDocuments = tsCliOptions.fileNames
      .filter(fname => (opt.options.include ? isMatch(fname, opt.options.include) : true))
      .filter(fname => (opt.options.exclude ? !isMatch(fname, opt.options.exclude) : true))
      .reduce((acc, fname) => {
        if (scriptModuleFileNames.includes(fname)) {
          logger.debug(`Skip to process file "${fname}", because this file is used as Touner script.`);
          return acc;
        }
        logger.debug(`Start to process file "${fname}"`);
        const sourceFile = service.getProgram()!.getSourceFile(fname)!;
        const sourceDocument = SourceFileDocument.createFromSourceFile(sourceFile);
        sourceDocument.onUpdate(scriptHost.updateFile.bind(scriptHost));
        userDefinedFn({ sourceDocument });
        if (sourceDocument.dirty) {
          sourceDocument.commit();
        }
        return [...acc, sourceDocument];
      }, [] as SourceFileDocument[]);
    const touchedDocuments = processedDocuments.filter(doc => doc.touched);
    if (opt.options.write) {
      touchedDocuments.forEach(doc => {
        ts.sys.writeFile(doc.fileName, doc.text);
      });
    } else {
      touchedDocuments.forEach(doc => {
        logger.info(prettyDiff(doc.fileName, scriptHost.readOriginalFile(doc.fileName)!, doc.text));
      });
    }
  }
}

function prettyDiff(fileName: string, oldText: string, newText: string) {
  const unifiedPatch = createPatch(fileName, oldText, newText);
  return unifiedPatch
    .split("\n")
    .map(line => {
      if (line.startsWith("---") || line.startsWith("+++")) return line;
      if (line.startsWith("@@")) return color.cyan(line);
      if (line.startsWith("+")) return color.green(line);
      if (line.startsWith("-")) return color.red(line);
      return line;
    })
    .join("\n");
}

main();
