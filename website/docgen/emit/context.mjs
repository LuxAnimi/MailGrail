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
import { readFileSync } from "node:fs";
import path from "node:path";

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

    const preview = renderToStaticMarkup(
      fx.build(makeTemplatePreviewContext(fx.sample)),
    );

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
const truncate = (s) =>
  s === null ? "(failed)" : s.length > 120 ? `${s.slice(0, 120)}...` : s;
