//------------------------------------------------------------------------------
// The parameter DSL, documented.
//
// This file holds the *prose* and nothing else. Each example is a source string
// which the generator evaluates against the real `t` export and then renders
// with mailgrail's own `emitObjectType`, so the "-> username: string" line on
// the page is produced by the compiler rather than transcribed by hand. An
// example that no longer evaluates fails generation instead of shipping.
//------------------------------------------------------------------------------

export type DslExample = {
  /** Optional caption above the example. */
  label?: string;
  /** Source of a `t.object({...})`, verbatim. Displayed *and* evaluated. */
  source: string;
};

export type DslDoc = {
  /** Must match a key of the `t` export -- coverage is asserted both ways. */
  id: string;
  /** Signature as a reader should think of it, not as TypeScript spells it. */
  signature: string;
  /** One line; also used as the card's summary. */
  summary: string;
  /** Markdown. */
  description?: string;
  examples: DslExample[];
  /** Markdown callouts rendered under the examples. */
  notes?: string[];
  seeAlso?: string[];
};

//------------------------------------------------------------------------------
export const dslDocs: DslDoc[] = [
  {
    id: "string",
    signature: "t.string(): StringSchema",
    summary: "A text parameter.",
    examples: [{ source: `t.object({ username: t.string() })` }],
  },

  {
    id: "number",
    signature: "t.number(): NumberSchema",
    summary: "A numeric parameter.",
    description:
      "Rendered with the engine's default number formatting. Format it yourself " +
      "-- currency, thousands separators -- before passing it in, since the " +
      "compiled template has no access to your locale.",
    examples: [{ source: `t.object({ invoiceTotal: t.number() })` }],
  },

  {
    id: "boolean",
    signature: "t.boolean(): BooleanSchema",
    summary: "A true/false parameter, usually used to branch.",
    description:
      "On its own a boolean renders as `true` or `false`. It is far more useful " +
      "as the subject of `mg.when` or `mg.unless`.",
    examples: [{ source: `t.object({ isAdmin: t.boolean() })` }],
    seeAlso: ["render-context"],
  },

  {
    id: "object",
    signature: "t.object(shape): ObjectSchema",
    summary: "A group of named parameters.",
    description:
      "Objects nest freely. Reach for `mg.with` in a template to scope to one " +
      "and stop repeating the path prefix.",
    examples: [
      {
        source: `t.object({
  address: t.object({
    street: t.string(),
    city: t.string(),
    country: t.string(),
  }),
})`,
      },
    ],
  },

  {
    id: "array",
    signature: "t.array(element): ArraySchema",
    summary: "A repeated parameter, iterated with `mg.each`.",
    examples: [
      { label: "Of primitives", source: `t.object({ tags: t.array(t.string()) })` },
      {
        label: "Of objects",
        source: `t.object({
  items: t.array(
    t.object({
      name: t.string(),
      quantity: t.number(),
      isFulfilled: t.boolean(),
    }),
  ),
})`,
      },
      {
        label: "Of arrays",
        source: `t.object({ matrix: t.array(t.array(t.string())) })`,
      },
    ],
  },

  {
    id: "optional",
    signature: "t.optional(schema): OptionalSchema",
    summary: "The parameter may be omitted, and renders as nothing when it is.",
    description:
      "Use this when an absent value genuinely has nothing to show. To branch on " +
      "one, reach for `mg.when`; in `subjectTemplate` and `textTemplate`, which " +
      "receive plain params rather than a render context, guard it yourself.",
    examples: [{ source: `t.object({ nickname: t.optional(t.string()) })` }],
    seeAlso: ["default"],
  },

  {
    id: "default",
    signature: "t.default(schema, value): DefaultedSchema",
    summary:
      "The parameter may be omitted, and renders `value` when it is.",
    description:
      "Omittable on input, never undefined at render time -- so a template can " +
      "use it unguarded.",
    examples: [{ source: `t.object({ role: t.default(t.string(), "user") })` }],
    notes: [
      "**`optional` vs `default`** — both let the caller leave the key out. They " +
        "differ only in what appears when it is absent: nothing, or the stand-in " +
        "value.",
      "`t.default(t.optional(t.string()), \"user\")` is valid and means exactly " +
        "`t.default(t.string(), \"user\")`. The nesting is never required.",
    ],
    seeAlso: ["optional"],
  },
];
