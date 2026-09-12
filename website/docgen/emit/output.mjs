//------------------------------------------------------------------------------
// What `mailgrail build` actually leaves on disk.
//
// The rest of the site can describe the build; this runs it. The real
// buildTemplates compiles the example app into a temp directory and the files
// it writes are read straight back out, so the declarations quoted on the
// landing page are the ones the compiler emits and cannot drift from it.
//
// The point being made is the shape of the output, not the HTML: one render
// function per template, typed end to end, importable from plain Node. The
// engine the template was compiled through is an implementation detail of the
// `.js` -- the signature is identical whichever it is, which is the whole
// argument for the wrapper.
//------------------------------------------------------------------------------
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { emitJson } from "../util/json.mjs";

//------------------------------------------------------------------------------
// How many packages each side of the build actually costs.
//
// Counted off the committed lockfile rather than measured on disk, so the
// number is the same on every machine and --check stays meaningful. It is the
// hoisted closure: every package reachable through `dependencies` from the
// named roots. Optional and peer edges are not followed, which is what a plain
// `npm install <engine>` would pull.
function closure(packages, roots) {
  const seen = new Set();
  const stack = [...roots];
  while (stack.length) {
    const name = stack.pop();
    if (seen.has(name)) continue;
    const entry = packages[`node_modules/${name}`];
    if (!entry) continue;
    seen.add(name);
    for (const dep of Object.keys(entry.dependencies ?? {})) stack.push(dep);
  }
  return [...seen].sort();
}

// The showcase talks about this one, and it is the example with a nested
// array, an optional and a number -- the params type is worth showing.
const TEMPLATE = "order-confirmation";

// The second showcase contrasts what you author with what the chosen engine
// gets. `welcome` is the one to quote: its opening paragraph puts two
// interpolations in a single readable line, where order-confirmation's are
// buried in a styled table.
const CONTRAST = {
  template: "welcome",
  // The window to quote, bounded by text that survives compilation. It is the
  // same stretch of the email the authored snippet shows, so the two panes are
  // the same thing before and after.
  //
  // It runs to the end of the plan conditional on purpose. Interpolation alone
  // would show three engines spelling the same substitution three ways, which
  // is a trivia question; the conditional is where they actually diverge --
  // Mustache has no else, and emulates it by closing the section and opening
  // its inverse, which is visible in the quoted block and in nothing else on
  // the page.
  from: "Welcome aboard.",
  to: "You are on the",
};

// id is what buildTemplates takes; ext is what it writes. Kept in step with the
// matrix in emit/config.mjs, which reads its ranges from package.json.
const ENGINES = [
  { id: "EJS", ext: "ejs" },
  { id: "Handlebars", ext: "hbs" },
  { id: "Mustache", ext: "mustache" },
];

// A line's text, with the markup and the engine's own syntax taken out. Empty
// means the line is pure scaffolding.
//
// `<%  %>` needs no separate case: `[^>]*` stops at the first `>`, which is the
// one closing the EJS tag.
function textOf(line) {
  return line
    .replace(/<[^>]*>/g, "")
    .replace(/\{\{[^}]*\}\}/g, "")
    .trim();
}

// Any of the engine's own syntax: a substitution or a block marker.
function isEngineSyntax(line) {
  return /<%|\{\{/.test(line);
}

// Narrower: a block marker specifically -- the open, the else or the close.
// Substitution is excluded, and is the reason for the `=`/`-` in the EJS case:
// `<%= x %>` is a value, `<% if %>` is control.
function isControl(line) {
  return /<%[^=-]|\{\{[#/^]|\{\{else/.test(line);
}

// What the chosen engine is handed, for the stretch of the email between the
// two anchors.
//
// Two things come out, and only these two. What is left -- the text, the inline
// markup around it, and every piece of the engine's own syntax -- is character
// for character what the compiler wrote.
//
// **The inline styles.** MJML sets a full font stack on every element, several
// hundred characters a tag, which pushed the block sideways off the pane and
// buried the one thing it is pointing at. Whether a paragraph carries its own
// `font-family` is not in question here. Removing the attribute leaves the
// opening tags spread over the lines it used to occupy, so those are closed up
// after.
//
// **MJML's layout rows.** Every text block is its own table row, so between two
// consecutive paragraphs sit a `</td></tr>` and a `<tr><td>` for a table opened
// eighty lines up. Quoted as-is that reads as closing tags for elements the
// reader never saw open -- it looks like the compiler emitted something broken,
// which is the opposite of the point. The rows are the email's layout and this
// pane is not about the layout; what stays is the content and the control flow.
//
// The alternative was to widen the window until the tags balanced, which means
// quoting the whole table: more scaffolding to make the scaffolding legible.
function contrastExcerpt(source, { from, to }) {
  const lines = source.split("\n");
  let start = lines.findIndex((l) => l.includes(from));
  let end = lines.findIndex((l, i) => i >= start && l.includes(to));
  if (start === -1 || end === -1) return null;

  // MJML prints an element's attributes across several lines, so the line
  // holding the text begins with the bare `>` that closes the opening tag.
  // Walk back to that tag, or the first line opens mid-element.
  while (start > 0 && !lines[start].trim().startsWith("<")) start -= 1;

  // The conditional's closing marker is a few lines past the last paragraph,
  // behind the layout rows that are about to be dropped. Without it the block
  // is quoted opened and never closed.
  for (let i = end + 1; i < lines.length; i += 1) {
    if (!lines[i].trim() || (!textOf(lines[i]) && !isControl(lines[i]))) continue;
    if (isControl(lines[i]) && !textOf(lines[i])) end = i;
    break;
  }

  const kept = lines
    .slice(start, end + 1)
    .join("\n")
    .replace(/\s+style="[^"]*"/g, "")
    // Close up the tags the removal left spread over several lines.
    .replace(/<[a-z][^>]*>/gi, (tag) => tag.replace(/\s+/g, " ").replace(/ >$/, ">"))
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => textOf(l) || isEngineSyntax(l));

  // Left flat rather than re-indented under the conditional. The indentation
  // the rows carried described the table, not the branch, and inventing a new
  // one would be the first thing on the block that the compiler did not write.
  return kept.join("\n");
}

// The top-level members of the emitted params type, read off the declarations.
//
// These are what an editor offers inside the call's braces, which is the whole
// of the completion list the showcase draws. Deriving them here rather than
// writing them into the component is what keeps that list honest: add a field
// to the schema and it appears in the popup, or generation fails.
//
// A member's type can run over several lines -- `items` is an array of an
// object -- so lines are accumulated until the braces opened on the way in have
// closed again, then flattened onto one. The popup is one row per member; how
// the declaration file happens to wrap is not information it carries.
function paramsMembers(dts) {
  const open = dts.indexOf("= {");
  if (open === -1) return [];

  const members = [];
  let buffer = "";
  let depth = 0;

  for (const line of dts.slice(open).split("\n").slice(1)) {
    if (depth === 0 && line.startsWith("}")) break;

    buffer += (buffer ? " " : "") + line.trim();
    depth += (line.match(/{/g) ?? []).length - (line.match(/}/g) ?? []).length;
    if (depth > 0 || !buffer.endsWith(";")) continue;

    const m = buffer.match(/^(\w+)(\??):\s*(.+);$/);
    if (m) members.push({ name: m[1], optional: Boolean(m[2]), type: m[3] });
    buffer = "";
  }
  return members;
}

export async function emitOutput({ repo, out, check, lib }) {
  globalThis.React = await import("react");

  const { buildTemplates } = await import(
    path.join(lib, "src/cli/build-templates.js")
  );
  const { loadMailgrailConfig } = await import(
    path.join(lib, "src/config/loadConfig.js")
  );

  const problems = [];
  const contrast = [];
  const dir = await mkdtemp(path.join(os.tmpdir(), "mailgrail-docgen-"));

  let files;
  let dts;
  let js;
  let outDirName;
  try {
    // The example app's own config, loaded rather than restated -- its
    // outputDir is the directory the call site below tells readers to import
    // from, and a second copy of it here would drift the moment it changed.
    const config = await loadMailgrailConfig(
      path.join(repo, "example/mailgrail.config.ts"),
    );
    outDirName = path.basename(config.outputDir);

    // Built somewhere disposable all the same: generating docs should not
    // leave artifacts in the example app.
    // The engine comes off the config, not from an argument -- buildTemplates
    // calls resolveEngine(config) itself.
    await buildTemplates({ ...config, outputDir: dir });

    files = (await readdir(dir)).sort();
    dts = await readFile(path.join(dir, `${TEMPLATE}.d.ts`), "utf8");
    js = await readFile(path.join(dir, `${TEMPLATE}.js`), "utf8");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }

  //----------------------------------------------------------------------------
  // The same template again through each engine, for the authoring contrast.
  for (const engine of ENGINES) {
    const engineDir = await mkdtemp(path.join(os.tmpdir(), "mailgrail-docgen-"));
    try {
      const config = await loadMailgrailConfig(
        path.join(repo, "example/mailgrail.config.ts"),
      );
      await buildTemplates({
        ...config,
        outputDir: engineDir,
        templatingEngine: engine.id,
      });

      const compiled = await readFile(
        path.join(engineDir, `${CONTRAST.template}.${engine.ext}`),
        "utf8",
      );
      const runtime = await readFile(
        path.join(engineDir, `${CONTRAST.template}.js`),
        "utf8",
      );

      const excerpt = contrastExcerpt(compiled, CONTRAST);
      if (!excerpt) {
        problems.push(
          `output: could not bound the excerpt in ${CONTRAST.template}.${engine.ext}` +
            ` between "${CONTRAST.from}" and "${CONTRAST.to}"`,
        );
      }

      contrast.push({
        id: engine.id,
        ext: engine.ext,
        file: `${CONTRAST.template}.${engine.ext}`,
        excerpt,
        lines: compiled.split("\n").length,
        imports: runtime.match(/^import .+$/gm) ?? [],
      });
    } finally {
      await rm(engineDir, { recursive: true, force: true });
    }
  }

  //----------------------------------------------------------------------------
  // Pull the function and type names out of the declarations rather than
  // recomputing them here. A second implementation of pascal-casing is a second
  // thing to get wrong.
  const fn = dts.match(/export declare function (\w+)\(/)?.[1];
  const type = dts.match(/export type (\w+) =/)?.[1];

  if (!fn) problems.push(`output: no render function found in ${TEMPLATE}.d.ts`);
  if (!type) problems.push(`output: no params type found in ${TEMPLATE}.d.ts`);

  // The emitted .js inlines the whole compiled template as one string, which is
  // tens of kilobytes of MJML and no use on a landing page. What is worth
  // showing is its shape: what it imports and what it exports.
  const imports = js.match(/^import .+$/gm) ?? [];
  const exported = js.match(/^export function \w+\([^)]*\)/gm) ?? [];

  if (!exported.length) {
    problems.push(`output: no exported function found in ${TEMPLATE}.js`);
  }

  //----------------------------------------------------------------------------
  const lock = JSON.parse(
    await readFile(path.join(repo, "package-lock.json"), "utf8"),
  );
  const packages = lock.packages ?? {};

  // What the authoring side costs, and what each engine costs. The first number
  // is only paid at build time; the second is what the server installs.
  const AUTHORING = ["react", "react-dom", "mjml", "@faire/mjml-react"];
  const authoring = closure(packages, AUTHORING);
  if (!authoring.length) {
    problems.push("output: authoring closure came back empty -- lockfile shape changed?");
  }

  for (const engine of contrast) {
    const module = engine.imports[0]?.match(/from "([^"]+)"/)?.[1];
    engine.module = module ?? null;
    engine.packages = module ? closure(packages, [module]).length : null;
    if (!engine.packages) {
      problems.push(`output: could not count packages for ${engine.id}`);
    }
  }

  const byTemplate = {};
  for (const file of files) {
    const name = file.replace(/\.(d\.ts|js|ejs|hbs|mustache)$/, "");
    (byTemplate[name] ??= []).push(file);
  }

  // Split where the caret goes: inside the call's braces, on a line of its own.
  //
  // Handed over as two pieces rather than one string with an index, because the
  // showcase puts a real line between them and hangs the completion list off
  // it. Anchoring to an element rather than to a measured offset is what makes
  // the popup land on the right line at any width -- the lines above it wrap.
  const usage = {
    head: [
      `import { ${fn} } from "./${outDirName}/${TEMPLATE}.js";`,
      "",
      `const mail = ${fn}({`,
    ].join("\n"),
    tail: [
      `  orderNumber: "A-1042",`,
      `  items: [{ name: "Kettle", quantity: 1, price: 49 }],`,
      `  total: 49,`,
      `});`,
      "",
      `await transport.sendMail({`,
      `  to: customer.email,`,
      `  subject: mail.subject,`,
      `  html: mail.html,`,
      `  text: mail.text,`,
      `});`,
    ].join("\n"),
  };

  const completions = paramsMembers(dts);
  if (!completions.length) {
    problems.push(`output: no params members found in ${TEMPLATE}.d.ts`);
  }

  const diffs = emitJson(path.join(out, "output.json"), {
    template: TEMPLATE,
    fn,
    type,
    dts: dts.trimEnd(),
    imports,
    exported,
    files: byTemplate,
    usage,
    completions,
    contrast: {
      template: CONTRAST.template,
      engines: contrast,
      authoring: { roots: AUTHORING, packages: authoring.length },
    },
  }, { check });

  return { problems, diffs };
}
