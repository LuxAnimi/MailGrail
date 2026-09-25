import type { MailgrailConfig } from "./types.js";
export type { PreviewDevice, PreviewDeviceType } from "./types.js";

//------------------------------------------------------------------------------
export function defineConfig(
  config: Partial<MailgrailConfig>,
): Partial<MailgrailConfig> {
  return config;
}

export { t } from "../dsl/index.js";
export { defineMessages } from "../i18n/messages.js";
export type { MessageDescriptor } from "../i18n/messages.js";
export type { Infer, Schema } from "../dsl/schemas.js";
export type {
  TemplateDefinition,
  RenderTemplateContext,
  HtmlTemplateContext,
  TextTemplateContext,
} from "../cli/types.js";
