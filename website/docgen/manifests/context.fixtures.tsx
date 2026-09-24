//------------------------------------------------------------------------------
// Render-context fixtures.
//
// Each entry is a real template. The generator compiles it through EJS,
// Handlebars and Mustache *and* renders it with `sample` through both the
// preview context and each engine, then asserts all four agree. The docs are
// therefore an integration test: if the compiled Mustache output stops matching
// what the preview shows, the page cannot be generated.
//
// Bare React elements, no MJML -- like the unit tests in test/. That keeps
// generation fast and the compiled output short enough to read on a page.
//
// Each template is a standalone `const` wrapped in a `#region doc:*` marker,
// because that region is what the site displays: a reader should see the shape
// they would actually write, not this file's fixture plumbing.
//------------------------------------------------------------------------------
import type { ReactNode } from "react";

import { t } from "../../../src/dsl/index.js";
import { defineMessages } from "../../../src/i18n/messages.js";
import type { Schema } from "../../../src/dsl/schemas.js";
import type { MessageDescriptor } from "../../../src/i18n/messages.js";

/** The render context. Typed against your own schema in a real template. */
type Ctx = any;

/**
 * Localization for one fixture. With it, the fixture is built the way a
 * localized project is -- once per locale, into the real render module -- and
 * rendered through that module in `locale`, since only the module computes
 * what plurals and formatting need.
 */
export type FixtureI18n = {
  /** The locales built; the first is the default, the source messages' language. */
  locales: string[];
  /** The locale the example is rendered in. */
  locale: string;
  /** The template's source messages, as defineMessages() returned them. */
  messages: MessageDescriptor[];
  /** Translations, by locale then message id. */
  catalogs: Record<string, Record<string, string>>;
  timeZone?: string;
};

export type ContextFixture = {
  /** Stable id, referenced from MDX and matching the region marker. */
  id: string;
  /** Which `mg.*` method this demonstrates -- coverage is asserted. */
  api: "render" | "when" | "unless" | "each" | "with" | "t" | "locale" | "dir";
  title: string;
  summary?: string;
  /** Real values, fed to every engine and to the preview context. */
  sample: Record<string, unknown>;
  build: (mg: Ctx) => ReactNode;
  /** Required with `i18n`: the render module normalizes params against it. */
  params?: Schema<any>;
  i18n?: FixtureI18n;
  /**
   * Set false where preview and build legitimately disagree, with a note
   * explaining why. Everything else must reach parity or generation fails.
   */
  expectParity?: boolean;
  parityNote?: string;
};

//------------------------------------------------------------------------------
// #region doc:render
const greeting = (mg: Ctx) => (
  <p>
    Welcome, {mg.render("username")} — invoice {mg.render("invoice.number")}
  </p>
);
// #endregion doc:render

//------------------------------------------------------------------------------
// #region doc:when
const premiumNotice = (mg: Ctx) => (
  <div>
    {mg.when(
      "isPremium",
      () => (
        <p>You have premium access.</p>
      ),
      () => (
        <p>Upgrade to unlock everything.</p>
      ),
    )}
  </div>
);
// #endregion doc:when

//------------------------------------------------------------------------------
// #region doc:when-optional
const salutation = (mg: Ctx) => (
  <div>
    {mg.when(
      "nickname",
      () => (
        <p>Hi {mg.render("nickname")}!</p>
      ),
      () => (
        <p>Hi there!</p>
      ),
    )}
  </div>
);
// #endregion doc:when-optional

//------------------------------------------------------------------------------
// #region doc:unless
const verifyBanner = (mg: Ctx) => (
  <div>
    {mg.unless("isVerified", () => (
      <p>Please confirm your address.</p>
    ))}
  </div>
);
// #endregion doc:unless

//------------------------------------------------------------------------------
// #region doc:each-primitives
const tagList = (mg: Ctx) => (
  <ul>
    {mg.each("tags", (tag: Ctx, i: number) => (
      <li key={i}>{tag.render()}</li>
    ))}
  </ul>
);
// #endregion doc:each-primitives

//------------------------------------------------------------------------------
// #region doc:each-objects
const orderTable = (mg: Ctx) => (
  <table>
    <tbody>
      {mg.each("items", (item: Ctx, i: number) => (
        <tr key={i}>
          <td>{item.render("name")}</td>
          <td>{item.render("quantity")}</td>
          {item.when(
            "isFulfilled",
            () => (
              <td>Shipped</td>
            ),
            () => (
              <td>Pending</td>
            ),
          )}
        </tr>
      ))}
    </tbody>
  </table>
);
// #endregion doc:each-objects

//------------------------------------------------------------------------------
// #region doc:with
const planSummary = (mg: Ctx) => (
  <div>
    {mg.with("user", (user: Ctx) => (
      <>
        <p>Hello, {user.render("name")}</p>
        {user.with("plan", (plan: Ctx) => (
          <p>
            Your {plan.render("name")} plan runs to {plan.render("expiresAt")}.
          </p>
        ))}
      </>
    ))}
  </div>
);
// #endregion doc:with

//------------------------------------------------------------------------------
// #region doc:t
const shipping = defineMessages("shipping", {
  sent:
    "{count, plural, one {# parcel is} other {# parcels are}} on the way " +
    "to <b>{city}</b>.",
});

const shippingNotice = (mg: Ctx) => (
  <p>
    {mg.t(shipping.sent, {
      count: "parcels",
      city: "address.city",
      b: (chunks: ReactNode) => <strong>{chunks}</strong>,
    })}
  </p>
);
// #endregion doc:t

//------------------------------------------------------------------------------
// #region doc:locale
const support = defineMessages("support", {
  link: "Help and support",
});

const helpLink = (mg: Ctx) => (
  <a href={`https://example.com/${mg.locale}/help`}>{mg.t(support.link)}</a>
);
// #endregion doc:locale

//------------------------------------------------------------------------------
// #region doc:dir
const orders = defineMessages("orders", {
  shipped: "Your order has shipped.",
});

const shippedBanner = (mg: Ctx) => (
  <p dir={mg.dir} style={{ textAlign: mg.dir === "rtl" ? "right" : "left" }}>
    {mg.t(orders.shipped)}
  </p>
);
// #endregion doc:dir

//------------------------------------------------------------------------------
export const fixtures: ContextFixture[] = [
  {
    id: "render",
    api: "render",
    title: "Rendering a value",
    summary:
      "`mg.render(path)` prints a scalar. The path is dot-separated for nested " +
      "objects and typed against your schema, so a key that does not exist is a " +
      "compile error rather than a blank space in a sent email.",
    sample: { username: "Alice", invoice: { number: "INV-2032" } },
    build: greeting,
  },

  {
    id: "when",
    api: "when",
    title: "Branching on a boolean",
    summary:
      "`mg.when(path, render, otherwise?)` renders its first branch when the " +
      "value is truthy. The `otherwise` branch is optional.",
    sample: { isPremium: true },
    build: premiumNotice,
  },

  {
    id: "when-optional",
    api: "when",
    title: "Testing whether a string is present",
    summary:
      "A string path works too, as a presence test. An omitted " +
      "`t.optional(t.string())` renders as an empty string, which every engine " +
      "treats as false. Number paths are rejected: `0` would read as absent.",
    sample: { nickname: "Al" },
    build: salutation,
  },

  {
    id: "unless",
    api: "unless",
    title: "Branching on a falsy value",
    summary: "`mg.unless` is the inverse of `mg.when`.",
    sample: { isVerified: false },
    build: verifyBanner,
  },

  {
    id: "each-primitives",
    api: "each",
    title: "Iterating an array of primitives",
    summary:
      "For an array of scalars call `item.render()` with no argument — there is " +
      "no key to name.",
    sample: { tags: ["billing", "urgent"] },
    build: tagList,
  },

  {
    id: "each-objects",
    api: "each",
    title: "Iterating an array of objects",
    summary:
      "For an array of objects each item is a full context scoped to the " +
      "element — `render`, `when`, `unless`, `each` and `with` all work on it.",
    sample: {
      items: [
        { name: "Widget", quantity: 2, isFulfilled: true },
        { name: "Gadget", quantity: 1, isFulfilled: false },
      ],
    },
    build: orderTable,
  },

  {
    id: "with",
    api: "with",
    title: "Scoping to a nested object",
    summary:
      "`mg.with(path, render)` scopes the context so a deep path is written once " +
      "instead of on every line.",
    sample: {
      user: { name: "Alice", plan: { name: "Pro", expiresAt: "2027-01-31" } },
    },
    build: planSummary,
  },

  {
    id: "t",
    api: "t",
    title: "Rendering a localized message",
    summary:
      "`mg.t(message, args)` renders a message from `defineMessages()` in the " +
      "locale being built. Each argument maps an ICU placeholder to a **param " +
      "path**, not a value, and each rich-text tag to a function that wraps its " +
      "contents. Plurals and number or date formats are decided per email, in " +
      "the email's locale.",
    params: t.object({
      parcels: t.number(),
      address: t.object({ city: t.string() }),
    }),
    sample: { parcels: 2, address: { city: "Lyon" } },
    i18n: {
      locales: ["en", "fr"],
      locale: "fr",
      messages: [shipping.sent],
      catalogs: {
        fr: {
          "shipping.sent":
            "{count, plural, one {# colis est} many {# de colis sont} " +
            "other {# colis sont}} en route " +
            "vers <b>{city}</b>.",
        },
      },
    },
    build: shippingNotice,
  },

  {
    id: "locale",
    api: "locale",
    title: "The locale being built",
    summary:
      "`mg.locale` is the canonical tag of the locale this copy of the template " +
      "is built for -- a plain string at build time, so it can go anywhere, " +
      "attributes included. Without `locales` in the config it is `und`.",
    params: t.object({}),
    sample: {},
    i18n: {
      locales: ["en", "fr"],
      locale: "fr",
      messages: [support.link],
      catalogs: { fr: { "support.link": "Aide et support" } },
    },
    build: helpLink,
  },

  {
    id: "dir",
    api: "dir",
    title: "Text direction",
    summary:
      "`mg.dir` is `rtl` for a right-to-left locale such as Arabic or Hebrew " +
      "and `ltr` otherwise. The `<html>` element already carries it; use it " +
      "where a layout has to mirror, such as alignment.",
    params: t.object({}),
    sample: {},
    i18n: {
      locales: ["en", "ar"],
      locale: "ar",
      messages: [orders.shipped],
      catalogs: { ar: { "orders.shipped": "تم شحن طلبك." } },
    },
    build: shippedBanner,
  },
];
