import path from "path";

//------------------------------------------------------------------------------
import type {
  MailgrailConfig,
  MailgrailResolvedConfig,
} from "./types.js";

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
export function resolveConfig(
  userConfig: Partial<MailgrailConfig>,
  configPath: string,
  baseDir: string,
): MailgrailResolvedConfig {
  const resolvedConf: MailgrailResolvedConfig = {
    ...userConfig,
    baseDir: baseDir,
    sourceDir: path.resolve(baseDir, userConfig.sourceDir ?? "./emails-src"),
    outputDir: path.resolve(baseDir, userConfig.outputDir ?? "./emails-dist"),
    configPath: configPath,
    previewPort: userConfig.previewPort ?? 7777,
    templatingEngine: userConfig.templatingEngine ?? "EJS",
    moduleFormat: userConfig.moduleFormat ?? "esm",
    typescript: userConfig.typescript ?? true,
    hideAppLogo: userConfig.hideAppLogo ?? false,
    hideAppName: userConfig.hideAppName ?? false,
    hideAppDescription: userConfig.hideAppDescription ?? false,
  };

  return resolvedConf;
}
