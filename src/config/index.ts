import type { MailgrailConfig } from "../config/types.ts";

//------------------------------------------------------------------------------
export function defineConfig(
  config: Partial<MailgrailConfig>,
): Partial<MailgrailConfig> {
  return config;
}

export { t } from "../dsl/index.js";
export type { Infer, Schema } from "../dsl/schemas.js";
export type {
  TemplateDefinition,
  RenderTemplateContext,
  HtmlTemplateContext,
} from "../cli/types.js";
