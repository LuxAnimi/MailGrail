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
export function emitNormalizer(schema: ObjectSchema<any>): string {
  return `function normalizeParams(params) {
  return ${normalizeExpr(schema, "params", 0)};
}
`;
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
function normalizeExpr(schema: AnySchema, access: string, depth = 0): string {
  switch (schema.kind) {
    case "object": {
      const o = depth === 0 ? "o" : `o${depth}`;
      const entries = Object.entries(schema.shape).map(([key, child]) => {
        const prop = JSON.stringify(key);
        return `${prop}: ${normalizeExpr(child as AnySchema, `${o}[${prop}]`, depth + 1)}`;
      });
      return `((${o}) => ({ ${entries.join(", ")} }))(${access} ?? {})`;
    }

    case "array": {
      const e = depth === 0 ? "e" : `e${depth}`;
      return `(${access} ?? []).map((${e}) => ${normalizeExpr(schema.element, e, depth + 1)})`;
    }

    case "optional": {
      // object and array supply their own empty value, so only scalars need
      // one added here -- otherwise the emitted code reads `(x ?? {}) ?? {}`.
      const empty = emptyFor(schema.inner);
      return normalizeExpr(
        schema.inner,
        empty === '""' ? `(${access} ?? "")` : access,
        depth,
      );
    }

    case "default":
      return normalizeExpr(
        schema.inner,
        `(${access} ?? ${JSON.stringify(schema.value)})`,
        depth,
      );

    default:
      return access;
  }
}

//------------------------------------------------------------------------------
// Emit DTS
//------------------------------------------------------------------------------
export function emitDts(template: TemplateDefinition<any>): string {
  const typeName = `${pascal(template.name)}Params`;
  const fnName = `render${pascal(template.name)}`;
  const paramsType = emitObjectType(template.params);

  return `
export type ${typeName} = ${paramsType};

export declare function ${fnName}(
  params: ${typeName}
): {
  name: "${template.name}";
  subject: string;
  sender: string;
  html: string;
  text: string;
};
`.trimStart();
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
