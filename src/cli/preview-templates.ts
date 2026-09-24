import path from "node:path";

//------------------------------------------------------------------------------
import react from "@vitejs/plugin-react";
import { createServer } from "vite";
import type { InlineConfig } from "vite";

//------------------------------------------------------------------------------
import { watchMailgrailConfig } from "../config/watchConfig.js";

//------------------------------------------------------------------------------
import { MailgrailTemplatesPlugin } from "../plugins/template-loader.js";
import { MailgrailConfigPlugin } from "../plugins/config-loader.js";
import { MailgrailCatalogsPlugin } from "../plugins/catalog-loader.js";
import { getLibraryDir } from "./utils.js";
import { assertReactPair } from "./react-preflight.js";
import type { MailgrailResolvedConfig } from "../config/types.js";

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
export async function previewTemplates(config: MailgrailResolvedConfig) {
  const root = process.cwd();
  const libraryDir = getLibraryDir();

  // Before the server starts: the app and the templates must share one React,
  // or the preview renders a blank pane and says nothing about why.
  assertReactPair(config.baseDir, libraryDir);

  const viteConfig: InlineConfig = {
    root: path.resolve(libraryDir, "app"),
    base: "/",
    // The project may have its own vite.config; this server is mailgrail's, and
    // picking that one up would apply its plugins and aliases to the preview.
    configFile: false,
    resolve: {
      // One React, the project's. The app and the templates each resolve it
      // from a different directory, and two copies render nothing at all.
      dedupe: ["react", "react-dom"],
    },
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
      MailgrailCatalogsPlugin(config),
    ],
    assetsInclude: ["**/*.png", "**/*.jpg", "**/*.jpeg", "**/*.svg"],
    optimizeDeps: {
      // The preview app is served from inside node_modules, so Vite would
      // otherwise treat it as a dependency and hand it to esbuild to
      // pre-bundle -- which cannot resolve the virtual modules our plugins
      // provide. Skipping the scan leaves them to the plugins at request time.
      entries: [],
      exclude: [
        "virtual:mailgrailconfig",
        "virtual:mailgrailtemplates",
        "virtual:mailgrailcatalogs",
      ],
      // Vite skips dependency discovery for importers inside node_modules,
      // which the preview app is. Without this the browser would be served
      // React's raw CommonJS and fail; listing it here prebundles it once and
      // hands the same copy to the app and to the templates.
      include: [
        "react",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "react-dom",
        "react-dom/client",
        "react-dom/server",
        "@faire/mjml-react",
      ],
    },
  };

  const server = await createServer(viteConfig);

  watchMailgrailConfig(server, config.configPath);

  await server.listen();
  server.printUrls();

  // Vite moves to the next free port when the configured one is taken, and
  // says so only in the URL it prints. With another project's preview already
  // holding 7777, that reads as "my migration did not work" -- so say it
  // plainly instead.
  const address = server.httpServer?.address();
  const port =
    typeof address === "object" && address !== null ? address.port : undefined;

  if (port !== undefined && port !== config.previewPort) {
    console.warn(
      `\nPort ${config.previewPort} is in use — preview is running on ` +
        `http://127.0.0.1:${port}\n`,
    );
  }

  return server;
}
