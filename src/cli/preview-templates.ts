import path from "node:path";

//------------------------------------------------------------------------------
import react from "@vitejs/plugin-react";
import { createServer } from "vite";
import type { UserConfig } from "vite";

//------------------------------------------------------------------------------
import { watchMailgrailConfig } from "../config/watchConfig.js";

//------------------------------------------------------------------------------
import { MailgrailTemplatesPlugin } from "../plugins/template-loader.js";
import { MailgrailConfigPlugin } from "../plugins/config-loader.js";
import { getLibraryDir } from "./utils.js";
import type { MailgrailResolvedConfig } from "@/config/types.js";

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
export async function previewTemplates(config: MailgrailResolvedConfig) {
  const root = process.cwd();
  const libraryDir = getLibraryDir();

  const viteConfig: UserConfig = {
    root: path.resolve(libraryDir, "app"),
    base: "/",
    build: {
      outDir: "dist",
      emptyOutDir: true,
    },
    server: {
      port: config.previewPort,
      fs: { allow: [root, path.resolve(libraryDir)] },
    },
    plugins: [
      react(),
      MailgrailConfigPlugin(config),
      MailgrailTemplatesPlugin(config.sourceDir),
    ],
    assetsInclude: ["**/*.png", "**/*.jpg", "**/*.jpeg", "**/*.svg"],
  };

  const server = await createServer(viteConfig);

  watchMailgrailConfig(server, config.configPath);

  await server.listen();
  server.printUrls();

  return server;
}
