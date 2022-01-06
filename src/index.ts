import { template as taltTemplate } from "talt";

export * from "./types";

const { sourceFile, ...rest } = taltTemplate;
export const template = { ...rest } as const;
