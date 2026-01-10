import path from "path";

//------------------------------------------------------------------------------
import type {
  MailgrailUserConfig,
  MailgrailResolvedConfig,
} from "../config/types.ts";

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
export function resolveConfig(
  userConfig: MailgrailUserConfig,
  configPath: string,
  baseDir: string,
): MailgrailResolvedConfig {
  const resolvedConf: MailgrailResolvedConfig = {
    ...userConfig,
    baseDir: baseDir,
    sourceDir: path.resolve(baseDir, userConfig.sourceDir ?? "./emails"),
    outputDir: path.resolve(baseDir, userConfig.outputDir ?? "./_generated"),
    configPath: configPath,
    previewPort: userConfig.previewPort ?? 7777,
    templatingEngine: userConfig.templatingEngine ?? "EJS",
    typescript: userConfig.typescript ?? true,
    hideAppLogo: userConfig.hideAppLogo ?? false,
    hideAppName: userConfig.hideAppName ?? false,
    hideAppDescription: userConfig.hideAppDescription ?? false,
  };

  return resolvedConf;
}
