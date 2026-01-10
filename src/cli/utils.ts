import path from "node:path";
import { fileURLToPath } from "node:url";

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
export const getLibraryDir = () => {
  if (typeof __dirname !== "undefined") {
    return __dirname;
  } else {
    const p = path.dirname(fileURLToPath(import.meta.url));
    const libPos = p.indexOf(`/lib/`);
    return libPos >= 0 ? p.slice(0, libPos + 4) : p;
  }
};
