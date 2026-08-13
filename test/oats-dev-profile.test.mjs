import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  PUBLISHED_FORM,
  SELECTOR_MAP,
  applyCatalogForm,
  catalogSelectors,
  checkPublishedForm,
} from "../scripts/catalog-selectors.mjs";

const REPO = resolve(fileURLToPath(new URL("..", import.meta.url)));
const ROOT = join(REPO, "oats-package");
const PROFILE = readFileSync(join(ROOT, "configs", "default", "oats-config.yaml"), "utf8");
const CHILD = readFileSync(join(REPO, "test", "fixtures", "child-oats-config.yaml"), "utf8");

function indentedBlock(text, heading, indent) {
  const lines = text.split("\n");
  const prefix = " ".repeat(indent);
  const start = lines.findIndex((line) => line === `${prefix}${heading}:`);
  assert.notEqual(start, -1, `missing ${heading} block`);
  const body = [];
  for (const line of lines.slice(start + 1)) {
    if (line && !line.startsWith(prefix + "  ")) break;
    body.push(line);
  }
  return body.join("\n");
}

test("distribution and capability identities remain independently versioned", () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, "oats-package.json"), "utf8"));
  const capability = JSON.parse(readFileSync(join(ROOT, "capabilities", "oats-review", "oats.json"), "utf8"));
  assert.equal(pkg.package, "oats.dev");
  assert.equal(pkg.version, "1.0.0");
  assert.deepEqual(pkg.capabilities, ["capabilities/oats-review"]);
  assert.equal(capability.capability, "oats.review");
  assert.equal(capability.version, "1.2.0");
  assert.equal(pkg.configs.default.path, "configs/default/oats-config.yaml");
  assert.equal(pkg.configs.default.default, true);
  assert.deepEqual(pkg.dependencies, ["oats.okf@v1.4.1", "oats.aweb@v1.8.0", "oats.authoring@v1.0.0"]);
  // No literal placeholder ever ships in the manifest.
  assert.doesNotMatch(JSON.stringify(pkg.dependencies), /TODO|pin-at-publication|placeholder/i);
});

test("dependencies use the immutable published catalog-selector form", () => {
  const { deps, selectors } = checkPublishedForm();
  assert.deepEqual(deps, PUBLISHED_FORM);
  assert.deepEqual(deps, ["oats.okf@v1.4.1", "oats.aweb@v1.8.0", "oats.authoring@v1.0.0"]);
  assert.deepEqual(selectors, deps);
});

test("catalog-selector replacement is deterministic (not a TODO)", () => {
  // The publication swap is fully specified by scripts/catalog-selectors.mjs:
  // each local path -> catalog id, version read from the sibling release.
  const selectors = catalogSelectors({ verifySibling: false });
  const byId = Object.fromEntries(selectors.map((s) => [s.split("@")[0], s.split("@")[1]]));
  assert.deepEqual(Object.keys(byId).sort(), ["oats.authoring", "oats.aweb", "oats.okf"]);
  for (const s of selectors) assert.match(s, /^oats\.[a-z]+@v\d+\.\d+\.\d+$/);
  // Jira/Linear are adopter-selected, never oats.dev dependencies.
  assert.deepEqual(SELECTOR_MAP.map((e) => e.catalog).sort(), ["oats.authoring", "oats.aweb", "oats.okf"]);
  // Applying the gate (dry run) yields exactly those catalog selectors and drops
  // the local form; identity/version/profile are untouched.
  const { selectors: applied, text } = applyCatalogForm({ write: false });
  assert.deepEqual(applied, selectors);
  const rewritten = JSON.parse(text);
  assert.deepEqual(rewritten.dependencies, selectors);
  assert.equal(rewritten.package, "oats.dev");
  assert.equal(rewritten.version, "1.0.0");
});

test("default profile is generic OATS development policy", () => {
  assert.match(PROFILE, /^name: awebai$/m);
  assert.match(PROFILE, /^team:\n  name: awebai$/m);
  assert.doesNotMatch(PROFILE, /\bteam\.id\b|^\s+id:|TODO|\/Users\/|credentials?|secrets?|souls?:/mi);
  for (const type of ["framework-authors", "developers", "package-maintainers"]) {
    assert.match(PROFILE, new RegExp(`^  ${type}:$`, "m"));
  }
  assert.match(PROFILE, /Experts that own an official OATS package's vision, implementation, maintenance, releases, and support/);
  assert.match(indentedBlock(PROFILE, "knowledge", 4), /capability: oats\.okf\n      from: installed/);
  assert.match(indentedBlock(PROFILE, "messaging", 4), /capability: oats\.aweb\n      from: installed/);
  assert.match(PROFILE, /^    tasks: none$/m);
});

test("profile targets authoring and review to the required agent families", () => {
  const authoring = indentedBlock(PROFILE, "oats.authoring", 4);
  const review = indentedBlock(PROFILE, "oats.review", 4);
  assert.match(authoring, /framework-authors: true/);
  assert.match(authoring, /package-maintainers: true/);
  assert.doesNotMatch(authoring, /developers: true/);
  assert.match(review, /developers: true/);
  assert.match(review, /package-maintainers: true/);
  assert.doesNotMatch(review, /framework-authors: true/);
});

test("child repository fixture can override every inherited provider", () => {
  assert.match(CHILD, /^    knowledge: none$/m);
  assert.match(CHILD, /^    messaging: none$/m);
  const authoring = indentedBlock(CHILD, "oats.authoring", 4);
  const review = indentedBlock(CHILD, "oats.review", 4);
  assert.match(authoring, /framework-authors: false/);
  assert.match(authoring, /package-maintainers: false/);
  assert.match(review, /developers: false/);
  assert.match(review, /package-maintainers: false/);
});
