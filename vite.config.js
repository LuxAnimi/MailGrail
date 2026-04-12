import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

//------------------------------------------------------------------------------
import { MailgrailTemplatesPlugin } from "./src/plugins/template-loader";
import { MailgrailConfigPlugin } from "./src/plugins/config-loader";

//------------------------------------------------------------------------------
import { loadMailgrailConfig } from "./src/config/loadConfig";

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------

export default defineConfig(async () => {
  const mailgrailConfigPath = process.env.MAILGRAIL_CONFIG;
  const mailgrailBasePath = process.env.MAILGRAIL_BASEPATH || "app";
  const mailgrailConfig = await loadMailgrailConfig(mailgrailConfigPath);

  return {
    root: mailgrailBasePath,
    plugins: [
      react(),
      MailgrailConfigPlugin(mailgrailConfig),
      MailgrailTemplatesPlugin(mailgrailConfig.sourceDir),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, mailgrailBasePath),
      },
    },
    // Optional: configure asset handling
    assetsInclude: ["**/*.png", "**/*.jpg", "**/*.jpeg", "**/*.svg"],
  };
});
