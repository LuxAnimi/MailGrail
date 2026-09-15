//------------------------------------------------------------------------------
// The configuration reference, plus the engine support matrix.
//
// Defaults come from calling resolveConfig({}) rather than from a table someone
// keeps in step by hand. Engine version ranges come from the root
// package.json's peerDependencies. Both have already drifted in the README.
//------------------------------------------------------------------------------
import { readFileSync } from "node:fs";
import path from "node:path";

import { loadManifest } from "../load.mjs";
import { emitJson, compareCoverage } from "../util/json.mjs";

// Present in the resolved config but not user-facing: derived, not configured.
const DERIVED = new Set(["baseDir", "configPath"]);

export async function emitConfig({ repo, out, check, lib }) {
  const { resolveConfig } = await import(
    path.join(lib, "src/config/resolveConfig.js")
  );

  const { configDocs } = await loadManifest(
    path.join(repo, "website/docgen/manifests/config.manifest.ts"),
  );

  // A virtual project rooted at "/" so the resolved absolute paths can be
  // relativized back to what a user would actually write. Committed JSON must
  // never contain a machine-specific path.
  const resolved = resolveConfig({}, "/mailgrail.config.ts", "/");

  const defaults = Object.fromEntries(
    Object.entries(resolved)
      .filter(([k]) => !DERIVED.has(k))
      .map(([k, v]) => [k, relativize(v)]),
  );

  const options = configDocs.map((doc) => {
    if (!(doc.id in defaults)) {
      throw new Error(
        `config.manifest documents "${doc.id}", which resolveConfig does not produce`,
      );
    }

    return {
      id: doc.id,
      type: doc.type,
      summary: doc.summary,
      description: doc.description ?? null,
      default: defaults[doc.id],
    };
  });

  const problems = compareCoverage(
    "config options",
    Object.keys(defaults),
    options.map((o) => o.id),
  );

  //----------------------------------------------------------------------------
  // Engine matrix, from the package's own declared peer ranges.
  const pkg = JSON.parse(readFileSync(path.join(repo, "package.json"), "utf8"));
  const peers = pkg.peerDependencies ?? {};

  const engines = [
    { id: "EJS", module: "ejs", ext: "ejs" },
    { id: "Handlebars", module: "handlebars", ext: "hbs" },
    { id: "Mustache", module: "mustache", ext: "mustache" },
  ].map((e) => ({
    ...e,
    range: peers[e.module] ?? null,
    isDefault: e.id === defaults.templatingEngine,
  }));

  const missing = engines.filter((e) => !e.range).map((e) => e.module);
  if (missing.length) {
    problems.push(
      `engine matrix: no peerDependency range declared for ${missing.join(", ")}`,
    );
  }

  const diffs = [];
  const d1 = emitJson(path.join(out, "config.json"), { options }, { check });
  if (d1) diffs.push({ file: "config.json", diff: d1 });

  const d2 = emitJson(
    path.join(out, "engines.json"),
    { engines, node: pkg.engines?.node ?? null },
    { check },
  );
  if (d2) diffs.push({ file: "engines.json", diff: d2 });

  return { problems, diffs };
}

//------------------------------------------------------------------------------
/** "/emails" -> "./emails". Keeps the output free of absolute paths. */
function relativize(value) {
  if (typeof value !== "string" || !value.startsWith("/")) return value;
  const rest = value.slice(1);
  return rest ? `./${rest}` : "./";
}
