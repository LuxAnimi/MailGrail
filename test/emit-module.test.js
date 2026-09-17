import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { t } from "../lib/src/dsl/index.js";
import { planTemplateEntries } from "../lib/src/cli/emit-types.js";
import { ENGINES } from "../lib/src/cli/engines.js";
import {
  emitIndexDts,
  emitIndexJs,
  emitTemplateModule,
  outputPackageJson,
} from "../lib/src/cli/emit-module.js";

//------------------------------------------------------------------------------
const entriesFor = (...names) => planTemplateEntries(names.map((name) => ({ name })));

const templateModule = (format, name = "welcome-email") =>
  emitTemplateModule({
    template: {
      name,
      sender: "hello@example.com",
      params: t.object({ username: t.string() }),
    },
    entry: entriesFor(name)[0],
    spec: ENGINES.ejs,
    format,
    html: "<p><%- username %></p>",
    text: "hi <%- username %>",
    subject: "hi",
  });

//------------------------------------------------------------------------------
describe("planTemplateEntries", () => {
  test("derives the file, function and type names", () => {
    assert.deepEqual(entriesFor("order-confirmation"), [
      {
        name: "order-confirmation",
        file: "order-confirmation",
        fnName: "renderOrderConfirmation",
        typeName: "OrderConfirmationParams",
      },
    ]);
  });

  test("accepts names that stay valid identifiers", () => {
    const [digits, underscore] = entriesFor("2fa-code", "order_confirmation");

    assert.equal(digits.fnName, "render2faCode");
    assert.equal(underscore.fnName, "renderOrder_confirmation");
  });

  test("rejects two names that compile to the same function", () => {
    assert.throws(() => entriesFor("welcome-email", "welcomeEmail"), {
      message: /both compile to `renderWelcomeEmail`/,
    });
  });

  // macOS and Windows would fold these into one file, so the second template
  // would silently overwrite the first. These two keep distinct function names,
  // so it is the filename check that has to catch them.
  test("rejects names that differ only in case", () => {
    assert.throws(() => entriesFor("welcomeEmail", "welcomeemail"), {
      message: /differ only in case/,
    });

    // When the names also collapse to one function, that is the better
    // complaint, so it wins.
    assert.throws(() => entriesFor("welcome", "Welcome"), {
      message: /both compile to `renderWelcome`/,
    });
  });

  test("rejects a name that cannot be an identifier", () => {
    assert.throws(() => entriesFor("welcome.email"), {
      message: /not a valid identifier/,
    });
  });

  test("rejects the reserved index name", () => {
    assert.throws(() => entriesFor("index"), { message: /is reserved/ });
    assert.throws(() => entriesFor("Index"), { message: /is reserved/ });
  });

  test("rejects a path or an empty name", () => {
    assert.throws(() => entriesFor("emails/welcome"), { message: /cannot be a path/ });
    assert.throws(() => entriesFor(""), { message: /has no name/ });
  });
});

//------------------------------------------------------------------------------
describe("emitTemplateModule", () => {
  test("esm imports the engine and exports the render function", () => {
    const out = templateModule("esm");

    assert.match(out, /^import ejs from "ejs";/);
    assert.match(out, /export function renderWelcomeEmail\(input\) \{/);
    assert.doesNotMatch(out, /require\(/);
  });

  test("cjs requires the engine and assigns to exports", () => {
    const out = templateModule("cjs");

    assert.match(out, /^"use strict";/);
    assert.match(out, /const ejs = require\("ejs"\);/);
    // The plain assignment is what cjs-module-lexer detects, so an ESM
    // consumer can still import the name.
    assert.match(out, /exports\.renderWelcomeEmail = renderWelcomeEmail;/);
    assert.doesNotMatch(out, /^import /m);
  });

  test("both formats carry the same render body", () => {
    for (const format of ["esm", "cjs"]) {
      const out = templateModule(format);
      assert.match(out, /function renderWelcomeEmail\(input\) \{/);
      assert.match(out, /sender: "hello@example\.com",/);
      assert.match(out, /const params = normalizeParams\(input\);/);
    }
  });
});

//------------------------------------------------------------------------------
describe("emitIndexJs", () => {
  const entries = entriesFor("welcome", "order-confirmation");

  test("esm re-exports every template and a frozen map", () => {
    const out = emitIndexJs(entries, "esm");

    assert.match(out, /import \{ renderWelcome \} from "\.\/welcome\.js";/);
    assert.match(out, /export \{ renderWelcome, renderOrderConfirmation \};/);
    assert.match(out, /export const templates = Object\.freeze\(\{/);
    assert.match(out, /"order-confirmation": renderOrderConfirmation,/);
  });

  test("cjs does the same with require and exports", () => {
    const out = emitIndexJs(entries, "cjs");

    assert.match(out, /const \{ renderWelcome \} = require\("\.\/welcome\.js"\);/);
    assert.match(out, /exports\.renderWelcome = renderWelcome;/);
    assert.match(out, /exports\.templates = Object\.freeze\(\{/);
  });
});

//------------------------------------------------------------------------------
describe("emitIndexDts", () => {
  test("re-exports functions and params types, and types the map", () => {
    const out = emitIndexDts(entriesFor("welcome", "order-confirmation"));

    assert.match(out, /import \{ renderWelcome, type WelcomeParams \} from "\.\/welcome\.js";/);
    assert.match(out, /export type \{ WelcomeParams, OrderConfirmationParams \};/);
    assert.match(out, /readonly "welcome": typeof renderWelcome;/);
    assert.match(out, /export type TemplateName = keyof typeof templates;/);
  });
});

//------------------------------------------------------------------------------
describe("outputPackageJson", () => {
  test("type follows the module format", () => {
    assert.equal(outputPackageJson("esm", true).type, "module");
    assert.equal(outputPackageJson("cjs", true).type, "commonjs");
  });

  test("exports reach the index and any single template", () => {
    const { exports } = outputPackageJson("esm", true);

    assert.deepEqual(exports["."], { types: "./index.d.ts", default: "./index.js" });
    assert.deepEqual(exports["./*"], { types: "./*.d.ts", default: "./*.js" });
  });

  test("without typescript the targets are plain paths", () => {
    const { exports } = outputPackageJson("cjs", false);

    assert.equal(exports["."], "./index.js");
    assert.equal(exports["./*"], "./*.js");
  });
});
