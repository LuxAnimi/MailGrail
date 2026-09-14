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
import type { MailgrailResolvedConfig } from "../config/types.js";

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
      // Bind IPv4 loopback explicitly. Left to its default, Vite resolves
      // "localhost" through Node's DNS order and on some machines -- containers
      // and CI runners among them -- binds ::1 only, while anything resolving
      // localhost to 127.0.0.1 then cannot reach it. Pinning the family keeps
      // the address we advertise and the one we listen on the same everywhere.
      host: "127.0.0.1",
      port: config.previewPort,
      fs: { allow: [root, path.resolve(libraryDir)] },
    },
    plugins: [
      react(),
      MailgrailConfigPlugin(config),
      MailgrailTemplatesPlugin(config.sourceDir),
    ],
    assetsInclude: ["**/*.png", "**/*.jpg", "**/*.jpeg", "**/*.svg"],
    optimizeDeps: {
      // The preview app is served from inside node_modules, so Vite would
      // otherwise treat it as a dependency and hand it to esbuild to
      // pre-bundle -- which cannot resolve the virtual modules our plugins
      // provide. Skipping the scan leaves them to the plugins at request time.
      entries: [],
      exclude: ["virtual:mailgrailconfig", "virtual:mailgrailtemplates"],
    },
  };

  const server = await createServer(viteConfig);

  watchMailgrailConfig(server, config.configPath);

  await server.listen();
  server.printUrls();

  return server;
}
