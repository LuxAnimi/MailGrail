//------------------------------------------------------------------------------
// Region extraction.
//
// Snippets shown on the site are pulled out of real, typechecked files by
// marker, so there is never a second copy to drift:
//
//   // #region doc:welcome-schema
//   const paramsSchema = t.object({ ... });
//   // #endregion doc:welcome-schema
//
// The `doc:` prefix namespaces these against any other use of #region, which
// editors fold and neither ESLint nor Prettier touch.
//------------------------------------------------------------------------------
const START = /^\s*\/\/\s*#region\s+doc:([A-Za-z0-9_-]+)\s*$/;
const END = /^\s*\/\/\s*#endregion\s+doc:([A-Za-z0-9_-]+)\s*$/;

//------------------------------------------------------------------------------
/**
 * @returns Map<id, { code, startLine, endLine }>
 * @throws on a duplicate id, an unterminated region, or a mismatched close --
 *         all of which mean the snippet on the page would be wrong.
 */
export function extractRegions(source, { file }) {
  const lines = source.split("\n");
  const out = new Map();
  const open = [];

  lines.forEach((line, i) => {
    const start = START.exec(line);
    if (start) {
      const id = start[1];
      if (out.has(id) || open.some((o) => o.id === id)) {
        throw new Error(`${file}:${i + 1}: duplicate region "doc:${id}"`);
      }
      open.push({ id, from: i });
      return;
    }

    const end = END.exec(line);
    if (!end) return;

    const id = end[1];
    const top = open.pop();

    if (!top) {
      throw new Error(`${file}:${i + 1}: #endregion doc:${id} with no open region`);
    }
    if (top.id !== id) {
      throw new Error(
        `${file}:${i + 1}: #endregion doc:${id} closes doc:${top.id}`,
      );
    }

    // Nested markers are structure, not content -- drop them from the body.
    const body = lines
      .slice(top.from + 1, i)
      .filter((l) => !START.test(l) && !END.test(l));

    out.set(id, {
      code: dedent(body).join("\n").replace(/\s+$/, ""),
      startLine: top.from + 2,
      endLine: i,
    });
  });

  if (open.length) {
    const { id, from } = open[0];
    throw new Error(`${file}:${from + 1}: region "doc:${id}" is never closed`);
  }

  return out;
}

//------------------------------------------------------------------------------
function dedent(lines) {
  const indents = lines
    .filter((l) => l.trim().length > 0)
    .map((l) => l.match(/^[ \t]*/)[0].length);

  const strip = indents.length ? Math.min(...indents) : 0;
  return lines.map((l) => l.slice(strip));
}

//------------------------------------------------------------------------------
/**
 * Rewrite the deep relative imports the example/ templates use into the public
 * specifiers a reader can actually type. Without this the site would teach an
 * import path that only exists inside this repo.
 */
export function rewriteImports(code, map) {
  let out = code;

  for (const [from, to] of Object.entries(map)) {
    // Only touch a complete specifier inside quotes.
    const re = new RegExp(`(["'])${escapeRe(from)}\\1`, "g");
    out = out.replace(re, `"${to}"`);
  }

  return out;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
