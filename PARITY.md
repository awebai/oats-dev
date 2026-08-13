# oats.dev default profile — resolved-config parity with the framework repo

The `oats.dev` default profile is not a minimal illustration. Adopted as an
editable snapshot at a non-Git development workspace root, its resolved behavior
**inside the child `oats/` framework repo** mirrors the framework repository's
historical `oats-config.yaml` for the existing `framework-authors` and
`developers` families, then adds the approved `package-maintainers` extensions.

It is the **complete setup artifact**: `oats init --package oats.dev` acquires and
locks the closure, validates this profile against the closure providers, and
snapshots it whole as the root `oats-config.yaml`; a bare `oats install` then
reconciles. There is no manual post-adoption assembly. A closer child-repo
config exists only for truly repo-specific policy (the framework injection),
never to reconstruct common OATS development policy. The end-to-end sequence is
exercised by `scripts/consumer-acceptance.mjs` (live, released kernel) and
`test/oats-dev-consumer.test.mjs` (structural, today).

Parity is proven mechanically by `test/oats-dev-parity.test.mjs`, which resolves
three fixtures with a dependency-free config reader and compares the effective
per-family view:

- `test/fixtures/legacy-framework-oats-config.yaml` — the legacy behavioral
  baseline (the framework repo's historical config; the deployment-local team id
  is omitted, and messaging is not declared because it came from the laptop's
  outer config).
- `configs/default/oats-config.yaml` — the shipped portable root profile.
- `test/fixtures/framework-child-oats-config.yaml` — the closer override the
  `oats/` repo keeps after migration.

`adopted = deepMerge(rootProfile, frameworkChild)` is the resolution inside
`oats/`. For `framework-authors` and `developers`, `adopted` equals the legacy
baseline on: knowledge = `oats.okf`, tasks = `none`, authoring → framework
authors, review → developers, worktree work-mode, and the
`injects/framework-workspace.md` instruction injection.

## Preserved (no policy loss)

| Behavior | Legacy | Adopted (root ⊕ oats/ child) |
| --- | --- | --- |
| framework-authors family + intent | present | present (same description) |
| developers family + intent | present | present (same description) |
| knowledge layer | `oats.okf` | `oats.okf` |
| tasks layer | `none` | `none` |
| authoring assignment | framework-authors | framework-authors (+ package-maintainers) |
| review assignment | developers | developers (+ package-maintainers) |
| worktree work-mode | declared | declared |
| default OATS policy (`oats:`) | present | present |
| framework-workspace injection **inside `oats/`** | root config | child `oats/` config (closer) |
| identity/team **name** | `awebai` | `awebai` (preserved — the workspace changes scope, not team identity) |

## Intentional deltas (each approved; none silent)

1. **No machine state in the package** — the resolved provider `team.id` and any account/host path are omitted from the shipped profile; local onboarding/adoption binds the existing provider team identity into the local snapshot only. (`test`: profile has no `id`.) The team NAME `awebai` is retained exactly.
2. **Messaging made explicit** — legacy declared no messaging in-config and
   inherited aweb from the laptop's outer config; the portable root declares
   `messaging: oats.aweb` explicitly. This preserves the *actual* runtime
   behavior (aweb) while removing the dependency on an outer config that does
   not exist at a fresh workspace root.
3. **`package-maintainers` family added** — with the owner description, assigned
   to both `oats.authoring` and `oats.review`.
4. **Released package provenance** — providers resolve `from: installed` from the
   workspace's installed **released** closure (oats.dev's catalog dependency
   selectors `oats.okf@…`, `oats.aweb@…`, `oats.authoring@…`), not the framework's
   bundled in-repo capabilities.

## Layering rule (why the injection stays in the child `oats/` config)

`injects/framework-workspace.md` is specific to the framework repository. It must
**not** be placed in the portable root profile:

- it would apply to every sibling package expert (`oats-okf-expert`, …), which is
  wrong — those experts steward their own repos, not the framework; and
- the path is repo-relative and would not resolve from a non-Git workspace root.

So it lives in the `oats/` repo's own (closer) config. The parity test asserts the
root profile carries no `agents-md-injection`, that the `oats/` child config
carries the framework injection, and that a package expert resolving in a sibling
repo (root profile alone) gets `frameworkInjection = null`. The acceptance
property is *effective parity inside `oats/`*, not copying a repo-relative path
into a root where it cannot resolve or would mis-target siblings.

## Live equivalence at migration time

The fixture comparison is portable and runs in the standalone repo. A live
`oats doctor --json` equivalence check (legacy framework-repo resolution vs
adopted-root + child-repo resolution, with the released capabilities installed)
is part of the post-publication workspace probe — it requires the released
capabilities to be installed in the workspace, so it is run by the operator once
the non-Git workspace is assembled (checklist step B9).
