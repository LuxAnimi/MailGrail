import { defineConfig } from "../src/config";

//------------------------------------------------------------------------------
// #region doc:config-file
export default defineConfig({
  sourceDir: "emails-src",
  outputDir: "emails-dist",
  typescript: true,
  previewPort: 7777,
  // The title in the preview's sidebar. Defaults to package.json's name.
  appName: "MailGrail",
  // Optional: build every template in each of these languages. The first is
  // the one the messages are written in.
  locales: ["en", "fr", "es"],
});
// #endregion doc:config-file
