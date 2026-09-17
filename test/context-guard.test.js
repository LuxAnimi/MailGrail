import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { guardContext } from "../lib/src/cli/rendering/context-guard.js";

//------------------------------------------------------------------------------
const where = { template: "welcome-email", part: "subjectTemplate" };

describe("context guard", () => {
  test("reading a parameter off the context throws a migration hint", () => {
    const mg = guardContext({ render: () => "x" }, where);

    assert.throws(() => mg.username, {
      message: /welcome-email: subjectTemplate read mg\.username/,
    });
    assert.throws(() => mg.username, { message: /mg\.render\("username"\)/ });
  });

  test("the context's own methods pass through", () => {
    const mg = guardContext({ render: () => "x", when: () => "y" }, where);

    assert.equal(mg.render(), "x");
    assert.equal(mg.when(), "y");
  });

  // The runtime probes these on any value it is handed; throwing would break
  // `await`, JSON.stringify and console.log rather than the template.
  test("symbols and runtime probes do not throw", () => {
    const mg = guardContext({ render: () => "x" }, where);

    assert.equal(mg[Symbol.iterator], undefined);
    assert.equal(mg.then, undefined);
    assert.equal(mg.toJSON, undefined);
    assert.doesNotThrow(() => `${JSON.stringify({ mg })}`);
  });
});
