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

/** The render context. Typed against your own schema in a real template. */
type Ctx = any;

export type ContextFixture = {
  /** Stable id, referenced from MDX and matching the region marker. */
  id: string;
  /** Which `mg.*` method this demonstrates -- coverage is asserted. */
  api: "render" | "when" | "unless" | "each" | "with";
  title: string;
  summary?: string;
  /** Real values, fed to every engine and to the preview context. */
  sample: Record<string, unknown>;
  build: (mg: Ctx) => ReactNode;
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
      () => <p>You have premium access.</p>,
      () => <p>Upgrade to unlock everything.</p>,
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
      () => <p>Hi {mg.render("nickname")}!</p>,
      () => <p>Hi there!</p>,
    )}
  </div>
);
// #endregion doc:when-optional

//------------------------------------------------------------------------------
// #region doc:unless
const verifyBanner = (mg: Ctx) => (
  <div>{mg.unless("isVerified", () => <p>Please confirm your address.</p>)}</div>
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
            () => <td>Shipped</td>,
            () => <td>Pending</td>,
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
];
