#!/usr/bin/env node
import { existsSync, lstatSync, readFileSync, readlinkSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

// Repo root holds dev tooling (scripts/, schemas/); the DISTRIBUTED package
// payload lives in the `oats-package/` subtree. Manifests and their resources
// are validated against the payload root; the containment boundary is the
// payload root, never the repo root (contract: repo-only tooling is not
// installed bytes and must never be reachable from a package resource path).
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = join(repoRoot, "oats-package");
const errors = [];
const report = (path, message) => errors.push(`${path}: ${message}`);
const readJson = (path) => {
  try { return JSON.parse(readFileSync(path, "utf8")); }
  catch (error) { report(relative(root, path), `invalid JSON (${error.message})`); return undefined; }
};

function validateSchema(value, schema, at) {
  if (!schema || typeof schema !== "object") return;
  if (schema.enum && !schema.enum.some((item) => Object.is(item, value))) report(at, `must be one of ${schema.enum.join(", ")}`);
  const actual = Array.isArray(value) ? "array" : value === null ? "null" : typeof value;
  if (schema.type && actual !== schema.type) { report(at, `must be ${schema.type}, got ${actual}`); return; }
  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) report(at, `must contain at least ${schema.minLength} character(s)`);
    if (schema.pattern && !(new RegExp(schema.pattern)).test(value)) report(at, `must match ${schema.pattern}`);
    if (schema.not?.pattern && (new RegExp(schema.not.pattern)).test(value)) report(at, `must not match ${schema.not.pattern}`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) report(at, `must contain at least ${schema.minItems} item(s)`);
    if (schema.uniqueItems && new Set(value.map((item) => JSON.stringify(item))).size !== value.length) report(at, "must contain unique items");
    value.forEach((item, index) => validateSchema(item, schema.items, `${at}[${index}]`));
  }
  if (value && actual === "object") {
    for (const key of schema.required || []) if (!(key in value)) report(at, `missing required property ${key}`);
    const properties = schema.properties || {};
    for (const [key, item] of Object.entries(value)) {
      if (schema.propertyNames?.pattern && !(new RegExp(schema.propertyNames.pattern)).test(key)) report(`${at}.${key}`, `property name must match ${schema.propertyNames.pattern}`);
      if (properties[key]) validateSchema(item, properties[key], `${at}.${key}`);
      else if (schema.additionalProperties === false) report(`${at}.${key}`, "unknown property");
      else if (schema.additionalProperties && typeof schema.additionalProperties === "object") validateSchema(item, schema.additionalProperties, `${at}.${key}`);
    }
  }
}

function safeResource(base, candidate, at, kind = "path") {
  if (typeof candidate !== "string" || !candidate.trim()) { report(at, `${kind} must be a non-empty string`); return; }
  if (isAbsolute(candidate) || candidate.split(/[\\/]+/).includes("..")) { report(at, `${kind} must be package-relative and may not contain '..'`); return; }
  const target = resolve(base, candidate);
  if (!existsSync(target)) { report(at, `${kind} does not exist: ${candidate}`); return; }
  const realRoot = realpathSync(root);
  const realTarget = realpathSync(target);
  if (realTarget !== realRoot && !realTarget.startsWith(realRoot + sep)) report(at, `${kind} escapes the package root after symlink resolution`);
}

const packagePath = join(root, "oats-package.json");
const packageSchemaPath = join(repoRoot, "schemas", "oats-package.schema.json");
const capabilitySchemaPath = join(repoRoot, "schemas", "capability-manifest.schema.json");
const packageManifest = readJson(packagePath);
const packageSchema = readJson(packageSchemaPath);
const capabilitySchema = readJson(capabilitySchemaPath);

if (packageManifest && packageSchema) validateSchema(packageManifest, packageSchema, "oats-package.json");

// Config templates (and their `oats init --package` adoption) are gone in OATS 0.26:
// a workspace declares packages and souls select capabilities; nothing adopts a config.
for (const key of ["configs", "configTemplates"]) {
  if (packageManifest && Object.hasOwn(packageManifest, key)) report(`oats-package.json.${key}`, "config templates were removed in OATS 0.26; a package ships capabilities only");
}

const declaredCapabilities = Array.isArray(packageManifest?.capabilities) ? packageManifest.capabilities : [];
if (declaredCapabilities.length !== 1) {
  report("oats-package.json.capabilities", `official single-capability package must enumerate exactly one capability directory (found ${declaredCapabilities.length})`);
}

const capabilities = [];
for (const [index, capabilityDir] of declaredCapabilities.entries()) {
  safeResource(root, capabilityDir, `oats-package.json.capabilities[${index}]`, "capability directory");
  if (isAbsolute(capabilityDir) || capabilityDir.split(/[\\/]+/).includes("..")) continue;
  const manifestPath = join(root, capabilityDir, "oats.json");
  if (!existsSync(manifestPath)) { report(`oats-package.json.capabilities[${index}]`, `${capabilityDir} has no oats.json`); continue; }
  const manifest = readJson(manifestPath);
  if (!manifest) continue;
  capabilities.push(manifest);
  if (capabilitySchema) validateSchema(manifest, capabilitySchema, `${capabilityDir}/oats.json`);
  const capabilityRoot = dirname(manifestPath);
  for (const [resourceIndex, resource] of (manifest.skills || []).entries()) safeResource(capabilityRoot, resource, `${capabilityDir}/oats.json.skills[${resourceIndex}]`, "skill path");
  if (manifest.inject) safeResource(capabilityRoot, manifest.inject, `${capabilityDir}/oats.json.inject`, "injection path");
  // Capability-defined agents were removed in OATS 0.29.0: an agent ships as a package soul.
  if (Object.hasOwn(manifest, "agents")) report(`${capabilityDir}/oats.json.agents`, "capability-defined agents were removed in OATS 0.29.0; ship the agent as a package soul (souls/<name>/, listed in oats-package.json souls)");
  // A hook may be a plain "entrypoint args" string or the object form
  // { command, required } (only the spawn hook may set required). Commands are
  // always strings. Reduce either to the executable entrypoint for containment.
  const entrypoint = (spec) => {
    const command = typeof spec === "string" ? spec : (spec && typeof spec === "object" ? spec.command : undefined);
    return typeof command === "string" ? command.trim().split(/\s+/)[0] : command;
  };
  for (const [name, command] of Object.entries(manifest.commands || {})) safeResource(capabilityRoot, entrypoint(command), `${capabilityDir}/oats.json.commands.${name}`, "command entrypoint");
  for (const [event, hook] of Object.entries(manifest.hooks || {})) safeResource(capabilityRoot, entrypoint(hook), `${capabilityDir}/oats.json.hooks.${event}`, "hook entrypoint");
  for (const forbidden of ["global", "agent-types", "souls"]) if (forbidden in manifest) report(`${capabilityDir}/oats.json.${forbidden}`, "deployment targeting belongs to config, not a capability manifest");
}

// Package souls (OATS 0.28.0): each an ordinary soul directory — soul.yaml, canonical AGENTS.md
// and the relative CLAUDE.md -> AGENTS.md alias — inside the payload.
const declaredSouls = Array.isArray(packageManifest?.souls) ? packageManifest.souls : [];
for (const [index, soulDir] of declaredSouls.entries()) {
  const at = `oats-package.json.souls[${index}]`;
  safeResource(root, soulDir, at, "soul directory");
  if (typeof soulDir !== "string" || isAbsolute(soulDir) || soulDir.split(/[\\/]+/).includes("..")) continue;
  for (const file of ["soul.yaml", "AGENTS.md"]) if (!existsSync(join(root, soulDir, file))) report(at, `${soulDir} has no ${file}`);
  const alias = join(root, soulDir, "CLAUDE.md");
  let link = null;
  try { link = lstatSync(alias).isSymbolicLink() ? readlinkSync(alias) : null; } catch { link = null; }
  if (link !== "AGENTS.md") report(at, `${soulDir}/CLAUDE.md must be a relative symlink to AGENTS.md`);
}

if (capabilities.length === 1 && packageManifest) {
  const capability = capabilities[0];
  if (packageManifest.package === "oats.dev") {
    const npmVersion = readJson(join(repoRoot, "package.json"))?.version;
    if (packageManifest.version !== npmVersion) report("oats-package.json.version", `oats.dev distribution version ${packageManifest.version} must equal package.json ${npmVersion}`);
    if (capability.capability !== "oats.review") {
      report("oats-package.json.capabilities[0]", "oats.dev must export capability oats.review");
    }
  } else {
    if (packageManifest.package !== capability.capability) report("oats-package.json.package", "single-capability official package ID must equal its capability ID");
    if (packageManifest.version !== capability.version) report("oats-package.json.version", "must start at the extracted capability version");
  }
  if (packageManifest.compatibility?.oats !== capability.compatibility?.oats) report("oats-package.json.compatibility.oats", "must match the staged capability compatibility floor");
}

if (errors.length) {
  process.stderr.write(`Manifest validation failed:\n- ${errors.join("\n- ")}\n`);
  process.exit(1);
}
process.stdout.write(`Validated ${relative(process.cwd(), packagePath) || "oats-package.json"} and ${capabilities.length} capability manifest(s).\n`);
