import type { ReactNode } from "react";

//------------------------------------------------------------------------------
import type { PreviewTemplateContext, TextTemplateContext } from "../types.js";

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
function getPath(obj: any, path: string): unknown {
  if (!obj || typeof obj !== "object") return undefined;
  if (!path) return undefined;

  const parts = path.split(".");
  let cur: any = obj;

  for (const key of parts) {
    if (cur == null) return undefined;
    cur = cur[key];
  }
  return cur;
}

//------------------------------------------------------------------------------
function toRenderableString(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  return "";
}

//------------------------------------------------------------------------------
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return (
    !!v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)
  );
}

//------------------------------------------------------------------------------
// How the block helpers combine what their callbacks return. The HTML preview
// composes React nodes, exactly as the compiled template composes JSX; the
// subject and text preview concatenates strings, as their compiled templates
// do. Everything else -- paths, truthiness, placeholders -- is shared, because
// the preview and the build have to agree.
//------------------------------------------------------------------------------
type Kit<N> = {
  /** A block that renders nothing. */
  none: N;
  /** One callback result, checked. */
  one: (node: unknown) => N;
  /** A list of results, as one node. */
  list: (nodes: unknown[]) => N;
};

const NODE_KIT: Kit<ReactNode> = {
  none: null,
  one: (node) => node as ReactNode,
  list: (nodes) => nodes as ReactNode,
};

const TEXT_KIT: Kit<string> = {
  none: "",
  one: (node) => {
    if (typeof node === "string") return node;
    throw new Error(
      `A subject or text callback returned ${
        node === undefined ? "nothing" : typeof node
      }; these compose plain strings, so every branch has to return one.`,
    );
  },
  list: (nodes) => nodes.map((node) => TEXT_KIT.one(node)).join(""),
};

//------------------------------------------------------------------------------
function makePreviewCore<N>(params: unknown, kit: Kit<N>): any {
  const mg: any = {};

  mg.render = (path: string) => {
    const value = getPath(params as any, path);
    if (value === "" || value === undefined || value === null) {
      const key = path.split(".").pop() ?? path;
      return `<${key}>`;
    }
    return toRenderableString(value);
  };

  mg.when = (path: string, render: () => unknown, otherwise?: () => unknown) => {
    const value = getPath(params as any, path);
    // Truthiness, to match what the compiled template will do: EJS emits a
    // plain `if`, Handlebars `#if` and Mustache a section, all of which are
    // truthiness tests. A strict `=== true` here made the preview disagree
    // with the built output for any non-boolean value.
    return value ? kit.one(render()) : otherwise ? kit.one(otherwise()) : kit.none;
  };

  mg.unless = (
    path: string,
    render: () => unknown,
    otherwise?: () => unknown,
  ) => {
    const value = getPath(params as any, path);
    return !value
      ? kit.one(render())
      : otherwise
        ? kit.one(otherwise())
        : kit.none;
  };

  mg.each = (path: string, render: (item: any, index: number) => unknown) => {
    const value = getPath(params as any, path);
    if (!Array.isArray(value)) return kit.none;

    const itemKey = path.split(".").pop() ?? path;

    return kit.list(
      value.map((elem, index) => {
        if (Array.isArray(elem)) {
          const arrItemCtx = {
            each: (r: (inner: any, i: number) => unknown) =>
              kit.list(elem.map((inner, i) => wrapItemContext(inner, r, i))),
          };
          return render(arrItemCtx, index);
        }

        if (
          elem instanceof Date ||
          elem == null ||
          ["string", "number", "boolean"].includes(typeof elem)
        ) {
          const primItemCtx = {
            render: () =>
              elem === "" || elem === undefined || elem === null
                ? `<${itemKey}>`
                : toRenderableString(elem),
          };
          return render(primItemCtx, index);
        }

        if (isPlainObject(elem)) {
          return render(makePreviewCore(elem, kit), index);
        }

        // fallback
        return render({}, index);
      }),
    );

    function wrapItemContext(
      inner: any,
      r: (ctx: any, i: number) => unknown,
      i: number,
    ) {
      if (Array.isArray(inner)) {
        return r(
          {
            each: (rr: (c: any, ii: number) => unknown) =>
              kit.list(inner.map((x, ii) => wrapItemContext(x, rr, ii))),
          },
          i,
        );
      }
      if (
        inner instanceof Date ||
        inner == null ||
        ["string", "number", "boolean"].includes(typeof inner)
      ) {
        return r({ render: () => toRenderableString(inner) }, i);
      }
      if (isPlainObject(inner)) {
        return r(makePreviewCore(inner, kit), i);
      }
      return r({}, i);
    }
  };

  mg.with = (path: string, render: (scoped: any) => unknown) => {
    const value = getPath(params as any, path);
    // The compiled template normalizes a missing object to `{}` and still
    // renders the block, so scope to an empty object rather than hiding it --
    // otherwise the preview omits markup that will ship.
    return kit.one(
      render(makePreviewCore(isPlainObject(value) ? value : {}, kit)),
    );
  };

  return mg;
}

//------------------------------------------------------------------------------
export function makeTemplatePreviewContext<T>(
  params: T,
): PreviewTemplateContext<T> {
  return makePreviewCore(params, NODE_KIT) as PreviewTemplateContext<T>;
}

//------------------------------------------------------------------------------
export function makeTextPreviewContext<T>(params: T): TextTemplateContext<T> {
  return makePreviewCore(params, TEXT_KIT) as TextTemplateContext<T>;
}
