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
  const mailgrailConfig = await loadMailgrailConfig(
    "./example/mailgrail.config.ts",
  );

  return {
    root: "./src",
    plugins: [
      react(),
      MailgrailConfigPlugin(mailgrailConfig),
      MailgrailTemplatesPlugin(mailgrailConfig.sourceDir),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    // Optional: configure asset handling
    assetsInclude: ["**/*.png", "**/*.jpg", "**/*.jpeg", "**/*.svg"],
  };
});
