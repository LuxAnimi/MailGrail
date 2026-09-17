import fs from "node:fs";
import path from "node:path";

//------------------------------------------------------------------------------
import type { ProjectInfo } from "../config/types.js";

//------------------------------------------------------------------------------
// Who the preview belongs to.
//
// The preview header used to be MailGrail's own name and tagline, which told
// the person looking at it nothing -- and with two preview servers open, which
// project each one belonged to was anybody's guess. The project's package.json
// already says, so read it from there.
//------------------------------------------------------------------------------
export type { ProjectInfo };

const NONE: ProjectInfo = { name: null, description: null };

//------------------------------------------------------------------------------
const stringOrNull = (value: unknown): string | null =>
  typeof value === "string" && value.trim() !== "" ? value : null;

//------------------------------------------------------------------------------
// Walks up from the config's directory, like Node's own resolution. Nothing
// here is worth failing a preview over, so anything unreadable or malformed
// just means no name.
//------------------------------------------------------------------------------
export function readProjectInfo(baseDir: string): ProjectInfo {
  let dir = path.resolve(baseDir);

  for (;;) {
    const file = path.join(dir, "package.json");

    let raw: string | null = null;
    try {
      raw = fs.readFileSync(file, "utf8");
    } catch {
      // No package.json here; keep walking up.
    }

    if (raw !== null) {
      try {
        const pkg = JSON.parse(raw) as Record<string, unknown>;

        return {
          name: stringOrNull(pkg["name"]),
          description: stringOrNull(pkg["description"]),
        };
      } catch {
        // Found it, but it is not valid JSON. A parent's name would be the
        // wrong answer, so stop here.
        return NONE;
      }
    }

    const parent = path.dirname(dir);
    if (parent === dir) return NONE;
    dir = parent;
  }
}
