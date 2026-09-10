import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

//------------------------------------------------------------------------------
export default defineConfig([
  globalIgnores(["dist"]),
  {
    ignores: [
      "./lib/**/*",
      // Astro's generated types and build output. Not ours to lint, and the
      // triple-slash reference it emits trips the recommended ruleset.
      "website/.astro/**",
      "website/dist/**",
    ],
  },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Allow `any`
      "@typescript-eslint/no-explicit-any": "off",

      // Allow unused parameters
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          args: "none",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
]);
