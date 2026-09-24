import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { extractCatalogs } from "../lib/src/cli/extract.js";

//------------------------------------------------------------------------------
const SOURCES = [
  { id: "c.welcome", defaultMessage: "Welcome, {name}!" },
  { id: "c.bye", defaultMessage: "Bye" },
];

let dir;
const config = () => ({
  locales: ["en", "fr"],
  defaultLocale: "en",
  localesDir: dir,
});
const read = async (locale) =>
  fs.readFile(path.join(dir, `${locale}.json`), "utf8");

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "mailgrail-extract-"));
});

//------------------------------------------------------------------------------
describe("extractCatalogs", () => {
  test("creates the source catalog and empty translations, sorted", async () => {
    const [report] = await extractCatalogs(config(), SOURCES, false);

    assert.equal(
      await read("en"),
      `{\n  "c.bye": "Bye",\n  "c.welcome": "Welcome, {name}!"\n}\n`,
    );
    assert.equal(await read("fr"), `{\n  "c.bye": "",\n  "c.welcome": ""\n}\n`);
    assert.deepEqual(report, {
      locale: "fr",
      added: 2,
      pruned: 0,
      untranslated: 2,
      stale: 0,
    });
  });

  test("keeps translations, and stale keys unless pruning", async () => {
    await fs.writeFile(
      path.join(dir, "fr.json"),
      JSON.stringify({ "c.welcome": "Bienvenue, {name} !", "c.old": "Vieux" }),
    );

    let [report] = await extractCatalogs(config(), SOURCES, false);
    let fr = JSON.parse(await read("fr"));
    assert.equal(fr["c.welcome"], "Bienvenue, {name} !");
    assert.equal(fr["c.old"], "Vieux");
    assert.equal(report.stale, 1);

    [report] = await extractCatalogs(config(), SOURCES, true);
    fr = JSON.parse(await read("fr"));
    assert.ok(!("c.old" in fr));
    assert.equal(report.pruned, 1);
  });

  test("a malformed catalog stops before anything is written", async () => {
    await fs.writeFile(path.join(dir, "fr.json"), "{ nope");

    await assert.rejects(extractCatalogs(config(), SOURCES, false), /not valid JSON/);
    await assert.rejects(read("en"), { code: "ENOENT" });
  });
});
