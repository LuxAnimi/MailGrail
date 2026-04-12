import path from "path";
import fs from "fs";
import type { Plugin } from "vite";

//------------------------------------------------------------------------------
const INDEX_CANDIDATES = [
  "index.ts",
  "index.tsx",
  "index.js",
  "index.jsx",
] as const;

//------------------------------------------------------------------------------
function fileExists(p: string) {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

//------------------------------------------------------------------------------
function assertDir(p: string) {
  try {
    if (!fs.statSync(p).isDirectory()) {
      throw new Error(`MailgrailTemplatesPlugin: "${p}" is not a directory`);
    }
  } catch {
    throw new Error(`MailgrailTemplatesPlugin: directory not found: "${p}"`);
  }
}

//------------------------------------------------------------------------------
function findIndexFile(dir: string): string {
  for (const name of INDEX_CANDIDATES) {
    const full = path.join(dir, name);
    if (fileExists(full)) return full;
  }
  throw new Error(
    `MailgrailTemplatesPlugin: no index file found in "${dir}". ` +
      `Expected one of: ${INDEX_CANDIDATES.join(", ")}`,
  );
}

//------------------------------------------------------------------------------
function isDir(p: string) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

//------------------------------------------------------------------------------
function walk(dir: string, exts: Set<string>, out: string[] = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, exts, out);
    else if (exts.has(path.extname(entry.name))) out.push(full);
  }
  return out;
}

//------------------------------------------------------------------------------
function toFsImportId(absPath: string) {
  // Vite-friendly absolute fs import id
  return "/@fs/" + absPath;
}

//------------------------------------------------------------------------------
export function MailgrailTemplatesPlugin(templatesPath: string): Plugin {
  const dir = path.resolve(templatesPath);
  assertDir(dir);

  const indexPath = findIndexFile(dir);

  const resolvedPath = path.resolve(indexPath);
  const virtualId = "virtual:mailgrailtemplates";
  const resolvedVirtualId = "\0" + virtualId;

  const exts = new Set([".ts", ".tsx", ".js", ".jsx"]);
  const ignored = new Set(["index.ts", "index.tsx", "index.js", "index.jsx"]);

  function templateFiles(): string[] {
    if (!isDir(resolvedPath)) return [resolvedPath];
    return walk(resolvedPath, exts).filter(
      (f) => !ignored.has(path.basename(f)),
    );
  }

  return {
    name: "mailgrail-templates",
    enforce: "pre",

    resolveId(id) {
      if (id === virtualId) return resolvedVirtualId;
    },

    load(id) {
      if (id !== resolvedVirtualId) return;

      const files = templateFiles();

      // Watch all template files
      for (const f of files) this.addWatchFile(f);
      this.addWatchFile(indexPath);

      // If templatesPath is a single file, just re-export its templates
      if (!isDir(resolvedPath)) {
        const fsId = toFsImportId(resolvedPath);
        return `export { templates } from ${JSON.stringify(fsId)};`;
      }

      // Directory mode: import each file as a module
      // Expect each file to default-export a template definition.
      const imports = files
        .map((f, i) => `import t${i} from ${JSON.stringify(toFsImportId(f))};`)
        .join("\n");

      const items = files
        .map((f, i) => {
          const fallbackName = path.basename(f, path.extname(f));
          // prefer t.name if present, otherwise filename
          return `({ ...(t${i} as any), name: (t${i} as any).name ?? ${JSON.stringify(fallbackName)} })`;
        })
        .join(",\n");

      return `
${imports}

export const templates = [
${items}
];
      `;
    },

    handleHotUpdate(ctx) {
      // If any template file changes, invalidate the virtual module
      const files = templateFiles();
      if (!files.includes(ctx.file)) return;

      const mod = ctx.server.moduleGraph.getModuleById(resolvedVirtualId);
      if (mod) {
        ctx.server.moduleGraph.invalidateModule(mod);
        return [mod];
      }
    },
  };
}
