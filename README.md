# oats-dev

Official OATS-project development policy package. The distribution package
`oats.dev` exports one capability, `oats.review`, which keeps its own identity
and version: the code-review and security-review skills and the developer
delivery discipline injected into the souls that select it. The ephemeral
reviewer is the package's soul `reviewer` (`souls/reviewer/`, since 1.1.0; it
was a capability-defined agent before OATS 0.29.0 removed them).

`oats.dev` is for contributors and maintainers working on the OATS project. A
workspace gets it only by declaring it; nothing applies it implicitly.
Requires OATS `>=0.28.0` (package souls). The vendored schemas are
described in [`SCHEMA-STATUS.md`](SCHEMA-STATUS.md).

## Declare and select

Declaring the package in the workspace file's `packages:` is the decision to
trust it, and `oats sync` locks it to an exact commit and integrity. Nothing is
installed, and the package carries no config to adopt.

```yaml
# oats-workspace.yaml
packages:
  oats.dev: v1.1.0
```

A developer soul selects the review discipline:

```yaml
# souls/<name>/soul.yaml
capabilities:
  oats.review: { from: package }
```

(or `defaults.capabilities: { oats.review: { from: package } }` in the
workspace file, for every soul). Knowledge, messaging and authoring are the
workspace's own choices — declare `oats.okf`, `oats.aweb` and `oats.authoring`
in `packages:` and fill the slots in `defaults:` as for any workspace.

```bash
oats sync --dir <deployment>
oats spawn <soul> --preview    # modules include oats.review
```

The capability has no commands or lifecycle hooks. The reviewer soul is
spawned by the developer (`oats spawn reviewer --work attached`, or by its
qualified name `oats.dev/reviewer`), reads `oats.review` from this package
(`from: here`), carries no knowledge slot, and reports its verdict to its
spawner over the deployment's messaging layer, or in its transcript when there
is none. A soul declares no harness or model: the spawner's launch
configuration chooses them.

## Development

```bash
npm test
```

This validates both manifests, the package soul, resource containment and the
reviewer contract.
