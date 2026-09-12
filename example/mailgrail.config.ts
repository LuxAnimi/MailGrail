import { defineConfig } from "../src/config";

//------------------------------------------------------------------------------
// #region doc:config-file
export default defineConfig({
  sourceDir: "emails-src",
  outputDir: "emails-dist",
  typescript: true,
  previewPort: 7777,
});
// #endregion doc:config-file
