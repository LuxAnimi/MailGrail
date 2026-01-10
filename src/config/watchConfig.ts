import type { ViteDevServer } from "vite";

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
export function watchMailgrailConfig(
  server: ViteDevServer,
  configPath: string,
) {
  server.watcher.add(configPath);

  server.watcher.on("change", (file) => {
    if (file === configPath) {
      console.log(
        "mailgrail.config.ts changed - restarting Mailgrail dev server...",
      );
      process.exit(0);
    }
  });
}
