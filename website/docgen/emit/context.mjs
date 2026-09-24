//------------------------------------------------------------------------------
// The render-context reference, proved against the real compiler.
//
// For every fixture this compiles the template through all three engines,
// renders each result with the sample values, renders the same template through
// the *preview* context, and requires all four to agree. That is the same
// contract test/preview-parity.test.js enforces, and the same bug class it
// exists to catch: preview and build are two independent implementations of one
// context API, and the build path once shipped "[object Object]" while the
// preview looked perfect.
//
// Documenting this from the compiler rather than by hand means Handlebars and
// Mustache get covered for free -- the README only ever showed EJS.
//------------------------------------------------------------------------------
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { loadManifest } from "../load.mjs";
import { emitJson, compareCoverage } from "../util/json.mjs";
import { extractRegions } from "../util/regions.mjs";

const ENGINES = ["ejs", "handlebars", "mustache"];
const FIXTURES = "website/docgen/manifests/context.fixtures.tsx";

export async function emitContext({ repo, out, check, lib }) {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { createTemplateCompiler } = await import(
    path.join(lib, "src/cli/rendering/schema-rendering.js")
  );
  const { makeTemplatePreviewContext } = await import(
    path.join(lib, "src/cli/rendering/schema-previewing.js")
  );

  const [ejs, Handlebars, Mustache] = await Promise.all([
    import("ejs").then((m) => m.default ?? m),
    import("handlebars").then((m) => m.default ?? m),
    import("mustache").then((m) => m.default ?? m),
  ]);

  const render = {
    ejs: (src, data) => ejs.render(src, data),
    handlebars: (src, data) => Handlebars.compile(src)(data),
    mustache: (src, data) => Mustache.render(src, data),
  };

  const { fixtures } = await loadManifest(path.join(repo, FIXTURES));

  const regions = extractRegions(
    readFileSync(path.join(repo, FIXTURES), "utf8"),
    { file: FIXTURES },
  );

  const problems = [];
  const out_fixtures = [];
  const localized = await localizedBuilder({
    repo,
    lib,
    renderToStaticMarkup,
    createTemplateCompiler,
  });

  for (const fx of fixtures) {
    const region = regions.get(fx.id);
    if (!region) {
      problems.push(
        `context: fixture "${fx.id}" has no \`#region doc:${fx.id}\` in ${FIXTURES}`,
      );
      continue;
    }

    const compiled = {};
    const rendered = {};
    let preview;

    if (fx.i18n) {
      // Localized: built into the real render module, as a project's is.
      let built;
      try {
        built = await localized(fx);
      } catch (err) {
        problems.push(
          `context: fixture "${fx.id}" fails to build: ${err.message}`,
        );
        continue;
      }
      Object.assign(compiled, built.compiled);
      Object.assign(rendered, built.rendered);
      problems.push(
        ...built.problems.map((p) => `context: fixture "${fx.id}": ${p}`),
      );

      preview = renderToStaticMarkup(
        fx.build(makeTemplatePreviewContext(fx.sample, built.previewI18n)),
      );
    } else {
      for (const engine of ENGINES) {
        const compiler = createTemplateCompiler({ engine, rootVar: "" });
        const node = fx.build(compiler.ctx);
        compiled[engine] = compiler.substitute(renderToStaticMarkup(node));

        try {
          rendered[engine] = render[engine](compiled[engine], fx.sample);
        } catch (err) {
          problems.push(
            `context: fixture "${fx.id}" fails to render under ${engine}: ${err.message}`,
          );
          rendered[engine] = null;
        }
      }

      preview = renderToStaticMarkup(
        fx.build(makeTemplatePreviewContext(fx.sample)),
      );
    }

    const disagreeing = ENGINES.filter((e) => rendered[e] !== preview);
    const parity = disagreeing.length === 0;
    const expectParity = fx.expectParity ?? true;

    if (expectParity && !parity) {
      problems.push(
        `context: fixture "${fx.id}" -- preview and ${disagreeing.join("/")} ` +
          `disagree.\n` +
          `      preview:  ${truncate(preview)}\n` +
          `      ${disagreeing[0]}: ${truncate(rendered[disagreeing[0]])}`,
      );
    }

    if (!expectParity && parity) {
      problems.push(
        `context: fixture "${fx.id}" declares expectParity:false but now agrees ` +
          `-- drop the exemption`,
      );
    }

    out_fixtures.push({
      id: fx.id,
      api: fx.api,
      title: fx.title,
      summary: fx.summary ?? null,
      tsx: region.code,
      sample: fx.sample,
      compiled,
      rendered,
      preview,
      parity,
      parityNote: fx.parityNote ?? null,
      // What the page needs to explain a localized example's output.
      i18n: fx.i18n
        ? {
            locale: fx.i18n.locale,
            catalog: fx.i18n.catalogs[fx.i18n.locale] ?? null,
          }
        : null,
    });
  }

  // Every method the context actually exposes must have a fixture.
  const probe = createTemplateCompiler({ engine: "ejs", rootVar: "" });
  problems.push(
    ...compareCoverage(
      "render context methods",
      Object.keys(probe.ctx),
      out_fixtures.map((f) => f.api),
    ),
  );

  const diff = emitJson(
    path.join(out, "context.json"),
    { fixtures: out_fixtures },
    { check },
  );

  return { problems, diffs: diff ? [{ file: "context.json", diff }] : [] };
}

//------------------------------------------------------------------------------
// A localized fixture is compiled once per locale, like a project's templates,
// and the real render module is emitted and imported: plurals and number or
// date formats are decided by that module, per email, so the compiled template
// alone cannot be rendered with the sample. Mirrors test/i18n-rendering.test.js.
//------------------------------------------------------------------------------
async function localizedBuilder({
  repo,
  lib,
  renderToStaticMarkup,
  createTemplateCompiler,
}) {
  const load = (file) => import(path.join(lib, file));
  const [
    { createTextTemplateCompiler },
    { ENGINES: SPECS },
    { planTemplateEntries },
    { emitTemplateModule },
    { validateCatalogs },
    { Derivations },
    { textDirection },
  ] = await Promise.all([
    load("src/cli/rendering/schema-rendering.js"),
    load("src/cli/engines.js"),
    load("src/cli/emit-types.js"),
    load("src/cli/emit-module.js"),
    load("src/i18n/catalog.js"),
    load("src/i18n/icu.js"),
    load("src/i18n/locale.js"),
  ]);

  let serial = 0;

  return async (fx) => {
    if (!fx.params) throw new Error("a localized fixture needs `params`");

    const {
      locales,
      locale,
      messages: sources,
      catalogs,
      timeZone = "UTC",
    } = fx.i18n;
    const defaultLocale = locales[0];
    const problems = [];

    // Strict, and warnings count too: an example's catalog should be exact.
    const { messages, warnings } = validateCatalogs(
      sources,
      new Map(Object.entries(catalogs)),
      { locales, defaultLocale, strict: true },
    );
    problems.push(...warnings);

    const entry = planTemplateEntries([{ name: `doc-${fx.id}` }])[0];
    const compiled = {};
    const rendered = {};

    for (const engine of ENGINES) {
      const derivations = new Derivations();
      const parts = new Map();

      for (const tag of locales) {
        const i18n = {
          locale: tag,
          dir: textDirection(tag),
          messages: messages.get(tag),
          derivations,
        };
        const html = createTemplateCompiler({ engine, i18n });
        const text = createTextTemplateCompiler({ engine, i18n });
        parts.set(tag, {
          html: html.substitute(renderToStaticMarkup(fx.build(html.ctx))),
          text: text.substitute(""),
          subject: text.substitute(""),
        });
      }

      compiled[engine] = parts.get(locale).html;

      const source = emitTemplateModule({
        template: { name: `doc-${fx.id}`, params: fx.params },
        entry,
        spec: SPECS[engine],
        format: "esm",
        localized: {
          parts,
          defaultLocale,
          timeZone,
          derivations: derivations.list,
        },
      });

      // Beside the fixtures, so the module resolves the engines from the repo.
      const file = path.join(
        repo,
        path.dirname(FIXTURES),
        `.docgen-${fx.id}-${engine}-${++serial}.mjs`,
      );
      try {
        writeFileSync(file, source);
        const mod = await import(pathToFileURL(file).href);
        rendered[engine] = mod[entry.fnName](fx.sample, { locale }).html;
      } catch (err) {
        problems.push(`fails to render under ${engine}: ${err.message}`);
        rendered[engine] = null;
      } finally {
        rmSync(file, { force: true });
      }
    }

    const previewI18n = {
      locale,
      dir: textDirection(locale),
      timeZone,
      messages: messages.get(locale),
    };

    return { compiled, rendered, previewI18n, problems };
  };
}

//------------------------------------------------------------------------------
const truncate = (s) =>
  s === null ? "(failed)" : s.length > 120 ? `${s.slice(0, 120)}...` : s;
