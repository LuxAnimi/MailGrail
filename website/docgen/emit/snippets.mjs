//------------------------------------------------------------------------------
// Snippets, extracted from example/ by region marker.
//
// example/ is typechecked by tsconfig.example.json, so every snippet on the
// site is code that actually compiles -- and a permalink points at the file it
// came from. Deep relative imports are rewritten to the public specifiers, and
// each rewrite target is validated against the package's real `exports`.
//------------------------------------------------------------------------------
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { emitJson } from "../util/json.mjs";
import { extractRegions, rewriteImports } from "../util/regions.mjs";

const LANG = { ".ts": "ts", ".tsx": "tsx", ".js": "js", ".mjs": "js" };

export async function emitSnippets({ repo, out, check }) {
  const config = (
    await import(
      path.join(repo, "website/docgen/manifests/snippets.config.mjs")
    )
  ).default;

  const pkg = JSON.parse(readFileSync(path.join(repo, "package.json"), "utf8"));
  const problems = [];

  //----------------------------------------------------------------------------
  // Every rewrite target must be a real entry point.
  const exported = new Set(
    Object.keys(pkg.exports ?? {}).map((k) =>
      k === "." ? pkg.name : path.posix.join(pkg.name, k.replace(/^\.\//, "")),
    ),
  );

  for (const target of new Set(Object.values(config.importRewrites))) {
    if (!exported.has(target)) {
      problems.push(
        `snippets: rewrite target "${target}" is not in package.json exports ` +
          `(${[...exported].sort().join(", ")})`,
      );
    }
  }

  //----------------------------------------------------------------------------
  const snippets = {};

  for (const rel of config.files) {
    const abs = path.join(repo, rel);

    let source;
    try {
      source = readFileSync(abs, "utf8");
    } catch {
      problems.push(`snippets: ${rel} is listed but does not exist`);
      continue;
    }

    const regions = extractRegions(source, { file: rel });

    for (const [id, region] of regions) {
      if (snippets[id]) {
        problems.push(
          `snippets: duplicate id "${id}" in ${rel} and ${snippets[id].file}`,
        );
        continue;
      }

      snippets[id] = {
        id,
        file: rel,
        lang: LANG[path.extname(rel)] ?? "txt",
        startLine: region.startLine,
        endLine: region.endLine,
        code: rewriteImports(region.code, config.importRewrites),
        // Permalink to a branch, not a SHA: a SHA would make every commit a
        // docs change and --check would fail on every push.
        href: `${config.repoUrl}/${rel}#L${region.startLine}-L${region.endLine}`,
      };
    }
  }

  //----------------------------------------------------------------------------
  // Every <Snippet id="..."> in the docs must resolve. This catches a deleted
  // region at generate time rather than as an empty box on the page.
  const referenced = collectReferences(path.join(repo, "website/src/content/docs"));

  for (const { id, file } of referenced) {
    if (!snippets[id]) {
      problems.push(`snippets: ${file} references <Snippet id="${id}"> which does not exist`);
    }
  }

  const diff = emitJson(path.join(out, "snippets.json"), snippets, { check });

  return { problems, diffs: diff ? [{ file: "snippets.json", diff }] : [] };
}

//------------------------------------------------------------------------------
function collectReferences(dir) {
  const found = [];

  const walk = (d) => {
    let entries;
    try {
      entries = readdirSync(d);
    } catch {
      return;
    }

    for (const entry of entries) {
      const full = path.join(d, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.mdx?$/.test(entry)) continue;

      const text = readFileSync(full, "utf8");
      for (const m of text.matchAll(/<Snippet\s+[^>]*id="([^"]+)"/g)) {
        found.push({ id: m[1], file: path.basename(full) });
      }
    }
  };

  walk(dir);
  return found;
}
