import type { EmptyObj, RenderTemplateContext } from "../types.js";

//------------------------------------------------------------------------------
export type TemplatingEngine = "ejs" | "handlebars" | "mustache";

//------------------------------------------------------------------------------
export type TemplateContext<R> = {
  render: (path: string) => R;

  when: (
    path: string,
    render: () => string,
    otherwise?: () => string,
  ) => string;
  unless: (
    path: string,
    render: () => string,
    otherwise?: () => string,
  ) => string;

  each: (
    path: string,
    render: (item: ItemContext<R>, index: number) => string,
  ) => string;

  with: (
    path: string,
    render: (scoped: TemplateContext<R>) => string,
  ) => string;
};

//------------------------------------------------------------------------------
export type ItemContext<R> =
  | TemplateContext<R>
  | { render: () => string } // primitive-ish item: render current item
  | {
      each: (render: (item: ItemContext<R>, index: number) => string) => string;
    } // nested arrays
  | EmptyObj;

//------------------------------------------------------------------------------
export function makeTemplateRenderContext<T>(opts: {
  engine: TemplatingEngine;
  rootVar?: string;
  unescaped?: boolean;
  guardArrays?: boolean; // guard array iteration as (expr || [])
}): RenderTemplateContext<T> {
  const engine = opts.engine;
  const rootVar = opts.rootVar ?? "";
  const unescaped = opts.unescaped ?? false;
  const guardArrays = opts.guardArrays ?? true;

  let id = 0;
  const next = (prefix: string) => `__${prefix}${++id}`;

  // Join base + path into either:
  // - EJS JS expr:   base.path
  // - HB/Mustache:   base.path (same string form)
  const joinPath = (base: string, path: string) => {
    if (!base) return path;
    if (!path) return base;
    return `${base}.${path}`;
  };

  // How to print an expression/path in each engine
  const emitValue = (exprOrPath: string, isCurrent: boolean) => {
    switch (engine) {
      case "ejs": {
        const tag = unescaped ? "<%-" : "<%=";
        // exprOrPath is a JS expression here
        return `${tag} ${exprOrPath} %>`;
      }
      case "handlebars": {
        if (isCurrent) return `{{this}}`;
        return unescaped ? `{{{${exprOrPath}}}}` : `{{${exprOrPath}}}`;
      }
      case "mustache": {
        if (isCurrent) return `{{.}}`;
        // Mustache unescaped is commonly {{& name}} (or triple mustache {{{name}}})
        return unescaped ? `{{& ${exprOrPath}}}` : `{{${exprOrPath}}}`;
      }
    }
  };

  // Blocks
  const emitIf = (cond: string, yes: string, no: string | undefined) => {
    switch (engine) {
      case "ejs":
        return no
          ? `<% if (${cond}) { %>${yes}<% } else { %>${no}<% } %>`
          : `<% if (${cond}) { %>${yes}<% } %>`;

      case "handlebars":
        return no
          ? `{{#if ${cond}}}${yes}{{else}}${no}{{/if}}`
          : `{{#if ${cond}}}${yes}{{/if}}`;

      case "mustache":
        // Mustache has no else, but we can emulate it with inverted sections:
        return no
          ? `{{#${cond}}}${yes}{{/${cond}}}{{^${cond}}}${no}{{/${cond}}}`
          : `{{#${cond}}}${yes}{{/${cond}}}`;
    }
  };

  const emitUnless = (cond: string, yes: string, no: string | undefined) => {
    switch (engine) {
      case "ejs":
        return no
          ? `<% if (!(${cond})) { %>${yes}<% } else { %>${no}<% } %>`
          : `<% if (!(${cond})) { %>${yes}<% } %>`;

      case "handlebars":
        // Handlebars has #unless
        return no
          ? `{{#unless ${cond}}}${yes}{{else}}${no}{{/unless}}`
          : `{{#unless ${cond}}}${yes}{{/unless}}`;

      case "mustache":
        // "unless" is just inverted section:
        return no
          ? `{{^${cond}}}${yes}{{/${cond}}}{{#${cond}}}${no}{{/${cond}}}`
          : `{{^${cond}}}${yes}{{/${cond}}}`;
    }
  };

  const emitEach = (
    arr: string,
    body: string,
    itemVar?: string,
    indexVar?: string,
  ) => {
    switch (engine) {
      case "ejs": {
        const arrExpr = guardArrays ? `(${arr} || [])` : arr;
        const item = itemVar ?? next("item");
        const idx = indexVar ?? next("i");
        return `<% ${arrExpr}.forEach(function(${item}, ${idx}) { %>${body}<% }); %>`;
      }

      case "handlebars":
        // Inside #each, context becomes each item
        return `{{#each ${arr}}}${body}{{/each}}`;

      case "mustache":
        // Mustache section iterates arrays; inside, context becomes each item
        return `{{#${arr}}}${body}{{/${arr}}}`;
    }
  };

  const emitWith = (obj: string, body: string, scopeVar?: string) => {
    switch (engine) {
      case "ejs": {
        const sv = scopeVar ?? next("scope");
        return `<% const ${sv} = ${obj}; %>${body}`;
      }

      case "handlebars":
        return `{{#with ${obj}}}${body}{{/with}}`;

      case "mustache":
        // Mustache "with" is just a section on the object
        return `{{#${obj}}}${body}{{/${obj}}}`;
    }
  };

  // Create a context whose "base" is either:
  // - EJS: JS expression string (e.g. "params.user")
  // - HB/Mustache: path string (e.g. "user") OR "" for current context
  const make = (base: string): RenderTemplateContext<T> => {
    const isEjs = engine === "ejs";

    const exprOrPathFor = (path: string) => {
      if (isEjs) {
        // EJS needs a JS expression; base can be "" or "params"
        const baseExpr = base;
        return joinPath(baseExpr, path);
      }
      // HB/Mustache: base is a *path prefix*; "" means “current context”
      return joinPath(base, path);
    };

    const ctx: any = {};
    (ctx.render = (path: string) => emitValue(exprOrPathFor(path), false)),
      (ctx.when = (
        path: string,
        render: () => string,
        otherwise: () => string,
      ) => {
        const cond = exprOrPathFor(path);
        return emitIf(cond, render(), otherwise?.());
      });

    ctx.unless = (
      path: string,
      render: () => string,
      otherwise: () => string,
    ) => {
      const cond = exprOrPathFor(path);
      return emitUnless(cond, render(), otherwise?.());
    };

    ctx.each = (path: string, render: (item: any, index: number) => string) => {
      const arr = exprOrPathFor(path);

      // Inside each:
      // - EJS: item has its own variable name, so nested renders must prefix with that var
      // - HB/Mustache: context becomes item, so base should be "" (current context)
      const itemVar = next("item");
      const idxVar = next("i");

      const itemCtx = makeItemContext(
        isEjs ? itemVar : "", // base for nested lookups
        isEjs ? itemVar : undefined,
      );

      // index number in callback is not meaningful for string templates;
      // but we still satisfy the signature.
      const body = render(itemCtx, 0);

      return emitEach(arr, body, itemVar, idxVar);
    };

    ctx.with = (path: string, render: (scope: any) => string) => {
      const obj = exprOrPathFor(path);

      const scopeVar = next("scope");
      const scopedBase = isEjs ? scopeVar : ""; // HB/Mustache: #with sets current context
      const scopedCtx = make(scopedBase);

      const body = render(scopedCtx);
      return emitWith(obj, body, scopeVar);
    };

    return ctx as RenderTemplateContext<T>;
  };

  const makeItemContext = (
    base: string,
    ejsItemVar?: string,
  ): ItemContext<string> => {
    const objectCtx = make(base);

    const primitiveCtx = {
      render: () => {
        if (engine === "ejs") {
          // In EJS, current item is the item variable itself
          return emitValue(ejsItemVar ?? base, true);
        }
        // HB: {{this}}, Mustache: {{.}}
        return emitValue("", true);
      },
    };

    const arrayCtx = {
      each: (
        renderFn: (item: ItemContext<string>, index: number) => string,
      ) => {
        // Iterate "current item" as an array
        if (engine === "ejs") {
          const arrExpr = ejsItemVar ?? base;
          const innerItemVar = next("item");
          const innerIdxVar = next("i");
          const innerCtx = makeItemContext(innerItemVar, innerItemVar);
          const body = renderFn(innerCtx, 0);
          return emitEach(arrExpr, body, innerItemVar, innerIdxVar);
        }

        // HB/Mustache: section/each on current context
        // Handlebars supports {{#each this}}; Mustache supports {{#.}}
        const arrRef = engine === "handlebars" ? "this" : ".";
        const innerCtx = makeItemContext("", undefined);
        const body = renderFn(innerCtx, 0);
        return emitEach(arrRef, body);
      },
    };

    return Object.assign({}, objectCtx, primitiveCtx, arrayCtx);
  };

  // Root base:
  // - EJS: rootVar may be "" or "params"
  // - HB/Mustache: leave "" so paths are relative to root context
  const rootBase = engine === "ejs" ? rootVar : "";
  return make(rootBase);
}
