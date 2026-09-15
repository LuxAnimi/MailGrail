import path from "path";
import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";

//------------------------------------------------------------------------------
import { build } from "esbuild";

//------------------------------------------------------------------------------
import { resolveConfig } from "./resolveConfig.js";

//------------------------------------------------------------------------------
import type {
  MailgrailConfig,
  MailgrailResolvedConfig,
} from "./types.js";

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
export async function loadMailgrailConfig(
  configPath?: string,
): Promise<MailgrailResolvedConfig> {
  // Resolved up front: baseDir ends up in createRequire (build-templates.ts),
  // which rejects a relative path, so `--configPath mailgrail.config.ts` used
  // to crash the build.
  const baseDir = configPath
    ? path.dirname(path.resolve(configPath))
    : process.cwd();
  const configFile = path.resolve(
    configPath || path.resolve(baseDir, "mailgrail.config.ts"),
  );

  // Transpile the config TypeScript → ESM without bundling deps.
  // Writing the tmp file into baseDir ensures Node resolves imports
  // (e.g. "mailgrail") from the user's node_modules, not from /tmp.
  const tmpFile = path.join(baseDir, `.mailgrail-config-${Date.now()}.mjs`);

  try {
    await build({
      entryPoints: [configFile],
      outfile: tmpFile,
      bundle: true,
      packages: "external",
      format: "esm",
      platform: "node",
    });

    // Cache-bust so Node doesn't serve a stale module on config reload
    const mod = await import(
      pathToFileURL(tmpFile).href + "?t=" + Date.now()
    );

    const config = mod.default as Partial<MailgrailConfig> | undefined;

    if (!config) {
      throw new Error(
        `No default export found in ${configFile}. ` +
          `Make sure you export a defineConfig() call as default.`,
      );
    }

    return resolveConfig(config, configFile, baseDir);
  } finally {
    await fs.unlink(tmpFile).catch(() => {});
  }
}
