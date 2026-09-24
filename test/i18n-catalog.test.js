import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { validateCatalogs, CatalogError } from "../lib/src/i18n/catalog.js";
import {
  defineMessages,
  registeredMessages,
  clearRegisteredMessages,
  assertNoMessageConflicts,
} from "../lib/src/i18n/messages.js";

//------------------------------------------------------------------------------
const SOURCES = [
  { id: "c.welcome", defaultMessage: "Welcome, {name}!" },
  { id: "c.items", defaultMessage: "{count, plural, one {# item} other {# items}}" },
  { id: "c.terms", defaultMessage: "Read our <link>terms</link>." },
];

const OPTS = { locales: ["en", "fr", "pl"], defaultLocale: "en", strict: false };

function run(catalogs, opts = OPTS, sources = SOURCES) {
  return validateCatalogs(sources, new Map(Object.entries(catalogs)), opts);
}

function problems(fn) {
  try {
    fn();
  } catch (err) {
    assert.ok(err instanceof CatalogError, err.message);
    return err.problems.join("\n");
  }
  assert.fail("expected a CatalogError");
}

const FR = {
  "c.welcome": "Bienvenue, {name} !",
  "c.items": "{count, plural, one {# article} many {# d’articles} other {# articles}}",
  "c.terms": "Lisez nos <link>conditions</link>.",
};
const PL = {
  "c.welcome": "Witaj, {name}!",
  "c.items":
    "{count, plural, one {# przedmiot} few {# przedmioty} many {# przedmiotów} other {# przedmiotu}}",
  "c.terms": "Przeczytaj <link>regulamin</link>.",
};

//------------------------------------------------------------------------------
describe("validateCatalogs", () => {
  test("complete catalogs pass cleanly", () => {
    const r = run({ fr: FR, pl: PL });
    assert.deepEqual(r.warnings, []);
    assert.deepEqual(r.coverage.get("fr"), { translated: 3, total: 3 });
    assert.equal(r.messages.get("pl").size, 3);
  });

  test("ICU syntax errors always fail, with locale and id", () => {
    const p = problems(() =>
      run({ fr: { ...FR, "c.welcome": "Bienvenue, {name !" }, pl: PL }),
    );
    assert.match(p, /fr c\.welcome: invalid ICU message/);
  });

  test("`other` is required", () => {
    const p = problems(() =>
      run({ fr: { ...FR, "c.items": "{count, plural, one {# article}}" }, pl: PL }),
    );
    assert.match(p, /need an `other` branch/);
  });

  test("an argument the source lacks fails", () => {
    const p = problems(() =>
      run({ fr: { ...FR, "c.welcome": "Bienvenue, {nom} !" }, pl: PL }),
    );
    assert.match(p, /uses argument `nom`/);
  });

  test("a tag the source lacks fails", () => {
    const p = problems(() =>
      run({ fr: { ...FR, "c.terms": "Lisez nos <a>conditions</a>." }, pl: PL }),
    );
    assert.match(p, /uses tag `a`/);
  });

  test("dropping a source argument only warns", () => {
    const r = run({ fr: { ...FR, "c.welcome": "Bienvenue !" }, pl: PL });
    assert.match(r.warnings.join("\n"), /does not use argument `name`/);
  });

  test("a missing key falls back to the source, or fails when strict", () => {
    const { "c.terms": _, ...partial } = FR;

    const r = run({ fr: partial, pl: PL });
    assert.match(r.warnings.join("\n"), /fr\.json is missing 1 translation: c\.terms/);
    assert.deepEqual(r.messages.get("fr").get("c.terms"), r.messages.get("en").get("c.terms"));
    assert.deepEqual(r.coverage.get("fr"), { translated: 2, total: 3 });

    assert.match(
      problems(() => run({ fr: partial, pl: PL }, { ...OPTS, strict: true })),
      /missing 1 translation/,
    );
  });

  test("an empty string counts as missing", () => {
    const r = run({ fr: { ...FR, "c.terms": "" }, pl: PL });
    assert.deepEqual(r.coverage.get("fr"), { translated: 2, total: 3 });
  });

  test("a missing catalog file warns, or fails when strict", () => {
    const r = run({ fr: FR, pl: null });
    assert.match(r.warnings.join("\n"), /pl\.json does not exist/);
    assert.equal(r.messages.get("pl").size, 3);

    assert.match(
      problems(() => run({ fr: FR, pl: null }, { ...OPTS, strict: true })),
      /pl\.json does not exist/,
    );
  });

  test("plural categories the locale needs are checked", () => {
    const englishShaped = { ...PL, "c.items": "{count, plural, one {# przedmiot} other {# przedmiotu}}" };

    const r = run({ fr: FR, pl: englishShaped });
    assert.match(r.warnings.join("\n"), /pl c\.items: plural `count` has no few, many branch/);

    assert.match(
      problems(() => run({ fr: FR, pl: englishShaped }, { ...OPTS, strict: true })),
      /no few, many branch/,
    );
  });

  test("stale keys warn", () => {
    const r = run({ fr: { ...FR, "c.gone": "Parti" }, pl: PL });
    assert.match(r.warnings.join("\n"), /fr c\.gone: no source message has this id/);
  });

  test("a non-string value fails", () => {
    assert.match(problems(() => run({ fr: { ...FR, "c.terms": 3 }, pl: PL })), /must be a string/);
  });

  test("text is NFC-normalized, and invisible characters are reported", () => {
    const decomposed = "Bienvenue, {name} ! Cafe\u0301";
    const r = run({ fr: { ...FR, "c.welcome": decomposed + "\u200B" }, pl: PL });

    const literal = r.messages.get("fr").get("c.welcome").at(-1).value;
    assert.ok(literal.includes("Café"), literal);
    assert.match(r.warnings.join("\n"), /zero-width space/);
  });
});

//------------------------------------------------------------------------------
describe("defineMessages", () => {
  test("builds namespaced ids and registers them", () => {
    clearRegisteredMessages();
    const m = defineMessages("confirm-email", { welcome: "Hi {name}" });

    assert.deepEqual(m.welcome, { id: "confirm-email.welcome", defaultMessage: "Hi {name}" });
    assert.deepEqual(registeredMessages(), [
      { id: "confirm-email.welcome", defaultMessage: "Hi {name}" },
    ]);
  });

  test("re-registering the same text is fine, different text is a conflict", () => {
    clearRegisteredMessages();
    defineMessages("n", { a: "A" });
    defineMessages("n", { a: "A" });
    assertNoMessageConflicts();

    // Recorded rather than thrown, since a module re-running after an edit in
    // the preview does the same thing; the newest text wins meanwhile.
    defineMessages("n", { a: "B" });
    assert.equal(registeredMessages()[0].defaultMessage, "B");
    assert.throws(() => assertNoMessageConflicts(), /defined twice with different text: "n\.a"/);

    clearRegisteredMessages();
    assertNoMessageConflicts();
  });

  test("rejects keys that would make ambiguous ids", () => {
    assert.throws(() => defineMessages("n", { "a.b": "x" }), /key "a\.b"/);
    assert.throws(() => defineMessages("bad ns", { a: "x" }), /namespace/);
  });
});
