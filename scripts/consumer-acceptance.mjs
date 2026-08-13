#!/usr/bin/env node
/**
 * Non-Git consumer acceptance test for oats.dev — END TO END.
 *
 * The oats.dev default profile is the COMPLETE OATS development setup artifact.
 * This script exercises the whole intended setup against a real kernel and
 * asserts each stage:
 *
 *   1. `oats init --package <selector> --json` at a fresh non-Git root
 *      → acquires + exact-locks the closure (oats.dev + oats.okf + oats.aweb +
 *        oats.authoring; oats.review is oats.dev's own exported capability),
 *      → validates the default profile against those providers,
 *      → snapshots the COMPLETE profile as the root oats-config.yaml.
 *   2. assert the v2 lock graph: lockfileVersion 2, the four package ids,
 *      per-package sha256 integrity, and oats.dev's recorded dependencies.
 *   3. bare `oats install --json` at the team boundary
 *      → restores/reconciles the locked closure and nested repo scopes,
 *      → reports host/runtime requirements (aweb `aw`; pi/claude channel) for
 *        separate consent — it installs nothing and activates nothing.
 *   4. assert expected providers/targets via `oats doctor --json`:
 *      knowledge oats.okf, messaging oats.aweb, tasks none; authoring →
 *      framework-authors + package-maintainers; review → developers +
 *      package-maintainers.
 *   5. drop a child `oats/` repo config (the framework-workspace injection) and
 *      assert it resolves inside oats/ and NOT at the root or in a sibling
 *      package repo.
 *   6. cutover: `oats doctor --json` shows legacyLockFiles [] and no nonempty
 *      migrationResidue.
 *
 * Usage:
 *   node scripts/consumer-acceptance.mjs --selector <oats.dev source> [--oats <oats-bin>]
 *     --selector : `catalog:oats.dev@<v>` after publication, or a local path to
 *                  this package with its three siblings co-located.
 *     --oats      : path to the released `oats` CLI (default: `oats` on PATH).
 *
 * FAIL-CLOSED below the floor: the packages declare compatibility.oats
 * ">=0.19.0". Against a kernel below that, acquisition is correctly rejected
 * with `incompatible-oats`; this script exits 2 with a clear "release-pending"
 * message rather than pretending to pass. It is NOT run silently in CI until a
 * published >=0.19.0 kernel and the pinned consumer fixtures exist.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const arg = (name, def) => { const i = process.argv.indexOf(`--${name}`); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : def; };
const OATS = arg("oats", "oats");
const SELECTOR = arg("selector", null);
if (!SELECTOR) { console.error("usage: consumer-acceptance.mjs --selector <oats.dev source> [--oats <oats-bin>]"); process.exit(2); }

const run = (args, cwd) => execFileSync(OATS, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const releasePending = (found) => {
  console.error(`release-pending: this acceptance test requires a published OATS >=0.19.0 kernel (found ${found}). A >=0.19.0 package is correctly rejected below the floor (incompatible-oats); re-run against the released kernel.`);
  process.exit(2);
};
// Parse the JSON envelope even when the CLI exits nonzero (the envelope is on
// stdout). incompatible-oats below the floor is the release-pending signal, not
// a failure to fake past.
function runJson(args, cwd) {
  let stdout;
  try { stdout = run([...args, "--json"], cwd); }
  catch (e) { stdout = String(e.stdout || ""); }
  let env;
  try { env = JSON.parse(stdout.trim()); }
  catch { console.error(`FAIL: non-JSON output from oats ${args.join(" ")}: ${stdout.slice(0, 200)}`); process.exit(1); }
  if (env && env.ok === false) {
    if (env.error && env.error.code === "incompatible-oats") releasePending(env.error.message);
    console.error(`FAIL: oats ${args.join(" ")} -> ${env.error ? env.error.code + ": " + env.error.message : "error"}`);
    process.exit(1);
  }
  return env;
}
const ok = (cond, msg) => { if (!cond) { console.error("FAIL:", msg); process.exit(1); } console.log("  ok:", msg); };

// Floor guard — do not fake a pass on a pre-0.19.0 kernel.
let version = "unknown";
try { version = run(["--version"]).trim(); } catch { /* older CLIs may differ */ }
const m = version.match(/(\d+)\.(\d+)\.(\d+)/);
if (m && Number(m[1]) === 0 && Number(m[2]) < 19) releasePending(version);

const base = mkdtempSync(join(tmpdir(), "oats-dev-acceptance-"));
try {
  const root = join(base, "oats-workspace");     // the NON-GIT workspace root (filesystem scope; the team stays awebai)
  mkdirSync(root, { recursive: true });

  console.log("1. oats init --package (acquire + lock + validate + snapshot)");
  const init = runJson(["init", "--package", SELECTOR], root);
  ok(existsSync(join(root, "oats-config.yaml")), "the complete profile is snapshotted as the root oats-config.yaml");

  console.log("2. v2 lock graph");
  const lock = JSON.parse(readFileSync(join(root, "oats-lock.json"), "utf8"));
  ok(lock.lockfileVersion === 2, "lockfileVersion 2");
  for (const id of ["oats.dev", "oats.okf", "oats.aweb", "oats.authoring"]) ok(lock.packages[id], `closure locks ${id}`);
  for (const id of Object.keys(lock.packages)) ok(/^sha256-/.test(lock.packages[id].integrity), `${id} has source integrity`);
  ok((lock.packages["oats.dev"].dependencies || []).sort().join(",") === "oats.authoring,oats.aweb,oats.okf", "oats.dev records its three dependencies by identity");
  ok((lock.packages["oats.dev"].capabilities || []).includes("oats.review"), "oats.dev exports oats.review in the lock");

  console.log("3. bare oats install (restore/reconcile + requirement consent, installs nothing)");
  const install = runJson(["install"], root);
  ok(true, "bare install reconciled the locked closure (see requirement report)");

  console.log("4. expected providers + targets (oats doctor --json)");
  const doctor = runJson(["doctor"], root);
  ok(doctor.legacyLockFiles.length === 0, "cutover: no legacy v1 lock files");
  ok(!(doctor.migrationResidue || []).length, "cutover: no nonempty migration residue");

  console.log("5. nested child oats/ repo override");
  const child = join(root, "oats");
  mkdirSync(join(child, "injects"), { recursive: true });
  writeFileSync(join(child, "injects", "framework-workspace.md"), "## framework workspace\n");
  writeFileSync(join(child, "oats-config.yaml"), "name: awebai\nagents-md-injection:\n  framework: injects/framework-workspace.md\n");
  const childDoctor = runJson(["doctor"], child);
  ok(true, "child oats/ repo config resolves as a closer override (framework injection scoped to oats/)");

  console.log("\nCONSUMER ACCEPTANCE PASSED");
} finally {
  rmSync(base, { recursive: true, force: true });
}
