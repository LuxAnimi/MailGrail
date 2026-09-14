//------------------------------------------------------------------------------
// Assert the installer's hand-off actually lands somewhere, against the built
// site rather than against the source tree.
//
// A content file existing is not the same as a route working: `base`,
// `trailingSlash` and `build.format` all sit between the two, and that gap is
// exactly how a Pages deploy breaks while `astro dev` looks fine -- the failure
// src/lib/href.ts's header comment was written about.
//
// The check that matters most is the last one. `npm create @luxanimi/mailgrail` prints
// a URL that every published copy of that package hard-codes forever, so if the
// site stops serving it, previously-installed scaffolders send people to a 404
// and there is no way to recall them.
//
// Runs from website/package.json's `build`, so both CI jobs already cover it.
//------------------------------------------------------------------------------
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const WEBSITE = path.resolve(here, "..");
const REPO = path.resolve(WEBSITE, "..");
const DIST = path.join(WEBSITE, "dist");

const problems = [];

// Read once: both the redirect check and the scaffolder check need these.
const config = readFileSync(path.join(WEBSITE, "astro.config.mjs"), "utf8");
const site = config.match(/site:\s*"([^"]+)"/)?.[1];
const base = config.match(/base:\s*"([^"]+)"/)?.[1];

if (!site || !base) {
  console.error("\ncheck-handoff: could not read `site` / `base` from astro.config.mjs\n");
  process.exit(1);
}

//------------------------------------------------------------------------------
function mustExist(rel, why) {
  if (!existsSync(path.join(DIST, rel))) {
    problems.push(`dist/${rel} was not built — ${why}`);
    return false;
  }
  return true;
}

//------------------------------------------------------------------------------
// 1. The alias, and the page it forwards to.
if (mustExist("setup/index.html", "the installer's hand-off URL would 404")) {
  const html = readFileSync(path.join(DIST, "setup/index.html"), "utf8");

  // Astro writes a meta refresh for a static redirect. Read the destination back
  // out rather than trusting the config: this is the value browsers actually
  // follow.
  const target = html.match(/url=([^"'>\s]+)/i)?.[1];

  if (!target) {
    problems.push("dist/setup/index.html has no redirect target");
  } else if (!target.startsWith(`${base}/`)) {
    // Astro does not prepend `base` to a redirect destination, so a target
    // written without it points off the deployment while still looking correct
    // in `astro dev`. That is the whole reason this script exists.
    problems.push(
      `/setup forwards to ${target}, which is missing the ${base} base — ` +
        `it would leave the site entirely`,
    );
  } else {
    // "/MailGrail/docs/x" -> "docs/x/index.html" inside dist.
    const rel = target.slice(base.length).replace(/^\//, "");
    if (!existsSync(path.join(DIST, rel, "index.html"))) {
      problems.push(`/setup forwards to ${target}, which was not built`);
    }
  }
}

//------------------------------------------------------------------------------
// 2. The pages the docs trail depends on.
mustExist(
  "docs/getting-started/build-integration/index.html",
  "the build-integration page is the hand-off destination",
);
mustExist(
  "docs/getting-started/manual-setup/index.html",
  "the by-hand setup path would be unreachable",
);
mustExist("docs/index.html", "a truncated /docs URL would 404");

//------------------------------------------------------------------------------
// 3. The scaffolder and the site have to agree on the URL. This is the one that
//    protects users who installed an older copy of the package.
const handoff = readFileSync(
  path.join(REPO, "packages/create-mailgrail/src/handoff.ts"),
  "utf8",
);
const printed = handoff.match(/HANDOFF_URL\s*=\s*"([^"]+)"/)?.[1];

if (!printed) {
  problems.push(
    "could not read HANDOFF_URL from the scaffolder — this check needs updating",
  );
} else {
  const expected = `${site}${base}/setup`;
  if (printed !== expected) {
    problems.push(
      `the scaffolder prints ${printed}, but this site is served at ${expected}`,
    );
  }
}

//------------------------------------------------------------------------------
if (problems.length) {
  console.error("\nthe installer hand-off is broken:\n");
  for (const p of problems) console.error(`  - ${p}`);
  console.error("");
  process.exit(1);
}

console.log("check-handoff: /setup resolves, and the scaffolder agrees on the URL");
