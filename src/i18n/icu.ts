//------------------------------------------------------------------------------
// Turning a parsed ICU message into template output.
//
// The walk is shared; what each node *becomes* is up to a backend. The build's
// backend emits engine syntax -- literal text, placeholders, and sections keyed
// on derived fields the generated module computes. The preview's evaluates the
// same nodes against real values, with the same runtime helpers. One walk for
// both is what keeps them from disagreeing about what a message says.
//------------------------------------------------------------------------------
import { parse, TYPE } from "@formatjs/icu-messageformat-parser";

//------------------------------------------------------------------------------
import type { MessageAst } from "./catalog.js";
import type { MessageDescriptor } from "./messages.js";

//------------------------------------------------------------------------------
export type FormatKind = "number" | "date" | "time";

export type ChoiceSpec =
  | {
      kind: "plural";
      pluralType: "cardinal" | "ordinal";
      offset: number;
      /** The `=N` arms, in order; arm `x<i>` is exact[i]. */
      exact: number[];
      /** The category arms present (`one`, `few`, ... always `other`). */
      categories: string[];
    }
  | {
      kind: "select";
      /** The non-`other` arms, in order; arm `a<i>` is keys[i]. */
      keys: string[];
    };

export interface Arm<N> {
  /** The arm's key in the derived object: a category, `x<i>`, `a<i>` or `other`. */
  key: string;
  /** Renders the arm. `pound` is what `#` inside it renders as. */
  render: (pound: () => N) => N;
}

export interface IcuBackend<N> {
  text(text: string): N;
  join(nodes: N[]): N;
  /** `{name}`: the argument, as it is. */
  value(arg: string): N;
  /** `{name, number|date|time, ...}`: the argument, formatted. */
  format(kind: FormatKind, arg: string, options: Record<string, unknown>): N;
  /** `{name, plural|select, ...}`. */
  choose(arg: string, spec: ChoiceSpec, arms: Arm<N>[]): N;
  /** `<tag>children</tag>`. */
  tag(name: string, children: N): N;
}

//------------------------------------------------------------------------------
export function renderMessage<N>(ast: MessageAst, backend: IcuBackend<N>): N {
  const walk = (nodes: MessageAst, pound: (() => N) | null): N =>
    backend.join(
      nodes.map((node): N => {
        switch (node.type) {
          case TYPE.literal:
            return backend.text(node.value);

          case TYPE.argument:
            return backend.value(node.value);

          case TYPE.number:
            return backend.format("number", node.value, numberOptions(node.style));

          case TYPE.date:
            return backend.format("date", node.value, dateOptions(node.style, "date"));

          case TYPE.time:
            return backend.format("time", node.value, dateOptions(node.style, "time"));

          case TYPE.pound:
            // Outside a plural, ICU reads `#` as a literal.
            return pound ? pound() : backend.text("#");

          case TYPE.tag:
            return backend.tag(node.value, walk(node.children, pound));

          case TYPE.select: {
            const keys = Object.keys(node.options).filter((k) => k !== "other");
            const arms = Object.entries(node.options).map(([key, option]) => ({
              key: key === "other" ? "other" : `a${keys.indexOf(key)}`,
              // A select does not rebind `#`: it still means the enclosing plural.
              render: () => walk(option.value, pound),
            }));
            return backend.choose(node.value, { kind: "select", keys }, arms);
          }

          case TYPE.plural: {
            const exact: number[] = [];
            const categories: string[] = [];
            const arms: Arm<N>[] = [];

            for (const [key, option] of Object.entries(node.options)) {
              let armKey = key;
              if (key.startsWith("=")) {
                armKey = `x${exact.length}`;
                exact.push(Number(key.slice(1)));
              } else {
                categories.push(key);
              }
              arms.push({ key: armKey, render: (p) => walk(option.value, p) });
            }

            return backend.choose(
              node.value,
              {
                kind: "plural",
                pluralType: node.pluralType ?? "cardinal",
                offset: node.offset ?? 0,
                exact,
                categories,
              },
              arms,
            );
          }
        }
      }),
    );

  return walk(ast, null);
}

//------------------------------------------------------------------------------
// ICU style keywords and skeletons -> Intl options. Skeletons arrive already
// parsed (`shouldParseSkeletons`); the keywords are ICU's own, mapped to what
// intl-messageformat gives them so messages mean what translators expect.
//------------------------------------------------------------------------------
function numberOptions(style: unknown): Record<string, unknown> {
  if (style && typeof style === "object" && "parsedOptions" in style) {
    return { ...(style as { parsedOptions: Record<string, unknown> }).parsedOptions };
  }

  switch (style) {
    case "integer":
      return { maximumFractionDigits: 0 };
    case "percent":
      return { style: "percent" };
    default:
      return {};
  }
}

function dateOptions(style: unknown, kind: "date" | "time"): Record<string, unknown> {
  if (style && typeof style === "object" && "parsedOptions" in style) {
    return { ...(style as { parsedOptions: Record<string, unknown> }).parsedOptions };
  }

  const keyword =
    style === "short" || style === "medium" || style === "long" || style === "full"
      ? style
      : "medium";

  return kind === "date" ? { dateStyle: keyword } : { timeStyle: keyword };
}

//------------------------------------------------------------------------------
// The message a descriptor stands for in one locale. A descriptor the catalog
// never saw -- defined after the registry was read, or built by hand -- still
// renders its own source text.
//------------------------------------------------------------------------------
export function messageAst(
  message: MessageDescriptor,
  messages: Map<string, MessageAst> | undefined,
): MessageAst {
  if (!message || typeof message.id !== "string") {
    throw new Error(
      `mg.t() takes a message from defineMessages(), got ${
        message === null ? "null" : typeof message
      }.`,
    );
  }

  const known = messages?.get(message.id);
  if (known) return known;

  return parse(message.defaultMessage.normalize("NFC"), {
    shouldParseSkeletons: true,
    requiresOtherClause: true,
  });
}

//------------------------------------------------------------------------------
// Derived fields
//
// Whatever a message needs computed per email -- a plural's arm, a formatted
// number -- becomes a field the generated module adds to the params before the
// engine sees them. A derivation lives on the object that holds its argument
// (the root, an array element, a `with` scope), so the engine finds it relative
// to wherever the message was rendered.
//------------------------------------------------------------------------------
export type Derivation =
  | {
      id: string;
      /** Schema path of the holding object: "", "items[]", "profile". */
      scope: string;
      /** Path of the argument within that object. */
      path: string;
      kind: "choice";
      spec: ChoiceSpec;
    }
  | {
      id: string;
      scope: string;
      path: string;
      kind: FormatKind;
      options: Record<string, unknown>;
    };

type NewDerivation =
  | Omit<Extract<Derivation, { kind: "choice" }>, "id">
  | Omit<Extract<Derivation, { kind: FormatKind }>, "id">;

//------------------------------------------------------------------------------
// One registry per template, shared by every locale and every part. Identical
// derivations share an id, so a plural every locale spells the same way is
// computed once; the ids are handed out in compile order, which is fixed, so
// a rebuild emits the same names.
//------------------------------------------------------------------------------
export class Derivations {
  readonly list: Derivation[] = [];
  private readonly byKey = new Map<string, string>();

  add(derivation: NewDerivation): string {
    const key = JSON.stringify(derivation);
    let id = this.byKey.get(key);

    if (id === undefined) {
      id = `__mg_d${this.list.length + 1}`;
      this.byKey.set(key, id);
      this.list.push({ ...derivation, id } as Derivation);
    }

    return id;
  }
}
