//------------------------------------------------------------------------------
// The parameter DSL reference.
//
// For each documented constructor the generator evaluates the manifest's example
// source against the real `t`, then runs mailgrail's own `emitObjectType` over
// the result. The "-> username: string" lines on the page therefore come from
// the same code that writes the .d.ts your backend imports.
//
// The trap this exists to avoid: `emitValueType` unwraps `optional` and
// `default` and reports the *inner* type, because optionality is expressed at
// the property level (see emit-types.ts). Rendering that alone would document
// `t.optional(t.string())` as `string` -- identical to `t.string()`, losing the
// entire point of the page. So the object type is emitted whole.
//------------------------------------------------------------------------------
import path from "node:path";

import { loadManifest } from "../load.mjs";
import { emitJson, compareCoverage } from "../util/json.mjs";

const ENGINES = ["ejs", "handlebars", "mustache"];

export async function emitDsl({ repo, out, check, lib }) {
  const { t } = await import(path.join(lib, "src/dsl/index.js"));
  const { emitObjectType } = await import(path.join(lib, "src/cli/emit-types.js"));
  const { createTemplateCompiler } = await import(
    path.join(lib, "src/cli/rendering/schema-rendering.js")
  );

  const { dslDocs } = await loadManifest(
    path.join(repo, "website/docgen/manifests/dsl.manifest.ts"),
  );

  const constructors = dslDocs.map((doc) => {
    const examples = doc.examples.map((ex) => {
      const schema = evaluate(ex.source, t, doc.id);

      if (schema?.kind !== "object") {
        throw new Error(
          `dsl.manifest: example for "${doc.id}" must be a t.object({...}), ` +
            `got ${schema?.kind ?? typeof schema}`,
        );
      }

      const keys = Object.keys(schema.shape);

      // Only a scalar is rendered with `mg.render`. Showing "<%= tags %>" for
      // an array would document something nobody should write -- arrays and
      // objects are reached through mg.each / mg.with, which the render-context
      // page covers.
      const scalars = keys.filter((k) => isScalar(schema.shape[k]));

      return {
        label: ex.label ?? null,
        source: ex.source,
        // The whole object, so property-level `?` survives.
        tsType: emitObjectType(schema),
        // What each scalar key compiles to, per engine.
        compiled: scalars.length
          ? Object.fromEntries(
              ENGINES.map((engine) => [
                engine,
                Object.fromEntries(
                  scalars.map((key) => [
                    key,
                    compileValue(createTemplateCompiler, engine, key),
                  ]),
                ),
              ]),
            )
          : null,
        keys,
      };
    });

    return {
      id: doc.id,
      call: `t.${doc.id}`,
      signature: doc.signature,
      summary: doc.summary,
      description: doc.description ?? null,
      notes: doc.notes ?? [],
      seeAlso: doc.seeAlso ?? [],
      examples,
    };
  });

  // A new constructor in src/dsl fails here until it is documented.
  const problems = compareCoverage(
    "DSL constructors",
    Object.keys(t),
    constructors.map((c) => c.id),
  );

  const diff = emitJson(path.join(out, "dsl.json"), { constructors }, { check });

  return { problems, diffs: diff ? [{ file: "dsl.json", diff }] : [] };
}

//------------------------------------------------------------------------------
/** Evaluate an example's source against the real `t`. A typo fails here. */
function evaluate(source, t, id) {
  try {
    return new Function("t", `"use strict"; return (${source});`)(t);
  } catch (err) {
    throw new Error(
      `dsl.manifest: example for "${id}" does not evaluate: ${err.message}\n` +
        `  source: ${source}`,
    );
  }
}

//------------------------------------------------------------------------------
/** Renderable with `mg.render`, i.e. a leaf. `optional`/`default` wrap one. */
function isScalar(schema) {
  switch (schema?.kind) {
    case "string":
    case "number":
    case "boolean":
      return true;
    case "optional":
    case "default":
      return isScalar(schema.inner);
    default:
      return false;
  }
}

//------------------------------------------------------------------------------
/** What `mg.render("<key>")` emits for a given engine. */
function compileValue(createTemplateCompiler, engine, key) {
  const compiler = createTemplateCompiler({ engine, rootVar: "" });
  // ctx.render returns a token; substitute swaps in the real engine syntax.
  return compiler.substitute(String(compiler.ctx.render(key)));
}
