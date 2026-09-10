import path from "node:path";
import { fileURLToPath } from "node:url";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import postcss from "rollup-plugin-postcss";
import alias from "@rollup/plugin-alias";
import json from "@rollup/plugin-json";
import html from "@rollup/plugin-html";
import terser from "@rollup/plugin-terser";

//------------------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
export default  [{
  input: {"index": "src/preview-app/index.tsx"},

  output: {
    dir: "dist-src",
    format: "esm",
    // The preview app ships inside the npm tarball; sourcemaps for it would
    // more than triple the package size for no consumer benefit.
    sourcemap: false,
  },

  external: [
    "virtual:mailgrailtemplates",
    "virtual:mailgrailconfig"
  ],

  plugins: [
    resolve({ browser: true, extensions: [".js", ".ts", ".tsx"] }),
    alias({
      entries: [
        { find: "@", replacement: path.resolve(__dirname, "src") }
      ]
    }),
    commonjs(),
    typescript({
      tsconfig: "./tsconfig.rollup.json",
    }),
    postcss({
      extensions: [".scss", ".css"],
      extract: "styles.css",
      minimize: true,
      sourceMap: false,
      use: ["sass"],
    }),
    html({
      template: ({ files }) => `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Mailgrail Preview</title>
    ${files.css.map(f => `<link rel="stylesheet" href="${f.fileName}" />`).join("\n")}
  <!-- Standard favicon -->
  <link rel="icon" type="image/png" sizes="32x32" href="/preview-app/assets/favicon-32x32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="/preview-app/assets/favicon-16x16.png">
  <link rel="shortcut icon" href="/preview-app/assets/favicon.ico">

  <!-- Apple touch icon -->
  <link rel="apple-touch-icon" sizes="180x180" href="/preview-app/assets/apple-touch-icon.png">

  <!-- Android / Chrome -->
  <link rel="icon" type="image/png" sizes="192x192" href="/preview-app/assets/android-chrome-192x192.png">
  <link rel="icon" type="image/png" sizes="512x512" href="/preview-app/assets/android-chrome-512x512.png">

  <!-- Optional JPG fallback (not standard, some old clients) -->
  <link rel="icon" type="image/jpeg" href="/preview-app/assets/favicon.jpg">

  <!-- Web manifest -->
  <link rel="manifest" href="/preview-app/assets/site.webmanifest">

  <!-- Optional theme color (used by some browsers for UI) -->
  <meta name="theme-color" content="#ffffff">
  </head>
  <body>
    <div id="root"></div>
    ${files.js.map(f => `<script type="module" src="${f.fileName}"></script>`).join("\n")}
  </body>
</html>
`,
    }),
    terser(),
  ]
}];
