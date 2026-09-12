//------------------------------------------------------------------------------
// Package facts the site quotes: version, supported Node, repository links,
// and the install commands. Read from package.json so a release cannot leave
// the site advertising an old version.
//------------------------------------------------------------------------------
import { readFileSync } from "node:fs";
import path from "node:path";

import { emitJson } from "../util/json.mjs";

export async function emitMeta({ repo, out, check }) {
  const pkg = JSON.parse(readFileSync(path.join(repo, "package.json"), "utf8"));
  const setup = JSON.parse(
    readFileSync(
      path.join(repo, "packages/setup-mailgrail-app/package.json"),
      "utf8",
    ),
  );

  const repoUrl = (pkg.repository?.url ?? "")
    .replace(/^git\+/, "")
    .replace(/\.git$/, "");

  const meta = {
    name: pkg.name,
    version: pkg.version,
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
      command: `npx ${setup.name}@latest`,
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
