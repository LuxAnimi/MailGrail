//------------------------------------------------------------------------------
// Load a TypeScript / TSX manifest.
//
// The manifests are real TS so they are typechecked and so the fixtures can be
// written as JSX, exactly like the templates they document. esbuild bundles one
// to a temp .mjs which is then imported -- the same pattern mailgrail itself
// uses in config/loadConfig.ts and cli/build-templates.ts, including the
// unlink-in-finally so a throw does not leave the file behind.
//------------------------------------------------------------------------------
import { build } from "esbuild";
import { rmSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export async function loadManifest(file) {
  // Written beside the manifest rather than in os.tmpdir(): the bundle keeps
  // `react` external, and a module in /tmp cannot resolve it -- node walks up
  // from the *importing* file. mailgrail's own loader does the same thing for
  // the same reason.
  const out = path.join(
    path.dirname(file),
    `.${path.basename(file)}.docgen.mjs`,
  );

  try {
    await build({
      entryPoints: [file],
      outfile: out,
      bundle: true,
      platform: "node",
      format: "esm",
      sourcemap: false,
      jsx: "automatic",
      jsxImportSource: "react",
      // Resolved from the repo's own node_modules at run time, not inlined.
      external: ["react", "react-dom", "@faire/mjml-react", "ejs", "handlebars", "mustache"],
      logLevel: "silent",
    });

    return await import(pathToFileURL(out).href);
  } finally {
    // Always clean up, even when esbuild or the import threw -- otherwise the
    // temp file is left behind in the repo.
    rmSync(out, { force: true });
  }
}
