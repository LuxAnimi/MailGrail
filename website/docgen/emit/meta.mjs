//------------------------------------------------------------------------------
// Package facts the site quotes: supported Node, repository links, and the
// install commands. Read from package.json so the site cannot drift from it.
//
// The version is not here. It changes on every release, so a committed copy
// failed `--check` after each `npm version`; the site reads it straight from
// package.json instead (website/src/lib/version.ts).
//------------------------------------------------------------------------------
import { readFileSync } from "node:fs";
import path from "node:path";

import { emitJson } from "../util/json.mjs";

//------------------------------------------------------------------------------
/** The documented invocation for the scaffolder, derived from its package name. */
function setupCommand(name) {
  const scoped = name.match(/^(@[^/]+)\/create-(.+)$/);
  if (scoped) return `npm create ${scoped[1]}/${scoped[2]}`;

  const bare = name.match(/^create-(.+)$/);
  if (bare) return `npm create ${bare[1]}`;

  return `npx ${name}@latest`;
}

export async function emitMeta({ repo, out, check }) {
  const pkg = JSON.parse(readFileSync(path.join(repo, "package.json"), "utf8"));
  const setup = JSON.parse(
    readFileSync(
      path.join(repo, "packages/create-mailgrail/package.json"),
      "utf8",
    ),
  );

  const repoUrl = (pkg.repository?.url ?? "")
    .replace(/^git\+/, "")
    .replace(/\.git$/, "");

  const meta = {
    name: pkg.name,
    description: pkg.description,
    license: pkg.license,
    author: typeof pkg.author === "string" ? pkg.author : (pkg.author?.name ?? null),
    node: pkg.engines?.node ?? null,
    repoUrl,
    issuesUrl: pkg.bugs?.url ?? null,
    npmUrl: `https://www.npmjs.com/package/${pkg.name}`,
    keywords: pkg.keywords ?? [],
    setup: {
      name: setup.name,
      // `npm create @scope/x` resolves to `@scope/create-x`, so derive the
      // short form from the real package name rather than writing it out --
      // the site then cannot advertise a command that does not map back to
      // what is published.
      command: setupCommand(setup.name),
    },
    install: {
      dev: `npm install --save-dev ${pkg.name}`,
      peers: `npm install ${Object.keys(pkg.peerDependencies ?? {})
        .filter((p) => !["ejs", "handlebars", "mustache"].includes(p))
        .join(" ")} ejs`,
    },
  };

  const diff = emitJson(path.join(out, "meta.json"), meta, { check });

  return { problems: [], diffs: diff ? [{ file: "meta.json", diff }] : [] };
}
