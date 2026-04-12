import type { ReactNode } from "react";

//------------------------------------------------------------------------------
import type { PreviewTemplateContext } from "../types.js";

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
export function makeTemplatePreviewContext<T>(
  params: T,
): PreviewTemplateContext<T> {
  const mg: any = {};

  mg.render = (path: string) => {
    const value = getPath(params as any, path);
    if (value === "" || value === undefined || value === null) {
      const key = path.split(".").pop() ?? path;
      return `<${key}>`;
    }
    return toRenderableString(value);
  };

  mg.when = (
    path: string,
    render: () => ReactNode,
    otherwise?: () => ReactNode,
  ) => {
    const value = getPath(params as any, path);
    // "Boolish": true/false/null/undefined
    // Treat null/undefined as false by default.
    const ok = value === true;
    return ok ? render() : (otherwise?.() ?? null);
  };

  mg.unless = (
    path: string,
    render: () => ReactNode,
    otherwise?: () => ReactNode,
  ) => {
    const value = getPath(params as any, path);
    const ok = value !== true;
    return ok ? render() : (otherwise?.() ?? null);
  };

  mg.each = (path: string, render: (item: any, index: number) => ReactNode) => {
    const value = getPath(params as any, path);
    if (!Array.isArray(value)) return null;

    const itemKey = path.split(".").pop() ?? path;

    return value.map((elem, index) => {
      if (Array.isArray(elem)) {
        const arrItemCtx = {
          each: (r: (inner: any, i: number) => ReactNode) =>
            elem.map((inner, i) => wrapItemContext(inner, r, i)),
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
        const objItemCtx = makeTemplatePreviewContext(elem);
        return render(objItemCtx, index);
      }

      // fallback
      return render({}, index);
    });

    function wrapItemContext(
      inner: any,
      r: (ctx: any, i: number) => ReactNode,
      i: number,
    ) {
      if (Array.isArray(inner)) {
        return r(
          {
            each: (rr: (c: any, ii: number) => ReactNode) =>
              inner.map((x, ii) => wrapItemContext(x, rr, ii)),
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
        return r(makeTemplatePreviewContext(inner), i);
      }
      return r({}, i);
    }
  };

  mg.with = (path: string, render: (scoped: any) => ReactNode) => {
    const value = getPath(params as any, path);
    if (!isPlainObject(value)) return null;
    return render(makeTemplatePreviewContext(value));
  };

  return mg as PreviewTemplateContext<T>;
}
