//------------------------------------------------------------------------------
// Make sure website/node_modules exists before running Astro.
//
// website/ is deliberately NOT a root workspace: Astro brings its own React,
// and as a workspace that copy would hoist into the root node_modules, in
// front of the one the library, example/ and the tests resolve. The cost of
// that choice is that a root `npm install` leaves this directory empty, and
// the first thing you see is `astro: command not found`, which explains
// nothing about why.
//
// So install it here, once, and say what happened.
//------------------------------------------------------------------------------
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const website = path.resolve(here, "..");

if (existsSync(path.join(website, "node_modules", "astro"))) {
  process.exit(0);
}

console.log(
  "\nwebsite/node_modules is empty — installing it now.\n" +
    "(website/ keeps its own lockfile and is not a root workspace, so a root\n" +
    " `npm install` does not cover it. This runs once.)\n",
);

// Honour the lockfile when there is one.
const useCi = existsSync(path.join(website, "package-lock.json"));

const result = spawnSync(
  process.platform === "win32" ? "npm.cmd" : "npm",
  [useCi ? "ci" : "install"],
  { cwd: website, stdio: "inherit" },
);

if (result.status !== 0) {
  console.error(
    "\nCould not install the website's dependencies.\n" +
      "Run it yourself with:  npm install --prefix website\n",
  );
  process.exit(result.status ?? 1);
}
