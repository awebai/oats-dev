import assert from "node:assert/strict";
import { lstatSync, readFileSync, readlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../oats-package", import.meta.url)));
const CAPABILITY = join(ROOT, "capabilities", "oats-review");
const SOUL = join(ROOT, "souls", "reviewer");
const read = (...parts) => readFileSync(join(CAPABILITY, ...parts), "utf8");
const readSoul = (file) => readFileSync(join(SOUL, file), "utf8");

test("the reviewer is this package's soul: ephemeral, no knowledge slot, the review capability from its own package", () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, "oats-package.json"), "utf8"));
  assert.deepEqual(pkg.souls, ["souls/reviewer"]);
  const soul = readSoul("soul.yaml");
  assert.match(soul, /^schemaVersion: 2$/m);
  assert.match(soul, /^name: reviewer$/m);
  assert.match(soul, /^work: directory$/m, "spawned --work attached by the developer; a soul declares no attached default");
  assert.match(soul, /^knowledge: none$/m);
  assert.match(soul, /^ {2}oats\.review: \{ from: here \}$/m);
  assert.equal(lstatSync(join(SOUL, "CLAUDE.md")).isSymbolicLink() && readlinkSync(join(SOUL, "CLAUDE.md")), "AGENTS.md");
  // Capability-defined agents were removed in OATS 0.29.0.
  assert.equal(Object.hasOwn(JSON.parse(read("oats.json")), "agents"), false);
});

test("reviewer operating loop requires both packaged review skills", () => {
  const instructions = readSoul("AGENTS.md");
  assert.match(instructions, /code-review/);
  assert.match(instructions, /security-review/);
  assert.match(instructions, /Verdict first: `APPROVE`, `APPROVE WITH NITS`, or `NEEDS CHANGES`/);
  // Delivery is messaging-layer-agnostic: report to the spawner over whatever
  // messaging layer is active, with a transcript fallback when none is.
  assert.match(instructions, /Deliver the report \*\*to your spawner\*\*/);
  assert.match(instructions, /parentInstance/);
  assert.match(instructions, /If a messaging layer is active/);
  assert.doesNotMatch(instructions, /aw mail|aweb/);
  // Layer-neutral: no unconditional command of a messaging or knowledge layer, and the
  // no-layer paragraph itself defines transcript delivery.
  assert.doesNotMatch(instructions, /\baw\b/i);
  assert.doesNotMatch(instructions, /\boats okf\b/i);
  const noLayer = instructions.split(/\n\s*\n/).find((para) => /none is active/i.test(para));
  assert.ok(noLayer && /print the full report as your final message/i.test(noLayer) && /transcript/i.test(noLayer));
  assert.match(instructions, /oats retire <your-instance> --self/);
  assert.match(instructions, /Never edit the work tree/);
});

test("packaged skill names match their directories", () => {
  for (const name of ["code-review", "security-review"]) {
    const skill = read("skills", name, "SKILL.md");
    assert.match(skill, new RegExp(`^---\\nname: ${name}\\n`));
    assert.match(skill, /description:/);
  }
});

test("developer injection preserves paired harvest and reviewer discipline", () => {
  const injection = read("injects", "review.md");
  assert.match(injection, /After every substantive commit, launch the reviewer/);
  // Knowledge promotion is a layer-agnostic placeholder, not a named command.
  assert.match(injection, /<your knowledge layer's promotion command>/);
  assert.doesNotMatch(injection, /aw mail|aweb/);
  assert.match(injection, /oats spawn reviewer --work attached/);
  assert.match(injection, /Multi-developer features/);
});
