import { defineConfig } from "../../../lib/src/config/index.js";

// For trying the localized preview by hand:
//   node lib/bin/mailgrail.js preview --configPath test/fixtures/i18n-project/mailgrail.config.ts
// test/i18n-build.test.js builds the same project with its own config.
export default defineConfig({
  sourceDir: "emails-src",
  outputDir: "emails-dist",
  previewPort: 7788,
  locales: ["en", "fr", "ar"],
});
