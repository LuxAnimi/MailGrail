import type { ReactNode } from "react";
import { createElement, Fragment } from "react";

//------------------------------------------------------------------------------
import type { PreviewTemplateContext, TextTemplateContext } from "../types.js";
import type { MessageAst } from "../../i18n/catalog.js";
import { messageAst, renderMessage } from "../../i18n/icu.js";
import type { IcuBackend } from "../../i18n/icu.js";
import type { MessageDescriptor } from "../../i18n/messages.js";
import { pseudoLocalize } from "../../i18n/pseudo.js";
import {
  __mgDate,
  __mgNumber,
  __mgPlural,
  __mgSelect,
} from "../../i18n/runtime.js";

//------------------------------------------------------------------------------
// What the preview renders messages with. The formatting locale and the text
// can differ: the pseudo-locale formats as the default locale but rewrites
// every literal, so an untranslated string stands out.
//------------------------------------------------------------------------------
export interface PreviewI18n {
  /** Exposed as mg.locale and used for plurals and formatting. */
  locale: string;
  dir: "ltr" | "rtl";
  timeZone: string;
  /** This locale's messages; undefined falls back to each message's source. */
  messages: Map<string, MessageAst> | undefined;
  /** Ids shown in the default locale's text, marked in the HTML preview. */
  fallbacks?: Set<string>;
  /** Rewrite literals as pseudo-text. */
  pseudo?: boolean;
}

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
  /** Pieces of one message, as one node. */
  join: (nodes: N[]) => N;
  /** Marks a message whose translation is missing, where that can be shown. */
  flag: (node: N, title: string) => N;
};

const NODE_KIT: Kit<ReactNode> = {
  none: null,
  one: (node) => node as ReactNode,
  list: (nodes) => nodes as ReactNode,
  // As arguments rather than an array, so React does not ask for keys.
  join: (nodes) => createElement(Fragment, null, ...nodes),
  flag: (node, title) =>
    createElement(
      "span",
      {
        title,
        style: {
          background: "rgba(255, 196, 0, 0.35)",
          outline: "1px dashed rgba(200, 140, 0, 0.9)",
        },
      },
      node,
    ),
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
  join: (nodes) => nodes.map((node) => TEXT_KIT.one(node)).join(""),
  // Plain text has nowhere to show a mark; the HTML preview carries it.
  flag: (node) => node,
};

//------------------------------------------------------------------------------
function makePreviewCore<N>(
  params: unknown,
  kit: Kit<N>,
  i18n: PreviewI18n | undefined,
): any {
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
          return render(makePreviewCore(elem, kit, i18n), index);
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
        return r(makePreviewCore(inner, kit, i18n), i);
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
      render(makePreviewCore(isPlainObject(value) ? value : {}, kit, i18n)),
    );
  };

  mg.locale = i18n?.locale ?? "und";
  mg.dir = i18n?.dir ?? "ltr";

  //----------------------------------------------------------------------------
  // The same walk the build does (i18n/icu.ts), evaluated here and now with the
  // runtime helpers the generated module embeds -- so a plural picks the same
  // arm and a date reads the same in the preview as in the email.
  mg.t = (message: MessageDescriptor, args: Record<string, unknown> = {}) => {
    if (!i18n) {
      throw new Error(
        `mg.t() needs \`locales\` in mailgrail.config.ts, e.g. ` +
          `locales: ["en", "fr"].`,
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
    const raw = (name: string) => getPath(params as any, argPath(name));
    const placeholder = (name: string) =>
      `<${argPath(name).split(".").pop() ?? name}>`;
    const isEmpty = (v: unknown) => v === "" || v === undefined || v === null;

    const backend: IcuBackend<N> = {
      text: (text) => (i18n.pseudo ? pseudoLocalize(text) : text) as N,
      join: kit.join,
      value: (name) => mg.render(argPath(name)),

      format: (kind, name, options) => {
        const v = raw(name);
        if (isEmpty(v)) return placeholder(name) as N;
        return (
          kind === "number"
            ? __mgNumber(i18n.locale, v, options)
            : __mgDate(i18n.locale, i18n.timeZone, v, options)
        ) as N;
      },

      choose: (name, spec, arms) => {
        const v = raw(name);
        const picked: Record<string, unknown> =
          spec.kind === "plural"
            ? __mgPlural(i18n.locale, v, spec.pluralType, spec.offset, spec.exact, spec.categories)
            : __mgSelect(v, spec.keys);
        const arm = arms.find((a) => picked[a.key] === true);
        return arm ? arm.render(() => String(picked["n"] ?? "") as N) : kit.none;
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

    const out = renderMessage(ast, backend);

    return i18n.fallbacks?.has(message.id)
      ? kit.flag(out, `No ${i18n.locale} translation yet: ${message.id}`)
      : out;
  };

  return mg;
}

//------------------------------------------------------------------------------
export function makeTemplatePreviewContext<T>(
  params: T,
  i18n?: PreviewI18n,
): PreviewTemplateContext<T> {
  return makePreviewCore(params, NODE_KIT, i18n) as PreviewTemplateContext<T>;
}

//------------------------------------------------------------------------------
export function makeTextPreviewContext<T>(
  params: T,
  i18n?: PreviewI18n,
): TextTemplateContext<T> {
  return makePreviewCore(params, TEXT_KIT, i18n) as TextTemplateContext<T>;
}
