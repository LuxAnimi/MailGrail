import path from "path";

//------------------------------------------------------------------------------
import { loadConfigFromFile } from "vite";

//------------------------------------------------------------------------------
import { resolveConfig } from "./resolveConfig.js";

//------------------------------------------------------------------------------
import type {
  MailgrailUserConfig,
  MailgrailResolvedConfig,
} from "../config/types.ts";

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
export async function loadMailgrailConfig(
  configPath?: string,
): Promise<MailgrailResolvedConfig> {
  const baseDir = configPath ? path.dirname(configPath) : process.cwd();
  const configFile = path.resolve(
    configPath || path.resolve(baseDir, "mailgrail.config.ts"),
  );

  const result = await loadConfigFromFile(
    {
      command: "serve", // or "build"
      mode: "development",
    },
    configFile,
    baseDir,
  );

  if (!result) {
    throw new Error("Failed to load mailgrail.config.ts");
  }

  return resolveConfig(
    result.config as MailgrailUserConfig,
    configFile,
    baseDir,
  );
}
