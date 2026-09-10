import path from "node:path";
import { fileURLToPath } from "node:url";

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
/**
 * Absolute path to the package's build output root (`lib/`), which is where the
 * bundled preview app lives (`lib/app`).
 *
 * This file is emitted to `lib/src/cli/utils.js`, so the root is always exactly
 * two levels up. Resolving it structurally keeps this correct regardless of
 * where the package is installed and on any path separator.
 */
export const getLibraryDir = () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..", "..");
};
