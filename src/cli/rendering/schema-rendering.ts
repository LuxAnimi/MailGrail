import type { ReactNode } from "react";
import { createElement, Fragment } from "react";

//------------------------------------------------------------------------------
import type { RenderTemplateContext } from "../types.js";

//------------------------------------------------------------------------------
export type TemplatingEngine = "ejs" | "handlebars" | "mustache";

//------------------------------------------------------------------------------
// Why tokens instead of emitting engine syntax directly
//
// The compiled HTML is produced by React -> renderToMjml -> mjml2html. Both of
// those stages transform text: React escapes it, and MJML escapes it again and
// drops bare text that sits between structural components. Emitting `<% %>` or
// `{{ }}` into the tree therefore loses it (`&lt;%= x %&gt;`, or nothing at all).
//
// So the context emits opaque alphanumeric tokens, which survive both stages
// untouched, and the real engine syntax is substituted back in at the very end.
// This also lets block helpers return React nodes, so their JSX children render
// through React normally instead of being coerced with String().
//------------------------------------------------------------------------------
const tokenFor = (index: number) => `MAILGRAILx${index}xTOKEN`;
const TOKEN_RE = /MAILGRAILx(\d+)xTOKEN/g;

//------------------------------------------------------------------------------
// MJML elements whose content is passed straight through as HTML. A marker
// inside one of these must stay bare text; anywhere else it has to be wrapped
// in <mj-raw> or MJML discards it.
//------------------------------------------------------------------------------
const RAW_CONTENT_ELEMENTS = new Set([
  "mj-text",
  "mj-button",
  "mj-raw",
  "mj-table",
  "mj-accordion-text",
  "mj-accordion-title",
  "mj-navbar-link",
  "mj-social-element",
  "mj-style",
  "mj-title",
  "mj-preview",
]);

//------------------------------------------------------------------------------
export type TemplateCompiler<T> = {
  /** Context handed to the template's `htmlTemplate` function. */
  ctx: RenderTemplateContext<T>;

  /**
   * Run on the MJML produced by `renderToMjml`, before `mjml2html`.
   * Wraps structural markers in `<mj-raw>` so MJML preserves them.
   */
  prepareMjml: (mjml: string) => string;

  /**
   * Run on the final HTML from `mjml2html`. Replaces every marker with the
   * engine syntax it stands for.
   */
  substitute: (html: string) => string;
};

//------------------------------------------------------------------------------
export function createTemplateCompiler<T>(opts: {
  engine: TemplatingEngine;
  rootVar?: string;
  unescaped?: boolean;
  guardArrays?: boolean; // guard array iteration as (expr || [])
}): TemplateCompiler<T> {
  const engine = opts.engine;
  const rootVar = opts.rootVar ?? "";
  const unescaped = opts.unescaped ?? false;
  const guardArrays = opts.guardArrays ?? true;

  let id = 0;
  const next = (prefix: string) => `__${prefix}${++id}`;

  // Emitted engine syntax, indexed by the token that stands in for it.
  const fragments: string[] = [];
  // Markers that are structural (block open/close) rather than inline values.
  const structural = new Set<number>();

  const mark = (syntax: string, isStructural: boolean): string => {
    const index = fragments.length;
    fragments.push(syntax);
    if (isStructural) structural.add(index);
    return tokenFor(index);
  };

  const value = (syntax: string) => mark(syntax, false);
  const block = (syntax: string) => mark(syntax, true);

  //----------------------------------------------------------------------------
  const joinPath = (base: string, path: string) => {
    if (!base) return path;
    if (!path) return base;
    return `${base}.${path}`;
  };

  //----------------------------------------------------------------------------
  // How to print an expression/path in each engine
  const emitValue = (exprOrPath: string, isCurrent: boolean) => {
    switch (engine) {
      case "ejs": {
        const tag = unescaped ? "<%-" : "<%=";
        return `${tag} ${exprOrPath} %>`;
      }
      case "handlebars": {
        if (isCurrent) return `{{this}}`;
        return unescaped ? `{{{${exprOrPath}}}}` : `{{${exprOrPath}}}`;
      }
      case "mustache": {
        if (isCurrent) return `{{.}}`;
        return unescaped ? `{{& ${exprOrPath}}}` : `{{${exprOrPath}}}`;
      }
    }
  };

  //----------------------------------------------------------------------------
  // Blocks are emitted as separate open / else / close markers so the JSX
  // between them can be rendered by React rather than concatenated as a string.
  //----------------------------------------------------------------------------
  const ifParts = (cond: string) => {
    switch (engine) {
      case "ejs":
        return {
          open: `<% if (${cond}) { %>`,
          alt: `<% } else { %>`,
          close: `<% } %>`,
        };
      case "handlebars":
        return {
          open: `{{#if ${cond}}}`,
          alt: `{{else}}`,
          close: `{{/if}}`,
        };
      case "mustache":
        // Mustache has no else; the alternative is an inverted section.
        return {
          open: `{{#${cond}}}`,
          alt: `{{/${cond}}}{{^${cond}}}`,
          close: `{{/${cond}}}`,
        };
    }
  };

  const unlessParts = (cond: string) => {
    switch (engine) {
      case "ejs":
        return {
          open: `<% if (!(${cond})) { %>`,
          alt: `<% } else { %>`,
          close: `<% } %>`,
        };
      case "handlebars":
        return {
          open: `{{#unless ${cond}}}`,
          alt: `{{else}}`,
          close: `{{/unless}}`,
        };
      case "mustache":
        return {
          open: `{{^${cond}}}`,
          alt: `{{/${cond}}}{{#${cond}}}`,
          close: `{{/${cond}}}`,
        };
    }
  };

  const eachParts = (arr: string, itemVar: string, idxVar: string) => {
    switch (engine) {
      case "ejs": {
        const arrExpr = guardArrays ? `(${arr} || [])` : arr;
        return {
          open: `<% ${arrExpr}.forEach(function(${itemVar}, ${idxVar}) { %>`,
          close: `<% }); %>`,
        };
      }
      case "handlebars":
        return { open: `{{#each ${arr}}}`, close: `{{/each}}` };
      case "mustache":
        return { open: `{{#${arr}}}`, close: `{{/${arr}}}` };
    }
  };

  const withParts = (obj: string, scopeVar: string) => {
    switch (engine) {
      case "ejs":
        return { open: `<% const ${scopeVar} = ${obj}; %>`, close: `` };
      case "handlebars":
        return { open: `{{#with ${obj}}}`, close: `{{/with}}` };
      case "mustache":
        return { open: `{{#${obj}}}`, close: `{{/${obj}}}` };
    }
  };

  //----------------------------------------------------------------------------
  const frag = (...nodes: ReactNode[]): ReactNode =>
    createElement(Fragment, null, ...nodes);

  //----------------------------------------------------------------------------
  // Create a context whose "base" is either:
  // - EJS: JS expression string (e.g. "params.user")
  // - HB/Mustache: path string (e.g. "user") OR "" for current context
  const make = (base: string): RenderTemplateContext<T> => {
    const isEjs = engine === "ejs";

    const exprOrPathFor = (path: string) => joinPath(base, path);

    const ctx: any = {};

    ctx.render = (path: string) =>
      value(emitValue(exprOrPathFor(path), false));

    ctx.when = (
      path: string,
      render: () => ReactNode,
      otherwise?: () => ReactNode,
    ) => {
      const parts = ifParts(exprOrPathFor(path));
      return otherwise
        ? frag(block(parts.open), render(), block(parts.alt), otherwise(), block(parts.close))
        : frag(block(parts.open), render(), block(parts.close));
    };

    ctx.unless = (
      path: string,
      render: () => ReactNode,
      otherwise?: () => ReactNode,
    ) => {
      const parts = unlessParts(exprOrPathFor(path));
      return otherwise
        ? frag(block(parts.open), render(), block(parts.alt), otherwise(), block(parts.close))
        : frag(block(parts.open), render(), block(parts.close));
    };

    ctx.each = (
      path: string,
      render: (item: any, index: number) => ReactNode,
    ) => {
      const arr = exprOrPathFor(path);

      // Inside each:
      // - EJS: the item gets its own variable, so nested lookups prefix with it
      // - HB/Mustache: the context becomes the item, so the base is "" (current)
      const itemVar = next("item");
      const idxVar = next("i");

      const itemCtx = makeItemContext(
        isEjs ? itemVar : "",
        isEjs ? itemVar : undefined,
      );

      const parts = eachParts(arr, itemVar, idxVar);
      return frag(block(parts.open), render(itemCtx, 0), block(parts.close));
    };

    ctx.with = (path: string, render: (scope: any) => ReactNode) => {
      const obj = exprOrPathFor(path);

      const scopeVar = next("scope");
      // HB/Mustache: #with sets the current context, so nested paths are relative
      const scopedCtx = make(isEjs ? scopeVar : "");

      const parts = withParts(obj, scopeVar);
      return frag(block(parts.open), render(scopedCtx), block(parts.close));
    };

    return ctx as RenderTemplateContext<T>;
  };

  //----------------------------------------------------------------------------
  const makeItemContext = (base: string, ejsItemVar?: string): any => {
    const objectCtx: any = make(base);

    const renderCurrent = () => {
      if (engine === "ejs") {
        // In EJS the current item is the item variable itself
        return value(emitValue(ejsItemVar ?? base, true));
      }
      return value(emitValue("", true));
    };

    const eachCurrent = (
      renderFn: (item: any, index: number) => ReactNode,
    ): ReactNode => {
      if (engine === "ejs") {
        const arrExpr = ejsItemVar ?? base;
        const innerItemVar = next("item");
        const innerIdxVar = next("i");
        const innerCtx = makeItemContext(innerItemVar, innerItemVar);
        const parts = eachParts(arrExpr, innerItemVar, innerIdxVar);
        return frag(block(parts.open), renderFn(innerCtx, 0), block(parts.close));
      }

      // HB: {{#each this}}, Mustache: {{#.}}
      const arrRef = engine === "handlebars" ? "this" : ".";
      const innerCtx = makeItemContext("", undefined);
      const parts = eachParts(arrRef, "", "");
      return frag(block(parts.open), renderFn(innerCtx, 0), block(parts.close));
    };

    // An item context serves several documented shapes at once, so `render`
    // and `each` dispatch on their arguments rather than being overwritten:
    //   - primitive item:     item.render()          -> the item itself
    //   - object item:        item.render("name")    -> a field of the item
    //   - nested-array item:  item.each((el) => ...) -> iterate the item
    //   - object w/ an array: item.each("tags", fn)  -> iterate a field
    const merged: any = Object.assign({}, objectCtx);

    merged.render = (path?: string) =>
      path === undefined || path === "" ? renderCurrent() : objectCtx.render(path);

    merged.each = (
      pathOrRender: string | ((item: any, index: number) => ReactNode),
      maybeRender?: (item: any, index: number) => ReactNode,
    ) =>
      typeof pathOrRender === "function"
        ? eachCurrent(pathOrRender)
        : objectCtx.each(pathOrRender, maybeRender);

    return merged;
  };

  //----------------------------------------------------------------------------
  // Wrap structural markers in <mj-raw> so MJML keeps them.
  //
  // Bare text between structural MJML components is discarded, but text inside
  // an mj-text-like element is passed through as HTML -- and an <mj-raw> there
  // would leak into the output. So the decision depends on the enclosing
  // element, which is only knowable once the MJML source exists.
  //----------------------------------------------------------------------------
  const prepareMjml = (mjml: string): string => {
    const TAG_RE = /<\/?([a-zA-Z][a-zA-Z0-9-]*)([^>]*?)(\/?)>/g;

    let out = "";
    let cursor = 0;
    let rawDepth = 0;
    let match: RegExpExecArray | null;

    const wrapStructural = (text: string) =>
      text.replace(TOKEN_RE, (token, index) =>
        structural.has(Number(index)) ? `<mj-raw>${token}</mj-raw>` : token,
      );

    while ((match = TAG_RE.exec(mjml)) !== null) {
      const [tag, name, , selfClosing] = match;

      // Text between the previous tag and this one
      const text = mjml.slice(cursor, match.index);
      out += rawDepth > 0 ? text : wrapStructural(text);

      // The tag itself is copied verbatim, so markers inside attributes are
      // never wrapped.
      out += tag;
      cursor = match.index + tag.length;

      if (RAW_CONTENT_ELEMENTS.has(name.toLowerCase()) && !selfClosing) {
        if (tag.startsWith("</")) rawDepth = Math.max(0, rawDepth - 1);
        else rawDepth += 1;
      }
    }

    const tail = mjml.slice(cursor);
    out += rawDepth > 0 ? tail : wrapStructural(tail);

    return out;
  };

  //----------------------------------------------------------------------------
  const substitute = (html: string): string =>
    html.replace(TOKEN_RE, (token, index) => {
      const syntax = fragments[Number(index)];
      return syntax === undefined ? token : syntax;
    });

  //----------------------------------------------------------------------------
  // Root base:
  // - EJS: rootVar may be "" or "params"
  // - HB/Mustache: leave "" so paths are relative to the root context
  const rootBase = engine === "ejs" ? rootVar : "";

  return { ctx: make(rootBase), prepareMjml, substitute };
}
