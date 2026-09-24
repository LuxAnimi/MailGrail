import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  canonicalizeLocales,
  fallbackChain,
  textDirection,
} from "../lib/src/i18n/locale.js";
import { resolveConfig } from "../lib/src/config/resolveConfig.js";

//------------------------------------------------------------------------------
const resolve = (config) => resolveConfig(config, "/p/mailgrail.config.ts", "/p");

//------------------------------------------------------------------------------
describe("canonicalizeLocales", () => {
  test("canonicalizes case", () => {
    assert.deepEqual(canonicalizeLocales(["EN-us", "zh-hant-tw"]), [
      "en-US",
      "zh-Hant-TW",
    ]);
  });

  test("rejects an invalid tag", () => {
    assert.throws(() => canonicalizeLocales(["en_US"]), /not a valid BCP 47/);
  });

  test("rejects a duplicate once canonical", () => {
    assert.throws(() => canonicalizeLocales(["fr-CA", "FR-ca"]), /more than once/);
  });
});

//------------------------------------------------------------------------------
describe("fallbackChain", () => {
  test("truncates most specific first", () => {
    assert.deepEqual(fallbackChain("zh-Hant-TW"), ["zh-Hant-TW", "zh-Hant", "zh"]);
  });

  test("skips single-letter subtags", () => {
    assert.deepEqual(fallbackChain("en-x-pirate"), ["en-x-pirate", "en"]);
  });
});

//------------------------------------------------------------------------------
describe("textDirection", () => {
  for (const [tag, dir] of [
    ["en", "ltr"],
    ["fr-CA", "ltr"],
    ["ar", "rtl"],
    ["he", "rtl"],
    ["fa-IR", "rtl"],
    ["ku-Latn", "ltr"],
  ]) {
    test(`${tag} is ${dir}`, () => assert.equal(textDirection(tag), dir));
  }
});

//------------------------------------------------------------------------------
describe("resolveConfig locales", () => {
  test("unset means localization is off", () => {
    const c = resolve({});
    assert.deepEqual(c.locales, []);
    assert.equal(c.defaultLocale, null);
    assert.equal(c.strictLocales, false);
    assert.equal(c.timeZone, "UTC");
    assert.equal(c.localesDir, "/p/emails-src/locales");
  });

  test("defaultLocale defaults to the first locale", () => {
    const c = resolve({ locales: ["fr", "en"] });
    assert.equal(c.defaultLocale, "fr");
  });

  test("defaultLocale is canonicalized and must be listed", () => {
    assert.equal(
      resolve({ locales: ["en", "fr-CA"], defaultLocale: "FR-ca" }).defaultLocale,
      "fr-CA",
    );
    assert.throws(
      () => resolve({ locales: ["en"], defaultLocale: "fr" }),
      /not one of locales/,
    );
  });

  test("defaultLocale without locales is an error", () => {
    assert.throws(() => resolve({ defaultLocale: "en" }), /locales is empty/);
  });

  test("timeZone is validated", () => {
    assert.equal(resolve({ timeZone: "America/Montreal" }).timeZone, "America/Montreal");
    assert.throws(() => resolve({ timeZone: "Mars/Olympus" }), /not a time zone/);
  });

  test("localesDir resolves against the project", () => {
    assert.equal(resolve({ localesDir: "i18n" }).localesDir, "/p/i18n");
  });
});
