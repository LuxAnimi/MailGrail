import { defineConfig } from "../src/config";

//------------------------------------------------------------------------------
export default defineConfig({
  sourceDir: "emails",
  outputDir: "dist",
  typescript: true,
  previewPort: 7777,
});
