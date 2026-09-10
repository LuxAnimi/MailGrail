// Ambient declarations for the virtual modules served by src/plugins/*.
/// <reference types="vite/client" />

declare module "virtual:mailgrailconfig" {
  import type { MailgrailResolvedConfig } from "@/config/types";
  const config: MailgrailResolvedConfig;
  export default config;
}

declare module "virtual:mailgrailtemplates" {
  import type { TemplateDefinition } from "@/cli/types";
  import type { Schema } from "@/dsl/schemas";
  export const templates: TemplateDefinition<Schema<any>>[];
}
