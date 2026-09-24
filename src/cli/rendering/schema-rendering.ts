import type { ReactNode } from "react";
import { createElement, Fragment } from "react";

//------------------------------------------------------------------------------
import type { RenderTemplateContext, TextTemplateContext } from "../types.js";
import type { MessageAst } from "../../i18n/catalog.js";
import { messageAst, renderMessage } from "../../i18n/icu.js";
import type { Derivations, IcuBackend } from "../../i18n/icu.js";
import type { MessageDescriptor } from "../../i18n/messages.js";

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
// A token that survived substitution means the template transformed the string
// it was handed -- `mg.render("x").toUpperCase()` mangles the token's case, so
// it no longer matches. The value would be silently dropped from the email, so
// the build fails instead.
//------------------------------------------------------------------------------
const LEAKED_RE = /MAILGRAIL[xX]\d+[xX]TOKEN/i;

export function findLeakedTokens(output: string): string | null {
  return output.match(LEAKED_RE)?.[0] ?? null;
}

//------------------------------------------------------------------------------
// Handlebars and Mustache drop a line that holds nothing but a block tag, while
// EJS keeps it. That is invisible in HTML and changes the shape of a plain-text
// body, so text templates opt out of it: Handlebars has a compile flag, and
// Mustache, which has none, gets a variable tag in front of every block tag so
// the line is no longer "standalone". An undefined name renders as nothing.
//------------------------------------------------------------------------------
export const TEXT_COMPILE_OPTIONS = {
  handlebars: { ignoreStandalone: true },
} as const;

const MUSTACHE_WS_SENTINEL = "{{&__mailgrail_ws}}";

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
// What `mg.t` needs to render one locale. Absent, the build is unlocalized:
// `mg.t` explains how to turn localization on, and `mg.locale` is "und".
//------------------------------------------------------------------------------
export interface CompilerI18n {
  locale: string;
  dir: "ltr" | "rtl";
  /** This locale's messages, by id. */
  messages: Map<string, MessageAst>;
  /** Shared by every locale and part of one template. */
  derivations: Derivations;
}

//------------------------------------------------------------------------------
export function createTemplateCompiler<T>(opts: {
  engine: TemplatingEngine;
  rootVar?: string;
  unescaped?: boolean;
  guardArrays?: boolean; // guard array iteration as (expr || [])
  mode?: "html" | "text"; // html composes React nodes, text composes strings
  i18n?: CompilerI18n;
}): TemplateCompiler<T> {
  const engine = opts.engine;
  const rootVar = opts.rootVar ?? "";
  const isText = (opts.mode ?? "html") === "text";
  // Text is not HTML: escaping it would turn an apostrophe into &#39; in a
  // plain-text body.
  const unescaped = opts.unescaped ?? isText;
  const guardArrays = opts.guardArrays ?? true;

  let id = 0;
  const next = (prefix: string) => `__${prefix}${++id}`;

  // Emitted engine syntax, indexed by the token that stands in for it.
  const fragments: string[] = [];
  // Markers that are structural (block open/close) rather than inline values.
  const structural = new Set<number>();

  const mark = (syntax: string, isStructural: boolean): string => {
    const index = fragments.length;
    fragments.push(
      isStructural && isText && engine === "mustache"
        ? MUSTACHE_WS_SENTINEL + syntax
        : syntax,
    );
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
        if (isCurrent) return unescaped ? `{{{this}}}` : `{{this}}`;
        return unescaped ? `{{{${exprOrPath}}}}` : `{{${exprOrPath}}}`;
      }
      case "mustache": {
        if (isCurrent) return unescaped ? `{{& .}}` : `{{.}}`;
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

  // The one place the two modes really differ: JSX children are composed by
  // React, and a text body by concatenation. A callback that returns markup in
  // a text template would otherwise concatenate as "[object Object]".
  const joinText = (...nodes: unknown[]): string =>
    nodes
      .map((node) => {
        if (typeof node === "string") return node;
        throw new Error(
          `A subject or text callback returned ${
            node === undefined ? "nothing" : typeof node
          }; these compose plain strings, so every branch has to return one.`,
        );
      })
      .join("");

  const combine: (...nodes: any[]) => any = isText ? joinText : frag;

  //----------------------------------------------------------------------------
  // Create a context whose "base" is either:
  // - EJS: JS expression string (e.g. "params.user")
  // - HB/Mustache: path string (e.g. "user") OR "" for current context
  //
  // `scope` is the schema path of the object the context stands for ("",
  // "items[]", "profile"). The engine does not need it; the derived fields a
  // message adds do, since they are attached to that object.
  const make = (base: string, scope: string): RenderTemplateContext<T> => {
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
        ? combine(block(parts.open), render(), block(parts.alt), otherwise(), block(parts.close))
        : combine(block(parts.open), render(), block(parts.close));
    };

    ctx.unless = (
      path: string,
      render: () => ReactNode,
      otherwise?: () => ReactNode,
    ) => {
      const parts = unlessParts(exprOrPathFor(path));
      return otherwise
        ? combine(block(parts.open), render(), block(parts.alt), otherwise(), block(parts.close))
        : combine(block(parts.open), render(), block(parts.close));
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
        `${joinPath(scope, path)}[]`,
      );

      const parts = eachParts(arr, itemVar, idxVar);
      return combine(block(parts.open), render(itemCtx, 0), block(parts.close));
    };

    ctx.with = (path: string, render: (scope: any) => ReactNode) => {
      const obj = exprOrPathFor(path);

      const scopeVar = next("scope");
      // HB/Mustache: #with sets the current context, so nested paths are relative
      const scopedCtx = make(isEjs ? scopeVar : "", joinPath(scope, path));

      const parts = withParts(obj, scopeVar);
      return combine(block(parts.open), render(scopedCtx), block(parts.close));
    };

    ctx.locale = i18n?.locale ?? "und";
    ctx.dir = i18n?.dir ?? "ltr";

    ctx.t = (message: MessageDescriptor, args: Record<string, unknown> = {}) =>
      translate(message, args, scope, exprOrPathFor, ctx.render);

    return ctx as RenderTemplateContext<T>;
  };

  //----------------------------------------------------------------------------
  // mg.t: the locale's message, walked into the same tokens the other helpers
  // emit. Literal text stays text -- React escapes it in HTML, escapeStatic
  // guards it in a text body -- so a translation can never inject markup or
  // engine syntax. Markup comes only from the tag functions the template
  // passes, and values only from params.
  //----------------------------------------------------------------------------
  const i18n = opts.i18n;

  const translate = (
    message: MessageDescriptor,
    args: Record<string, unknown>,
    scope: string,
    exprOrPathFor: (path: string) => string,
    render: (path: string) => unknown,
  ): any => {
    if (!i18n) {
      throw new Error(
        `mg.t() needs \`locales\` in mailgrail.config.ts, e.g. ` +
          `locales: ["en", "fr"]. Without it the build has no locale to ` +
          `render the message in.`,
      );
    }

    const ast = messageAst(message, i18n.messages);
    const where = `mg.t(${JSON.stringify(message.id)}) in ${i18n.locale}`;

    const argPath = (name: string): string => {
      const path = args[name];
      if (typeof path === "string" && path !== "") return path;

      throw new Error(
        `${where}: the message uses {${name}}, so mg.t() needs ` +
          `${name}: "<param path>" in its arguments.`,
      );
    };

    const derived = (id: string) =>
      value(emitValue(exprOrPathFor(id), false));

    const backend: IcuBackend<any> = {
      text: (text) => text,
      join: (nodes) => (nodes.length === 1 ? nodes[0] : combine(...nodes)),
      value: (name) => render(argPath(name)),

      format: (kind, name, options) =>
        derived(i18n.derivations.add({ scope, path: argPath(name), kind, options })),

      choose: (name, spec, arms) => {
        const id = i18n.derivations.add({
          scope,
          path: argPath(name),
          kind: "choice",
          spec,
        });
        const pound = () => derived(`${id}.n`);

        // One section per arm. The generated module sets exactly one arm key,
        // so no engine needs an else -- which Mustache would not have.
        return combine(
          ...arms.flatMap((arm) => {
            const parts = ifParts(exprOrPathFor(`${id}.${arm.key}`));
            return [block(parts.open), arm.render(pound), block(parts.close)];
          }),
        );
      },

      tag: (name, children) => {
        const fn = args[name];
        if (typeof fn !== "function") {
          throw new Error(
            `${where}: the message has a <${name}> tag, so mg.t() needs ` +
              `${name}: (chunks) => ... in its arguments.`,
          );
        }
        return fn(children);
      },
    };

    return renderMessage(ast, backend);
  };

  //----------------------------------------------------------------------------
  const makeItemContext = (
    base: string,
    ejsItemVar: string | undefined,
    scope: string,
  ): any => {
    const objectCtx: any = make(base, scope);

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
        const innerCtx = makeItemContext(innerItemVar, innerItemVar, `${scope}[]`);
        const parts = eachParts(arrExpr, innerItemVar, innerIdxVar);
        return combine(block(parts.open), renderFn(innerCtx, 0), block(parts.close));
      }

      // HB: {{#each this}}, Mustache: {{#.}}
      const arrRef = engine === "handlebars" ? "this" : ".";
      const innerCtx = makeItemContext("", undefined, `${scope}[]`);
      const parts = eachParts(arrRef, "", "");
      return combine(block(parts.open), renderFn(innerCtx, 0), block(parts.close));
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
  // A text template *is* the template, so a literal delimiter someone wrote
  // would be read as engine syntax. (HTML has its own pass, escapeStaticHtml.)
  //----------------------------------------------------------------------------
  const escapeStatic = (text: string): string => {
    switch (engine) {
      case "ejs":
        return text.replace(/<%/g, "<%%");
      case "handlebars":
        return text.replace(/\{\{/g, "\\{{");
      case "mustache":
        if (text.includes("{{")) {
          throw new Error(
            `Mustache has no escape for a literal "{{", and a subject or text ` +
              `template contains one:\n\n  ${text.trim().slice(0, 80)}\n\n` +
              `Pass it in as a parameter, or use EJS or Handlebars.`,
          );
        }
        return text;
    }
  };

  //----------------------------------------------------------------------------
  // React escapes `<`, so a stray `<%` in HTML text or an attribute is already
  // inert for EJS. It leaves braces alone, though, and Handlebars and Mustache
  // would evaluate a `{{secret}}` written as plain text. Every `{` that opens a
  // `{{` becomes an entity: the mail client decodes it, the engine never sees
  // a delimiter. Only static text is touched -- the engine syntax is spliced in
  // afterwards.
  //
  // A single brace touching a tag matters too: `{` + `{{name}}` reads as the
  // triple-stache, which skips HTML escaping, and `{{name}}` + `}` is a
  // Handlebars parse error. `{` is only rewritten where it opens `{{` or ends
  // right before a tag, so CSS in <style> keeps its braces.
  //----------------------------------------------------------------------------
  const escapeStaticHtml = (
    html: string,
    afterTag: boolean,
    beforeTag: boolean,
  ): string => {
    if (engine === "ejs") return html;

    let out = html.replace(/\{(?=\{)/g, "&#123;");
    if (beforeTag) out = out.replace(/\{$/, "&#123;");
    if (afterTag) out = out.replace(/^\}/, "&#125;");
    return out;
  };

  //----------------------------------------------------------------------------
  const substituteHtml = (html: string): string => {
    const re = new RegExp(TOKEN_RE.source, "g");

    let out = "";
    let cursor = 0;
    let match: RegExpExecArray | null;

    while ((match = re.exec(html)) !== null) {
      const syntax = fragments[Number(match[1])];
      out +=
        escapeStaticHtml(html.slice(cursor, match.index), cursor > 0, true) +
        (syntax === undefined ? match[0] : syntax);
      cursor = match.index + match[0].length;
    }

    return out + escapeStaticHtml(html.slice(cursor), cursor > 0, false);
  };

  //----------------------------------------------------------------------------
  const substituteText = (text: string): string => {
    const re = new RegExp(TOKEN_RE.source, "g");

    let out = "";
    let cursor = 0;
    let match: RegExpExecArray | null;

    while ((match = re.exec(text)) !== null) {
      let stat = escapeStatic(text.slice(cursor, match.index));

      // Static text ending in an odd number of backslashes would escape the
      // Handlebars tag about to be emitted, printing it instead of the value.
      // One more backslash escapes the backslash itself.
      if (engine === "handlebars" && /(^|[^\\])(\\\\)*\\$/.test(stat)) {
        stat += "\\";
      }

      const syntax = fragments[Number(match[1])];
      out += stat + (syntax === undefined ? match[0] : syntax);
      cursor = match.index + match[0].length;
    }

    return out + escapeStatic(text.slice(cursor));
  };

  const substitute = isText ? substituteText : substituteHtml;

  //----------------------------------------------------------------------------
  // Root base:
  // - EJS: rootVar may be "" or "params"
  // - HB/Mustache: leave "" so paths are relative to the root context
  const rootBase = engine === "ejs" ? rootVar : "";

  return { ctx: make(rootBase, ""), prepareMjml, substitute };
}

//------------------------------------------------------------------------------
export type TextTemplateCompiler<T> = {
  /** Context handed to the template's `subjectTemplate` / `textTemplate`. */
  ctx: TextTemplateContext<T>;

  /** Replaces every marker in the returned string with engine syntax. */
  substitute: (text: string) => string;
};

//------------------------------------------------------------------------------
// The subject and the text body are compiled the same way as the HTML: the
// context emits tokens, the template composes them, and the engine syntax is
// substituted at the end. There is no React and no MJML in between, so the
// pieces are joined as strings and nothing is escaped.
//------------------------------------------------------------------------------
export function createTextTemplateCompiler<T>(opts: {
  engine: TemplatingEngine;
  rootVar?: string;
  guardArrays?: boolean;
  i18n?: CompilerI18n;
}): TextTemplateCompiler<T> {
  const { ctx, substitute } = createTemplateCompiler<T>({
    ...opts,
    mode: "text",
  });

  return { ctx: ctx as unknown as TextTemplateContext<T>, substitute };
}
