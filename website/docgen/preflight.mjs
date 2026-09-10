//------------------------------------------------------------------------------
// The generators import mailgrail's real compiler from lib/, which is a build
// artifact and gitignored. Missing, it produces an opaque ERR_MODULE_NOT_FOUND
// several frames deep. Say what to run instead.
//------------------------------------------------------------------------------
import { existsSync } from "node:fs";
import path from "node:path";

const REQUIRED = [
  "lib/src/cli/emit-types.js",
  "lib/src/cli/rendering/schema-rendering.js",
  "lib/src/cli/rendering/schema-previewing.js",
  "lib/src/dsl/index.js",
  "lib/src/config/resolveConfig.js",
];

export function preflight(repo) {
  const missing = REQUIRED.filter((f) => !existsSync(path.join(repo, f)));

  if (missing.length) {
    throw new Error(
      `mailgrail's compiled library is not present -- docgen reads the real\n` +
        `compiler rather than reimplementing it.\n\n` +
        `  missing: ${missing[0]}\n\n` +
        `Run:  npm run build\n`,
    );
  }
}
