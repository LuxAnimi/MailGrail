//------------------------------------------------------------------------------
// Deterministic JSON output.
//
// The generated files are committed, and `--check` compares them byte for byte,
// so anything non-deterministic turns every CI run into a false alarm. Rules:
// sorted keys, fixed indentation, trailing newline, and never a timestamp or an
// absolute path.
//------------------------------------------------------------------------------
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

//------------------------------------------------------------------------------
/** JSON.stringify with object keys sorted, recursively. Arrays keep order. */
export function stableStringify(value) {
  const sort = (v) => {
    if (Array.isArray(v)) return v.map(sort);
    if (v && typeof v === "object" && v.constructor === Object) {
      return Object.fromEntries(
        Object.keys(v)
          .sort()
          .map((k) => [k, sort(v[k])]),
      );
    }
    return v;
  };

  return `${JSON.stringify(sort(value), null, 2)}\n`;
}

//------------------------------------------------------------------------------
/**
 * Write `value` to `file`, or in check mode compare and report.
 * Returns null when in sync, otherwise a human-readable description.
 */
export function emitJson(file, value, { check }) {
  const next = stableStringify(value);

  if (!check) {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, next, "utf8");
    return null;
  }

  if (!existsSync(file)) return `missing (never generated)`;

  const current = readFileSync(file, "utf8");
  if (current === next) return null;

  return describeDiff(current, next);
}

//------------------------------------------------------------------------------
/** First differing line, with a little context. Enough to see what moved. */
function describeDiff(current, next) {
  const a = current.split("\n");
  const b = next.split("\n");
  const max = Math.max(a.length, b.length);

  for (let i = 0; i < max; i++) {
    if (a[i] === b[i]) continue;

    const at = i + 1;
    const lines = [`differs at line ${at}`];
    if (a[i] !== undefined) lines.push(`      committed: ${a[i].trim()}`);
    if (b[i] !== undefined) lines.push(`      generated: ${b[i].trim()}`);
    return lines.join("\n");
  }

  return `differs in length (${a.length} vs ${b.length} lines)`;
}

//------------------------------------------------------------------------------
/**
 * Compare two name sets both ways. This is the check that actually protects the
 * docs: byte equality only proves the JSON matches itself, while this proves the
 * docs still cover the source. A new `t.date()` fails here.
 */
export function compareCoverage(what, runtime, documented) {
  const r = new Set(runtime);
  const d = new Set(documented);

  const undocumented = [...r].filter((k) => !d.has(k)).sort();
  const phantom = [...d].filter((k) => !r.has(k)).sort();

  const problems = [];
  if (undocumented.length) {
    problems.push(`${what}: undocumented in the site -> ${undocumented.join(", ")}`);
  }
  if (phantom.length) {
    problems.push(`${what}: documented but gone from the source -> ${phantom.join(", ")}`);
  }

  return problems;
}
