//------------------------------------------------------------------------------
// Code emitters for the compiled output
//
// Everything here is a pure schema -> source-string transform. It lives apart
// from `build-templates.ts` so that callers who only need to render a schema as
// TypeScript -- the docs generator, for one -- do not pull in React, mjml and
// esbuild, all of which that module imports at the top level.
//------------------------------------------------------------------------------
import type { TemplateDefinition } from "./types.js";
import type { AnySchema, ObjectSchema } from "../dsl/types.js";
import type { Derivation } from "../i18n/icu.js";

//------------------------------------------------------------------------------
// Utilities
//------------------------------------------------------------------------------
export const pascal = (str: string) =>
  str.replace(/(^\w|-\w)/g, (m) => m.replace("-", "").toUpperCase());

//------------------------------------------------------------------------------
// Emit the params normalizer
//
// Templating engines disagree about missing keys -- EJS throws a ReferenceError
// while Handlebars and Mustache render nothing -- and neither knows about the
// schema's `default` values or `optional` fallbacks. So the generated module
// normalizes its input first: every declared key is present, defaults and
// fallbacks are applied, and an absent optional becomes an empty string.
//------------------------------------------------------------------------------
//
// A localized build also computes what its messages need per email -- a
// plural's arm, a formatted date -- as derived fields next to the values they
// come from; see i18n/icu.ts. `L` and `TZ` are the locale and time zone the
// email is rendered in.
//------------------------------------------------------------------------------
export function emitNormalizer(
  schema: ObjectSchema<any>,
  derivations?: readonly Derivation[],
): string {
  if (derivations === undefined) {
    return `function normalizeParams(params) {
  return ${normalizeExpr(schema, "params", 0)};
}
`;
  }

  const placed = new Set<string>();
  const body = normalizeExpr(schema, "params", 0, { scope: "", derivations, placed });

  // Every derivation is attached to an object the schema declares; one that is
  // not would render as nothing, so it is a bug here rather than in a template.
  const lost = derivations.filter((d) => !placed.has(d.id));
  if (lost.length > 0) {
    throw new Error(
      `Internal error: no object in the schema holds ` +
        lost.map((d) => `${d.id} (scope ${JSON.stringify(d.scope)})`).join(", "),
    );
  }

  return `function normalizeParams(params, L, TZ) {
  return ${body};
}
`;
}

//------------------------------------------------------------------------------
type DeriveContext = {
  scope: string;
  derivations: readonly Derivation[];
  placed: Set<string>;
};

function deriveCall(d: Derivation, holder: string): string {
  const value =
    holder + d.path.split(".").map((key) => `[${JSON.stringify(key)}]`).join("");
  const json = (v: unknown) => JSON.stringify(v);

  switch (d.kind) {
    case "choice":
      return d.spec.kind === "plural"
        ? `__mgPlural(L, ${value}, ${json(d.spec.pluralType)}, ${d.spec.offset}, ${json(d.spec.exact)}, ${json(d.spec.categories)})`
        : `__mgSelect(${value}, ${json(d.spec.keys)})`;
    case "number":
      return `__mgNumber(L, ${value}, ${json(d.options)})`;
    case "date":
    case "time":
      return `__mgDate(L, TZ, ${value}, ${json(d.options)})`;
  }
}

//------------------------------------------------------------------------------
function emptyFor(schema: AnySchema): string {
  switch (schema.kind) {
    case "object":
      return "{}";
    case "array":
      return "[]";
    case "optional":
    case "default":
      return emptyFor(schema.inner);
    default:
      return '""';
  }
}

//------------------------------------------------------------------------------
function normalizeExpr(
  schema: AnySchema,
  access: string,
  depth = 0,
  derive?: DeriveContext,
): string {
  switch (schema.kind) {
    case "object": {
      const o = depth === 0 ? "o" : `o${depth}`;
      const entries = Object.entries(schema.shape).map(([key, child]) => {
        const prop = JSON.stringify(key);
        const childDerive = derive && {
          ...derive,
          scope: derive.scope === "" ? key : `${derive.scope}.${key}`,
        };
        return `${prop}: ${normalizeExpr(child as AnySchema, `${o}[${prop}]`, depth + 1, childDerive)}`;
      });

      const own = derive?.derivations.filter((d) => d.scope === derive.scope) ?? [];
      if (own.length === 0) {
        return `((${o}) => ({ ${entries.join(", ")} }))(${access} ?? {})`;
      }

      // Derived from the normalized object, so a `default` has been applied
      // and a missing nested object is already {}.
      const n = depth === 0 ? "n" : `n${depth}`;
      const assigns = own.map((d) => {
        derive!.placed.add(d.id);
        return `${n}[${JSON.stringify(d.id)}] = ${deriveCall(d, n)};`;
      });
      return `((${o}) => { const ${n} = { ${entries.join(", ")} }; ${assigns.join(" ")} return ${n}; })(${access} ?? {})`;
    }

    case "array": {
      const e = depth === 0 ? "e" : `e${depth}`;
      const elementDerive = derive && { ...derive, scope: `${derive.scope}[]` };
      return `(${access} ?? []).map((${e}) => ${normalizeExpr(schema.element, e, depth + 1, elementDerive)})`;
    }

    case "optional": {
      // object and array supply their own empty value, so only scalars need
      // one added here -- otherwise the emitted code reads `(x ?? {}) ?? {}`.
      const empty = emptyFor(schema.inner);
      return normalizeExpr(
        schema.inner,
        empty === '""' ? `(${access} ?? "")` : access,
        depth,
        derive,
      );
    }

    case "default":
      return normalizeExpr(
        schema.inner,
        `(${access} ?? ${JSON.stringify(schema.value)})`,
        depth,
        derive,
      );

    default:
      return access;
  }
}

//------------------------------------------------------------------------------
// Template names -> emitted identifiers and filenames
//
// Planned in one pass before anything is compiled, so a name that cannot work
// fails the build with every other file untouched rather than half-written.
// The checks are all about collisions the emitted code cannot express: two
// templates sharing a render function name, or two files a case-insensitive
// filesystem would fold into one.
//------------------------------------------------------------------------------
export type TemplateEntry = {
  /** The template's own name, as written in the definition. */
  name: string;
  /** Base filename, without extension. */
  file: string;
  /** Exported render function. */
  fnName: string;
  /** Exported params type. */
  typeName: string;
};

const RESERVED_NAMES = new Set(["index"]);

export function planTemplateEntries(
  templates: { name: unknown }[],
): TemplateEntry[] {
  const entries: TemplateEntry[] = [];
  const byFn = new Map<string, string>();
  const byFile = new Map<string, string>();

  for (const template of templates) {
    const name = template.name;

    if (typeof name !== "string" || name.trim() === "") {
      throw new Error(
        `A template has no name: every template needs a non-empty \`name\`, ` +
          `which becomes its filename and its exported function.`,
      );
    }

    if (/[\\/]/.test(name) || name.startsWith(".")) {
      throw new Error(
        `Template name ${JSON.stringify(name)} cannot be a path: it is used ` +
          `as a filename in the output directory.`,
      );
    }

    if (RESERVED_NAMES.has(name.toLowerCase())) {
      throw new Error(
        `Template name ${JSON.stringify(name)} is reserved: the build writes ` +
          `its own index.js and index.d.ts alongside the templates.`,
      );
    }

    const fnName = `render${pascal(name)}`;

    if (!IDENTIFIER.test(fnName)) {
      throw new Error(
        `Template name ${JSON.stringify(name)} gives the render function ` +
          `\`${fnName}\`, which is not a valid identifier. Use letters, ` +
          `digits, "-" or "_", and do not start with a digit.`,
      );
    }

    const fnClash = byFn.get(fnName);
    if (fnClash !== undefined) {
      throw new Error(
        `Templates ${JSON.stringify(fnClash)} and ${JSON.stringify(name)} ` +
          `both compile to \`${fnName}\`. Rename one of them.`,
      );
    }

    const lower = name.toLowerCase();
    const fileClash = byFile.get(lower);
    if (fileClash !== undefined) {
      throw new Error(
        `Templates ${JSON.stringify(fileClash)} and ${JSON.stringify(name)} ` +
          `differ only in case, so they would be the same file on macOS and ` +
          `Windows. Rename one of them.`,
      );
    }

    byFn.set(fnName, name);
    byFile.set(lower, name);

    entries.push({
      name,
      file: name,
      fnName,
      typeName: `${pascal(name)}Params`,
    });
  }

  return entries;
}

//------------------------------------------------------------------------------
// Emit DTS
//------------------------------------------------------------------------------
export function emitDts(
  template: TemplateDefinition<any>,
  locales: readonly string[] | null = null,
): string {
  const typeName = `${pascal(template.name)}Params`;
  const fnName = `render${pascal(template.name)}`;
  const paramsType = emitObjectType(template.params);

  // The sender is fixed at build time, so type it as the literal. A template
  // without one gets no `sender` key at all -- matching the emitted module,
  // which leaves it out rather than returning undefined behind a `string`.
  const sender =
    template.sender === undefined
      ? ""
      : `  sender: ${JSON.stringify(template.sender)};\n`;

  if (locales === null) {
    return `
export type ${typeName} = ${paramsType};

export declare function ${fnName}(
  params: ${typeName}
): {
  name: ${JSON.stringify(template.name)};
  subject: string;
${sender}  html: string;
  text: string;
};
`.trimStart();
  }

  return `
export type ${typeName} = ${paramsType};

${emitLocaleType(locales)}

export interface RenderOptions {
  /**
   * The locale to render in. Anything is accepted -- a user preference, an
   * Accept-Language value -- and resolved to the closest built locale, falling
   * back to the default. The result's \`locale\` says which one was used.
   */
  locale?: Locale | (string & {});
  /** IANA time zone for dates, e.g. "America/Montreal". */
  timeZone?: string;
}

export declare function ${fnName}(
  params: ${typeName},
  options?: RenderOptions
): {
  name: ${JSON.stringify(template.name)};
  locale: Locale;
  subject: string;
${sender}  html: string;
  text: string;
};
`.trimStart();
}

//------------------------------------------------------------------------------
export function emitLocaleType(locales: readonly string[]): string {
  return `export type Locale = ${locales.map((l) => JSON.stringify(l)).join(" | ")};`;
}

//------------------------------------------------------------------------------
// Emit Type
//------------------------------------------------------------------------------
// Both make the key omittable on input. `default` additionally guarantees a
// value at render time, which `normalizeParams` supplies.
export function isOptional(schema: AnySchema): boolean {
  switch (schema.kind) {
    case "optional":
    case "default":
      return true;
    default:
      return false;
  }
}

//------------------------------------------------------------------------------
const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

export function emitKey(key: string): string {
  return IDENTIFIER.test(key) ? key : JSON.stringify(key);
}

//------------------------------------------------------------------------------
export function emitObjectType(schema: ObjectSchema<any>, indent = ""): string {
  const inner = `${indent}  `;

  const lines = Object.entries(schema.shape).map(([key, value]) => {
    const optional = isOptional(value as AnySchema) ? "?" : "";
    return `${inner}${emitKey(key)}${optional}: ${emitValueType(value as AnySchema, inner)};`;
  });

  return `{\n${lines.join("\n")}\n${indent}}`;
}

//------------------------------------------------------------------------------
export function emitValueType(schema: AnySchema, indent = ""): string {
  switch (schema.kind) {
    case "string":
      return "string";

    case "number":
      return "number";

    case "boolean":
      return "boolean";

    case "date":
      return "Date | string | number";

    case "array":
      return `${emitValueType(schema.element, indent)}[]`;

    case "default":
      return emitValueType(schema.inner, indent);

    case "optional":
      // optionality handled at property level
      return emitValueType(schema.inner, indent);

    case "object":
      return emitObjectType(schema, indent);

    default:
      return "unknown";
  }
}
