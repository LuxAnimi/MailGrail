//------------------------------------------------------------------------------
// Source messages: the default locale's text, written in code.
//
// Keeping the source in TypeScript is what types `mg.t()` without a codegen
// step -- a message is a value, so a typo'd key is a compile error in the
// template itself. The other locales live in JSON catalogs keyed by `id`.
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
export interface MessageDescriptor<
  Id extends string = string,
  Source extends string = string,
> {
  /** Catalog key: `<namespace>.<key>`. */
  readonly id: Id;
  /** The default locale's ICU message. */
  readonly defaultMessage: Source;
}

//------------------------------------------------------------------------------
export type MessagesOf<NS extends string, M extends Record<string, string>> = {
  readonly [K in keyof M & string]: MessageDescriptor<`${NS}.${K}`, M[K]>;
};

//------------------------------------------------------------------------------
// Every defineMessages() call registers here, so `build` and `extract` can see
// messages no template has used yet. The registry is keyed on a global symbol
// rather than held in this module: templates are bundled by esbuild with their
// own copy of MailGrail, and the CLI has to read what *that* copy registered.
//------------------------------------------------------------------------------
const REGISTRY_KEY = Symbol.for("mailgrail.messages");

export interface RegisteredMessage {
  id: string;
  defaultMessage: string;
}

type Registry = {
  messages: Map<string, RegisteredMessage>;
  /** Ids defined more than once with different text. */
  conflicts: Set<string>;
};

function registry(): Registry {
  const store = globalThis as { [REGISTRY_KEY]?: Registry };
  return (store[REGISTRY_KEY] ??= { messages: new Map(), conflicts: new Set() });
}

/** The messages registered so far, in definition order. */
export function registeredMessages(): RegisteredMessage[] {
  return [...registry().messages.values()];
}

/** Forgets every registered message, before templates are (re)loaded. */
export function clearRegisteredMessages(): void {
  registry().messages.clear();
  registry().conflicts.clear();
}

//------------------------------------------------------------------------------
// Two definitions of one id with different text would leave the catalog with
// one key and two sources. That is only knowable once every module has loaded
// -- and in the preview a module re-running after an edit redefines its own
// messages, which is not a conflict -- so defineMessages() records it, the
// newest text wins, and the build and `extract` reject it here, having loaded
// everything into a cleared registry.
//------------------------------------------------------------------------------
export function assertNoMessageConflicts(): void {
  const conflicts = [...registry().conflicts];
  if (conflicts.length === 0) return;

  throw new Error(
    `${conflicts.length === 1 ? "A message is" : "Messages are"} defined ` +
      `twice with different text: ${conflicts.map((id) => JSON.stringify(id)).join(", ")}. ` +
      `Give one of the defineMessages() calls another namespace.`,
  );
}

//------------------------------------------------------------------------------
// Namespaces and keys become catalog ids, which translators and translation
// platforms see; a dot inside a key would make "a.b" + "c" and "a" + "b.c"
// the same id.
//------------------------------------------------------------------------------
const NAMESPACE_RE = /^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)*$/;
const KEY_RE = /^[A-Za-z0-9_-]+$/;

export function defineMessages<
  const NS extends string,
  const M extends Record<string, string>,
>(namespace: NS, messages: M): MessagesOf<NS, M> {
  if (!NAMESPACE_RE.test(namespace)) {
    throw new Error(
      `defineMessages: namespace ${JSON.stringify(namespace)} must be made of ` +
        `letters, digits, "_" and "-", optionally dot-separated.`,
    );
  }

  const out: Record<string, MessageDescriptor> = {};

  for (const [key, defaultMessage] of Object.entries(messages)) {
    if (!KEY_RE.test(key)) {
      throw new Error(
        `defineMessages(${JSON.stringify(namespace)}): key ` +
          `${JSON.stringify(key)} must be made of letters, digits, "_" and "-".`,
      );
    }
    if (typeof defaultMessage !== "string") {
      throw new Error(
        `defineMessages(${JSON.stringify(namespace)}): ${key} must be a string.`,
      );
    }

    const id = `${namespace}.${key}`;
    const { messages: registered, conflicts } = registry();
    const existing = registered.get(id);

    if (existing && existing.defaultMessage !== defaultMessage) conflicts.add(id);

    registered.set(id, { id, defaultMessage });
    out[key] = Object.freeze({ id, defaultMessage });
  }

  return Object.freeze(out) as MessagesOf<NS, M>;
}
