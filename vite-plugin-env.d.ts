// vite-env.d.ts
/// <reference types="./vite-plugin-env.d.ts" />
/// <reference types="vite/client" />

declare module "virtual:mailgrailconfig" {
  import type { MailgrailResolvedConfig } from "@/config/types";
  const config: MailgrailResolvedConfig;
  export default config;
}

declare module "virtual:mailgrailtemplates" {
  import type { TemplateDefinition } from "@/config/types";
  export const templates: TemplateDefinition[];
}
