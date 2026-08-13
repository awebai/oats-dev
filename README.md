# oats-dev

Official OATS-project development policy package. It combines:

- the independently targetable `oats.review@1.2.0` capability, including its ephemeral reviewer and code/security review skills; and
- a reference `default` workspace profile for developing OATS itself, with framework-author, developer, and official-package-maintainer agent families.

The distribution package is `oats.dev@1.0.0`; the inner capability intentionally keeps its separate `oats.review@1.2.0` identity and version.

## Not part of default init

`oats.dev` is for contributors and maintainers working on the OATS project. It is **not** part of OATS's default initialization profile and must never be applied implicitly.

The profile recommends OATS knowledge and messaging integrations plus authoring/review policy. Its dependency closure is pinned to the immutable official selectors `oats.okf@v1.4.1`, `oats.aweb@v1.8.0`, and `oats.authoring@v1.0.0`; Jira and Linear remain adopter-selected. `oats.dev` publishes last, after those dependencies. See [`SCHEMA-STATUS.md`](SCHEMA-STATUS.md).

## Set up an OATS development workspace (the profile IS the setup)

The `oats.dev` default profile is the **complete** OATS development config — the
portable form of the framework repo's own config plus the package-maintainer
extensions — not an illustrative snippet. Setting up a fresh non-Git
development root is two package-native steps; there is no manual config
assembly:

```bash
# 1. Acquire + lock oats.dev and its full closure, validate the profile against
#    those providers, and snapshot the COMPLETE profile as the root config.
oats init --package oats.dev --config default --dir /path/to/oats-workspace
# Until the kernel catalog patch is installed, the equivalent explicit source is:
# https://github.com/awebai/oats-dev.git@v1.0.0
# with OATS_PACKAGE_CATALOG pointing at the released dependency catalog.

# 2. Restore/reconcile the locked closure and nested repo scopes; host/runtime
#    requirements (aweb `aw`; pi/claude channel) are reported for separate
#    consent — install activates and installs nothing on its own.
oats install --dir /path/to/oats-workspace
```

The closure is `oats.dev` (which exports `oats.review`) plus dependencies
supplying `oats.okf`, `oats.aweb`, and `oats.authoring`. Adoption is explicit and
refuses to overwrite an existing config; the resulting `oats-config.yaml` is an
ordinary local snapshot. Jira/Linear stay absent (tasks `none`) unless the
adopter adds a tasks provider.

The profile defines:

- `framework-authors`: `oats.authoring`;
- `developers`: `oats.review`;
- `package-maintainers`: both `oats.authoring` and `oats.review`;
- knowledge through `oats.okf`, messaging through `oats.aweb`, and tasks explicitly `none`;
- the worktree work-mode and default OATS policy.

Adopted at the non-Git development root, the profile's resolved behavior **inside
the child `oats/` framework repo** mirrors that repository's historical
`oats-config.yaml` for the `framework-authors` and `developers` families, plus the
approved `package-maintainers` extensions. A closer child-repository config is
only for **truly repo-specific** policy that cannot sensibly apply to sibling
packages — the framework instruction injection (`injects/framework-workspace.md`)
stays in the `oats/` repo so it never reaches sibling package experts and its
repo-relative path always resolves. It is **not** for reconstructing common OATS
development policy. Every preserved behavior and every intentional delta
(deployment-specific team id/credentials/paths, the rename, explicit messaging,
the maintainer family, released provenance) is documented in [`PARITY.md`](PARITY.md).

The end-to-end non-Git consumer acceptance test
(`scripts/consumer-acceptance.mjs`) exercises the whole sequence against a
published OATS ≥ 0.19.0 kernel — `oats init --package` → v2 lock graph → adopted
complete root config → bare `oats install` → expected providers/targets via
`oats doctor` → nested `oats/` override → cutover check — and fails closed
(release-pending) below the floor. Its kernel-free structural half
(`test/oats-dev-consumer.test.mjs`) runs today.

## Acquire or activate review independently

The inner review capability remains independently targetable after its provider package is acquired:

```bash
oats install oats.dev --dir /path/to/scope
oats use oats.review --type developers --dir /path/to/scope
oats doctor /path/to/scope --soul <developer-soul>
```

The capability has no commands or lifecycle hooks, so it does not require executable trust. Its reviewer uses the deployment's configured messaging layer to deliver verdicts.

## Development

```bash
npm test
```

The package-local gates validate both manifests, resource containment, the reviewer contract, the exact profile target matrix, and a child-repository override fixture. The released OATS 0.19.0 consumer probe and immutable dependency pins remain external release gates.
