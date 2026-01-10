import type { TemplateDefinition } from "@/cli/types.ts";
import type { Schema } from "@/dsl/types";

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
export const loadTemplates = async (): Promise<
  TemplateDefinition<Schema<any>>[]
> => {
  const mod = await import("virtual:mailgrailtemplates");
  return mod.templates;
};
