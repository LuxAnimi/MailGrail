// Ambient declarations for the virtual modules served by src/plugins/*.
/// <reference types="vite/client" />

declare module "virtual:mailgrailconfig" {
  import type { MailgrailResolvedConfig } from "@/config/types";
  import type { ProjectInfo } from "@/config/types";
  const config: MailgrailResolvedConfig;
  export const project: ProjectInfo;
  export default config;
}

declare module "virtual:mailgrailtemplates" {
  import type { TemplateDefinition } from "@/cli/types";
  import type { Schema } from "@/dsl/schemas";
  export const templates: TemplateDefinition<Schema<any>>[];
}

declare module "virtual:mailgrailcatalogs" {
  /** Empty when the project is not localized. */
  export const locales: string[];
  export const defaultLocale: string | null;
  export const timeZone: string;
  export const strict: boolean;
  /** locale -> the catalog's JSON, or null when the file does not exist. */
  export const catalogs: Record<string, unknown>;
  /** Catalog files that could not be parsed. */
  export const errors: string[];
}
