import type { MailgrailConfig } from "../config/types.ts";

//------------------------------------------------------------------------------
export function defineConfig(
  config: Partial<MailgrailConfig>,
): Partial<MailgrailConfig> {
  return config;
}
