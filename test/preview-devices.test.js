import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { resolveConfig } from "../lib/src/config/resolveConfig.js";

//------------------------------------------------------------------------------
const resolve = (config) => resolveConfig(config, "/p/mailgrail.config.ts", "/p");

//------------------------------------------------------------------------------
describe("resolveConfig previewDevices", () => {
  test("unset gives a desktop, a tablet and a phone", () => {
    assert.deepEqual(resolve({}).previewDevices, [
      { type: "desktop", label: "Desktop", width: null },
      { type: "tablet", label: "Tablet", width: 768 },
      { type: "mobile", label: "Mobile", width: 375 },
    ]);
  });

  test("keeps the configured devices, in order, labelled by type", () => {
    const c = resolve({
      previewDevices: [
        { type: "mobile", width: 320, label: "iPhone SE" },
        { type: "mobile", width: 414 },
        { type: "desktop" },
      ],
    });
    assert.deepEqual(c.previewDevices, [
      { type: "mobile", label: "iPhone SE", width: 320 },
      { type: "mobile", label: "Mobile", width: 414 },
      { type: "desktop", label: "Desktop", width: null },
    ]);
  });

  test("rejects an empty list", () => {
    assert.throws(() => resolve({ previewDevices: [] }), /at least one device/);
  });

  test("rejects an unknown type", () => {
    assert.throws(
      () => resolve({ previewDevices: [{ type: "watch", width: 200 }] }),
      /previewDevices\[0\]\.type must be one of/,
    );
  });

  test("rejects a width on a desktop", () => {
    assert.throws(
      () => resolve({ previewDevices: [{ type: "desktop", width: 1200 }] }),
      /previewDevices\[0\] is a desktop/,
    );
  });

  test("requires a positive whole width on other types", () => {
    for (const width of [undefined, 0, -375, 375.5, "375"]) {
      assert.throws(
        () => resolve({ previewDevices: [{ type: "mobile", width }] }),
        /previewDevices\[0\]\.width must be a positive whole number/,
      );
    }
  });

  test("rejects a blank label", () => {
    assert.throws(
      () => resolve({ previewDevices: [{ type: "desktop", label: " " }] }),
      /previewDevices\[0\]\.label/,
    );
  });
});
